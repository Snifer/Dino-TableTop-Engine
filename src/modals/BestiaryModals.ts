import { App, Modal, Notice, Setting, TFile } from 'obsidian';
import { BestiaryEntry, HP_KEYS, MAXHP_KEYS, IMAGE_KEYS, IMAGE_EXTS, MapData, TokenData } from '../types';
import { genId, getIconClass, readFrontmatterStat, readFrontmatterImagePath } from '../utils';
import { renderCountersEditor } from './CountersEditor';
import { FileSuggestModal } from './FileSuggestModal';
import { IconSuggestModal } from './IconSuggestModal';

export class BestiaryEntryEditModal extends Modal {
  entry: BestiaryEntry;
  onSave: (entry: BestiaryEntry) => void;
  onDelete: ((entry: BestiaryEntry) => void) | null;

  constructor(
    app: App,
    entry: BestiaryEntry,
    onSave: (entry: BestiaryEntry) => void,
    onDelete: ((entry: BestiaryEntry) => void) | null
  ) {
    super(app);
    this.entry = entry;
    this.onSave = onSave;
    this.onDelete = onDelete;
    if (!this.entry.counters) this.entry.counters = [];
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: this.onDelete ? 'Editar criatura' : 'Nueva criatura del bestiario' });

    new Setting(contentEl)
      .setName('Nombre')
      .addText((t) => t.setValue(this.entry.name || '').onChange((v) => (this.entry.name = v)));

    new Setting(contentEl)
      .setName('Color')
      .addColorPicker((c) =>
        c.setValue(this.entry.color || '#8b3a3a').onChange((v) => (this.entry.color = v))
      );

    new Setting(contentEl)
      .setName('Tamaño (px)')
      .addSlider((s) =>
        s
          .setLimits(20, 120, 2)
          .setValue(this.entry.size || 44)
          .setDynamicTooltip()
          .onChange((v) => (this.entry.size = v))
      );

    new Setting(contentEl)
      .setName('Imagen')
      .setDesc(this.entry.imagePath ? this.entry.imagePath : 'Ninguna.')
      .addButton((b) =>
        b.setButtonText('Elegir imagen').onClick(() => {
          new FileSuggestModal(this.app, IMAGE_EXTS, (file) => {
            this.entry.imagePath = file.path;
            this.onOpen();
          }).open();
        })
      )
      .addExtraButton((b) =>
        b
          .setIcon('x')
          .setTooltip('Quitar imagen')
          .onClick(() => {
            if (!confirm('¿Quitar la imagen asignada a esta criatura?')) return;
            this.entry.imagePath = null;
            this.onOpen();
          })
      );

    const bestiaryIconSetting = new Setting(contentEl)
      .setName('Ícono (Custom Font / RPG-Awesome)')
      .setDesc(
        this.entry.icon
          ? `Ícono asignado: "${this.entry.icon}". Se copiará al token cuando se coloque en el mapa.`
          : 'Opcional. Se muestra si no hay imagen asignada (ej. ra-dragon, ra-monster-skull, ra-hydra).',
      )
      .addText((t) =>
        t
          .setPlaceholder('ej. ra-dragon')
          .setValue(this.entry.icon || '')
          .onChange((v) => {
            this.entry.icon = v.trim() || null;
          })
      )
      .addButton((b) =>
        b
          .setButtonText('Catálogo')
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
          .setTooltip('Quitar ícono')
          .onClick(() => {
            this.entry.icon = null;
            this.onOpen();
          })
      );
    }

    new Setting(contentEl)
      .setName('Nota vinculada (ficha de la criatura)')
      .setDesc(
        this.entry.linkedNote
          ? this.entry.linkedNote
          : 'Ninguna. Si la vinculas, el HP se leerá de su YAML cada vez que coloques un token de esta criatura.',
      )
      .addButton((b) =>
        b.setButtonText('Elegir nota').onClick(() => {
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
          .setTooltip('Quitar vínculo')
          .onClick(() => {
            this.entry.linkedNote = null;
            this.onOpen();
          })
      );

    new Setting(contentEl)
      .setName('HP por defecto')
      .setDesc('Se usa solo si no hay nota vinculada, o si la nota no tiene HP en su YAML.')
      .addText((t) =>
        t.setValue(String(this.entry.defaultHp ?? 10)).onChange((v) => {
          const n = Number(v);
          if (!isNaN(n)) this.entry.defaultHp = n;
        })
      );

    new Setting(contentEl).setName('HP máximo por defecto').addText((t) =>
      t.setValue(String(this.entry.defaultMaxHp ?? 10)).onChange((v) => {
        const n = Number(v);
        if (!isNaN(n)) this.entry.defaultMaxHp = n;
      })
    );

    if (this.entry.linkedNote) {
      const info = contentEl.createDiv({ cls: 'dte-hint' });
      info.setText(
        'Claves de YAML reconocidas para HP: ' +
          HP_KEYS.join(', ') +
          ' — para HP máximo: ' +
          MAXHP_KEYS.join(', ')
      );
    }

    renderCountersEditor(contentEl, this.entry.counters, () => this.onOpen());

    const btnRow = new Setting(contentEl);
    btnRow.addButton((b) =>
      b
        .setButtonText('Guardar')
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
          .setButtonText('Eliminar criatura')
          .setWarning()
          .onClick(() => {
            if (!confirm(`¿Eliminar la criatura "${this.entry.name || 'sin nombre'}"? Esta acción no se puede deshacer.`)) return;
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

  constructor(app: App, plugin: any, view: any) {
    super(app);
    this.plugin = plugin;
    this.view = view;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: 'Bestiario' });
    contentEl.createDiv({
      cls: 'dte-hint',
      text:
        'Plantillas de tokens reutilizables. "Colocar en mapa" crea un token nuevo e independiente en el mapa activo, ' +
        'con las estadísticas iniciales tomadas de la nota vinculada.',
    });

    const bestiary = this.plugin.settings.bestiary;
    const map = this.view.getCurrentMap();

    const list = contentEl.createDiv({ cls: 'dte-bestiary-list' });
    const ids = Object.keys(bestiary);
    if (!ids.length) {
      list.createDiv({ cls: 'dte-empty', text: 'Aún no hay criaturas guardadas.' });
    }
    for (const id of ids) {
      const entry = bestiary[id];
      const row = list.createDiv({ cls: 'dte-bestiary-row' });

      const thumb = row.createDiv({ cls: 'dte-bestiary-thumb' });
      thumb.style.background = entry.color || '#8b3a3a';
      const imgFile = entry.imagePath ? this.app.vault.getAbstractFileByPath(entry.imagePath) : null;
      if (imgFile) {
        thumb.style.backgroundImage = `url("${this.app.vault.getResourcePath(imgFile as TFile)}")`;
        thumb.style.backgroundSize = 'cover';
        thumb.style.backgroundPosition = 'center';
      } else if (entry.icon && this.plugin.settings.enableCustomFont) {
        const iconCls = getIconClass(entry.icon, this.plugin.settings.customFontPrefix);
        const iconEl = thumb.createEl('i', { cls: iconCls });
        iconEl.style.fontSize = '18px';
      } else {
        thumb.setText((entry.name || '?').slice(0, 2).toUpperCase());
      }

      const info = row.createDiv({ cls: 'dte-bestiary-info' });
      info.createDiv({ cls: 'dte-bestiary-name', text: entry.name || '(sin nombre)' });
      if (entry.linkedNote) info.createDiv({ cls: 'dte-hint', text: entry.linkedNote });

      const actions = row.createDiv({ cls: 'dte-bestiary-actions' });
      const placeBtn = actions.createEl('button', { text: 'Colocar en mapa' }) as HTMLButtonElement;
      placeBtn.disabled = !map;
      placeBtn.addEventListener('click', () => {
        if (!map) return;
        this.placeOnMap(map, entry);
      });
      actions.createEl('button', { text: 'Editar' }).addEventListener('click', () => {
        new BestiaryEntryEditModal(
          this.app,
          Object.assign({}, entry, { counters: (entry.counters || []).map((c: any) => Object.assign({}, c)) }),
          (saved) => {
            bestiary[id] = saved;
            this.plugin.saveSettings();
            this.onOpen();
          },
          () => {
            delete bestiary[id];
            this.plugin.saveSettings();
            this.onOpen();
          }
        ).open();
      });
      actions.createEl('button', { text: 'Eliminar' }).addEventListener('click', () => {
        if (!confirm(`¿Eliminar "${entry.name || 'esta criatura'}" del bestiario? Los tokens ya colocados en mapas no se ven afectados. Esta acción no se puede deshacer.`)) return;
        delete bestiary[id];
        this.plugin.saveSettings();
        this.onOpen();
      });
    }

    contentEl.createEl('button', { text: '+ Nueva criatura', cls: 'mod-cta' }).addEventListener('click', () => {
      const entry: BestiaryEntry = {
        id: genId(),
        name: '',
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
        (saved) => {
          bestiary[saved.id] = saved;
          this.plugin.saveSettings();
          this.onOpen();
        },
        null
      ).open();
    });
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
    const token: TokenData = {
      id: genId(),
      name: entry.name || 'Criatura',
      color: entry.color || '#8b3a3a',
      size: entry.size || 44,
      x: 50,
      y: 50,
      hp,
      maxHp,
      linkedNote: entry.linkedNote || null,
      imagePath: entry.imagePath || null,
      icon: entry.icon || null,
      counters: (entry.counters || []).map((c) => Object.assign({}, c, { id: genId() })),
    };
    map.tokens.push(token);
    this.plugin.saveSettings();
    this.view.render();
    new Notice(`"${token.name}" colocado en el mapa`);
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
