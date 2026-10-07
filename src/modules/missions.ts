import { App, Modal, Notice, Setting, setIcon } from 'obsidian';
import { EngineModule } from './types';
import { t, TranslationKey } from '../i18n';
import {
  CampaignData,
  DinoSettings,
  MissionData,
  MissionObjective,
  MissionReward,
  DEFAULT_MISSION_TYPES,
  DEFAULT_MISSION_REWARD_TYPES,
  DEFAULT_MISSION_STATUSES,
} from '../types';
import { genId } from '../utils';
import { FileSuggestModal } from '../modals/FileSuggestModal';
import { NamePromptModal } from '../modals/NamePromptModal';

export interface DeadlineFormatResult {
  text: string;
  overdue: boolean;
}

/**
 * pure function: formats deadline relative to current calendar/timeline day
 */
export function formatDeadline(
  campaign: CampaignData,
  settings: DinoSettings,
  deadlineDay: number | null
): DeadlineFormatResult | null {
  if (deadlineDay == null) return null;

  let currentDay: number | null = null;
  let unit = 'días';

  if ((campaign as any).calendar && typeof (campaign as any).calendar.currentDay === 'number') {
    currentDay = (campaign as any).calendar.currentDay;
    if ((campaign as any).calendar.unit) unit = (campaign as any).calendar.unit;
  } else if (settings.currentTimelineId && settings.timelines?.[settings.currentTimelineId]) {
    const tl = settings.timelines[settings.currentTimelineId];
    currentDay = tl.counter;
    if (tl.unit) unit = tl.unit;
  }

  if (currentDay == null) return null;

  const diff = deadlineDay - currentDay;
  if (diff < 0) return { text: t('missions.overdue'), overdue: true };
  if (diff === 0) return { text: t('missions.dueToday'), overdue: false };
  return {
    text: t('missions.dueInDays', { days: String(diff), unit }),
    overdue: false,
  };
}

export function ensureCampaignMissionsData(campaign: CampaignData): void {
  if (!campaign.missionTypes || campaign.missionTypes.length === 0) {
    campaign.missionTypes = [...DEFAULT_MISSION_TYPES];
  }
  if (!campaign.missionRewardTypes || campaign.missionRewardTypes.length === 0) {
    campaign.missionRewardTypes = [...DEFAULT_MISSION_REWARD_TYPES];
  }
  if (!campaign.missionStatuses || campaign.missionStatuses.length === 0) {
    campaign.missionStatuses = [...DEFAULT_MISSION_STATUSES];
  }
  if (!campaign.missions) {
    campaign.missions = {};
  }
}

