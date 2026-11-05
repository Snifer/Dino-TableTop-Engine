import { App, EventRef, getAllTags, TFile } from 'obsidian';
import { RandomTable, TableScope, RandomTablesSettings } from './types';
import { parseMarkdownTables } from './tableParser';

export class TableIndexer {
  private app: App;
  private settingsProvider: () => RandomTablesSettings;
  private tablesByNote: Map<string, RandomTable[]> = new Map();
  private metaListener: EventRef | null = null;
  private deleteListener: EventRef | null = null;
  private renameListener: EventRef | null = null;
  private listeners: Set<() => void> = new Set();
  private isIndexing = false;

  constructor(app: App, settingsProvider: () => RandomTablesSettings) {
    this.app = app;
    this.settingsProvider = settingsProvider;
  }

  /** Subscribe to index changes */
  onChange(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify(): void {
    for (const cb of this.listeners) {
      try {
        cb();
      } catch (err) {
        console.error('[RandomTables Indexer] Listener error:', err);
      }
    }
  }

  /** Start listening to metadataCache and vault file changes */
  startWatchers(): void {
    this.stopWatchers();

    this.metaListener = this.app.metadataCache.on('changed', (file: TFile) => {
      this.reindexFile(file);
    });

    this.deleteListener = this.app.vault.on('delete', (file) => {
      if (file instanceof TFile) {
        this.removeFile(file.path);
      }
    });

    this.renameListener = this.app.vault.on('rename', (file, oldPath) => {
      this.removeFile(oldPath);
      if (file instanceof TFile) {
        this.reindexFile(file);
      }
    });
  }

  /** Stop event listeners */
  stopWatchers(): void {
    if (this.metaListener) {
      this.app.metadataCache.offref(this.metaListener);
      this.metaListener = null;
    }
    if (this.deleteListener) {
      this.app.vault.offref(this.deleteListener);
      this.deleteListener = null;
    }
    if (this.renameListener) {
      this.app.vault.offref(this.renameListener);
      this.renameListener = null;
    }
  }

  /** Full index of all eligible files in the vault */
  async indexAll(): Promise<void> {
    if (this.isIndexing) return;
    this.isIndexing = true;
    try {
      this.tablesByNote.clear();
      const files = this.app.vault.getMarkdownFiles();
      for (const file of files) {
        await this.indexFileIfEligible(file);
      }
      this.notify();
    } finally {
      this.isIndexing = false;
    }
  }

  /** Reindex single file on change */
  async reindexFile(file: TFile): Promise<void> {
    if (file.extension !== 'md') return;
    const hadBefore = this.tablesByNote.has(file.path);
    const parsed = await this.indexFileIfEligible(file);
    if (hadBefore || (parsed && parsed.length > 0)) {
      this.notify();
    }
  }

  /** Remove file from index */
  removeFile(filePath: string): void {
    if (this.tablesByNote.has(filePath)) {
      this.tablesByNote.delete(filePath);
      this.notify();
    }
  }

  /** Check eligibility and parse tables for a file */
  private async indexFileIfEligible(file: TFile): Promise<RandomTable[] | null> {
    const settings = this.settingsProvider();
    const tagPrefix = (settings.tagPrefix || 'dte-table').toLowerCase().replace(/^#/, '');
    const folders = settings.folders || [];

    const cache = this.app.metadataCache.getFileCache(file);
    const allTags = cache ? (getAllTags(cache) || []).map((t) => t.toLowerCase().replace(/^#/, '')) : [];
    const frontmatter = cache?.frontmatter || {};

    const inFolder = folders.length > 0 && folders.some((f) => file.path.startsWith(f));
    const hasDteTableFrontmatter = frontmatter['dte-table'] === true || frontmatter['dteTable'] === true;

    // Check tags starting with prefix e.g. "dte-table" or "dte-table/campaign1"
    const matchingTags = allTags.filter((t) => t === tagPrefix || t.startsWith(tagPrefix + '/'));
    const isEligible = matchingTags.length > 0 || hasDteTableFrontmatter || inFolder;

    if (!isEligible) {
      if (this.tablesByNote.has(file.path)) {
        this.tablesByNote.delete(file.path);
      }
      return null;
    }

    // Determine scopes and campaign associations
    // If tag is dte-table -> global
    // If tag is dte-table/campId -> campaign specific
    let hasGlobal = false;
    const campaignIds = new Set<string>();

    for (const tag of matchingTags) {
      if (tag === tagPrefix) {
        hasGlobal = true;
      } else if (tag.startsWith(tagPrefix + '/')) {
        const camp = tag.substring(tagPrefix.length + 1).trim();
        if (camp) campaignIds.add(camp);
      }
    }

    if (hasDteTableFrontmatter) {
      const camp = frontmatter['dte-campaign'] || frontmatter['dteCampaign'];
      if (camp && typeof camp === 'string') {
        campaignIds.add(camp.trim());
      } else {
        hasGlobal = true;
      }
    }

    if (inFolder && !matchingTags.length && !hasDteTableFrontmatter) {
      hasGlobal = true;
    }

    try {
      const content = await this.app.vault.cachedRead(file);
      const parsedTables = parseMarkdownTables(file.path, content, {
        tags: allTags,
      });

      if (parsedTables.length === 0) {
        this.tablesByNote.delete(file.path);
        return null;
      }

      // If note belongs to specific campaigns or both global and campaigns, clone tables with appropriate scopes
      const resultTables: RandomTable[] = [];

      for (const tbl of parsedTables) {
        if (hasGlobal || campaignIds.size === 0) {
          resultTables.push({
            ...tbl,
            scope: { type: 'global' },
          });
        }

        for (const cId of campaignIds) {
          resultTables.push({
            ...tbl,
            id: `${tbl.id}@camp_${cId}`,
            scope: { type: 'campaign', campaignId: cId },
          });
        }
      }

      this.tablesByNote.set(file.path, resultTables);
      return resultTables;
    } catch (err) {
      console.error(`[RandomTables Indexer] Error reading/parsing ${file.path}:`, err);
      this.tablesByNote.delete(file.path);
      return null;
    }
  }

  /** Return all indexed tables */
  getAllTables(): RandomTable[] {
    const list: RandomTable[] = [];
    for (const tables of this.tablesByNote.values()) {
      list.push(...tables);
    }
    return list;
  }

  /** Find a table by its unique id or name */
  getTableById(id: string): RandomTable | undefined {
    for (const tables of this.tablesByNote.values()) {
      const found = tables.find((t) => t.id === id);
      if (found) return found;
    }
    return undefined;
  }

  /** Find a table by name (case-insensitive) */
  getTableByName(name: string): RandomTable | undefined {
    const lower = name.toLowerCase().trim();
    for (const tables of this.tablesByNote.values()) {
      const found = tables.find((t) => t.name.toLowerCase().trim() === lower);
      if (found) return found;
    }
    return undefined;
  }

  /** Get tables segregated for the active campaign: campaign-specific first, then global */
  getTablesForCampaign(campaignId: string | null): { campaignTables: RandomTable[]; globalTables: RandomTable[] } {
    const all = this.getAllTables();
    const campaignTables: RandomTable[] = [];
    const globalTables: RandomTable[] = [];
    const seenGlobalIds = new Set<string>();

    for (const tbl of all) {
      if (tbl.scope.type === 'campaign') {
        if (campaignId && (tbl.scope.campaignId === campaignId || tbl.scope.campaignId.toLowerCase() === campaignId.toLowerCase())) {
          campaignTables.push(tbl);
        }
      } else {
        if (!seenGlobalIds.has(tbl.id)) {
          seenGlobalIds.add(tbl.id);
          globalTables.push(tbl);
        }
      }
    }

    return { campaignTables, globalTables };
  }
}
