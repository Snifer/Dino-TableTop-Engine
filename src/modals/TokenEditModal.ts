import { App, Modal, Setting, TFile } from 'obsidian';
import { TokenData, HP_KEYS, MAXHP_KEYS, IMAGE_KEYS, IMAGE_EXTS } from '../types';
import { readFrontmatterStat, readFrontmatterImagePath } from '../utils';
import { t } from '../i18n';
import { renderCountersEditor } from './CountersEditor';
import { FileSuggestModal } from './FileSuggestModal';
import { IconSuggestModal } from './IconSuggestModal';

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
