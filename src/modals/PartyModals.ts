import { App, Modal, Notice, Setting, TFile } from 'obsidian';
import {
  CampaignCharacter,
  CampaignData,
  MapData,
  TokenData,
  DinoPlugin,
  IDinoTabletopView,
  HP_KEYS,
  MAXHP_KEYS,
  IMAGE_KEYS,
  IMAGE_EXTS,
} from '../types';
import { clamp, genId, getIconClass, readFrontmatterStat, readFrontmatterImagePath } from '../utils';
import { t } from '../i18n';
import { FileSuggestModal } from './FileSuggestModal';
import { IconSuggestModal } from './IconSuggestModal';
import { renderCountersEditor } from './CountersEditor';

export class PartyCharacterEditModal extends Modal {
  character: CampaignCharacter;
  onSave: (character: CampaignCharacter) => void;
  onDelete: ((character: CampaignCharacter) => void) | null;

  constructor(
    app: App,
    character: CampaignCharacter,
    onSave: (character: CampaignCharacter) => void,
    onDelete: ((character: CampaignCharacter) => void) | null
  ) {
    super(app);
    this.character = character;
    this.onSave = onSave;
    this.onDelete = onDelete;
    if (!this.character.counters) this.character.counters = [];
    if (!this.character.conditions) this.character.conditions = [];
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', {
      text: this.onDelete ? t('party.editCharacter') : t('party.newCharacter'),
    });

    // 1. Nombre
    new Setting(contentEl)
      .setName(t('common.name'))
      .addText((text) =>
        text.setValue(this.character.name || '').onChange((v) => (this.character.name = v))
      );

    // 2. Color
    new Setting(contentEl)
      .setName(t('common.color'))
      .addColorPicker((c) =>
        c.setValue(this.character.color || '#4c8bf5').onChange((v) => (this.character.color = v))
      );

    // 3. Tamaño
    new Setting(contentEl)
      .setName(t('common.size'))
      .addSlider((s) =>
        s
          .setLimits(20, 120, 2)
          .setValue(this.character.size || 44)
          .setDynamicTooltip()
          .onChange((v) => (this.character.size = v))
      );

    // 4. Puntos de Vida
    new Setting(contentEl)
      .setName(t('common.currentHp'))
      .addText((text) => {
        text.inputEl.type = 'number';
        text.setValue(String(this.character.hp ?? 10));
        text.onChange((v) => (this.character.hp = parseInt(v, 10) || 0));
      });

    new Setting(contentEl)
      .setName(t('common.maxHp'))
      .addText((text) => {
        text.inputEl.type = 'number';
        text.setValue(String(this.character.maxHp ?? 10));
        text.onChange((v) => (this.character.maxHp = parseInt(v, 10) || 0));
      });

    // 5. Imagen
    const imageSetting = new Setting(contentEl)
      .setName(t('common.image'))
      .setDesc(this.character.imagePath ? this.character.imagePath : t('common.noImageDesc'));
    let imageInputEl: HTMLInputElement;
    imageSetting.addText((text) => {
      imageInputEl = text.inputEl;
      text
        .setPlaceholder('attachments/token.png')
        .setValue(this.character.imagePath || '')
        .onChange((v) => (this.character.imagePath = v.trim() || null));
    });
    imageSetting.addButton((btn) => {
      btn.setButtonText(t('common.selectImage')).onClick(() => {
        new FileSuggestModal(this.app, IMAGE_EXTS, (file) => {
          this.character.imagePath = file.path;
          imageInputEl.value = file.path;
        }).open();
      });
    });

    // 6. Icono RPG
    const iconSetting = new Setting(contentEl)
      .setName(t('common.iconField'))
      .setDesc(
        this.character.icon
          ? t('common.bestiaryIconDescAssigned', { icon: this.character.icon })
          : t('common.bestiaryIconDescEmpty')
      );
    let iconInputEl: HTMLInputElement;
    iconSetting.addText((text) => {
      iconInputEl = text.inputEl;
      text
        .setPlaceholder('ra-sword, ra-shield...')
        .setValue(this.character.icon || '')
        .onChange((v) => (this.character.icon = v.trim() || null));
    });
    iconSetting.addButton((btn) => {
      btn.setButtonText(t('common.iconCatalog')).onClick(() => {
        new IconSuggestModal(this.app, (selectedIcon) => {
          this.character.icon = selectedIcon;
          iconInputEl.value = selectedIcon;
        }).open();
      });
    });

    // 7. Nota Vinculada
    const noteSetting = new Setting(contentEl)
      .setName(t('common.linkedNote'))
      .setDesc(
        this.character.linkedNote
          ? t('common.linkedNoteTokenDescAssigned', { path: this.character.linkedNote })
          : t('common.linkedNoteTokenDescEmpty')
      );
    let noteInputEl: HTMLInputElement;
    noteSetting.addText((text) => {
      noteInputEl = text.inputEl;
      text
        .setPlaceholder('Notes/Character.md')
        .setValue(this.character.linkedNote || '')
        .onChange((v) => (this.character.linkedNote = v.trim() || null));
    });
    noteSetting.addButton((btn) => {
      btn.setButtonText(t('common.selectNote')).onClick(() => {
        new FileSuggestModal(this.app, ['md'], (file) => {
          this.character.linkedNote = file.path;
          noteInputEl.value = file.path;
          if (!this.character.name) this.character.name = file.basename;

          const hpVal = readFrontmatterStat(this.app, file.path, HP_KEYS);
          const maxHpVal = readFrontmatterStat(this.app, file.path, MAXHP_KEYS);
          const imgVal = readFrontmatterImagePath(this.app, file.path, IMAGE_KEYS);

          if (hpVal !== null) this.character.hp = hpVal;
          if (maxHpVal !== null) this.character.maxHp = maxHpVal;
          if (imgVal) this.character.imagePath = imgVal;

          this.onOpen();
        }).open();
      });
    });

    // 8. Contadores
    renderCountersEditor(contentEl, this.character.counters || [], () => this.onOpen());

    // 10. Botones de Acción
    const btnRow = contentEl.createDiv({ cls: 'dte-modal-buttons' });
    btnRow.style.display = 'flex';
    btnRow.style.justifyContent = 'space-between';
    btnRow.style.marginTop = '16px';

    if (this.onDelete) {
      const delBtn = btnRow.createEl('button', {
        cls: 'mod-warning',
        text: t('common.delete'),
      });
      delBtn.addEventListener('click', () => {
        if (!confirm(t('party.deleteConfirm', { name: this.character.name || t('common.unnamed') }))) return;
        this.close();
        if (this.onDelete) this.onDelete(this.character);
      });
    } else {
      btnRow.createDiv();
    }

    const rightBtns = btnRow.createDiv({ cls: 'dte-modal-buttons-right' });
    rightBtns.style.display = 'flex';
    rightBtns.style.gap = '8px';

    const cancelBtn = rightBtns.createEl('button', { text: t('common.cancel') });
    cancelBtn.addEventListener('click', () => this.close());

    const saveBtn = rightBtns.createEl('button', {
      cls: 'mod-cta',
      text: t('common.save'),
    });
    saveBtn.addEventListener('click', () => {
      if (!this.character.name) this.character.name = t('common.unnamed');
      this.close();
      this.onSave(this.character);
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export class PartyInheritModal extends Modal {
  character: CampaignCharacter;
  campaign: CampaignData;
  onChoice: (inherit: boolean) => void;

  constructor(
    app: App,
    character: CampaignCharacter,
    campaign: CampaignData,
    onChoice: (inherit: boolean) => void
  ) {
    super(app);
    this.character = character;
    this.campaign = campaign;
    this.onChoice = onChoice;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', {
      text: t('party.inheritModalTitle', { name: this.character.name || t('common.unnamed') }),
    });

    contentEl.createEl('p', {
      cls: 'dte-hint',
      text: t('party.inheritModalDesc'),
    });

    const choicesWrap = contentEl.createDiv({ cls: 'dte-inherit-choices-wrap' });
    choicesWrap.style.display = 'flex';
    choicesWrap.style.flexDirection = 'column';
    choicesWrap.style.gap = '12px';
    choicesWrap.style.margin = '16px 0';

    // Opción 1: Heredar estado actual
    const inheritBtn = choicesWrap.createEl('button', {
      cls: 'dte-inherit-choice-btn mod-cta',
    });

    inheritBtn.createEl('strong', {
      text: `✨ ${t('party.inheritOption', {
        hp: this.character.hp ?? this.character.maxHp ?? 10,
        maxHp: this.character.maxHp ?? 10,
      })}`,
    });
    const condCount = (this.character.conditions || []).length;
    const invCount = (this.character.inventory?.items || []).length;
    inheritBtn.createSpan({
      cls: 'dte-hint',
      text: `${condCount} cond., ${invCount} items en inventario`,
    });

    inheritBtn.addEventListener('click', () => {
      this.close();
      this.onChoice(true);
    });

    // Opción 2: Iniciar fresco
    const freshBtn = choicesWrap.createEl('button', {
      cls: 'dte-inherit-choice-btn',
    });

    freshBtn.createEl('strong', {
      text: `🔄 ${t('party.freshOption')}`,
    });
    freshBtn.createSpan({
      cls: 'dte-hint',
      text: `HP: ${this.character.maxHp ?? 10}/${this.character.maxHp ?? 10}, 0 condiciones`,
    });

    freshBtn.addEventListener('click', () => {
      this.close();
      this.onChoice(false);
    });

    // Recordar elección
    new Setting(contentEl)
      .setName(t('party.syncModeDesc'))
      .addDropdown((dd) => {
        dd.addOption('prompt', t('party.syncModePrompt'));
        dd.addOption('always', t('party.syncModeAlways'));
        dd.addOption('never', t('party.syncModeNever'));
        dd.setValue(this.campaign.characterSyncMode || 'prompt');
        dd.onChange((val) => {
          this.campaign.characterSyncMode = val as 'prompt' | 'always' | 'never';
        });
      });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export class PartyModal extends Modal {
  plugin: DinoPlugin;
  view: IDinoTabletopView;
  searchQuery: string = '';

  constructor(app: App, plugin: DinoPlugin, view: IDinoTabletopView) {
    super(app);
    this.plugin = plugin;
    this.view = view;
  }

  onOpen(): void {
    this.renderModal();
  }

  private renderModal(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('dte-party-modal-wrap');

    const camp = this.view.getCurrentCampaign();
    if (!camp) {
      contentEl.createEl('p', { text: t('diary.noCampaign') });
      return;
    }

    if (!camp.characters) {
      camp.characters = {};
    }

    // Header
    const headerEl = contentEl.createDiv({ cls: 'dte-bestiary-header' });
    headerEl.createEl('h2', { text: `👥 ${t('party.panelTitle')}` });

    // Top Bar
    const topBar = contentEl.createDiv({ cls: 'dte-bestiary-topbar' });

    // Search input
    const searchInput = topBar.createEl('input', {
      type: 'text',
      cls: 'dte-bestiary-search',
      placeholder: t('party.filterPlaceholder'),
    });
    searchInput.value = this.searchQuery;
    searchInput.addEventListener('input', (e) => {
      this.searchQuery = (e.target as HTMLInputElement).value.toLowerCase().trim();
      this.renderList(listContainer);
    });

    const actionButtons = topBar.createDiv({ cls: 'dte-bestiary-topbar-actions' });

    // Sync Mode dropdown
    const modeSelect = actionButtons.createEl('select', { cls: 'dropdown' });
    modeSelect.createEl('option', { value: 'prompt', text: `⚙️ ${t('party.syncModePrompt')}` });
    modeSelect.createEl('option', { value: 'always', text: `⚡ ${t('party.syncModeAlways')}` });
    modeSelect.createEl('option', { value: 'never', text: `🔄 ${t('party.syncModeNever')}` });
    modeSelect.value = camp.characterSyncMode || 'prompt';
    modeSelect.addEventListener('change', () => {
      camp.characterSyncMode = modeSelect.value as 'prompt' | 'always' | 'never';
      this.plugin.saveSettings();
    });

    // Nuevo Personaje Button
    const newBtn = actionButtons.createEl('button', {
      text: `➕ ${t('party.newCharacter')}`,
      cls: 'dte-btn mod-cta',
    });
    newBtn.addEventListener('click', () => {
      const newChar: CampaignCharacter = {
        id: genId(),
        name: '',
        color: '#4c8bf5',
        size: 44,
        hp: 10,
        maxHp: 10,
        linkedNote: null,
        imagePath: null,
        counters: [],
        conditions: [],
      };
      new PartyCharacterEditModal(
        this.app,
        newChar,
        (saved) => {
          if (!camp.characters) camp.characters = {};
          camp.characters[saved.id] = saved;
          this.plugin.saveSettings();
          this.renderModal();
        },
        null
      ).open();
    });

    // Character List Container
    const listContainer = contentEl.createDiv({ cls: 'dte-bestiary-list-wrap' });
    this.renderList(listContainer);
  }

  private renderList(container: HTMLElement): void {
    container.empty();
    const camp = this.view.getCurrentCampaign();
    if (!camp || !camp.characters) return;

    const map = this.view.getCurrentMap();
    let characters = Object.values(camp.characters);

    if (this.searchQuery) {
      characters = characters.filter((c) => {
        const nameMatch = (c.name || '').toLowerCase().includes(this.searchQuery);
        const noteMatch = (c.linkedNote || '').toLowerCase().includes(this.searchQuery);
        return nameMatch || noteMatch;
      });
    }

    if (characters.length === 0) {
      container.createDiv({
        cls: 'dte-empty-state',
        text: t('party.empty'),
      });
      return;
    }

    const list = container.createDiv({ cls: 'dte-bestiary-list' });

    for (const char of characters) {
      const row = list.createDiv({ cls: 'dte-bestiary-row' });

      // Thumbnail
      const thumb = row.createDiv({ cls: 'dte-bestiary-thumb' });
      thumb.style.background = char.color || '#4c8bf5';
      const imgFile = char.imagePath ? this.app.vault.getAbstractFileByPath(char.imagePath) : null;
      if (imgFile) {
        thumb.style.backgroundImage = `url("${this.app.vault.getResourcePath(imgFile as TFile)}")`;
      } else if (char.icon) {
        const iconCls = getIconClass(char.icon, 'ra');
        thumb.createEl('i', { cls: iconCls });
      } else {
        thumb.setText((char.name || '?').slice(0, 2).toUpperCase());
      }

      // Info
      const info = row.createDiv({ cls: 'dte-bestiary-info' });
      const nameRow = info.createDiv({ cls: 'dte-bestiary-name-row' });
      nameRow.createSpan({ cls: 'dte-bestiary-name', text: char.name || t('common.unnamed') });

      // Si está en el mapa actual o en otro
      if (char.currentMapId && camp.maps[char.currentMapId]) {
        const mapName = camp.maps[char.currentMapId].name;
        nameRow.createSpan({
          cls: 'dte-bestiary-pack-badge',
          text: `🗺️ ${mapName}`,
        });
      }

      const metaRow = info.createDiv({ cls: 'dte-bestiary-meta-row' });
      metaRow.createSpan({
        cls: 'dte-bestiary-hp-badge',
        text: `❤️ ${char.hp ?? 10}/${char.maxHp ?? 10} HP`,
      });

      if (char.inventory && char.inventory.items.length > 0) {
        metaRow.createSpan({
          cls: 'dte-bestiary-inv-badge',
          text: `🎒 ${char.inventory.items.length}`,
        });
      }

      if (char.conditions && char.conditions.length > 0) {
        for (const cond of char.conditions) {
          metaRow.createSpan({
            cls: 'dte-bestiary-pack-badge',
            text: `✨ ${cond.name}`,
          });
        }
      }

      if (char.linkedNote) {
        metaRow.createSpan({
          cls: 'dte-hint dte-bestiary-note-link',
          text: `🔗 ${char.linkedNote}`,
        });
      }

      // Actions
      const actions = row.createDiv({ cls: 'dte-bestiary-actions' });
      const placeBtn = actions.createEl('button', {
        text: `📍 ${t('party.placeOnMap')}`,
        cls: 'dte-btn dte-btn-primary',
      }) as HTMLButtonElement;
      placeBtn.disabled = !map;

      placeBtn.addEventListener('click', () => {
        if (!map) {
          new Notice(t('bestiary.spawnNoMap'));
          return;
        }
        this.handlePlaceCharacter(camp, map, char);
      });

      actions.createEl('button', { text: t('common.edit'), cls: 'dte-btn' }).addEventListener('click', () => {
        new PartyCharacterEditModal(
          this.app,
          { ...char, counters: (char.counters || []).map((c) => ({ ...c })) },
          (saved) => {
            if (!camp.characters) camp.characters = {};
            camp.characters[saved.id] = saved;
            this.plugin.saveSettings();
            this.renderModal();
            this.view.render();
          },
          (toDelete) => {
            if (camp.characters) {
              delete camp.characters[toDelete.id];
              this.plugin.saveSettings();
              this.renderModal();
              this.view.render();
            }
          }
        ).open();
      });
    }
  }

  private handlePlaceCharacter(camp: CampaignData, map: MapData, char: CampaignCharacter): void {
    const mode = camp.characterSyncMode || 'prompt';

    if (mode === 'always') {
      this.spawnTokenOnMap(camp, map, char, true);
    } else if (mode === 'never') {
      this.spawnTokenOnMap(camp, map, char, false);
    } else {
      new PartyInheritModal(this.app, char, camp, (inherit) => {
        this.spawnTokenOnMap(camp, map, char, inherit);
      }).open();
    }
  }

  private spawnTokenOnMap(
    camp: CampaignData,
    map: MapData,
    char: CampaignCharacter,
    inheritState: boolean
  ): void {
    const center = this.view.getViewportCenterCoords();
    const isWorld = map.coordSpace === 'world' || !!map.cellMap;
    const offsetStep = isWorld ? 24 : 2.5;
    const nearbyCount = map.tokens.filter(
      (t) => Math.abs(t.x - center.x) < (isWorld ? 60 : 6) && Math.abs(t.y - center.y) < (isWorld ? 60 : 6)
    ).length;
    const offsetX = (nearbyCount % 4) * offsetStep;
    const offsetY = Math.floor(nearbyCount / 4) * offsetStep;

    const hp = inheritState ? (char.hp ?? char.maxHp ?? 10) : (char.maxHp ?? 10);
    const maxHp = char.maxHp ?? 10;

    const token: TokenData = {
      id: genId(),
      characterId: char.id,
      name: char.name || t('common.unnamed'),
      color: char.color || '#4c8bf5',
      size: char.size || 44,
      x: isWorld ? Math.round(center.x + offsetX) : clamp(Math.round((center.x + offsetX) * 10) / 10, 5, 95),
      y: isWorld ? Math.round(center.y + offsetY) : clamp(Math.round((center.y + offsetY) * 10) / 10, 5, 95),
      hp,
      maxHp,
      linkedNote: char.linkedNote || null,
      imagePath: char.imagePath || null,
      icon: char.icon || null,
      dmOnly: char.dmOnly || false,
      revealsFog: char.revealsFog || null,
      conditions: inheritState && char.conditions ? char.conditions.map((c) => ({ ...c })) : [],
      counters: char.counters
        ? char.counters.map((c) => ({ ...c, value: inheritState ? c.value : 0 }))
        : [],
      inventory: char.inventory
        ? {
            items: char.inventory.items.map((i) => ({ ...i, id: genId() })),
            capacity: { ...char.inventory.capacity },
          }
        : undefined,
    };

    map.tokens.push(token);

    // Actualizar seguimiento de mapa en el personaje de campaña
    char.currentMapId = camp.currentMapId;
    if (!inheritState) {
      char.hp = maxHp;
      char.conditions = [];
    }

    this.plugin.saveSettings();
    this.view.render();
    new Notice(t('party.placedNotice', { name: token.name }));
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
