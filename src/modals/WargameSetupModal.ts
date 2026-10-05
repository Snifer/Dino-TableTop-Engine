import { App, Modal, Setting, setIcon } from 'obsidian';
import {
  MapData,
  WargameMatchData,
  WargameSide,
  WargameUnitOnTable,
  WargameModel,
  WargameZone,
  WargameObjective,
  WargameRoster,
  WargameRosterUnit,
} from '../types';
import { genId } from '../utils';
import { t } from '../i18n';
import { NamePromptModal } from './NamePromptModal';
import { WargameRosterListModal } from './WargameRosterModals';

export class WargameSetupModal extends Modal {
  view: any;
  map: MapData;
  activeTab: 'general' | 'sides' | 'deploy' | 'objectives' | 'zones' = 'general';

  constructor(app: App, view: any, map: MapData) {
    super(app);
    this.view = view;
    this.map = map;
  }

  getWargame(): WargameMatchData {
    if (!this.map.wargame) {
      this.map.wargame = {
        enabled: true,
        sides: [
          { id: genId(), name: t('wargame.defaultSide1'), color: '#3b82f6', victoryPoints: 0 },
          { id: genId(), name: t('wargame.defaultSide2'), color: '#ef4444', victoryPoints: 0 },
        ],
        units: [],
        phases: {
          names: [
            t('wargame.phaseMove'),
            t('wargame.phaseShoot'),
            t('wargame.phaseCombat'),
            t('wargame.phaseMorale'),
          ],
          turnMode: 'perSideAllPhases',
          round: 1,
          currentSideIndex: 0,
          currentPhaseIndex: 0,
        },
        zones: [],
        objectives: [],
      };
    }
    return this.map.wargame;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('dte-wargame-setup-modal');

    const wargame = this.getWargame();

    contentEl.createEl('h2', { text: t('wargame.setupTitle', { mapName: this.map.name }) });

    // Tabs navigation
    const tabsBar = contentEl.createDiv({ cls: 'dte-segmented-group dte-tabs-bar' });

    const tabs: Array<{ id: 'general' | 'sides' | 'deploy' | 'objectives' | 'zones'; label: string }> = [
      { id: 'general', label: t('wargame.tabPhases') },
      { id: 'sides', label: t('wargame.tabSides') },
      { id: 'deploy', label: t('wargame.tabDeploy') },
      { id: 'objectives', label: t('wargame.tabObjectives') },
      { id: 'zones', label: t('wargame.tabZones') },
    ];

    for (const tab of tabs) {
      const btn = tabsBar.createEl('button', {
        cls: 'dte-btn dte-btn-segment' + (this.activeTab === tab.id ? ' mod-active' : ''),
        text: tab.label,
      });
      btn.addEventListener('click', () => {
        this.activeTab = tab.id;
        this.onOpen();
      });
    }

    const tabContent = contentEl.createDiv({ cls: 'dte-tab-content' });

    switch (this.activeTab) {
      case 'general':
        this.renderGeneralTab(tabContent, wargame);
        break;
      case 'sides':
        this.renderSidesTab(tabContent, wargame);
        break;
      case 'deploy':
        this.renderDeployTab(tabContent, wargame);
        break;
      case 'objectives':
        this.renderObjectivesTab(tabContent, wargame);
        break;
      case 'zones':
        this.renderZonesTab(tabContent, wargame);
        break;
    }

    // Footer
    const footer = contentEl.createDiv({ cls: 'dte-modal-footer' });

    const disableBtn = footer.createEl('button', {
      cls: 'dte-btn mod-warning',
      text: t('wargame.disableWargame'),
    });
    disableBtn.addEventListener('click', () => {
      if (!confirm(t('wargame.disableWargameConfirm'))) return;
      this.map.wargame = null;
      this.view.plugin.saveSettings();
      this.view.render();
      this.close();
    });

    const closeBtn = footer.createEl('button', { cls: 'mod-cta dte-btn', text: t('common.close') });
    closeBtn.addEventListener('click', () => {
      this.view.plugin.saveSettings();
      this.view.render();
      this.close();
    });
  }

