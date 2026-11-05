import { App, Modal, Notice, Setting, TFile } from 'obsidian';
import { DinoPlugin, DinoSettings } from '../types';
import { t } from '../i18n';

/**
 * Modal to register any note in the vault as a random table.
 * Resolves the campaign ID internally — the user picks by name.
 */
export class RegisterTableModal extends Modal {
  private plugin: DinoPlugin;
  private preselectedFile: TFile | null;

  // Form state
  private selectedFilePath = '';
  private tableName = '';
  private tableScope: 'global' | string = 'global'; // 'global' | campaignId
  private rollFormula = '';
  private groupTags = '';

  constructor(app: App, plugin: DinoPlugin, preselectedFile?: TFile) {
    super(app);
    this.plugin = plugin;
    this.preselectedFile = preselectedFile || null;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('dte-register-table-modal');

    contentEl.createEl('h2', { text: t('tables.registerModal.title') });
    contentEl.createEl('p', {
      text: t('tables.registerModal.description'),
      cls: 'dte-modal-description',
    });

    // ── Note selector ──
    const allFiles = this.app.vault.getMarkdownFiles().sort((a, b) =>
      a.path.localeCompare(b.path)
    );

    // Pre-select active file if none given
    if (!this.preselectedFile) {
      const activeFile = this.app.workspace.getActiveFile();
      if (activeFile && activeFile.extension === 'md') {
        this.preselectedFile = activeFile;
      }
    }

    this.selectedFilePath = this.preselectedFile?.path || '';
    this.tableName = this.preselectedFile?.basename || '';

    new Setting(contentEl)
      .setName(t('tables.registerModal.noteLabel'))
      .setDesc(t('tables.registerModal.noteDesc'))
      .addDropdown((dd) => {
        dd.addOption('', `— ${t('tables.registerModal.selectNote')} —`);
        for (const f of allFiles) {
          dd.addOption(f.path, f.path);
        }
        if (this.selectedFilePath) {
          dd.setValue(this.selectedFilePath);
        }
        dd.onChange((val) => {
          this.selectedFilePath = val;
          // Auto-fill name from filename if still empty
          if (!this.tableName && val) {
            const file = this.app.vault.getAbstractFileByPath(val);
            if (file instanceof TFile) {
              this.tableName = file.basename;
              nameInput.setValue(file.basename);
            }
          }
        });
      });

    // ── Table name ──
    let nameInput: { setValue(v: string): void; inputEl: HTMLInputElement };
    new Setting(contentEl)
      .setName(t('tables.registerModal.nameLabel'))
      .setDesc(t('tables.registerModal.nameDesc'))
      .addText((text) => {
        nameInput = text;
        text
          .setPlaceholder(t('tables.registerModal.namePlaceholder'))
          .setValue(this.tableName)
          .onChange((v) => (this.tableName = v.trim()));
      });

    // ── Scope ──
    const settings = this.plugin.settings as DinoSettings;
    const campaigns = settings.campaigns || {};
    const currentCampaignId = settings.currentCampaignId;

    new Setting(contentEl)
      .setName(t('tables.registerModal.scopeLabel'))
      .setDesc(t('tables.registerModal.scopeDesc'))
      .addDropdown((dd) => {
        // Global option
        dd.addOption('global', `🌐 ${t('tables.registerModal.scopeGlobal')}`);

        // Current campaign first (if any)
        if (currentCampaignId && campaigns[currentCampaignId]) {
          const camp = campaigns[currentCampaignId];
          dd.addOption(currentCampaignId, `🎲 ${camp.name} (${t('tables.registerModal.current')})`);
        }

        // Rest of campaigns
        for (const [id, camp] of Object.entries(campaigns)) {
          if (id !== currentCampaignId) {
            dd.addOption(id, `🎲 ${camp.name}`);
          }
        }

        // Default: current campaign if available, else global
        const defaultScope = currentCampaignId && campaigns[currentCampaignId]
          ? currentCampaignId
          : 'global';
        this.tableScope = defaultScope;
        dd.setValue(defaultScope);
        dd.onChange((v) => (this.tableScope = v));
      });

    // ── Roll formula ──
    new Setting(contentEl)
      .setName(t('tables.registerModal.rollLabel'))
      .setDesc(t('tables.registerModal.rollDesc'))
      .addText((text) => {
        text
          .setPlaceholder('d6, 1d20, d100, 2d6...')
          .onChange((v) => (this.rollFormula = v.trim()));
      });

    // ── Group tags ──
    new Setting(contentEl)
      .setName(t('tables.registerModal.tagsLabel'))
      .setDesc(t('tables.registerModal.tagsDesc'))
      .addText((text) => {
        text
          .setPlaceholder('encuentro, botin, clima...')
          .onChange((v) => (this.groupTags = v.trim()));
      });

    // ── Action buttons ──
    const btnRow = contentEl.createDiv({ cls: 'dte-modal-btn-row' });

    btnRow.createEl('button', {
      text: t('common.cancel'),
      cls: 'dte-btn',
    }).addEventListener('click', () => this.close());

    const registerBtn = btnRow.createEl('button', {
      text: t('tables.registerModal.register'),
      cls: 'dte-btn dte-btn-primary',
    });
    registerBtn.addEventListener('click', () => this.submit());
  }

