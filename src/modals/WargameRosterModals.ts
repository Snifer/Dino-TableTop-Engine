import { App, Modal, Setting, setIcon, TFile } from 'obsidian';
import {
  WargameRoster,
  WargameRosterUnit,
  WargameArcs,
  IMAGE_EXTS,
} from '../types';
import { genId } from '../utils';
import { t } from '../i18n';
import { FileSuggestModal } from './FileSuggestModal';
import { NamePromptModal } from './NamePromptModal';

export class WargameRosterListModal extends Modal {
  plugin: any;
  view: any;
  selectedRosterId: string | null;

  constructor(app: App, plugin: any, view: any) {
    super(app);
    this.plugin = plugin;
    this.view = view;
    if (!this.plugin.settings.wargameRosters) {
      this.plugin.settings.wargameRosters = {};
    }
    this.selectedRosterId = this.plugin.settings.activeRosterId || null;
    const rosterIds = Object.keys(this.plugin.settings.wargameRosters);
    if (!this.selectedRosterId && rosterIds.length > 0) {
      this.selectedRosterId = rosterIds[0];
    }
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('dte-wargame-roster-modal');

    const rosters: Record<string, WargameRoster> = this.plugin.settings.wargameRosters || {};
    const rosterIds = Object.keys(rosters);
    const activeRoster = this.selectedRosterId ? rosters[this.selectedRosterId] : null;

    // Header
    const header = contentEl.createDiv({ cls: 'dte-modal-header-row' });
    header.createEl('h2', { text: t('wargame.rosterListTitle') });

    const newRosterBtn = header.createEl('button', {
      cls: 'mod-cta dte-btn',
      text: t('wargame.newRoster'),
    });
    const plusIcon = newRosterBtn.createSpan({ cls: 'dte-btn-icon-prefix' });
    setIcon(plusIcon, 'plus');
    newRosterBtn.prepend(plusIcon);
    newRosterBtn.addEventListener('click', () => {
      new NamePromptModal(
        this.app,
        t('wargame.newRoster'),
        t('wargame.rosterNamePrompt'),
        (name) => {
          if (!name) return;
          const id = genId();
          rosters[id] = { id, name, units: [] };
          this.selectedRosterId = id;
          this.plugin.settings.activeRosterId = id;
          this.plugin.saveSettings();
          this.onOpen();
        }
      ).open();
    });

    if (rosterIds.length === 0) {
      contentEl.createDiv({ cls: 'dte-empty', text: t('wargame.noRosters') });
      return;
    }

    // Top Bar: Roster selector dropdown + actions
    const selectRow = contentEl.createDiv({ cls: 'dte-roster-select-row' });
    const select = selectRow.createEl('select', { cls: 'dropdown dte-select' });
    for (const id of rosterIds) {
      const opt = select.createEl('option', {
        text: rosters[id].name,
        value: id,
      });
      if (id === this.selectedRosterId) opt.selected = true;
    }
    select.addEventListener('change', () => {
      this.selectedRosterId = select.value;
      this.plugin.settings.activeRosterId = select.value;
      this.plugin.saveSettings();
      this.onOpen();
    });

    // Rename active roster
    const renameBtn = selectRow.createEl('button', {
      cls: 'clickable-icon dte-btn-icon',
      attr: { 'aria-label': t('wargame.renameRoster') },
    });
    setIcon(renameBtn, 'pencil');
    renameBtn.addEventListener('click', () => {
      if (!activeRoster) return;
      new NamePromptModal(
        this.app,
        t('wargame.renameRoster'),
        activeRoster.name,
        (newName) => {
          if (!newName) return;
          activeRoster.name = newName;
          this.plugin.saveSettings();
          this.onOpen();
        }
      ).open();
    });

    // Delete active roster
    const deleteBtn = selectRow.createEl('button', {
      cls: 'clickable-icon dte-btn-icon',
      attr: { 'aria-label': t('wargame.deleteRoster') },
    });
    setIcon(deleteBtn, 'trash');
    deleteBtn.addEventListener('click', () => {
      if (!activeRoster) return;
      if (!confirm(t('wargame.deleteRosterConfirm', { name: activeRoster.name }))) return;
      delete rosters[activeRoster.id];
      const remaining = Object.keys(rosters);
      this.selectedRosterId = remaining.length > 0 ? remaining[0] : null;
      this.plugin.settings.activeRosterId = this.selectedRosterId;
      this.plugin.saveSettings();
      this.onOpen();
    });

    if (!activeRoster) return;

    // Total points calculation
    const totalPoints = (activeRoster.units || []).reduce(
      (sum, u) => sum + (u.pointCost || 0),
      0
    );
    const totalModels = (activeRoster.units || []).reduce(
      (sum, u) => sum + (u.modelsCount || 1),
      0
    );

    const summaryCard = contentEl.createDiv({ cls: 'dte-roster-summary-card' });
    const ptsBadge = summaryCard.createDiv({ cls: 'dte-roster-pts-badge' });
    ptsBadge.createSpan({ cls: 'dte-pts-val', text: String(totalPoints) });
    ptsBadge.createSpan({ cls: 'dte-pts-label', text: t('wargame.pointsLabel') });

    const unitsCountEl = summaryCard.createDiv({ cls: 'dte-roster-models-count' });
    unitsCountEl.setText(
      t('wargame.summaryStats', {
        units: activeRoster.units.length,
        models: totalModels,
      })
    );

    const addUnitBtn = summaryCard.createEl('button', {
      cls: 'mod-cta dte-btn',
      text: t('wargame.addUnit'),
    });
    const unitPlusIcon = addUnitBtn.createSpan({ cls: 'dte-btn-icon-prefix' });
    setIcon(unitPlusIcon, 'user-plus');
    addUnitBtn.prepend(unitPlusIcon);
    addUnitBtn.addEventListener('click', () => {
      const newUnit: WargameRosterUnit = {
        id: genId(),
        name: '',
        pointCost: 100,
        modelsCount: 5,
        imagePath: null,
        linkedNote: null,
        woundsPerModel: 1,
        arcs: { front: 90, flank: 90, rear: 180 },
        baseSizePx: 36,
        cohesionDistanceMm: 50,
        color: '#4c8bf5',
      };
      new WargameUnitEditModal(this.app, newUnit, (saved) => {
        activeRoster.units.push(saved);
        this.plugin.saveSettings();
        this.onOpen();
      }).open();
    });

    // Units List
    const unitsList = contentEl.createDiv({ cls: 'dte-wargame-units-list' });
    if (!activeRoster.units || activeRoster.units.length === 0) {
      unitsList.createDiv({ cls: 'dte-empty', text: t('wargame.noUnitsInRoster') });
      return;
    }

    for (let i = 0; i < activeRoster.units.length; i++) {
      const unit = activeRoster.units[i];
      const card = unitsList.createDiv({ cls: 'dte-wargame-unit-card' });

      // Thumbnail
      const thumb = card.createDiv({ cls: 'dte-unit-thumb' });
      thumb.style.background = unit.color || '#4c8bf5';
      if (unit.imagePath) {
        const af = this.app.vault.getAbstractFileByPath(unit.imagePath);
        if (af instanceof TFile) {
          thumb.style.backgroundImage = `url("${this.app.vault.getResourcePath(af)}")`;
          thumb.style.backgroundSize = 'cover';
          thumb.style.backgroundPosition = 'center';
        }
      } else {
        thumb.setText((unit.name || '?').slice(0, 2).toUpperCase());
      }

      // Info
      const info = card.createDiv({ cls: 'dte-unit-info' });
      const titleRow = info.createDiv({ cls: 'dte-unit-title-row' });
      titleRow.createSpan({ cls: 'dte-unit-name', text: unit.name || t('common.unnamed') });
      titleRow.createSpan({ cls: 'dte-unit-pts', text: `${unit.pointCost} pts` });

      const details = info.createDiv({ cls: 'dte-unit-details' });
      details.setText(
        t('wargame.unitDetailsText', {
          models: unit.modelsCount,
          wounds: unit.woundsPerModel,
          cohesion: unit.cohesionDistanceMm ? `${unit.cohesionDistanceMm}mm` : t('common.none'),
        })
      );

      // Actions
      const actions = card.createDiv({ cls: 'dte-unit-actions' });
      const editBtn = actions.createEl('button', {
        cls: 'clickable-icon dte-btn-icon',
        attr: { 'aria-label': t('common.edit') },
      });
      setIcon(editBtn, 'pencil');
      editBtn.addEventListener('click', () => {
        new WargameUnitEditModal(this.app, { ...unit }, (saved) => {
          activeRoster.units[i] = saved;
          this.plugin.saveSettings();
          this.onOpen();
        }).open();
      });

      const delBtn = actions.createEl('button', {
        cls: 'clickable-icon dte-btn-icon',
        attr: { 'aria-label': t('common.delete') },
      });
      setIcon(delBtn, 'trash');
      delBtn.addEventListener('click', () => {
        if (!confirm(t('wargame.deleteUnitConfirm', { name: unit.name || t('common.unnamed') }))) return;
        activeRoster.units.splice(i, 1);
        this.plugin.saveSettings();
        this.onOpen();
      });
    }
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}

export class WargameUnitEditModal extends Modal {
  unit: WargameRosterUnit;
  onSave: (unit: WargameRosterUnit) => void;