  // 1. General & Phases Tab
  private renderGeneralTab(container: HTMLElement, wargame: WargameMatchData): void {
    new Setting(container)
      .setName(t('wargame.turnMode'))
      .setDesc(t('wargame.turnModeDesc'))
      .addDropdown((dd) =>
        dd
          .addOption('perSideAllPhases', t('wargame.modePerSide'))
          .addOption('alternatingUnits', t('wargame.modeAlternating'))
          .setValue(wargame.phases.turnMode)
          .onChange((v) => {
            wargame.phases.turnMode = v as 'perSideAllPhases' | 'alternatingUnits';
            this.view.plugin.saveSettings();
          })
      );

    container.createEl('h3', { text: t('wargame.phasesListTitle') });
    container.createDiv({ cls: 'dte-hint', text: t('wargame.phasesListDesc') });

    const listEl = container.createDiv({ cls: 'dte-wargame-phases-list' });
    wargame.phases.names.forEach((name, idx) => {
      const row = listEl.createDiv({ cls: 'dte-phase-row' });
      row.createSpan({ cls: 'dte-phase-num', text: `${idx + 1}.` });

      const tx = row.createEl('input', { cls: 'dte-input-text', value: name });
      tx.addEventListener('change', () => {
        wargame.phases.names[idx] = tx.value.trim() || `Fase ${idx + 1}`;
        this.view.plugin.saveSettings();
      });

      const del = row.createEl('button', { cls: 'clickable-icon dte-btn-icon' });
      setIcon(del, 'x');
      del.addEventListener('click', () => {
        wargame.phases.names.splice(idx, 1);
        if (wargame.phases.currentPhaseIndex >= wargame.phases.names.length) {
          wargame.phases.currentPhaseIndex = 0;
        }
        this.view.plugin.saveSettings();
        this.onOpen();
      });
    });

    const addPhaseBtn = container.createEl('button', {
      cls: 'dte-btn',
      text: t('wargame.addPhase'),
    });
    setIcon(addPhaseBtn.createSpan({ cls: 'dte-btn-icon-prefix' }), 'plus');
    addPhaseBtn.addEventListener('click', () => {
      wargame.phases.names.push(`Fase ${wargame.phases.names.length + 1}`);
      this.view.plugin.saveSettings();
      this.onOpen();
    });
  }

  // 2. Sides Tab
  private renderSidesTab(container: HTMLElement, wargame: WargameMatchData): void {
    const listEl = container.createDiv({ cls: 'dte-wargame-sides-list' });

    wargame.sides.forEach((side, idx) => {
      const card = listEl.createDiv({ cls: 'dte-side-card' });
      card.style.borderLeftColor = side.color;

      const nameInput = card.createEl('input', { cls: 'dte-side-name-input', value: side.name });
      nameInput.addEventListener('change', () => {
        side.name = nameInput.value.trim() || `Bando ${idx + 1}`;
        this.view.plugin.saveSettings();
      });

      const colorPicker = card.createEl('input', { type: 'color', cls: 'dte-color-picker', value: side.color });
      colorPicker.addEventListener('change', () => {
        side.color = colorPicker.value;
        this.view.plugin.saveSettings();
        this.onOpen();
      });

      const vpRow = card.createDiv({ cls: 'dte-side-vp-box' });
      vpRow.createSpan({ text: t('wargame.vpLabel') + ':' });
      const vpInput = vpRow.createEl('input', { type: 'number', cls: 'dte-vp-input', value: String(side.victoryPoints) });
      vpInput.addEventListener('change', () => {
        side.victoryPoints = parseInt(vpInput.value) || 0;
        this.view.plugin.saveSettings();
      });

      const delBtn = card.createEl('button', { cls: 'clickable-icon dte-btn-icon', attr: { 'aria-label': t('common.delete') } });
      setIcon(delBtn, 'trash');
      delBtn.addEventListener('click', () => {
        if (!confirm(t('wargame.deleteSideConfirm', { name: side.name }))) return;
        wargame.sides.splice(idx, 1);
        this.view.plugin.saveSettings();
        this.onOpen();
      });
    });

    const addSideBtn = container.createEl('button', { cls: 'mod-cta dte-btn', text: t('wargame.addSide') });
    setIcon(addSideBtn.createSpan({ cls: 'dte-btn-icon-prefix' }), 'plus');
    addSideBtn.addEventListener('click', () => {
      const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
      const color = colors[wargame.sides.length % colors.length];
      wargame.sides.push({
        id: genId(),
        name: `${t('wargame.sideNamePrefix')} ${wargame.sides.length + 1}`,
        color,
        victoryPoints: 0,
      });
      this.view.plugin.saveSettings();
      this.onOpen();
    });
  }

