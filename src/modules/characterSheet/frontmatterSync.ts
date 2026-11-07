import { App, TFile } from 'obsidian';
import { DinoPlugin } from '../../types';

export type ChangeCallback = (data: Record<string, any>) => void;

export class FrontmatterSyncManager {
  private app: App;
  private plugin: DinoPlugin;
  private pendingWrites: Map<string, { timeout: number; values: Record<string, any> }> = new Map();
  private listeners: Map<string, Set<ChangeCallback>> = new Map();

  constructor(app: App, plugin: DinoPlugin) {
    this.app = app;
    this.plugin = plugin;
    this.registerCacheListener();
  }

  private registerCacheListener(): void {
    this.app.metadataCache.on('changed', (file: TFile) => {
      const path = file.path;
      if (this.listeners.has(path)) {
        // If there's an active pending debounce for this file, don't trigger external refresh loop immediately
        if (this.pendingWrites.has(path)) return;
        this.readData(file).then((data) => {
          const cbs = this.listeners.get(path);
          if (cbs) {
            cbs.forEach((cb) => {
              try {
                cb(data);
              } catch (e) {
                console.error('[FrontmatterSync] Listener error:', e);
              }
            });
          }
        });
      }
    });
  }

  /**
   * Subscribe to changes on a character note
   */
  public subscribe(filePath: string, cb: ChangeCallback): () => void {
    if (!this.listeners.has(filePath)) {
      this.listeners.set(filePath, new Set());
    }
    this.listeners.get(filePath)!.add(cb);

    return () => {
      const set = this.listeners.get(filePath);
      if (set) {
        set.delete(cb);
        if (set.size === 0) {
          this.listeners.delete(filePath);
        }
      }
    };
  }

  /**
   * Read all frontmatter and bound heading sections for a file
   */
  public async readData(file: TFile): Promise<Record<string, any>> {
    const cache = this.app.metadataCache.getFileCache(file);
    const fm = { ...(cache?.frontmatter || {}) };

    // Delete internal Obsidian metadata if present
    delete fm['position'];

    return fm;
  }

  /**
   * Read a heading section from the markdown body
   */
  public async readHeadingSection(file: TFile, headingName: string): Promise<string> {
    const content = await this.app.vault.read(file);
    const cleanHeading = headingName.replace(/^#+\s*/, '').trim().toLowerCase();
    
    const lines = content.split('\n');
    let insideTarget = false;
    let targetLevel = 1;
    const resultLines: string[] = [];

    for (const line of lines) {
      const match = line.match(/^(#{1,6})\s+(.*)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2].trim().toLowerCase();

        if (insideTarget) {
          // If we hit another heading of same or higher level (smaller number of #), stop
          if (level <= targetLevel) {
            break;
          }
        }

        if (text === cleanHeading) {
          insideTarget = true;
          targetLevel = level;
          continue;
        }
      }

      if (insideTarget) {
        resultLines.push(line);
      }
    }

    return resultLines.join('\n').trim();
  }

  /**
   * Write or replace a heading section in the markdown body
   */
  public async writeHeadingSection(file: TFile, headingName: string, newText: string): Promise<void> {
    const content = await this.app.vault.read(file);
    const cleanHeading = headingName.replace(/^#+\s*/, '').trim();
    const headingLevel = headingName.startsWith('#') ? (headingName.match(/^#+/)?.[0] || '##') : '##';

    const lines = content.split('\n');
    let insideTarget = false;
    let targetLevel = 1;
    let startIndex = -1;
    let endIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/^(#{1,6})\s+(.*)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2].trim().toLowerCase();

        if (insideTarget) {
          if (level <= targetLevel) {
            endIndex = i;
            break;
          }
        }

        if (text === cleanHeading.toLowerCase()) {
          insideTarget = true;
          targetLevel = level;
          startIndex = i + 1;
        }
      }
    }

    if (insideTarget) {
      if (endIndex === -1) endIndex = lines.length;
      lines.splice(startIndex, endIndex - startIndex, newText);
      await this.app.vault.modify(file, lines.join('\n'));
    } else {
      // Append new heading at the end
      const appendContent = `\n\n${headingLevel} ${cleanHeading}\n${newText}\n`;
      await this.app.vault.modify(file, content + appendContent);
    }
  }

  /**
   * Schedule a debounced write (~400ms) to frontmatter or body heading
   */
  public updateKeyDebounced(file: TFile, key: string, value: any, delayMs: number = 400): void {
    const path = file.path;

    if (key.startsWith('#')) {
      // Handle heading binding directly with debounce
      const entry = this.pendingWrites.get(path) || { timeout: 0, values: {} };
      entry.values[key] = value;
      if (entry.timeout) window.clearTimeout(entry.timeout);

      entry.timeout = window.setTimeout(async () => {
        this.pendingWrites.delete(path);
        try {
          await this.writeHeadingSection(file, key, String(value || ''));
        } catch (e) {
          console.error('[FrontmatterSync] Heading write error:', e);
        }
      }, delayMs);

      this.pendingWrites.set(path, entry);
      return;
    }

    const entry = this.pendingWrites.get(path) || { timeout: 0, values: {} };
    entry.values[key] = value;

    if (entry.timeout) {
      window.clearTimeout(entry.timeout);
    }

    entry.timeout = window.setTimeout(async () => {
      this.pendingWrites.delete(path);
      const valuesToWrite = entry.values;
      try {
        await this.app.fileManager.processFrontMatter(file, (fm) => {
          for (const [k, v] of Object.entries(valuesToWrite)) {
            if (v === undefined || v === null) {
              delete fm[k];
            } else {
              fm[k] = v;
            }
          }
        });

        // Sync with active tabletop tokens if applicable (hp, maxHp, image)
        this.syncWithTokens(file.path, valuesToWrite);
      } catch (err) {
        console.error('[FrontmatterSync] Error writing frontmatter:', err);
      }
    }, delayMs);

    this.pendingWrites.set(path, entry);
  }

  /**
   * Check if any tokens on the active map link to this note and update hp/maxHp/image
   */
  private syncWithTokens(filePath: string, values: Record<string, any>): void {
    const view = this.plugin.getOpenDinoView();
    if (!view) return;
    const map = view.getCurrentMap();
    if (!map || !map.tokens) return;

    let modified = false;
    for (const token of map.tokens) {
      if (token.linkedNote === filePath) {
        if ('hp' in values || 'vida' in values) {
          const hpVal = Number(values['hp'] ?? values['vida']);
          if (!isNaN(hpVal)) {
            token.hp = hpVal;
            modified = true;
          }
        }
        if ('maxHp' in values || 'vidaMax' in values) {
          const maxHpVal = Number(values['maxHp'] ?? values['vidaMax']);
          if (!isNaN(maxHpVal)) {
            token.maxHp = maxHpVal;
            modified = true;
          }
        }
        if ('image' in values || 'imagen' in values) {
          const imgVal = String(values['image'] ?? values['imagen'] ?? '');
          if (imgVal) {
            token.imagePath = imgVal;
            modified = true;
          }
        }
      }
    }

    if (modified) {
      view.render();
      this.plugin.saveSettings();
    }
  }
}
