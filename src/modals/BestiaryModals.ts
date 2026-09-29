import { App, Modal, Notice, Setting, TFile } from 'obsidian';
import { BestiaryEntry, HP_KEYS, MAXHP_KEYS, IMAGE_KEYS, IMAGE_EXTS, MapData, TokenData } from '../types';
import { genId, getIconClass, readFrontmatterStat, readFrontmatterImagePath } from '../utils';
import { t } from '../i18n';
import { ItemEditModal } from './ItemEditModal';
import { FileSuggestModal } from './FileSuggestModal';
import { IconSuggestModal } from './IconSuggestModal';
import { renderCountersEditor } from './CountersEditor';

export class BestiaryEntryEditModal extends Modal {
  entry: BestiaryEntry;
  availablePacks: string[];
  onSave: (entry: BestiaryEntry) => void;
  onDelete: ((entry: BestiaryEntry) => void) | null;

  constructor(
    app: App,
    entry: BestiaryEntry,
    availablePacks: string[],
    onSave: (entry: BestiaryEntry) => void,
    onDelete: ((entry: BestiaryEntry) => void) | null
  ) {
    super(app);
    this.entry = entry;
    this.availablePacks = availablePacks;
    this.onSave = onSave;
    this.onDelete = onDelete;
    if (!this.entry.counters) this.entry.counters = [];
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', {
      text: this.onDelete ? t('bestiary.editCreatureTitle') : t('bestiary.newCreatureTitle'),
    });

    new Setting(contentEl)
      .setName(t('common.name'))
      .addText((text) => text.setValue(this.entry.name || '').onChange((v) => (this.entry.name = v)));

    // Pack selection
    const packSetting = new Setting(contentEl)
      .setName(t('bestiary.pack'))
      .setDesc(t('bestiary.packDesc'));

    packSetting.addText((text) => {
      text
        .setPlaceholder(t('bestiary.packGeneral'))
        .setValue(this.entry.pack || '')
        .onChange((v) => {
          this.entry.pack = v.trim() || undefined;
        });
    });

    if (this.availablePacks.length > 0) {
      const pillsWrap = contentEl.createDiv({ cls: 'dte-bestiary-pack-pills-row' });
      pillsWrap.createSpan({ cls: 'dte-hint', text: `${t('bestiary.packSelect')} ` });
      for (const p of this.availablePacks) {
        const pill = pillsWrap.createEl('button', { cls: 'dte-pill-btn', text: p });
        if (this.entry.pack === p) pill.addClass('is-active');
        pill.addEventListener('click', (e) => {
          e.preventDefault();
          this.entry.pack = p;
          this.onOpen();
        });
      }
    }

    new Setting(contentEl)
      .setName(t('common.color'))
      .addColorPicker((c) =>
        c.setValue(this.entry.color || '#8b3a3a').onChange((v) => (this.entry.color = v))
      );

    new Setting(contentEl)
      .setName(t('common.size'))
      .addSlider((s) =>
        s
          .setLimits(20, 120, 2)
          .setValue(this.entry.size || 44)
          .setDynamicTooltip()
          .onChange((v) => (this.entry.size = v))
      );

    new Setting(contentEl)
      .setName(t('common.image'))
      .setDesc(this.entry.imagePath ? this.entry.imagePath : t('common.noImageDesc'))
      .addButton((b) =>
        b.setButtonText(t('common.selectImage')).onClick(() => {
          new FileSuggestModal(this.app, IMAGE_EXTS, (file) => {
            this.entry.imagePath = file.path;
            this.onOpen();
          }).open();
        })
      )
      .addExtraButton((b) =>
        b
          .setIcon('x')
          .setTooltip(t('common.removeImage'))
          .onClick(() => {
            if (!confirm(t('common.removeImageConfirm'))) return;
            this.entry.imagePath = null;
            this.onOpen();
          })
      );

    const bestiaryIconSetting = new Setting(contentEl)
      .setName(t('common.iconField'))
      .setDesc(
        this.entry.icon
          ? t('common.bestiaryIconDescAssigned', { icon: this.entry.icon })
          : t('common.bestiaryIconDescEmpty'),
      )
      .addText((text) =>
        text
          .setPlaceholder('ra-dragon')
          .setValue(this.entry.icon || '')
          .onChange((v) => {
            this.entry.icon = v.trim() || null;
          })
      )
      .addButton((b) =>
        b
          .setButtonText(t('common.iconCatalog'))
          .setIcon('search')
          .onClick(() => {
            new IconSuggestModal(this.app, (chosen) => {
              this.entry.icon = chosen;
              this.onOpen();
            }).open();
          })
      );

    if (this.entry.icon) {
      bestiaryIconSetting.addExtraButton((b) =>
        b
          .setIcon('x')
          .setTooltip(t('common.removeIcon'))
          .onClick(() => {
            this.entry.icon = null;
            this.onOpen();
          })
      );
    }

    new Setting(contentEl)
      .setName(t('common.linkedNote'))
      .setDesc(
        this.entry.linkedNote
          ? t('common.linkedNoteTokenDescAssigned', { path: this.entry.linkedNote })
          : t('common.linkedNoteTokenDescEmpty'),
      )
      .addButton((b) =>
        b.setButtonText(t('common.selectNote')).onClick(() => {
          new FileSuggestModal(this.app, null, (file) => {
            this.entry.linkedNote = file.path;
            if (!this.entry.name) this.entry.name = file.basename;
            const img = readFrontmatterImagePath(this.app, file.path, IMAGE_KEYS);
            if (img) this.entry.imagePath = img;
            const hp = readFrontmatterStat(this.app, file.path, HP_KEYS);
            const maxHp = readFrontmatterStat(this.app, file.path, MAXHP_KEYS);
            if (hp !== null) this.entry.defaultHp = hp;
            if (maxHp !== null) this.entry.defaultMaxHp = maxHp;
            this.onOpen();
          }).open();
        })
      )
      .addExtraButton((b) =>
        b
          .setIcon('x')
          .setTooltip(t('common.removeLink'))
          .onClick(() => {
            this.entry.linkedNote = null;
            this.onOpen();
          })
      );

    new Setting(contentEl)
      .setName(t('bestiary.defaultHp'))
      .addText((text) =>
        text.setValue(String(this.entry.defaultHp ?? 10)).onChange((v) => {
          const n = Number(v);
          if (!isNaN(n)) this.entry.defaultHp = n;
        })
      );

    new Setting(contentEl).setName(t('bestiary.defaultMaxHp')).addText((text) =>
      text.setValue(String(this.entry.defaultMaxHp ?? 10)).onChange((v) => {
        const n = Number(v);
        if (!isNaN(n)) this.entry.defaultMaxHp = n;
      })
    );

    if (this.entry.linkedNote) {
      const info = contentEl.createDiv({ cls: 'dte-hint' });
      info.setText(
        t('common.yamlHint', {
          hpKeys: HP_KEYS.join(', '),
          maxHpKeys: MAXHP_KEYS.join(', '),
        })
      );
    }

    renderCountersEditor(contentEl, this.entry.counters || [], () => this.onOpen());

    const invSetting = new Setting(contentEl).setName(t('inventory.title'));
    if (!this.entry.inventory) {
      invSetting
        .setDesc(t('inventory.noInventoryAttached'))
        .addButton((btn) =>
          btn.setButtonText(t('inventory.addInventory')).onClick(() => {
            this.entry.inventory = {
              items: [],
              capacity: { mode: 'none', value: 0, label: '' },
            };
            this.onOpen();
          })
        );
    } else {
      const itemsCount = this.entry.inventory.items.length;
      invSetting
        .setDesc(`${itemsCount} items`)
        .addButton((btn) =>
          btn.setButtonText(t('inventory.addItem')).onClick(() => {
            new ItemEditModal(this.app, null, (newItem) => {
              this.entry.inventory?.items.push(newItem);
              this.onOpen();
            }, null).open();
          })
        )
        .addExtraButton((btn) =>
          btn.setIcon('trash').setTooltip(t('inventory.removeInventory')).onClick(() => {
            delete this.entry.inventory;
            this.onOpen();
          })
        );
    }

    const btnRow = new Setting(contentEl);
    btnRow.addButton((b) =>
      b
        .setButtonText(t('common.save'))
        .setCta()
        .onClick(() => {
          this.close();
          this.onSave(this.entry);
        })
    );
    if (this.onDelete) {
      const onDelete = this.onDelete;
      btnRow.addButton((b) =>
        b
          .setButtonText(t('common.delete'))
          .setWarning()
          .onClick(() => {
            if (!confirm(t('bestiary.deleteConfirm', { name: this.entry.name || t('common.unnamed') }))) return;
            this.close();
            onDelete(this.entry);
          })
      );
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export class BestiaryListModal extends Modal {
  plugin: any;
  view: any;
  private selectedPack: string | null = null;
  private searchQuery: string = '';

  constructor(app: App, plugin: any, view: any) {
    super(app);
    this.plugin = plugin;
    this.view = view;
  }

  onOpen(): void {
    this.renderModal();
  }

  private getPacksList(): string[] {
    const bestiary: Record<string, BestiaryEntry> = this.plugin.settings.bestiary || {};
    const packsSet = new Set<string>();
    for (const entry of Object.values(bestiary)) {
      if (entry.pack && entry.pack.trim()) {
        packsSet.add(entry.pack.trim());
      }
    }
    if (Array.isArray(this.plugin.settings.bestiaryPacks)) {
      for (const p of this.plugin.settings.bestiaryPacks) {
        if (p && p.trim()) packsSet.add(p.trim());
      }
    }
    return Array.from(packsSet).sort();
  }

  renderModal(): void {
    const { contentEl, modalEl } = this;
    contentEl.empty();
    modalEl.addClass('dte-bestiary-modal');

    // Header & Title
    const headerEl = contentEl.createDiv({ cls: 'dte-bestiary-header' });
    headerEl.createEl('h2', { text: `🐉 ${t('bestiary.title')}` });

    // Top action bar (New, Export, Import)
    const topBar = contentEl.createDiv({ cls: 'dte-bestiary-topbar' });

    // Search bar
    const searchInput = topBar.createEl('input', {
      type: 'text',
      cls: 'dte-bestiary-search dte-input-clean',
      placeholder: t('bestiary.searchPlaceholder'),
      value: this.searchQuery,
    });
    searchInput.addEventListener('input', () => {
      this.searchQuery = searchInput.value.toLowerCase().trim();
      this.renderList(listContainer);
    });

    const actionButtons = topBar.createDiv({ cls: 'dte-bestiary-topbar-actions' });

    // New Creature Button
    const newBtn = actionButtons.createEl('button', {
      text: t('bestiary.addCreature'),
      cls: 'dte-btn mod-cta',
    });
    newBtn.addEventListener('click', () => {
      const entry: BestiaryEntry = {
        id: genId(),
        name: '',
        pack: this.selectedPack && this.selectedPack !== '__general__' ? this.selectedPack : undefined,
        color: '#8b3a3a',
        size: 44,
        imagePath: null,
        icon: null,
        linkedNote: null,
        defaultHp: 10,
        defaultMaxHp: 10,
        counters: [],
      };
      new BestiaryEntryEditModal(
        this.app,
        entry,
        this.getPacksList(),
        (saved) => {
          this.plugin.settings.bestiary[saved.id] = saved;
          this.plugin.saveSettings();
          this.renderModal();
        },
        null
      ).open();
    });

    // Export Pack / All Button
    const exportBtn = actionButtons.createEl('button', {
      text: this.selectedPack ? `📦 ${t('bestiary.exportPack')}` : `📦 ${t('bestiary.exportAll')}`,
      cls: 'dte-btn',
    });
    exportBtn.addEventListener('click', () => {
      this.exportCurrentPack();
    });

    // Import Pack Button
    const importBtn = actionButtons.createEl('button', {
      text: `📥 ${t('bestiary.importPack')}`,
      cls: 'dte-btn',
    });
    importBtn.addEventListener('click', () => {
      this.triggerImport();
    });

    // Pack Pills Bar
    const packs = this.getPacksList();
    const bestiary: Record<string, BestiaryEntry> = this.plugin.settings.bestiary || {};
    const totalCount = Object.keys(bestiary).length;

    const packPillsBar = contentEl.createDiv({ cls: 'dte-bestiary-pack-pills' });

    // "All" Pill
    const allPill = packPillsBar.createEl('button', { cls: 'dte-icon-pack-pill' });
    allPill.setText(`📋 ${t('bestiary.packAll')} (${totalCount})`);
    if (this.selectedPack === null) allPill.addClass('is-active');
    allPill.addEventListener('click', () => {
      this.selectedPack = null;
      this.renderModal();
    });

    // Specific Pack Pills
    for (const p of packs) {
      const count = Object.values(bestiary).filter((e) => (e.pack || '').trim() === p).length;
      const pill = packPillsBar.createEl('button', { cls: 'dte-icon-pack-pill' });
      pill.setText(`📁 ${p} (${count})`);
      if (this.selectedPack === p) pill.addClass('is-active');
      pill.addEventListener('click', () => {
        this.selectedPack = p;
        this.renderModal();
      });
    }

    // Unassigned / General Pack Pill (if there are creatures without a pack and other packs exist)
    const unassignedCount = Object.values(bestiary).filter((e) => !e.pack || !e.pack.trim()).length;
    if (packs.length > 0 && unassignedCount > 0) {
      const generalPill = packPillsBar.createEl('button', { cls: 'dte-icon-pack-pill' });
      generalPill.setText(`📂 ${t('bestiary.packGeneral')} (${unassignedCount})`);
      if (this.selectedPack === '__general__') generalPill.addClass('is-active');
      generalPill.addEventListener('click', () => {
        this.selectedPack = '__general__';
        this.renderModal();
      });
    }

    // Creature List Container
    const listContainer = contentEl.createDiv({ cls: 'dte-bestiary-list-wrap' });
    this.renderList(listContainer);
  }

  private renderList(container: HTMLElement): void {
    container.empty();
    const bestiary: Record<string, BestiaryEntry> = this.plugin.settings.bestiary || {};
    const map = this.view.getCurrentMap ? this.view.getCurrentMap() : null;

    let entries = Object.values(bestiary);

    // Filter by Pack
    if (this.selectedPack === '__general__') {
      entries = entries.filter((e) => !e.pack || !e.pack.trim());
    } else if (this.selectedPack !== null) {
      entries = entries.filter((e) => (e.pack || '').trim() === this.selectedPack);
    }

    // Filter by Search Query
    if (this.searchQuery) {
      entries = entries.filter((e) => {
        const nameMatch = (e.name || '').toLowerCase().includes(this.searchQuery);
        const noteMatch = (e.linkedNote || '').toLowerCase().includes(this.searchQuery);
        const packMatch = (e.pack || '').toLowerCase().includes(this.searchQuery);
        return nameMatch || noteMatch || packMatch;
      });
    }

    if (entries.length === 0) {
      container.createDiv({
        cls: 'dte-empty dte-bestiary-empty',
        text: this.selectedPack ? t('bestiary.noCreaturesInPack') : t('bestiary.empty'),
      });
      return;
    }

    const list = container.createDiv({ cls: 'dte-bestiary-list' });

    for (const entry of entries) {
      const row = list.createDiv({ cls: 'dte-bestiary-row' });

      const thumb = row.createDiv({ cls: 'dte-bestiary-thumb' });
      thumb.style.background = entry.color || '#8b3a3a';
      const imgFile = entry.imagePath ? this.app.vault.getAbstractFileByPath(entry.imagePath) : null;
      if (imgFile) {
        thumb.style.backgroundImage = `url("${this.app.vault.getResourcePath(imgFile as TFile)}")`;
        thumb.style.backgroundSize = 'cover';
        thumb.style.backgroundPosition = 'center';
      } else if (entry.icon) {
        const iconCls = getIconClass(entry.icon, 'ra');
        const iconEl = thumb.createEl('i', { cls: iconCls });
        iconEl.style.fontSize = '18px';
      } else {
        thumb.setText((entry.name || '?').slice(0, 2).toUpperCase());
      }

      const info = row.createDiv({ cls: 'dte-bestiary-info' });
      const nameRow = info.createDiv({ cls: 'dte-bestiary-name-row' });
      nameRow.createSpan({ cls: 'dte-bestiary-name', text: entry.name || `(${t('common.unnamed')})` });

      if (entry.pack && this.selectedPack === null) {
        nameRow.createSpan({ cls: 'dte-bestiary-pack-badge', text: entry.pack });
      }

      const metaRow = info.createDiv({ cls: 'dte-bestiary-meta-row' });
      metaRow.createSpan({ cls: 'dte-bestiary-hp-badge', text: `❤️ ${entry.defaultHp ?? 10}/${entry.defaultMaxHp ?? 10} HP` });
      if (entry.inventory && entry.inventory.items.length > 0) {
        metaRow.createSpan({ cls: 'dte-bestiary-inv-badge', text: `🎒 ${entry.inventory.items.length}` });
      }
      if (entry.linkedNote) {
        metaRow.createSpan({ cls: 'dte-hint dte-bestiary-note-link', text: `🔗 ${entry.linkedNote}` });
      }

      const actions = row.createDiv({ cls: 'dte-bestiary-actions' });
      const placeBtn = actions.createEl('button', {
        text: `📍 ${t('bestiary.spawnBtn')}`,
        cls: 'dte-btn dte-btn-primary',
      }) as HTMLButtonElement;
      placeBtn.disabled = !map;
      placeBtn.addEventListener('click', () => {
        if (!map) {
          new Notice(t('bestiary.spawnNoMap'));
          return;
        }
        this.placeOnMap(map, entry);
      });

      actions.createEl('button', { text: t('common.edit'), cls: 'dte-btn' }).addEventListener('click', () => {
        new BestiaryEntryEditModal(
          this.app,
          Object.assign({}, entry, { counters: (entry.counters || []).map((c: any) => Object.assign({}, c)) }),
          this.getPacksList(),
          (saved) => {
            this.plugin.settings.bestiary[entry.id] = saved;
            this.plugin.saveSettings();
            this.renderModal();
          },
          () => {
            delete this.plugin.settings.bestiary[entry.id];
            this.plugin.saveSettings();
            this.renderModal();
          }
        ).open();
      });

      actions.createEl('button', { text: '🗑️', cls: 'dte-btn dte-btn-danger' }).addEventListener('click', () => {
        if (!confirm(t('bestiary.deleteConfirm', { name: entry.name || t('common.unnamed') }))) return;
        delete this.plugin.settings.bestiary[entry.id];
        this.plugin.saveSettings();
        this.renderModal();
      });
    }
  }

  private exportCurrentPack(): void {
    const bestiary: Record<string, BestiaryEntry> = this.plugin.settings.bestiary || {};
    let exportEntries: BestiaryEntry[] = Object.values(bestiary);
    let filename = 'bestiary-all.json';

    if (this.selectedPack === '__general__') {
      exportEntries = exportEntries.filter((e) => !e.pack || !e.pack.trim());
      filename = 'bestiary-general.json';
    } else if (this.selectedPack !== null) {
      exportEntries = exportEntries.filter((e) => (e.pack || '').trim() === this.selectedPack);
      filename = `bestiary-${this.selectedPack.toLowerCase().replace(/[^a-z0-9]/g, '-')}.json`;
    }

    const payload = {
      packName: this.selectedPack || 'All',
      exportedAt: new Date().toISOString(),
      version: '1.0',
      entries: exportEntries,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    new Notice(`Exported ${exportEntries.length} creatures to ${filename}`);
  }

  private triggerImport(): void {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    fileInput.style.display = 'none';

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const parsed = JSON.parse(text);

        let incomingEntries: BestiaryEntry[] = [];
        if (Array.isArray(parsed)) {
          incomingEntries = parsed;
        } else if (parsed && Array.isArray(parsed.entries)) {
          incomingEntries = parsed.entries;
        } else if (parsed && typeof parsed === 'object') {
          incomingEntries = Object.values(parsed);
        }

        if (!incomingEntries.length) {
          throw new Error('No entries found in JSON');
        }

        let importedCount = 0;
        for (const item of incomingEntries) {
          if (!item.name) continue;
          const id = genId();
          this.plugin.settings.bestiary[id] = {
            ...item,
            id,
            counters: Array.isArray(item.counters) ? item.counters : [],
          };
          importedCount++;
        }

        await this.plugin.saveSettings();
        new Notice(t('bestiary.importSuccess', { count: importedCount }));
        this.renderModal();
      } catch (err) {
        new Notice(t('bestiary.importError'));
      }
    });

    document.body.appendChild(fileInput);
    fileInput.click();
    document.body.removeChild(fileInput);
  }

  placeOnMap(map: MapData, entry: BestiaryEntry): void {
    let hp = entry.defaultHp ?? 10;
    let maxHp = entry.defaultMaxHp ?? 10;
    if (entry.linkedNote) {
      const foundHp = readFrontmatterStat(this.app, entry.linkedNote, HP_KEYS);
      const foundMaxHp = readFrontmatterStat(this.app, entry.linkedNote, MAXHP_KEYS);
      if (foundHp !== null) hp = foundHp;
      if (foundMaxHp !== null) maxHp = foundMaxHp;
    }
    const center = this.view.getViewportCenterCoords ? this.view.getViewportCenterCoords() : { x: 50, y: 50 };
    const token: TokenData = {
      id: genId(),
      name: entry.name || 'Criatura',
      color: entry.color || '#8b3a3a',
      size: entry.size || 44,
      x: center.x,
      y: center.y,
      hp,
      maxHp,
      linkedNote: entry.linkedNote || null,
      imagePath: entry.imagePath || null,
      icon: entry.icon || null,
      inventory: entry.inventory
        ? {
            items: entry.inventory.items.map((i) => ({ ...i, id: genId() })),
            capacity: { ...entry.inventory.capacity },
          }
        : undefined,
    };
    map.tokens.push(token);
    this.plugin.saveSettings();
    this.view.render();
    new Notice(t('bestiary.spawnNotice', { name: token.name }));
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