  // 3. Deploy Tab
  private renderDeployTab(container: HTMLElement, wargame: WargameMatchData): void {
    const rosters: Record<string, WargameRoster> = this.view.plugin.settings.wargameRosters || {};
    const rosterIds = Object.keys(rosters);

    if (rosterIds.length === 0) {
      container.createDiv({ cls: 'dte-empty', text: t('wargame.noRostersForDeploy') });
      const openRostersBtn = container.createEl('button', { cls: 'dte-btn', text: t('wargame.openRosters') });
      openRostersBtn.addEventListener('click', () => {
        this.close();
        new WargameRosterListModal(this.app, this.view.plugin, this.view).open();
      });
      return;
    }

    if (wargame.sides.length === 0) {
      container.createDiv({ cls: 'dte-empty', text: t('wargame.noSidesForDeploy') });
      return;
    }

    container.createEl('h3', { text: t('wargame.deployTitle') });

    let selectedRosterId = this.view.plugin.settings.activeRosterId || rosterIds[0];
    let selectedUnitId: string | null = null;
    let selectedSideId = wargame.sides[0]?.id;

    const deployForm = container.createDiv({ cls: 'dte-deploy-form' });

    // Roster dropdown
    new Setting(deployForm)
      .setName(t('wargame.selectRoster'))
      .addDropdown((dd) => {
        for (const rId of rosterIds) {
          dd.addOption(rId, rosters[rId].name);
        }
        dd.setValue(selectedRosterId);
        dd.onChange((v) => {
          selectedRosterId = v;
          this.view.plugin.settings.activeRosterId = v;
          this.onOpen();
        });
      });

    const activeRoster = rosters[selectedRosterId];
    if (activeRoster && activeRoster.units.length > 0) {
      selectedUnitId = activeRoster.units[0].id;

      // Unit dropdown
      new Setting(deployForm)
        .setName(t('wargame.selectUnit'))
        .addDropdown((dd) => {
          for (const u of activeRoster.units) {
            dd.addOption(u.id, `${u.name} (${u.pointCost} pts, ${u.modelsCount} mod)`);
          }
          dd.setValue(selectedUnitId!);
          dd.onChange((v) => (selectedUnitId = v));
        });

      // Side dropdown
      new Setting(deployForm)
        .setName(t('wargame.assignSide'))
        .addDropdown((dd) => {
          for (const s of wargame.sides) {
            dd.addOption(s.id, s.name);
          }
          dd.setValue(selectedSideId);
          dd.onChange((v) => (selectedSideId = v));
        });

      // Deploy Button
      const deployBtn = deployForm.createEl('button', {
        cls: 'mod-cta dte-btn dte-btn-full',
        text: t('wargame.btnDeployOnMap'),
      });
      setIcon(deployBtn.createSpan({ cls: 'dte-btn-icon-prefix' }), 'shield');
      deployBtn.addEventListener('click', () => {
        const uDef = activeRoster.units.find((u) => u.id === selectedUnitId);
        if (!uDef) return;

        const center = this.view.getViewportCenterCoords();
        const modelsCount = uDef.modelsCount || 1;

        // Generate models in simple formation grid around center
        const models: WargameModel[] = [];
        const cols = Math.min(5, Math.ceil(Math.sqrt(modelsCount)));
        const spacingPct = 3.5; // percentage offset

        for (let mIdx = 0; mIdx < modelsCount; mIdx++) {
          const col = mIdx % cols;
          const row = Math.floor(mIdx / cols);
          models.push({
            id: genId(),
            x: center.x + (col - cols / 2 + 0.5) * spacingPct,
            y: center.y + (row - Math.floor(modelsCount / cols) / 2 + 0.5) * spacingPct,
            facing: 0,
            woundsCurrent: uDef.woundsPerModel || 1,
            woundsMax: uDef.woundsPerModel || 1,
          });
        }

        const deployedUnit: WargameUnitOnTable = {
          id: genId(),
          rosterUnitId: uDef.id,
          name: uDef.name,
          sideId: selectedSideId,
          cohesionDistanceMm: uDef.cohesionDistanceMm ?? 50,
          color: uDef.color || '#4c8bf5',
          imagePath: uDef.imagePath,
          baseSizePx: uDef.baseSizePx || 36,
          arcs: uDef.arcs || { front: 90, flank: 90, rear: 180 },
          models,
        };

        wargame.units.push(deployedUnit);
        this.view.plugin.saveSettings();
        this.view.render();
        this.onOpen();
      });
    } else {
      deployForm.createDiv({ cls: 'dte-hint', text: t('wargame.rosterEmptyHint') });
    }

    // Units on table list
    container.createEl('h3', { text: t('wargame.unitsOnTableTitle') });
    const deployedList = container.createDiv({ cls: 'dte-deployed-units-list' });
    if (!wargame.units || wargame.units.length === 0) {
      deployedList.createDiv({ cls: 'dte-empty', text: t('wargame.noUnitsDeployed') });
      return;
    }

    wargame.units.forEach((unit, uIdx) => {
      const card = deployedList.createDiv({ cls: 'dte-deployed-unit-card' });
      const side = wargame.sides.find((s) => s.id === unit.sideId);
      if (side) card.style.borderLeftColor = side.color;

      const title = card.createDiv({ cls: 'dte-deployed-title' });
      title.createSpan({ cls: 'dte-unit-name', text: unit.name });
      title.createSpan({ cls: 'dte-side-badge', text: side ? side.name : '?' });
      title.createSpan({ cls: 'dte-models-badge', text: `${unit.models.length} mod` });

      const delBtn = card.createEl('button', { cls: 'clickable-icon dte-btn-icon' });
      setIcon(delBtn, 'trash');
      delBtn.addEventListener('click', () => {
        if (!confirm(t('wargame.deleteUnitOnTableConfirm', { name: unit.name }))) return;
        wargame.units.splice(uIdx, 1);
        this.view.plugin.saveSettings();
        this.view.render();
        this.onOpen();
      });
    });
  }

