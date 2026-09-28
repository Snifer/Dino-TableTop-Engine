import { App, Modal, Setting, TFile } from 'obsidian';
import { TokenData, HP_KEYS, MAXHP_KEYS, IMAGE_KEYS, IMAGE_EXTS } from '../types';
import { readFrontmatterStat, readFrontmatterImagePath } from '../utils';
import { t } from '../i18n';
import { renderCountersEditor } from './CountersEditor';
import { FileSuggestModal } from './FileSuggestModal';
import { IconSuggestModal } from './IconSuggestModal';
import { AddConditionModal, AdjustConditionModal } from '../modules/combatTracker';

export class TokenEditModal extends Modal {
  token: TokenData;
  onSave: (token: TokenData) => void;
  onDelete: ((token: TokenData) => void) | null;

  constructor(
    app: App,
    token: TokenData,
    onSave: (token: TokenData) => void,
    onDelete: ((token: TokenData) => void) | null
  ) {
    super(app);
    this.token = token;
    this.onSave = onSave;
    this.onDelete = onDelete;
    if (!this.token.counters) this.token.counters = [];
    if (!this.token.conditions) this.token.conditions = [];
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: this.onDelete ? t('token.editTitle') : t('token.newTitle') });

    new Setting(contentEl)
      .setName(t('common.name'))
      .addText((text) => text.setValue(this.token.name || '').onChange((v) => (this.token.name = v)));

    new Setting(contentEl)
      .setName(t('common.color'))
      .addColorPicker((c) =>
        c.setValue(this.token.color || '#4c8bf5').onChange((v) => (this.token.color = v))
      );

    new Setting(contentEl)
      .setName(t('common.size'))
      .addSlider((s) =>
        s
          .setLimits(20, 120, 2)
          .setValue(this.token.size || 44)
          .setDynamicTooltip()
          .onChange((v) => (this.token.size = v))
      );

    new Setting(contentEl)
      .setName(t('common.tokenImage'))
      .setDesc(
        this.token.imagePath
          ? this.token.imagePath
          : t('common.noImageTokenDesc'),
      )
      .addButton((b) =>
        b.setButtonText(t('common.selectImage')).onClick(() => {
          new FileSuggestModal(this.app, IMAGE_EXTS, (file) => {
            this.token.imagePath = file.path;
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
            this.token.imagePath = null;
            this.onOpen();
          })
      );

    const tokenIconSetting = new Setting(contentEl)
      .setName(t('common.iconField'))
      .setDesc(
        this.token.icon
          ? t('common.tokenIconDescAssigned', { icon: this.token.icon })
          : t('common.tokenIconDescEmpty'),
      )
      .addText((text) =>
        text
          .setPlaceholder('ra-sword')
          .setValue(this.token.icon || '')
          .onChange((v) => {
            this.token.icon = v.trim() || null;
          })
      )
      .addButton((b) =>
        b
          .setButtonText(t('common.iconCatalog'))
          .setIcon('search')
          .onClick(() => {
            new IconSuggestModal(this.app, (chosen) => {
              this.token.icon = chosen;
              this.onOpen();
            }).open();
          })
      );

    if (this.token.icon) {
      tokenIconSetting.addExtraButton((b) =>
        b
          .setIcon('x')
          .setTooltip(t('common.removeIcon'))
          .onClick(() => {
            this.token.icon = null;
            this.onOpen();
          })
      );
    }

    new Setting(contentEl)
      .setName(t('common.linkedNote'))
      .setDesc(
        this.token.linkedNote
          ? t('common.linkedNoteTokenDescAssigned', { path: this.token.linkedNote })
          : t('common.linkedNoteTokenDescEmpty'),
      )
      .addButton((b) =>
        b.setButtonText(t('common.selectNote')).onClick(() => {
          new FileSuggestModal(this.app, null, (file) => {
            this.token.linkedNote = file.path;
            this.applyLinkedStats();
            this.onOpen();
          }).open();
        })
      )
      .addExtraButton((b) =>
        b
          .setIcon('x')
          .setTooltip(t('common.removeLink'))
          .onClick(() => {
            this.token.linkedNote = null;
            this.onOpen();
          })
      );

    new Setting(contentEl).setName(t('common.currentHp')).addText((text) =>
      text.setValue(String(this.token.hp ?? 10)).onChange((v) => {
        const n = Number(v);
        if (!isNaN(n)) this.token.hp = n;
      })
    );

    new Setting(contentEl).setName(t('common.maxHp')).addText((text) =>
      text.setValue(String(this.token.maxHp ?? 10)).onChange((v) => {
        const n = Number(v);
        if (!isNaN(n)) this.token.maxHp = n;
      })
    );

    if (this.token.linkedNote) {
      const info = contentEl.createDiv({ cls: 'dte-hint' });
      info.setText(
        t('common.yamlHint', {
          hpKeys: HP_KEYS.join(', '),
          maxHpKeys: MAXHP_KEYS.join(', '),
        })
      );
    }

    renderCountersEditor(contentEl, this.token.counters, () => this.onOpen());

    // Editor de condiciones y efectos de estado
    this.token.conditions = this.token.conditions || [];
    const condHeader = contentEl.createEl('h3', { text: t('modules.combatConditionTitle') });
    condHeader.style.marginTop = '18px';

    const condsWrap = contentEl.createDiv({ cls: 'dte-combat-conditions-row' });
    condsWrap.style.marginBottom = '12px';
    for (let cIdx = 0; cIdx < this.token.conditions.length; cIdx++) {
      const cond = this.token.conditions[cIdx];
      const durText = cond.roundsRemaining !== null ? `${cond.roundsRemaining}r` : '∞';
      const condBadge = condsWrap.createSpan({
        cls: 'dte-combat-condition-badge',
        text: `${cond.icon || '✨'} ${cond.name} (${durText})`,
        attr: { 'aria-label': `${cond.name} (${durText})` },
      });
      if (cond.color) condBadge.style.borderColor = cond.color;
      condBadge.addEventListener('click', () => {
        new AdjustConditionModal(this.app, cond, this.token.name || t('common.unnamed'), (updated) => {
          if (updated === null) {
            this.token.conditions?.splice(cIdx, 1);
          }
          this.onOpen();
        }).open();
      });
    }

    const addCondBtn = condsWrap.createEl('button', {
      cls: 'dte-btn',
      text: t('modules.combatAddCondition'),
    });
    addCondBtn.style.fontSize = '11px';
    addCondBtn.style.height = '24px';
    addCondBtn.addEventListener('click', () => {
      new AddConditionModal(this.app, (newCond) => {
        this.token.conditions = this.token.conditions || [];
        this.token.conditions.push(newCond);
        this.onOpen();
      }).open();
    });

    const btnRow = new Setting(contentEl);
    btnRow.addButton((b) =>
      b
        .setButtonText(t('common.save'))
        .setCta()
        .onClick(() => {
          this.close();
          this.onSave(this.token);
        })
    );
    if (this.onDelete) {
      const onDelete = this.onDelete;
      btnRow.addButton((b) =>
        b
          .setButtonText(t('token.deleteBtn'))
          .setWarning()
          .onClick(() => {
            if (!confirm(t('token.deleteConfirm', { name: this.token.name || t('common.unnamed') }))) return;
            this.close();
            onDelete(this.token);
          })
      );
    }
  }

  applyLinkedStats(): void {
    if (!this.token.linkedNote) return;
    const hp = readFrontmatterStat(this.app, this.token.linkedNote, HP_KEYS);
    const maxHp = readFrontmatterStat(this.app, this.token.linkedNote, MAXHP_KEYS);
    const img = readFrontmatterImagePath(this.app, this.token.linkedNote, IMAGE_KEYS);
    if (hp !== null) this.token.hp = hp;
    if (maxHp !== null) this.token.maxHp = maxHp;
    if (img) this.token.imagePath = img;
    if (!this.token.name) {
      const file = this.app.vault.getAbstractFileByPath(this.token.linkedNote);
      if (file) this.token.name = (file as TFile).basename;
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