  constructor(app: App, unit: WargameRosterUnit, onSave: (unit: WargameRosterUnit) => void) {
    super(app);
    this.unit = {
      ...unit,
      arcs: unit.arcs || { front: 90, flank: 90, rear: 180 },
    };
    this.onSave = onSave;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('dte-wargame-unit-edit-modal');

    contentEl.createEl('h2', {
      text: this.unit.name ? t('wargame.editUnitTitle') : t('wargame.newUnitTitle'),
    });

    new Setting(contentEl)
      .setName(t('common.name'))
      .addText((tx) => tx.setValue(this.unit.name || '').onChange((v) => (this.unit.name = v)));

    new Setting(contentEl)
      .setName(t('wargame.pointCost'))
      .setDesc(t('wargame.pointCostDesc'))
      .addText((tx) => {
        tx.inputEl.type = 'number';
        tx.setValue(String(this.unit.pointCost || 0));
        tx.onChange((v) => (this.unit.pointCost = Math.max(0, parseInt(v) || 0)));
      });

    new Setting(contentEl)
      .setName(t('wargame.modelsCount'))
      .setDesc(t('wargame.modelsCountDesc'))
      .addSlider((sl) =>
        sl
          .setLimits(1, 50, 1)
          .setValue(this.unit.modelsCount || 1)
          .setDynamicTooltip()
          .onChange((v) => (this.unit.modelsCount = v))
      );

    new Setting(contentEl)
      .setName(t('wargame.woundsPerModel'))
      .setDesc(t('wargame.woundsPerModelDesc'))
      .addSlider((sl) =>
        sl
          .setLimits(1, 30, 1)
          .setValue(this.unit.woundsPerModel || 1)
          .setDynamicTooltip()
          .onChange((v) => (this.unit.woundsPerModel = v))
      );

    new Setting(contentEl)
      .setName(t('common.color'))
      .addColorPicker((cp) =>
        cp.setValue(this.unit.color || '#4c8bf5').onChange((v) => (this.unit.color = v))
      );

    new Setting(contentEl)
      .setName(t('wargame.baseSizePx'))
      .setDesc(t('wargame.baseSizePxDesc'))
      .addSlider((sl) =>
        sl
          .setLimits(20, 100, 2)
          .setValue(this.unit.baseSizePx || 36)
          .setDynamicTooltip()
          .onChange((v) => (this.unit.baseSizePx = v))
      );

    new Setting(contentEl)
      .setName(t('wargame.cohesionDistance'))
      .setDesc(t('wargame.cohesionDistanceDesc'))
      .addText((tx) => {
        tx.inputEl.type = 'number';
        tx.setPlaceholder('50 (mm) o 0 para desactivar');
        tx.setValue(this.unit.cohesionDistanceMm ? String(this.unit.cohesionDistanceMm) : '0');
        tx.onChange((v) => {
          const num = parseFloat(v);
          this.unit.cohesionDistanceMm = !isNaN(num) && num > 0 ? num : null;
        });
      });

    // Image
    new Setting(contentEl)
      .setName(t('common.image'))
      .setDesc(this.unit.imagePath || t('common.noImageDesc'))
      .addButton((b) =>
        b.setButtonText(t('common.selectImage')).onClick(() => {
          new FileSuggestModal(this.app, IMAGE_EXTS, (file) => {
            this.unit.imagePath = file.path;
            this.onOpen();
          }).open();
        })
      )
      .addExtraButton((b) =>
        b
          .setIcon('x')
          .setTooltip(t('common.removeImage'))
          .onClick(() => {
            this.unit.imagePath = null;
            this.onOpen();
          })
      );

    // Linked Note
    new Setting(contentEl)
      .setName(t('common.linkedNote'))
      .setDesc(this.unit.linkedNote || t('common.none'))
      .addButton((b) =>
        b.setButtonText(t('common.selectNote')).onClick(() => {
          new FileSuggestModal(this.app, ['md'], (file) => {
            this.unit.linkedNote = file.path;
            this.onOpen();
          }).open();
        })
      )
      .addExtraButton((b) =>
        b
          .setIcon('x')
          .setTooltip(t('common.removeLink'))
          .onClick(() => {
            this.unit.linkedNote = null;
            this.onOpen();
          })
      );

    // Arcs
    contentEl.createEl('h3', { text: t('wargame.arcsTitle') });
    contentEl.createDiv({ cls: 'dte-hint', text: t('wargame.arcsDesc') });

    const arcsSetting = new Setting(contentEl).setName(t('wargame.arcsConfig'));
    arcsSetting.addText((tx) => {
      tx.setPlaceholder(t('wargame.arcFront'));
      tx.setValue(String(this.unit.arcs.front || 90));
      tx.onChange((v) => (this.unit.arcs.front = parseInt(v) || 90));
    });
    arcsSetting.addText((tx) => {
      tx.setPlaceholder(t('wargame.arcFlank'));
      tx.setValue(String(this.unit.arcs.flank || 90));
      tx.onChange((v) => (this.unit.arcs.flank = parseInt(v) || 90));
    });
    arcsSetting.addText((tx) => {
      tx.setPlaceholder(t('wargame.arcRear'));
      tx.setValue(String(this.unit.arcs.rear || 180));
      tx.onChange((v) => (this.unit.arcs.rear = parseInt(v) || 180));
    });

    // Footer
    const footer = contentEl.createDiv({ cls: 'dte-modal-footer' });
    const cancelBtn = footer.createEl('button', { cls: 'dte-btn', text: t('common.cancel') });
    cancelBtn.addEventListener('click', () => this.close());

    const saveBtn = footer.createEl('button', { cls: 'mod-cta dte-btn', text: t('common.save') });
    saveBtn.addEventListener('click', () => {
      if (!this.unit.name.trim()) this.unit.name = t('common.unnamed');
      this.onSave(this.unit);
      this.close();
    });
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}