  private async submit(): Promise<void> {
    if (!this.selectedFilePath) {
      new Notice(t('tables.registerModal.errorNoNote'));
      return;
    }

    const file = this.app.vault.getAbstractFileByPath(this.selectedFilePath);
    if (!(file instanceof TFile)) {
      new Notice(t('tables.registerModal.errorNoteNotFound'));
      return;
    }

    try {
      await this.app.vault.process(file, (content) => {
        return this.injectFrontmatter(content);
      });

      new Notice(t('tables.registerModal.success', { name: this.tableName || file.basename }), 3000);
      this.close();
    } catch (err) {
      console.error('[RegisterTableModal] Error writing frontmatter:', err);
      new Notice(t('tables.registerModal.errorWrite'));
    }
  }

  /**
   * Injects or merges dte-* frontmatter into the note content.
   * Preserves all existing content and other frontmatter keys.
   */
  private injectFrontmatter(content: string): string {
    const settings = this.plugin.settings as DinoSettings;
    const tagPrefix = (settings.randomTables?.tagPrefix || 'dte-table').toLowerCase().replace(/^#/, '');

    // Build the dte fields to inject
    const fields: Record<string, string | boolean | string[]> = {
      'dte-table': true,
    };

    if (this.tableScope !== 'global') {
      fields['dte-campaign'] = this.tableScope;
    }

    if (this.tableName) {
      fields['dte-name'] = this.tableName;
    }

    if (this.rollFormula) {
      fields['dte-roll'] = this.rollFormula;
    }

    if (this.groupTags) {
      const tagsArr = this.groupTags
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (tagsArr.length > 0) {
        fields['dte-tags'] = tagsArr;
      }
    }

    // Also inject the proper Obsidian tag for scope
    const scopeTag = this.tableScope === 'global'
      ? tagPrefix
      : `${tagPrefix}/${this.tableScope}`;

    const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---/;
    const match = content.match(frontmatterRegex);

    if (match) {
      // --- Existing frontmatter: merge dte fields ---
      let fmBody = match[1];

      // Update/add each dte field
      for (const [key, value] of Object.entries(fields)) {
        const lineRegex = new RegExp(`^${key}:.*$`, 'm');
        const serialized = this.serializeYamlValue(value);
        if (lineRegex.test(fmBody)) {
          fmBody = fmBody.replace(lineRegex, `${key}: ${serialized}`);
        } else {
          fmBody += `\n${key}: ${serialized}`;
        }
      }

      // Merge tag into tags array
      fmBody = this.mergeTagIntoFrontmatter(fmBody, scopeTag);

      return content.replace(frontmatterRegex, `---\n${fmBody}\n---`);
    } else {
      // --- No existing frontmatter: prepend a new block ---
      const tagLine = `tags: [${scopeTag}]`;
      const fieldLines = Object.entries(fields)
        .map(([k, v]) => `${k}: ${this.serializeYamlValue(v)}`)
        .join('\n');

      const newFrontmatter = `---\n${tagLine}\n${fieldLines}\n---\n\n`;
      return newFrontmatter + content;
    }
  }

  private serializeYamlValue(value: string | boolean | string[]): string {
    if (typeof value === 'boolean') return value.toString();
    if (Array.isArray(value)) return `[${value.join(', ')}]`;
    return value;
  }

  /** Merge scopeTag into existing `tags:` line without duplicates */
  private mergeTagIntoFrontmatter(fmBody: string, tag: string): string {
    // Match inline array: tags: [a, b, c]
    const inlineTagsRegex = /^tags:\s*\[([^\]]*)\]/m;
    // Match block list:
    // tags:
    //   - a
    const blockTagsRegex = /^tags:\s*\n((?:\s*-\s*.+\n?)*)/m;

    if (inlineTagsRegex.test(fmBody)) {
      return fmBody.replace(inlineTagsRegex, (_, items) => {
        const existing = items.split(',').map((s: string) => s.trim()).filter(Boolean);
        if (!existing.includes(tag)) {
          existing.push(tag);
        }
        return `tags: [${existing.join(', ')}]`;
      });
    } else if (blockTagsRegex.test(fmBody)) {
      return fmBody.replace(blockTagsRegex, (full, items) => {
        const existingItems = items
          .split('\n')
          .map((l: string) => l.replace(/^\s*-\s*/, '').trim())
          .filter(Boolean);
        if (!existingItems.includes(tag)) {
          return full + `  - ${tag}\n`;
        }
        return full;
      });
    } else {
      // No tags field yet, add it
      return fmBody + `\ntags: [${tag}]`;
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