export function getMissionTypeColor(type: string): string {
  const lower = (type || '').toLowerCase();
  if (lower.includes('primaria') || lower.includes('main')) return '#3b82f6';
  if (lower.includes('secundaria') || lower.includes('side')) return '#22c55e';
  if (lower.includes('trasfondo') || lower.includes('background')) return '#a855f7';
  if (lower.includes('facci') || lower.includes('faction')) return '#f97316';
  if (lower.includes('repetible') || lower.includes('mundan')) return '#06b6d4';
  if (lower.includes('oculta') || lower.includes('hidden')) return '#64748b';
  if (lower.includes('mundial') || lower.includes('world')) return '#ef4444';

  let hash = 0;
  for (let i = 0; i < type.length; i++) {
    hash = type.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 55%)`;
}

// ─── Modal 1: Configurar Tipos, Recompensas y Estados ──────────────────────────────

export class MissionConfigModal extends Modal {
  plugin: any;
  view: any;
  onSave: () => void;

  constructor(app: App, plugin: any, view: any, onSave: () => void) {
    super(app);
    this.plugin = plugin;
    this.view = view;
    this.onSave = onSave;
  }

  onOpen(): void {
    this.renderModal();
  }

  renderModal(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('dte-modal-content');
    contentEl.createEl('h2', { text: `⚙ ${t('missions.configTitle')}` });

    const campaign = this.view.getCurrentCampaign();
    if (!campaign) {
      contentEl.createEl('p', { text: t('exportImport.campaignNotFound') });
      return;
    }
    ensureCampaignMissionsData(campaign);

    // Section 1: Types
    this.renderConfigSection(
      contentEl,
      t('missions.configTypes'),
      campaign.missionTypes!,
      (val) => {
        campaign.missionTypes!.push(val);
      },
      (val) => {
        const count = (Object.values(campaign.missions || {}) as MissionData[]).filter((m) => m.type === val).length;
        if (count > 0) {
          if (!confirm(t('missions.deleteInUse', { name: val, count: String(count) }))) return false;
        }
        campaign.missionTypes = campaign.missionTypes!.filter((x) => x !== val);
        return true;
      }
    );

    // Section 2: Reward Types
    this.renderConfigSection(
      contentEl,
      t('missions.configRewardTypes'),
      campaign.missionRewardTypes!,
      (val) => {
        campaign.missionRewardTypes!.push(val);
      },
      (val) => {
        const count = (Object.values(campaign.missions || {}) as MissionData[]).filter((m) =>
          m.rewards.some((r) => r.type === val)
        ).length;
        if (count > 0) {
          if (!confirm(t('missions.deleteInUse', { name: val, count: String(count) }))) return false;
        }
        campaign.missionRewardTypes = campaign.missionRewardTypes!.filter((x) => x !== val);
        return true;
      }
    );

    // Section 3: Statuses
    this.renderConfigSection(
      contentEl,
      t('missions.configStatuses'),
      campaign.missionStatuses!,
      (val) => {
        campaign.missionStatuses!.push(val);
      },
      (val) => {
        const count = (Object.values(campaign.missions || {}) as MissionData[]).filter((m) => m.status === val).length;
        if (count > 0) {
          if (!confirm(t('missions.deleteInUse', { name: val, count: String(count) }))) return false;
        }
        campaign.missionStatuses = campaign.missionStatuses!.filter((x) => x !== val);
        return true;
      }
    );
  }

  private renderConfigSection(
    container: HTMLElement,
    title: string,
    items: string[],
    onAdd: (val: string) => void,
    onDelete: (val: string) => boolean
  ): void {
    const card = container.createDiv({ cls: 'dte-form-card' });
    card.createEl('h3', { text: title, cls: 'dte-section-header' });

    const listEl = card.createDiv({ cls: 'dte-config-tag-list' });

    for (const item of items) {
      const tag = listEl.createDiv({ cls: 'dte-config-tag-item' });
      tag.createSpan({ text: item });

      const delBtn = tag.createEl('button', {
        cls: 'clickable-icon dte-btn-icon-danger',
        attr: { 'aria-label': t('common.delete') },
      });
      setIcon(delBtn, 'trash');
      delBtn.addEventListener('click', async () => {
        if (onDelete(item)) {
          await this.plugin.saveSettings();
          this.onSave();
          this.renderModal();
        }
      });
    }

    const addRow = card.createDiv({ cls: 'dte-config-add-row' });
    const input = addRow.createEl('input', {
      type: 'text',
      cls: 'dte-input-clean',
      placeholder: t('common.name'),
    });

    const addBtn = addRow.createEl('button', {
      cls: 'dte-btn mod-cta',
      text: t('common.add'),
    });

    const submit = async () => {
      const v = input.value.trim();
      if (!v) return;
      if (items.includes(v)) {
        new Notice(t('common.alreadyExists'));
        return;
      }
      onAdd(v);
      await this.plugin.saveSettings();
      this.onSave();
      this.renderModal();
    };

    addBtn.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

// ─── Modal 2: Crear / Editar Misión ───────────────────────────────────────────

export class MissionEditModal extends Modal {
  plugin: any;
  view: any;
  mission: MissionData;
  onSave: () => void;

  constructor(app: App, plugin: any, view: any, mission: MissionData | null, onSave: () => void) {
    super(app);
    this.plugin = plugin;
    this.view = view;
    this.onSave = onSave;

    const campaign = view.getCurrentCampaign();
    if (campaign) ensureCampaignMissionsData(campaign);

    const defaultType = campaign?.missionTypes?.[0] || 'Primaria';
    const defaultStatus = campaign?.missionStatuses?.[0] || 'Activa';

    this.mission = mission
      ? JSON.parse(JSON.stringify(mission))
      : {
          id: genId(),
          title: '',
          type: defaultType,
          status: defaultStatus,
          giver: null,
          location: null,
          description: '',
          objectives: [],
          rewards: [],
          linkedNote: null,
          relatedNotes: [],
          deadlineDay: null,
          createdDay: null,
        };
  }

  onOpen(): void {
    this.renderModal();
  }

  renderModal(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('dte-modal-content');

    const isNew = !this.view.getCurrentCampaign()?.missions?.[this.mission.id];
    contentEl.createEl('h2', {
      text: isNew ? `⚔️ ${t('missions.newMission')}` : `⚔️ ${t('missions.editMission')}`,
    });

    const campaign = this.view.getCurrentCampaign();
    if (!campaign) return;
    ensureCampaignMissionsData(campaign);

    const form = contentEl.createDiv({ cls: 'dte-form-card' });

    // 1. Título
    const titleField = form.createDiv({ cls: 'dte-form-field' });
    titleField.createEl('label', { text: t('common.title'), cls: 'dte-label' });
    const titleInput = titleField.createEl('input', {
      type: 'text',
      cls: 'dte-input-clean',
      value: this.mission.title,
      placeholder: t('common.title'),
    });
    titleInput.addEventListener('input', () => {
      this.mission.title = titleInput.value;
    });

    // 2. Grid Tipo y Estado
    const gridTypeStatus = form.createDiv({ cls: 'dte-form-grid' });

    // Tipo
    const typeField = gridTypeStatus.createDiv({ cls: 'dte-form-field' });
    typeField.createEl('label', { text: t('common.type'), cls: 'dte-label' });

    const renderTypeSelect = () => {
      typeField.querySelectorAll('select, button').forEach((el) => el.remove());

      const typeSelect = typeField.createEl('select', { cls: 'dte-select' });
      for (const tType of campaign.missionTypes!) {
        const opt = typeSelect.createEl('option', { value: tType, text: tType });
        if (tType === this.mission.type) opt.selected = true;
      }
      const newOpt = typeSelect.createEl('option', { value: '__new__', text: `+ ${t('missions.newType')}` });
      if (!campaign.missionTypes!.includes(this.mission.type)) {
        const customOpt = typeSelect.createEl('option', { value: this.mission.type, text: this.mission.type });
        customOpt.selected = true;
      }

      typeSelect.addEventListener('change', () => {
        if (typeSelect.value === '__new__') {
          new NamePromptModal(this.app, t('missions.newType'), '', (newTypeName) => {
            const v = (newTypeName || '').trim();
            if (v) {
              if (!campaign.missionTypes!.includes(v)) {
                campaign.missionTypes!.push(v);
                this.plugin.saveSettings();
              }
              this.mission.type = v;
            }
            renderTypeSelect();
          }).open();
        } else {
          this.mission.type = typeSelect.value;
        }
      });
    };
    renderTypeSelect();

    // Estado
    const statusField = gridTypeStatus.createDiv({ cls: 'dte-form-field' });
    statusField.createEl('label', { text: t('common.status'), cls: 'dte-label' });
    const statusSelect = statusField.createEl('select', { cls: 'dte-select' });
    for (const st of campaign.missionStatuses!) {
      const opt = statusSelect.createEl('option', { value: st, text: st });
      if (st === this.mission.status) opt.selected = true;
    }
    statusSelect.addEventListener('change', () => {
      this.mission.status = statusSelect.value;
    });

    // 3. Encargado y Ubicación
    const gridGiverLoc = form.createDiv({ cls: 'dte-form-grid' });

    const giverField = gridGiverLoc.createDiv({ cls: 'dte-form-field' });
    giverField.createEl('label', { text: t('missions.giver'), cls: 'dte-label' });
    const giverInput = giverField.createEl('input', {
      type: 'text',
      cls: 'dte-input-clean',
      value: this.mission.giver || '',
      placeholder: 'ej. Capitán Vane',
    });
    giverInput.addEventListener('input', () => {
      this.mission.giver = giverInput.value.trim() || null;
    });

    const locField = gridGiverLoc.createDiv({ cls: 'dte-form-field' });
    locField.createEl('label', { text: t('missions.location'), cls: 'dte-label' });
    const locRow = locField.createDiv({ cls: 'dte-input-with-buttons' });
    const locInput = locRow.createEl('input', {
      type: 'text',
      cls: 'dte-input-clean',
      value: this.mission.location || '',
      placeholder: 'ej. Puerto del Faro / POI',
    });
    locInput.addEventListener('input', () => {
      this.mission.location = locInput.value.trim() || null;
    });

    const currentMap = this.view.getCurrentMap();
    if (currentMap && currentMap.pois && currentMap.pois.length > 0) {
      const poiBtn = locRow.createEl('button', {
        cls: 'dte-btn',
        title: t('missions.selectPoi'),
      });
      setIcon(poiBtn, 'map-pin');
      poiBtn.addEventListener('click', () => {
        const menu = new (require('obsidian').Menu)();
        for (const poi of currentMap.pois) {
          menu.addItem((item: any) => {
            item.setTitle(poi.name || 'POI sin nombre').onClick(() => {
              this.mission.location = poi.name;
              locInput.value = poi.name;
            });
          });
        }
        menu.showAtEl(poiBtn);
      });
    }

    // 4. Descripción
    const descField = form.createDiv({ cls: 'dte-form-field' });
    descField.createEl('label', { text: t('missions.description'), cls: 'dte-label' });
    const descText = descField.createEl('textarea', {
      cls: 'dte-textarea',
      placeholder: 'Detalles de la misión...',
    });
    descText.value = this.mission.description || '';
    descText.rows = 3;
    descText.addEventListener('input', () => {
      this.mission.description = descText.value;
    });

    // 5. Objectives Checklist
    const objSection = form.createDiv({ cls: 'dte-form-field' });
    objSection.createEl('label', { text: t('missions.objectives'), cls: 'dte-label' });
    const objListEl = objSection.createDiv({ cls: 'dte-checklist-container' });

    const renderObjectives = () => {
      objListEl.empty();
      for (let i = 0; i < this.mission.objectives.length; i++) {
        const obj = this.mission.objectives[i];
        const row = objListEl.createDiv({ cls: 'dte-checklist-item' });

        const chk = row.createEl('input', {
          type: 'checkbox',
          cls: 'dte-checkbox',
        });
        chk.checked = obj.done;
        chk.addEventListener('change', () => {
          obj.done = chk.checked;
        });

        const textInp = row.createEl('input', {
          type: 'text',
          cls: 'dte-input-clean',
          value: obj.text,
          placeholder: 'Paso u objetivo...',
        });
        textInp.addEventListener('input', () => {
          obj.text = textInp.value;
        });

        const delBtn = row.createEl('button', {
          cls: 'clickable-icon dte-btn-icon-danger',
          attr: { 'aria-label': t('common.delete') },
        });
        setIcon(delBtn, 'trash');
        delBtn.addEventListener('click', () => {
          this.mission.objectives.splice(i, 1);
          renderObjectives();
        });
      }
    };
    renderObjectives();

    const addObjBtn = objSection.createEl('button', {
      cls: 'dte-btn',
      text: `+ ${t('missions.addObjective')}`,
    });
    addObjBtn.addEventListener('click', () => {
      this.mission.objectives.push({ id: genId(), text: '', done: false });
      renderObjectives();
    });

    // 6. Rewards List
    const rewSection = form.createDiv({ cls: 'dte-form-field' });
    rewSection.createEl('label', { text: t('missions.rewards'), cls: 'dte-label' });
    const rewListEl = rewSection.createDiv({ cls: 'dte-rewards-edit-container' });

    const renderRewards = () => {
      rewListEl.empty();
      for (let i = 0; i < this.mission.rewards.length; i++) {
        const rew = this.mission.rewards[i];
        const row = rewListEl.createDiv({ cls: 'dte-reward-edit-item' });

        const textInp = row.createEl('input', {
          type: 'text',
          cls: 'dte-input-clean',
          value: rew.text,
          placeholder: 'ej. 100 POs / Espada mágica',
        });
        textInp.addEventListener('input', () => {
          rew.text = textInp.value;
        });

        const typeSel = row.createEl('select', { cls: 'dte-select' });
        for (const rwType of campaign.missionRewardTypes!) {
          const opt = typeSel.createEl('option', { value: rwType, text: rwType });
          if (rwType === rew.type) opt.selected = true;
        }
        typeSel.addEventListener('change', () => {
          rew.type = typeSel.value;
        });

        const delBtn = row.createEl('button', {
          cls: 'clickable-icon dte-btn-icon-danger',
          attr: { 'aria-label': t('common.delete') },
        });
        setIcon(delBtn, 'trash');
        delBtn.addEventListener('click', () => {
          this.mission.rewards.splice(i, 1);
          renderRewards();
        });
      }
    };
    renderRewards();

    const addRewBtn = rewSection.createEl('button', {
      cls: 'dte-btn',
      text: `+ ${t('missions.addReward')}`,
    });
    addRewBtn.addEventListener('click', () => {
      const defaultRewType = campaign.missionRewardTypes![0] || 'Tesoro';
      this.mission.rewards.push({ id: genId(), text: '', type: defaultRewType });
      renderRewards();
    });

    // 7. Linked Note & Related Notes
    const notesGrid = form.createDiv({ cls: 'dte-form-grid' });

    // Linked Note
    const linkedField = notesGrid.createDiv({ cls: 'dte-form-field' });
    linkedField.createEl('label', { text: t('missions.linkedNote'), cls: 'dte-label' });
    const linkedRow = linkedField.createDiv({ cls: 'dte-input-with-buttons' });
    const linkedInput = linkedRow.createEl('input', {
      type: 'text',
      cls: 'dte-input-clean',
      value: this.mission.linkedNote || '',
      placeholder: 'Ruta de la nota...',
      attr: { readonly: 'readonly' },
    });
    const pickLinkedBtn = linkedRow.createEl('button', { cls: 'dte-btn', text: '...' });
    pickLinkedBtn.addEventListener('click', () => {
      new FileSuggestModal(this.app, null, (file) => {
        this.mission.linkedNote = file.path;
        linkedInput.value = file.path;
      }).open();
    });
    if (this.mission.linkedNote) {
      const clearLinkedBtn = linkedRow.createEl('button', { cls: 'clickable-icon dte-btn-icon' });
      setIcon(clearLinkedBtn, 'x');
      clearLinkedBtn.addEventListener('click', () => {
        this.mission.linkedNote = null;
        linkedInput.value = '';
        clearLinkedBtn.remove();
      });
    }

    // Related Notes
    const relField = notesGrid.createDiv({ cls: 'dte-form-field' });
    relField.createEl('label', { text: t('missions.relatedNotes'), cls: 'dte-label' });
    const relListEl = relField.createDiv({ cls: 'dte-related-notes-list' });

    const renderRelatedNotes = () => {
      relListEl.empty();
      if (!this.mission.relatedNotes) this.mission.relatedNotes = [];
      for (let i = 0; i < this.mission.relatedNotes.length; i++) {
        const notePath = this.mission.relatedNotes[i];
        const tag = relListEl.createDiv({ cls: 'dte-config-tag-item' });
        tag.createSpan({ text: notePath.split('/').pop() || notePath, title: notePath });
        const delBtn = tag.createEl('button', { cls: 'clickable-icon dte-btn-icon' });
        setIcon(delBtn, 'x');
        delBtn.addEventListener('click', () => {
          this.mission.relatedNotes.splice(i, 1);
          renderRelatedNotes();
        });
      }
    };
    renderRelatedNotes();

    const addRelBtn = relField.createEl('button', {
      cls: 'dte-btn',
      text: `+ ${t('missions.addRelatedNote')}`,
    });
    addRelBtn.addEventListener('click', () => {
      new FileSuggestModal(this.app, null, (file) => {
        if (!this.mission.relatedNotes.includes(file.path)) {
          this.mission.relatedNotes.push(file.path);
          renderRelatedNotes();
        }
      }).open();
    });

    // 8. Deadline Day
    const deadField = form.createDiv({ cls: 'dte-form-field' });
    deadField.createEl('label', { text: t('missions.deadline'), cls: 'dte-label' });
    const deadInput = deadField.createEl('input', {
      type: 'number',
      cls: 'dte-input-clean',
      placeholder: 'ej. 45 (día del calendario)',
    });
    if (this.mission.deadlineDay != null) deadInput.value = String(this.mission.deadlineDay);
    deadInput.addEventListener('input', () => {
      const v = parseInt(deadInput.value, 10);
      this.mission.deadlineDay = isNaN(v) ? null : v;
    });

    // Footer buttons
    const footer = contentEl.createDiv({ cls: 'dte-modal-footer' });

    if (!isNew) {
      const delBtn = footer.createEl('button', {
        cls: 'dte-btn mod-warning',
        text: t('missions.deleteMission'),
      });
      delBtn.addEventListener('click', async () => {
        if (confirm(t('missions.deleteMissionConfirm', { title: this.mission.title || 'esta misión' }))) {
          if (campaign.missions) delete campaign.missions[this.mission.id];
          await this.plugin.saveSettings();
          this.onSave();
          this.close();
        }
      });
    }

    const saveBtn = footer.createEl('button', {
      cls: 'dte-btn mod-cta',
      text: t('common.save'),
    });
    saveBtn.addEventListener('click', async () => {
      if (!this.mission.title.trim()) {
        new Notice(t('common.titleRequired') || 'El título es obligatorio.');
        return;
      }
      if (!campaign.missions) campaign.missions = {};
      campaign.missions[this.mission.id] = this.mission;
      await this.plugin.saveSettings();
      this.onSave();
      this.close();
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

// ─── Floating Panel: MissionListPanel ─────────────────────────────────────────

export class MissionListPanel {
  app: App;
  plugin: any;
  container: HTMLElement;
  el: HTMLElement;
  minimized: boolean;
  filterStatus: string;
  filterType: string;
  private isDragging: boolean;
  private dragOffsetX: number;
  private dragOffsetY: number;

  constructor(app: App, plugin: any, container: HTMLElement) {
    this.app = app;
    this.plugin = plugin;
    this.container = container;
    this.minimized = false;
    this.filterStatus = '__all__';
    this.filterType = '__all__';
    this.isDragging = false;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;

    this.el = this.container.createDiv({ cls: 'dte-floating-panel dte-missions-panel' });
    this.setupDrag(); // register once — survives all build() calls
    this.build();
  }

  public build(): void {
    this.el.empty();
    if (this.minimized) {
      this.el.addClass('is-minimized');
      const minBtn = this.el.createEl('button', {
        cls: 'dte-btn dte-minimized-handle',
        title: t('missions.title'),
      });
      const icon = minBtn.createSpan({ cls: 'dte-btn-icon-prefix' });
      setIcon(icon, 'flag');
      minBtn.createSpan({ text: t('missions.title') });
      minBtn.addEventListener('click', () => {
        this.minimized = false;
        this.build();
      });
      return;
    }

    this.el.removeClass('is-minimized');

    const view = this.plugin.getActiveDinoView?.() || this.app.workspace.getLeavesOfType('dino-tabletop-engine-view')?.[0]?.view;
    const campaign = view?.getCurrentCampaign?.();

    if (campaign) ensureCampaignMissionsData(campaign);

    // 1. Header
    const header = this.el.createDiv({ cls: 'dte-panel-header dte-drag-handle' });

    const titleWrap = header.createDiv({ cls: 'dte-panel-title' });
    const iconSpan = titleWrap.createSpan({ cls: 'dte-panel-icon' });
    setIcon(iconSpan, 'flag');
    const titleText = campaign ? `Misiones — ${campaign.name}` : t('missions.title');
    titleWrap.createSpan({ text: titleText, cls: 'dte-panel-title-text' });

    const controls = header.createDiv({ cls: 'dte-panel-controls' });

    if (campaign) {
      const configBtn = controls.createEl('button', {
        cls: 'clickable-icon dte-btn-icon',
        title: t('missions.configTitle'),
      });
      setIcon(configBtn, 'settings');
      configBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        new MissionConfigModal(this.app, this.plugin, view, () => this.build()).open();
      });
    }

    const minBtn = controls.createEl('button', {
      cls: 'clickable-icon dte-btn-icon',
      title: t('common.minimize'),
    });
    setIcon(minBtn, 'minus');
    minBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.minimized = true;
      this.build();
    });

    if (!campaign) {
      const body = this.el.createDiv({ cls: 'dte-panel-body' });
      body.createDiv({ cls: 'dte-empty-hint', text: t('exportImport.campaignNotFound') });
      return;
    }

    // 2. Filter Bar
    const filterBar = this.el.createDiv({ cls: 'dte-missions-filter-bar' });

    // Status filter
    const statusSel = filterBar.createEl('select', { cls: 'dte-select dte-select-sm' });
    statusSel.createEl('option', { value: '__all__', text: t('missions.filterAllStatuses') });
    for (const st of campaign.missionStatuses || []) {
      const opt = statusSel.createEl('option', { value: st, text: st });
      if (st === this.filterStatus) opt.selected = true;
    }
    statusSel.addEventListener('change', () => {
      this.filterStatus = statusSel.value;
      this.build();
    });

    // Type filter
    const typeSel = filterBar.createEl('select', { cls: 'dte-select dte-select-sm' });
    typeSel.createEl('option', { value: '__all__', text: t('missions.filterAllTypes') });
    for (const tp of campaign.missionTypes || []) {
      const opt = typeSel.createEl('option', { value: tp, text: tp });
      if (tp === this.filterType) opt.selected = true;
    }
    typeSel.addEventListener('change', () => {
      this.filterType = typeSel.value;
      this.build();
    });

    // 3. Missions List Body
    const listBody = this.el.createDiv({ cls: 'dte-panel-body dte-missions-list-body' });

    const missionsList = (Object.values(campaign.missions || {}) as MissionData[]).filter((m) => {
      if (this.filterStatus !== '__all__' && m.status !== this.filterStatus) return false;
      if (this.filterType !== '__all__' && m.type !== this.filterType) return false;
      return true;
    });

    if (missionsList.length === 0) {
      listBody.createDiv({ cls: 'dte-empty-hint', text: t('missions.noMissions') });
    } else {
      for (const mission of missionsList) {
        this.renderMissionRow(listBody, mission, campaign, view);
      }
    }

    // 4. Footer
    const footer = this.el.createDiv({ cls: 'dte-panel-footer' });
    const addBtn = footer.createEl('button', {
      cls: 'dte-btn mod-cta dte-btn-full',
      text: `+ ${t('missions.newMission')}`,
    });
    addBtn.addEventListener('click', () => {
      new MissionEditModal(this.app, this.plugin, view, null, () => this.build()).open();
    });
  }

  private renderMissionRow(
    container: HTMLElement,
    mission: MissionData,
    campaign: CampaignData,
    view: any
  ): void {
    const row = container.createDiv({ cls: 'dte-mission-row' });

    // Type indicator / badge
    const badge = row.createDiv({ cls: 'dte-mission-type-badge' });
    badge.style.backgroundColor = getMissionTypeColor(mission.type);
    badge.title = mission.type;

    // Content center
    const content = row.createDiv({ cls: 'dte-mission-content' });

    const topRow = content.createDiv({ cls: 'dte-mission-top-row' });
    topRow.createDiv({ cls: 'dte-mission-title-text', text: mission.title || 'Misión sin título' });

    const bottomRow = content.createDiv({ cls: 'dte-mission-bottom-row' });

    // Objectives progress
    const objTotal = mission.objectives?.length || 0;
    const objDone = mission.objectives?.filter((o) => o.done).length || 0;
    const objText =
      objTotal > 0
        ? t('missions.objectivesProgress', { done: String(objDone), total: String(objTotal) })
        : t('missions.noObjectives');
    bottomRow.createSpan({ cls: 'dte-mission-subtext', text: objText });

    // Deadline badge if active calendar
    const deadlineInfo = formatDeadline(campaign, this.plugin.settings, mission.deadlineDay);
    if (deadlineInfo) {
      bottomRow.createSpan({
        cls: `dte-mission-deadline-badge ${deadlineInfo.overdue ? 'is-overdue' : ''}`,
        text: deadlineInfo.text,
      });
    }

    // Quick status dropdown (right)
    const statusSelect = row.createEl('select', { cls: 'dte-select dte-select-xs dte-status-select' });
    for (const st of campaign.missionStatuses || []) {
      const opt = statusSelect.createEl('option', { value: st, text: st });
      if (st === mission.status) opt.selected = true;
    }
    statusSelect.addEventListener('click', (e) => e.stopPropagation());
    statusSelect.addEventListener('change', async (e) => {
      e.stopPropagation();
      mission.status = statusSelect.value;
      await this.plugin.saveSettings();
      this.build();
    });

    // Row click -> opens edit modal
    row.addEventListener('click', () => {
      new MissionEditModal(this.app, this.plugin, view, mission, () => this.build()).open();
    });
  }

  private setupDrag(): void {
    // Use event delegation on this.el so the listener survives build() rebuilds.
    // The .dte-drag-handle node is re-created on every build() call, but this.el persists.
    this.el.addEventListener('mousedown', (e: MouseEvent) => {
      const handle = (e.target as HTMLElement).closest('.dte-drag-handle');
      if (!handle) return;
      if ((e.target as HTMLElement).closest('.clickable-icon, button, select, input')) return;

      e.preventDefault();
      this.isDragging = true;
      const rect = this.el.getBoundingClientRect();
      this.dragOffsetX = e.clientX - rect.left;
      this.dragOffsetY = e.clientY - rect.top;

      const onMouseMove = (ev: MouseEvent) => {
        if (!this.isDragging) return;
        const parent = this.el.parentElement?.getBoundingClientRect();
        if (!parent) return;
        const x = Math.max(0, Math.min(ev.clientX - parent.left - this.dragOffsetX, parent.width - 200));
        const y = Math.max(0, Math.min(ev.clientY - parent.top - this.dragOffsetY, parent.height - 50));
        this.el.style.left = `${x}px`;
        this.el.style.top = `${y}px`;
        this.el.style.right = 'auto';
        this.el.style.bottom = 'auto';
      };

      const onMouseUp = () => {
        this.isDragging = false;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  }

  public destroy(): void {
    this.el.remove();
  }
}

// ─── Toolbar Button ────────────────────────────────────────────────────────────

export function renderMissionsToolbarButton(container: HTMLElement, view: any): void {
  const btn = container.createEl('button', {
    cls: 'dte-btn',
    title: t('missions.title'),
  });
  const icon = btn.createSpan({ cls: 'dte-btn-icon-prefix' });
  setIcon(icon, 'flag');
  btn.prepend(icon);
  btn.createSpan({ text: t('modules.missionsShort') });
  btn.addEventListener('click', () => {
    if (!view.missionsPanel) return;
    view.missionsPanel.minimized = false;
    view.missionsPanel.build();
  });
}

// ─── Module Definition ─────────────────────────────────────────────────────────

export const MissionsModule: EngineModule = {
  id: 'missions',
  nameKey: 'modules.missionsName' as TranslationKey,
  descKey: 'modules.missionsDesc' as TranslationKey,
  icon: 'flag',
  defaultEnabled: false,
  renderToolbarButton: renderMissionsToolbarButton,
};