  // 4. Objectives Tab
  private renderObjectivesTab(container: HTMLElement, wargame: WargameMatchData): void {
    const list = container.createDiv({ cls: 'dte-objectives-list' });

    wargame.objectives.forEach((obj, idx) => {
      const card = list.createDiv({ cls: 'dte-objective-card' });

      const labelInput = card.createEl('input', { cls: 'dte-obj-input', value: obj.label });
      labelInput.addEventListener('change', () => {
        obj.label = labelInput.value.trim() || `Objetivo ${idx + 1}`;
        this.view.plugin.saveSettings();
      });

      const ptsRow = card.createDiv({ cls: 'dte-obj-pts-row' });
      ptsRow.createSpan({ text: t('wargame.ptsPerTurn') + ':' });
      const ptsInput = ptsRow.createEl('input', { type: 'number', cls: 'dte-vp-input', value: String(obj.pointsPerTurn ?? 1) });
      ptsInput.addEventListener('change', () => {
        obj.pointsPerTurn = parseInt(ptsInput.value) || 0;
        this.view.plugin.saveSettings();
      });

      // Controlled by dropdown
      const ctrlSelect = card.createEl('select', { cls: 'dropdown dte-select' });
      ctrlSelect.createEl('option', { text: t('wargame.uncontrolled'), value: '' });
      for (const s of wargame.sides) {
        const opt = ctrlSelect.createEl('option', { text: s.name, value: s.id });
        if (s.id === obj.controlledBy) opt.selected = true;
      }
      ctrlSelect.addEventListener('change', () => {
        obj.controlledBy = ctrlSelect.value || null;
        this.view.plugin.saveSettings();
        this.view.render();
      });

      const delBtn = card.createEl('button', { cls: 'clickable-icon dte-btn-icon' });
      setIcon(delBtn, 'trash');
      delBtn.addEventListener('click', () => {
        if (!confirm(t('wargame.deleteObjectiveConfirm', { name: obj.label }))) return;
        wargame.objectives.splice(idx, 1);
        this.view.plugin.saveSettings();
        this.view.render();
        this.onOpen();
      });
    });

    const addObjBtn = container.createEl('button', { cls: 'mod-cta dte-btn', text: t('wargame.addObjective') });
    setIcon(addObjBtn.createSpan({ cls: 'dte-btn-icon-prefix' }), 'flag');
    addObjBtn.addEventListener('click', () => {
      const center = this.view.getViewportCenterCoords();
      wargame.objectives.push({
        id: genId(),
        label: `${t('wargame.objPrefix')} ${wargame.objectives.length + 1}`,
        x: center.x,
        y: center.y,
        sideId: null,
        controlledBy: null,
        pointsPerTurn: 1,
      });
      this.view.plugin.saveSettings();
      this.view.render();
      this.onOpen();
    });
  }

