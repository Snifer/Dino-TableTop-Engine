import { App, Modal, Setting, TFile } from 'obsidian';
import { TokenData, HP_KEYS, MAXHP_KEYS, IMAGE_KEYS, IMAGE_EXTS } from '../types';
import { readFrontmatterStat, readFrontmatterImagePath } from '../utils';
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
    contentEl.createEl('h2', { text: this.onDelete ? 'Editar token' : 'Nuevo token' });

    new Setting(contentEl)
      .setName('Nombre')
      .addText((t) => t.setValue(this.token.name || '').onChange((v) => (this.token.name = v)));

    new Setting(contentEl)
      .setName('Color')
      .addColorPicker((c) =>
        c.setValue(this.token.color || '#4c8bf5').onChange((v) => (this.token.color = v))
      );

    new Setting(contentEl)
      .setName('Tamaño (px)')
      .addSlider((s) =>
        s
          .setLimits(20, 120, 2)
          .setValue(this.token.size || 44)
          .setDynamicTooltip()
          .onChange((v) => (this.token.size = v))
      );

    new Setting(contentEl)
      .setName('Imagen del token')
      .setDesc(
        this.token.imagePath
          ? this.token.imagePath
          : 'Ninguna. Sin imagen se mostrará el ícono o las iniciales del nombre.',
      )
      .addButton((b) =>
        b.setButtonText('Elegir imagen').onClick(() => {
          new FileSuggestModal(this.app, IMAGE_EXTS, (file) => {
            this.token.imagePath = file.path;
            this.onOpen();
          }).open();
        })
      )
      .addExtraButton((b) =>
        b
          .setIcon('x')
          .setTooltip('Quitar imagen')
          .onClick(() => {
            if (!confirm('¿Quitar la imagen asignada a este token?')) return;
            this.token.imagePath = null;
            this.onOpen();
          })
      );

    const tokenIconSetting = new Setting(contentEl)
      .setName('Ícono (Custom Font / RPG-Awesome)')
      .setDesc(
        this.token.icon
          ? `Ícono asignado: "${this.token.icon}". Se muestra en el círculo si no hay imagen.`
          : 'Opcional. Se muestra si no hay imagen asignada (ej. ra-sword, ra-dragon, ra-shield).',
      )
      .addText((t) =>
        t
          .setPlaceholder('ej. ra-sword')
          .setValue(this.token.icon || '')
          .onChange((v) => {
            this.token.icon = v.trim() || null;
          })
      )
      .addButton((b) =>
        b
          .setButtonText('Catálogo')
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
          .setTooltip('Quitar ícono')
          .onClick(() => {
            this.token.icon = null;
            this.onOpen();
          })
      );
    }

    new Setting(contentEl)
      .setName('Nota vinculada')
      .setDesc(
        this.token.linkedNote
          ? this.token.linkedNote
          : 'Ninguna. Si vinculas una nota, sus datos de YAML (hp/maxHp) sobreescribirán los valores manuales.',
      )
      .addButton((b) =>
        b.setButtonText('Elegir nota').onClick(() => {
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
          .setTooltip('Quitar vínculo')
          .onClick(() => {
            this.token.linkedNote = null;
            this.onOpen();
          })
      );

    new Setting(contentEl).setName('Puntos de vida (HP)').addText((t) =>
      t.setValue(String(this.token.hp ?? 10)).onChange((v) => {
        const n = Number(v);
        if (!isNaN(n)) this.token.hp = n;
      })
    );

    new Setting(contentEl).setName('HP máximo').addText((t) =>
      t.setValue(String(this.token.maxHp ?? 10)).onChange((v) => {
        const n = Number(v);
        if (!isNaN(n)) this.token.maxHp = n;
      })
    );

    if (this.token.linkedNote) {
      const info = contentEl.createDiv({ cls: 'dte-hint' });
      info.setText(
        'Claves de YAML reconocidas para HP: ' +
          HP_KEYS.join(', ') +
          ' — para HP máximo: ' +
          MAXHP_KEYS.join(', ')
      );
    }

    renderCountersEditor(contentEl, this.token.counters, () => this.onOpen());

    const btnRow = new Setting(contentEl);
    btnRow.addButton((b) =>
      b
        .setButtonText('Guardar')
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
          .setButtonText('Eliminar token')
          .setWarning()
          .onClick(() => {
            if (!confirm(`¿Eliminar el token "${this.token.name || 'sin nombre'}"? Esta acción no se puede deshacer.`)) return;
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