  // 5. Zones Tab
  private renderZonesTab(container: HTMLElement, wargame: WargameMatchData): void {
    const list = container.createDiv({ cls: 'dte-zones-list' });

    wargame.zones.forEach((zone, idx) => {
      const card = list.createDiv({ cls: 'dte-zone-card' });
      card.style.borderLeftColor = zone.color;

      const labelInput = card.createEl('input', { cls: 'dte-zone-input', value: zone.label });
      labelInput.addEventListener('change', () => {
        zone.label = labelInput.value.trim() || `Zona ${idx + 1}`;
        this.view.plugin.saveSettings();
      });

      const kindSelect = card.createEl('select', { cls: 'dropdown dte-select' });
      kindSelect.createEl('option', { text: t('wargame.zoneTerrain'), value: 'terrain' });
      kindSelect.createEl('option', { text: t('wargame.zoneDeployment'), value: 'deployment' });
      kindSelect.value = zone.kind;
      kindSelect.addEventListener('change', () => {
        zone.kind = kindSelect.value as 'terrain' | 'deployment';
        this.view.plugin.saveSettings();
        this.view.render();
      });

      const shapeSelect = card.createEl('select', { cls: 'dropdown dte-select' });
      shapeSelect.createEl('option', { text: t('wargame.zoneRect'), value: 'rect' });
      shapeSelect.createEl('option', { text: t('wargame.zoneCircle'), value: 'circle' });
      shapeSelect.createEl('option', { text: t('wargame.zonePolygon'), value: 'polygon' });
      shapeSelect.value = zone.shapeType || 'rect';
      shapeSelect.addEventListener('change', () => {
        zone.shapeType = shapeSelect.value as 'rect' | 'circle' | 'polygon';
        const center = this.view.getViewportCenterCoords();
        if (zone.shapeType === 'rect') {
          zone.points = [
            { x: center.x - 10, y: center.y - 7 },
            { x: center.x + 10, y: center.y + 7 },
          ];
        } else if (zone.shapeType === 'circle') {
          zone.points = [
            { x: center.x, y: center.y },
            { x: center.x + 8, y: center.y },
          ];
        } else if (zone.shapeType === 'polygon') {
          zone.points = [
            { x: center.x - 8, y: center.y + 8 },
            { x: center.x, y: center.y - 8 },
            { x: center.x + 8, y: center.y + 8 },
          ];
        }
        this.view.plugin.saveSettings();
        this.view.render();
      });

      const colorPicker = card.createEl('input', { type: 'color', cls: 'dte-color-picker', value: zone.color });
      colorPicker.addEventListener('change', () => {
        zone.color = colorPicker.value;
        this.view.plugin.saveSettings();
        this.view.render();
      });

      const delBtn = card.createEl('button', { cls: 'clickable-icon dte-btn-icon' });
      setIcon(delBtn, 'trash');
      delBtn.addEventListener('click', () => {
        if (!confirm(t('wargame.deleteZoneConfirm', { name: zone.label }))) return;
        wargame.zones.splice(idx, 1);
        this.view.plugin.saveSettings();
        this.view.render();
        this.onOpen();
      });
    });

    const addZoneBtn = container.createEl('button', { cls: 'mod-cta dte-btn', text: t('wargame.addZone') });
    setIcon(addZoneBtn.createSpan({ cls: 'dte-btn-icon-prefix' }), 'square');
    addZoneBtn.addEventListener('click', () => {
      const center = this.view.getViewportCenterCoords();
      wargame.zones.push({
        id: genId(),
        kind: 'terrain',
        shapeType: 'rect',
        points: [
          { x: center.x - 10, y: center.y - 7 },
          { x: center.x + 10, y: center.y + 7 },
        ],
        label: `${t('wargame.zonePrefix')} ${wargame.zones.length + 1}`,
        color: '#10b981',
        sideId: null,
      });
      this.view.plugin.saveSettings();
      this.view.render();
      this.onOpen();
    });
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}
