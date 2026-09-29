import { App, Modal, Notice, setIcon } from 'obsidian';
import { EngineModule } from './types';
import { t } from '../i18n';
import {
  ClockData,
  DinoSettings,
  TimelineAdvanceStep,
  TimelineCycle,
  TimelineCycleSegment,
  TimelineData,
  TimelineEvent,
} from '../types';
import { genId } from '../utils';

// ─── Mathematical and Formatting Helpers ─────────────────────────────────────

export function getCycleLength(cycle: TimelineCycle): number {
  if (!cycle.segments || cycle.segments.length === 0) return 0;
  return cycle.segments.reduce((acc, s) => acc + Math.max(1, Number(s.length) || 1), 0);
}

export interface CycleComputationResult {
  segment: TimelineCycleSegment;
  segmentIndex: number;
  dayInSegment: number;
  repeatCount: number;
  cycleLength: number;
}

export function computeCycleState(counter: number, cycle: TimelineCycle): CycleComputationResult {
  const cycleLen = getCycleLength(cycle);
  if (cycleLen <= 0 || !cycle.segments || cycle.segments.length === 0) {
    return {
      segment: { name: '—', length: 1 },
      segmentIndex: 0,
      dayInSegment: 1,
      repeatCount: cycle.repeatStart || 1,
      cycleLength: 1,
    };
  }

  const offset = cycle.offset || 0;
  const effective = counter + offset;
  // Mathematical modulo handling negative numbers correctly:
  const rem = ((effective % cycleLen) + cycleLen) % cycleLen;
  const repeat = Math.floor(effective / cycleLen) + (cycle.repeatStart !== undefined ? cycle.repeatStart : 1);

  let accum = 0;
  let foundIndex = 0;
  let dayInSeg = 1;

  for (let i = 0; i < cycle.segments.length; i++) {
    const seg = cycle.segments[i];
    const segLen = Math.max(1, Number(seg.length) || 1);
    if (rem < accum + segLen) {
      foundIndex = i;
      dayInSeg = rem - accum + 1;
      break;
    }
    accum += segLen;
  }

  return {
    segment: cycle.segments[foundIndex],
    segmentIndex: foundIndex,
    dayInSegment: dayInSeg,
    repeatCount: repeat,
    cycleLength: cycleLen,
  };
}

export function formatTimeline(timeline: TimelineData): string {
  const unit = timeline.unit || '';
  const counterStr = String(timeline.counter);

  if (timeline.format && timeline.format.trim()) {
    let result = timeline.format;
    result = result.replace(/{unit}/gi, unit);
    result = result.replace(/{counter}/gi, counterStr);

    if (timeline.cycles && timeline.cycles.length > 0) {
      for (const cycle of timeline.cycles) {
        if (!cycle.name) continue;
        const state = computeCycleState(timeline.counter, cycle);
        const nameRegex = new RegExp(`{${escapeRegex(cycle.name)}}`, 'gi');
        const dayRegex = new RegExp(`{${escapeRegex(cycle.name)}\\.day}`, 'gi');
        const repRegex = new RegExp(`{${escapeRegex(cycle.name)}\\.repeat}`, 'gi');

        result = result.replace(nameRegex, state.segment.name);
        result = result.replace(dayRegex, String(state.dayInSegment));
        result = result.replace(repRegex, String(state.repeatCount));
      }
    }
    return result;
  }

  // Dynamic fallback when format string is empty
  const parts: string[] = [];
  if (timeline.cycles && timeline.cycles.length > 0) {
    for (const cycle of timeline.cycles) {
      const state = computeCycleState(timeline.counter, cycle);
      if (cycle.showRepeatCount) {
        parts.push(`${state.segment.name} (${state.dayInSegment}/${state.segment.length}, #${state.repeatCount})`);
      } else {
        parts.push(`${state.segment.name} (${state.dayInSegment}/${state.segment.length})`);
      }
    }
  }

  const base = `${unit} ${counterStr}`.trim();
  if (parts.length > 0) {
    return `${parts.join(', ')} · ${base}`;
  }
  return base || `0`;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function getActiveEvents(timeline: TimelineData): TimelineEvent[] {
  if (!timeline.events || timeline.events.length === 0) return [];
  const active: TimelineEvent[] = [];

  for (const ev of timeline.events) {
    if (ev.counter !== undefined && ev.counter !== null && ev.counter === timeline.counter) {
      active.push(ev);
      continue;
    }
    if (ev.cycleId && timeline.cycles) {
      const cycle = timeline.cycles.find((c) => c.id === ev.cycleId);
      if (cycle) {
        const state = computeCycleState(timeline.counter, cycle);
        if (ev.segmentIndex !== undefined && ev.segmentIndex !== null && state.segmentIndex === ev.segmentIndex) {
          if (ev.segmentDay === undefined || ev.segmentDay === null || state.dayInSegment === ev.segmentDay) {
            active.push(ev);
          }
        }
      }
    }
  }

  return active;
}

// ─── SVG Clock Generator (Pie & Track Slices) ────────────────────────────────

export function createClockSvg(clock: ClockData, size: number = 44): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.classList.add('dte-clock-svg');

  const total = Math.max(2, clock.segments);
  const filled = Math.max(0, Math.min(total, clock.filled));
  const center = 50;
  const radius = 44;
  const fillColor = clock.color || 'var(--interactive-accent)';

  // Outer circle background
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  bg.setAttribute('cx', String(center));
  bg.setAttribute('cy', String(center));
  bg.setAttribute('r', String(radius));
  bg.setAttribute('fill', 'var(--background-secondary)');
  bg.setAttribute('stroke', 'var(--background-modifier-border)');
  bg.setAttribute('stroke-width', '3');
  svg.appendChild(bg);

  const anglePerSlice = (2 * Math.PI) / total;

  for (let i = 0; i < total; i++) {
    const startAngle = -Math.PI / 2 + i * anglePerSlice;
    const endAngle = startAngle + anglePerSlice;

    const x1 = center + radius * Math.cos(startAngle);
    const y1 = center + radius * Math.sin(startAngle);
    const x2 = center + radius * Math.cos(endAngle);
    const y2 = center + radius * Math.sin(endAngle);

    const largeArcFlag = anglePerSlice > Math.PI ? 1 : 0;
    const pathData = [
      `M ${center} ${center}`,
      `L ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
      'Z',
    ].join(' ');

    const slice = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    slice.setAttribute('d', pathData);
    slice.setAttribute('fill', i < filled ? fillColor : 'transparent');
    slice.setAttribute('stroke', 'var(--background-modifier-border)');
    slice.setAttribute('stroke-width', '2');
    slice.classList.add('dte-clock-slice');
    slice.dataset.sliceIndex = String(i);

    svg.appendChild(slice);
  }

  return svg;
}

// ─── Timeline Floating Panel ──────────────────────────────────────────────────

export class TimelinePanel {
  app: App;
  plugin: any;
  el: HTMLElement;
  minimized = false;
  private showClocks = true;
  private dragOffsetX = 0;
  private dragOffsetY = 0;
  private isDragging = false;
  private onUpdate: () => void;

  constructor(app: App, plugin: any, panelsLayer: HTMLElement, onUpdate: () => void) {
    this.app = app;
    this.plugin = plugin;
    this.onUpdate = onUpdate;

    this.el = panelsLayer.createDiv({ cls: 'dte-panel dte-timeline-panel' });
    this.el.style.left = '16px';
    this.el.style.top = '60px';
    this.el.style.right = 'auto';
    this.el.style.pointerEvents = 'auto';

    this.build();
  }

  private get settings(): DinoSettings {
    return this.plugin.settings as DinoSettings;
  }

  private async save(): Promise<void> {
    await this.plugin.saveSettings();
  }

  public getActiveTimeline(): TimelineData | null {
    const s = this.settings;
    if (!s.timelines) s.timelines = {};
    const ids = Object.keys(s.timelines);
    if (ids.length === 0) return null;

    if (s.currentTimelineId && s.timelines[s.currentTimelineId]) {
      return s.timelines[s.currentTimelineId];
    }
    s.currentTimelineId = ids[0];
    return s.timelines[ids[0]];
  }

  public build(): void {
    this.el.empty();
    const s = this.settings;
    if (!s.timelines) s.timelines = {};
    if (!s.clocks) s.clocks = {};

    const activeTl = this.getActiveTimeline();

    // ── Header ──
    const header = this.el.createDiv({ cls: 'dte-panel-header' });
    this.setupDrag(header);

    const titleWrap = header.createDiv({ cls: 'dte-panel-title' });
    const iconSpan = titleWrap.createSpan({ cls: 'dte-panel-icon' });
    setIcon(iconSpan, 'calendar');

    if (Object.keys(s.timelines).length > 1) {
      const select = titleWrap.createEl('select', { cls: 'dropdown dte-select dte-timeline-select' });
      for (const id in s.timelines) {
        const opt = select.createEl('option', { text: s.timelines[id].name || t('common.unnamed'), value: id });
        if (id === s.currentTimelineId) opt.selected = true;
      }
      select.addEventListener('change', async () => {
        s.currentTimelineId = select.value;
        await this.save();
        this.build();
      });
    } else if (activeTl) {
      titleWrap.createSpan({ text: activeTl.name || t('timeline.title'), cls: 'dte-panel-title-text' });
    } else {
      titleWrap.createSpan({ text: t('timeline.title'), cls: 'dte-panel-title-text' });
    }

    const actions = header.createDiv({ cls: 'dte-panel-actions' });

    // Clocks toggle button
    const clocksBtn = actions.createEl('button', {
      cls: `clickable-icon dte-panel-btn ${this.showClocks ? 'is-active' : ''}`,
      attr: { 'aria-label': t('timeline.clocksTab') },
    });
    setIcon(clocksBtn, 'pie-chart');
    clocksBtn.addEventListener('click', () => {
      this.showClocks = !this.showClocks;
      this.build();
    });

    // Manage button
    const manageBtn = actions.createEl('button', {
      cls: 'clickable-icon dte-panel-btn',
      attr: { 'aria-label': t('timeline.manageTimelines') },
    });
    setIcon(manageBtn, 'settings');
    manageBtn.addEventListener('click', () => {
      new TimelineManagerModal(this.app, this.plugin, () => this.build()).open();
    });

    // Minimize button
    const minBtn = actions.createEl('button', {
      cls: 'clickable-icon dte-panel-btn',
      attr: { 'aria-label': this.minimized ? t('modules.combatExpand') : t('modules.combatMinimize') },
    });
    setIcon(minBtn, this.minimized ? 'chevron-down' : 'chevron-up');
    minBtn.addEventListener('click', () => {
      this.minimized = !this.minimized;
      this.build();
    });

    if (this.minimized) return;

    // ── Body ──
    const body = this.el.createDiv({ cls: 'dte-timeline-body' });

    if (!activeTl) {
      const empty = body.createDiv({ cls: 'dte-panel-empty' });
      empty.createSpan({ text: t('timeline.noTimelineSelected') });
      const newBtn = empty.createEl('button', { cls: 'dte-btn mod-cta', text: t('timeline.newTimeline') });
      newBtn.addEventListener('click', () => {
        new TimelineManagerModal(this.app, this.plugin, () => this.build()).open();
      });
      return;
    }

    // ── Primary Display: Time & Cycles ──
    const displayCard = body.createDiv({ cls: 'dte-timeline-card' });
    const formattedText = formatTimeline(activeTl);

    const timeLabel = displayCard.createDiv({ cls: 'dte-timeline-time-label' });
    timeLabel.createSpan({ text: formattedText });

    // Counter pill & direct edit
    const counterRow = displayCard.createDiv({ cls: 'dte-timeline-counter-row' });
    const counterPill = counterRow.createDiv({ cls: 'dte-timeline-counter-badge' });
    counterPill.createSpan({ text: `${activeTl.unit || 'unidad'}: ${activeTl.counter}` });
    counterPill.title = 'Click para editar contador directamente';
    counterPill.addEventListener('click', () => {
      const valStr = prompt(t('timeline.currentValue'), String(activeTl.counter));
      if (valStr !== null) {
        const parsed = parseInt(valStr, 10);
        if (!isNaN(parsed)) {
          this.advance(activeTl, parsed - activeTl.counter);
        }
      }
    });

    // ── Advance Buttons ──
    const stepRow = body.createDiv({ cls: 'dte-timeline-steps-row' });
    const steps: TimelineAdvanceStep[] =
      activeTl.steps && activeTl.steps.length > 0
        ? activeTl.steps
        : [
            { id: '1', amount: 1 },
            { id: '2', amount: 7 },
            { id: '3', amount: -1 },
          ];

    for (const step of steps) {
      const btnLabel =
        step.label ||
        `${step.amount > 0 ? '+' : ''}${step.amount} ${activeTl.unit || ''}`.trim();
      const stepBtn = stepRow.createEl('button', {
        cls: 'dte-btn dte-timeline-step-btn',
        text: btnLabel,
      });
      stepBtn.addEventListener('click', () => {
        this.advance(activeTl, step.amount);
      });
    }

    // ── Active Events Pill ──
    const activeEvents = getActiveEvents(activeTl);
    if (activeEvents.length > 0) {
      const eventSection = body.createDiv({ cls: 'dte-timeline-events-box' });
      eventSection.createDiv({ cls: 'dte-timeline-section-title', text: t('timeline.currentEvents') });
      for (const ev of activeEvents) {
        const evRow = eventSection.createDiv({ cls: 'dte-timeline-event-item' });
        const dot = evRow.createSpan({ cls: 'dte-timeline-event-dot' });
        if (ev.color) dot.style.backgroundColor = ev.color;
        evRow.createSpan({ cls: 'dte-timeline-event-name', text: ev.name });
        if (ev.description) {
          evRow.createSpan({ cls: 'dte-timeline-event-desc', text: `— ${ev.description}` });
        }
      }
    }

    // ── Progress Clocks ──
    if (this.showClocks) {
      const clocksSection = body.createDiv({ cls: 'dte-timeline-clocks-section' });
      const clocksHeader = clocksSection.createDiv({ cls: 'dte-timeline-clocks-header' });
      clocksHeader.createSpan({ text: t('timeline.clocksTab'), cls: 'dte-timeline-section-title' });

      const addClockBtn = clocksHeader.createEl('button', {
        cls: 'clickable-icon dte-panel-btn',
        attr: { 'aria-label': t('timeline.addClock') },
      });
      setIcon(addClockBtn, 'plus');
      addClockBtn.addEventListener('click', () => {
        new ClockEditModal(this.app, this.plugin, null, activeTl.id, () => this.build()).open();
      });

      const clockList = clocksSection.createDiv({ cls: 'dte-timeline-clocks-grid' });
      const clockIds = Object.keys(s.clocks);

      if (clockIds.length === 0) {
        clockList.createDiv({ cls: 'dte-hint', text: t('timeline.noClocks') });
      } else {
        for (const cId of clockIds) {
          const clock = s.clocks[cId];
          const clockCard = clockList.createDiv({ cls: 'dte-clock-card' });

          const svgWrap = clockCard.createDiv({ cls: 'dte-clock-svg-wrap' });
          const svg = createClockSvg(clock, 46);
          svgWrap.appendChild(svg);

          // Click on svg to increment / decrement
          svg.addEventListener('click', async (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target && target.classList.contains('dte-clock-slice')) {
              const idx = parseInt(target.dataset.sliceIndex || '0', 10);
              if (idx + 1 === clock.filled) {
                clock.filled = Math.max(0, clock.filled - 1);
              } else {
                clock.filled = idx + 1;
              }
            } else {
              clock.filled = (clock.filled + 1) % (clock.segments + 1);
            }
            await this.save();
            this.build();
          });

          svg.addEventListener('contextmenu', async (e: MouseEvent) => {
            e.preventDefault();
            clock.filled = Math.max(0, clock.filled - 1);
            await this.save();
            this.build();
          });

          const meta = clockCard.createDiv({ cls: 'dte-clock-meta' });
          const nameEl = meta.createDiv({ cls: 'dte-clock-title', text: clock.name });
          nameEl.addEventListener('click', () => {
            new ClockEditModal(this.app, this.plugin, clock, activeTl.id, () => this.build()).open();
          });

          const countRow = meta.createDiv({ cls: 'dte-clock-count-row' });
          countRow.createSpan({ text: `${clock.filled} / ${clock.segments}` });
        }
      }
    }
  }

  public async advance(timeline: TimelineData, amount: number): Promise<void> {
    const oldCounter = timeline.counter;
    timeline.counter += amount;
    if (!timeline.allowNegative && timeline.counter < 0) {
      timeline.counter = 0;
    }

    // Advance any linked clocks
    const s = this.settings;
    if (s.clocks && amount > 0) {
      for (const cId in s.clocks) {
        const clock = s.clocks[cId];
        if (clock.linkedTimelineId === timeline.id && clock.advanceEvery && clock.advanceEvery > 0) {
          const prevTicks = Math.floor(oldCounter / clock.advanceEvery);
          const newTicks = Math.floor(timeline.counter / clock.advanceEvery);
          const diff = newTicks - prevTicks;
          if (diff > 0) {
            clock.filled = Math.min(clock.segments, clock.filled + diff);
            if (clock.filled >= clock.segments) {
              new Notice(`⏰ Reloj "${clock.name}" completado!`);
            }
          }
        }
      }
    }

    await this.save();
    this.build();
    this.onUpdate();
  }

  // ── Drag & Drop ──
  private setupDrag(handle: HTMLElement): void {
    handle.addEventListener('mousedown', (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('button, select, input')) return;
      this.isDragging = true;
      const rect = this.el.getBoundingClientRect();
      this.dragOffsetX = e.clientX - rect.left;
      this.dragOffsetY = e.clientY - rect.top;

      const onMouseMove = (ev: MouseEvent) => {
        if (!this.isDragging) return;
        const parent = this.el.parentElement?.getBoundingClientRect();
        if (!parent) return;
        const x = Math.max(0, Math.min(ev.clientX - parent.left - this.dragOffsetX, parent.width - 150));
        const y = Math.max(0, Math.min(ev.clientY - parent.top - this.dragOffsetY, parent.height - 50));
        this.el.style.left = `${x}px`;
        this.el.style.top = `${y}px`;
        this.el.style.right = 'auto';
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

// ─── Calendars & Clocks Manager Modal (Sleek Redesign) ─────────────────────────

export class TimelineManagerModal extends Modal {
  plugin: any;
  onRefresh: () => void;
  private activeTab: 'timelines' | 'clocks' | 'templates' = 'timelines';
  private selectedTimelineId: string | null = null;

  constructor(app: App, plugin: any, onRefresh: () => void) {
    super(app);
    this.plugin = plugin;
    this.onRefresh = onRefresh;
  }

  private get settings(): DinoSettings {
    return this.plugin.settings as DinoSettings;
  }

  private async save(): Promise<void> {
    await this.plugin.saveSettings();
    this.onRefresh();
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('dte-modal-large');

    const s = this.settings;
    if (!s.timelines) s.timelines = {};
    if (!s.clocks) s.clocks = {};

    if (!this.selectedTimelineId || !s.timelines[this.selectedTimelineId]) {
      const keys = Object.keys(s.timelines);
      this.selectedTimelineId = keys.length > 0 ? keys[0] : null;
    }

    this.renderModal();
  }

  private renderModal(): void {
    const { contentEl } = this;
    contentEl.empty();

    // ── Header Tabs ──
    const headerRow = contentEl.createDiv({ cls: 'dte-modal-header-tabs' });
    const tabs = headerRow.createDiv({ cls: 'dte-tab-group' });

    const tlTab = tabs.createEl('button', {
      cls: `dte-tab-btn ${this.activeTab === 'timelines' ? 'is-active' : ''}`,
      text: `📅 ${t('timeline.timelineTab')}`,
    });
    tlTab.addEventListener('click', () => {
      this.activeTab = 'timelines';
      this.renderModal();
    });

    const clocksTab = tabs.createEl('button', {
      cls: `dte-tab-btn ${this.activeTab === 'clocks' ? 'is-active' : ''}`,
      text: `⏱️ ${t('timeline.clocksTab')}`,
    });
    clocksTab.addEventListener('click', () => {
      this.activeTab = 'clocks';
      this.renderModal();
    });

    const tplTab = tabs.createEl('button', {
      cls: `dte-tab-btn ${this.activeTab === 'templates' ? 'is-active' : ''}`,
      text: `📦 ${t('timeline.exportJson')}`,
    });
    tplTab.addEventListener('click', () => {
      this.activeTab = 'templates';
      this.renderModal();
    });

    const body = contentEl.createDiv({ cls: 'dte-modal-tab-body' });

    if (this.activeTab === 'timelines') {
      this.renderTimelinesTab(body);
    } else if (this.activeTab === 'clocks') {
      this.renderClocksTab(body);
    } else {
      this.renderTemplatesTab(body);
    }
  }

  // ── Calendars Tab ──
  private renderTimelinesTab(container: HTMLElement): void {
    const s = this.settings;
    const split = container.createDiv({ cls: 'dte-manager-split' });

    // Sidebar: Calendar List
    const sidebar = split.createDiv({ cls: 'dte-manager-sidebar' });
    const sidebarHeader = sidebar.createDiv({ cls: 'dte-sidebar-header' });
    sidebarHeader.createSpan({ text: t('timeline.timelineTab'), cls: 'dte-section-title' });

    const newTlBtn = sidebarHeader.createEl('button', {
      cls: 'clickable-icon dte-btn-icon',
      attr: { 'aria-label': t('timeline.newTimeline') },
    });
    setIcon(newTlBtn, 'plus');
    newTlBtn.addEventListener('click', async () => {
      const id = genId();
      s.timelines[id] = {
        id,
        name: 'Nuevo Calendario',
        unit: 'día',
        counter: 1,
        allowNegative: false,
        cycles: [],
        format: '',
        steps: [
          { id: genId(), amount: 1 },
          { id: genId(), amount: 7 },
          { id: genId(), amount: -1 },
        ],
        events: [],
      };
      this.selectedTimelineId = id;
      s.currentTimelineId = id;
      await this.save();
      this.renderModal();
    });

    const listEl = sidebar.createDiv({ cls: 'dte-manager-list' });
    for (const id in s.timelines) {
      const tl = s.timelines[id];
      const item = listEl.createDiv({
        cls: `dte-manager-item ${id === this.selectedTimelineId ? 'is-active' : ''}`,
      });
      const icon = item.createSpan({ cls: 'dte-manager-item-icon' });
      setIcon(icon, 'calendar');
      const textWrap = item.createDiv({ cls: 'dte-manager-item-text-wrap' });
      textWrap.createSpan({ text: tl.name || t('common.unnamed'), cls: 'dte-item-title' });
      textWrap.createSpan({ text: `${tl.unit || 'unidad'}: ${tl.counter}`, cls: 'dte-item-sub' });

      item.addEventListener('click', () => {
        this.selectedTimelineId = id;
        s.currentTimelineId = id;
        this.renderModal();
      });
    }

    // Detail Editor
    const detail = split.createDiv({ cls: 'dte-manager-detail' });
    const currentTl = this.selectedTimelineId ? s.timelines[this.selectedTimelineId] : null;

    if (!currentTl) {
      detail.createDiv({ cls: 'dte-hint dte-manager-empty-hint', text: t('timeline.noTimelineSelected') });
      return;
    }

    // ── 1. Top Properties Form Card ──
    const formCard = detail.createDiv({ cls: 'dte-form-card' });
    const formHeader = formCard.createDiv({ cls: 'dte-form-card-title' });
    formHeader.createSpan({ text: '⚙️ Configuración Básica' });

    const grid = formCard.createDiv({ cls: 'dte-form-grid' });

    // Calendar Name
    const nameField = grid.createDiv({ cls: 'dte-form-field dte-field-wide' });
    nameField.createEl('label', { text: t('timeline.name') });
    const nameInput = nameField.createEl('input', {
      type: 'text',
      cls: 'dte-input-clean',
      value: currentTl.name,
    });
    nameInput.addEventListener('input', async () => {
      currentTl.name = nameInput.value;
      await this.save();
    });

    // Unit Name
    const unitField = grid.createDiv({ cls: 'dte-form-field' });
    unitField.createEl('label', { text: t('timeline.unit') });
    const unitInput = unitField.createEl('input', {
      type: 'text',
      cls: 'dte-input-clean',
      value: currentTl.unit,
      placeholder: 'día, turno, jornada...',
    });
    unitInput.addEventListener('input', async () => {
      currentTl.unit = unitInput.value;
      await this.save();
      this.updateFormatPreview(detail, currentTl);
    });

    // Current Value
    const valField = grid.createDiv({ cls: 'dte-form-field' });
    valField.createEl('label', { text: t('timeline.currentValue') });
    const valInput = valField.createEl('input', {
      type: 'number',
      cls: 'dte-input-clean',
      value: String(currentTl.counter),
    });
    valInput.addEventListener('input', async () => {
      const num = parseInt(valInput.value, 10);
      if (!isNaN(num)) {
        currentTl.counter = num;
        await this.save();
        this.updateFormatPreview(detail, currentTl);
      }
    });

    // Allow Negative Toggle
    const negField = grid.createDiv({ cls: 'dte-form-field dte-field-checkbox' });
    const negLabel = negField.createEl('label');
    const negToggle = negLabel.createEl('input', { type: 'checkbox' });
    negToggle.checked = !!currentTl.allowNegative;
    negLabel.appendChild(document.createTextNode(` ${t('timeline.allowNegative')}`));
    negToggle.addEventListener('change', async () => {
      currentTl.allowNegative = negToggle.checked;
      await this.save();
    });

    // ── 2. Display Format & Live Preview Card ──
    const formatCard = detail.createDiv({ cls: 'dte-form-card' });
    formatCard.createDiv({ cls: 'dte-form-card-title', text: '🏷️ ' + t('timeline.formatString') });
    formatCard.createDiv({ cls: 'dte-hint', text: t('timeline.formatHint') });

    const formatInputWrap = formatCard.createDiv({ cls: 'dte-format-input-wrap' });
    const formatInput = formatInputWrap.createEl('input', {
      type: 'text',
      cls: 'dte-input-clean dte-format-input',
      placeholder: '{Estación}, {Mes} · {unit} {counter}',
      value: currentTl.format || '',
    });

    formatInput.addEventListener('input', async () => {
      currentTl.format = formatInput.value;
      await this.save();
      this.updateFormatPreview(detail, currentTl);
    });

    // Tag pills to insert
    const tagPillsRow = formatCard.createDiv({ cls: 'dte-tag-pills-row' });
    tagPillsRow.createSpan({ text: 'Insertar etiqueta:', cls: 'dte-tag-pills-label' });

    const makeTagPill = (tag: string) => {
      const pill = tagPillsRow.createEl('button', { cls: 'dte-tag-pill', text: `+ ${tag}` });
      pill.addEventListener('click', async (e: MouseEvent) => {
        e.preventDefault();
        formatInput.value = (formatInput.value ? `${formatInput.value} ` : '') + tag;
        currentTl.format = formatInput.value;
        await this.save();
        this.updateFormatPreview(detail, currentTl);
      });
    };

    makeTagPill('{unit}');
    makeTagPill('{counter}');
    if (currentTl.cycles) {
      for (const c of currentTl.cycles) {
        if (c.name) {
          makeTagPill(`{${c.name}}`);
          makeTagPill(`{${c.name}.day}`);
          makeTagPill(`{${c.name}.repeat}`);
        }
      }
    }

    // Live preview box
    this.updateFormatPreview(detail, currentTl);

    // ── 3. Cycles Section ──
    const cyclesSection = detail.createDiv({ cls: 'dte-editor-section' });
    const cyclesHeader = cyclesSection.createDiv({ cls: 'dte-editor-section-header' });
    cyclesHeader.createEl('h4', { text: `🔄 ${t('timeline.cycles')} (${currentTl.cycles ? currentTl.cycles.length : 0})` });

    const addCycleBtn = cyclesHeader.createEl('button', { cls: 'dte-btn mod-cta', text: t('timeline.addCycle') });
    addCycleBtn.addEventListener('click', async () => {
      if (!currentTl.cycles) currentTl.cycles = [];
      currentTl.cycles.push({
        id: genId(),
        name: `Ciclo ${currentTl.cycles.length + 1}`,
        offset: 0,
        showRepeatCount: false,
        repeatStart: 1,
        segments: [
          { name: 'Segmento 1', length: 1 },
          { name: 'Segmento 2', length: 1 },
        ],
      });
      await this.save();
      this.renderModal();
    });

    if (!currentTl.cycles || currentTl.cycles.length === 0) {
      cyclesSection.createDiv({ cls: 'dte-empty-inline', text: 'No hay ciclos configurados en este calendario.' });
    } else {
      currentTl.cycles.forEach((cycle, cIndex) => {
        const cycleCard = cyclesSection.createDiv({ cls: 'dte-cycle-card' });
        const cRow = cycleCard.createDiv({ cls: 'dte-cycle-top-row' });

        const nameInput = cRow.createEl('input', {
          type: 'text',
          cls: 'dte-input-clean dte-cycle-name-input',
          value: cycle.name,
        });
        nameInput.placeholder = t('timeline.cycleName');
        nameInput.addEventListener('change', async () => {
          cycle.name = nameInput.value;
          await this.save();
          this.renderModal();
        });

        const offsetWrap = cRow.createDiv({ cls: 'dte-inline-label-input' });
        offsetWrap.createSpan({ text: 'Desfase:' });
        const offsetInput = offsetWrap.createEl('input', {
          type: 'number',
          cls: 'dte-input-clean dte-number-sm',
          value: String(cycle.offset || 0),
        });
        offsetInput.addEventListener('change', async () => {
          cycle.offset = parseInt(offsetInput.value, 10) || 0;
          await this.save();
          this.updateFormatPreview(detail, currentTl);
        });

        const repWrap = cRow.createDiv({ cls: 'dte-inline-label-input' });
        const repToggle = repWrap.createEl('input', { type: 'checkbox' });
        repToggle.checked = !!cycle.showRepeatCount;
        repWrap.createSpan({ text: t('timeline.showRepeatCount') });
        repToggle.addEventListener('change', async () => {
          cycle.showRepeatCount = repToggle.checked;
          await this.save();
          this.updateFormatPreview(detail, currentTl);
        });

        const delCycleBtn = cRow.createEl('button', { cls: 'clickable-icon dte-btn-icon' });
        setIcon(delCycleBtn, 'trash');
        delCycleBtn.addEventListener('click', async () => {
          currentTl.cycles.splice(cIndex, 1);
          await this.save();
          this.renderModal();
        });

        // Segments within cycle
        const segContainer = cycleCard.createDiv({ cls: 'dte-segments-container' });
        const segHeader = segContainer.createDiv({ cls: 'dte-segments-header' });
        segHeader.createSpan({ text: `${t('timeline.segments')} (${cycle.segments.length})`, cls: 'dte-sub-title' });

        const addSegBtn = segHeader.createEl('button', {
          cls: 'dte-btn-sm',
          text: t('timeline.addSegment'),
        });
        addSegBtn.addEventListener('click', async () => {
          cycle.segments.push({ name: `Segmento ${cycle.segments.length + 1}`, length: 1 });
          await this.save();
          this.renderModal();
        });

        const segList = segContainer.createDiv({ cls: 'dte-segments-list' });
        cycle.segments.forEach((seg, sIndex) => {
          const segRow = segList.createDiv({ cls: 'dte-segment-row' });

          const segName = segRow.createEl('input', {
            type: 'text',
            cls: 'dte-input-clean dte-seg-name',
            value: seg.name,
          });
          segName.placeholder = t('timeline.segmentName');
          segName.addEventListener('change', async () => {
            seg.name = segName.value;
            await this.save();
            this.updateFormatPreview(detail, currentTl);
          });

          const lenWrap = segRow.createDiv({ cls: 'dte-inline-label-input' });
          lenWrap.createSpan({ text: `${currentTl.unit || 'unidades'}:` });
          const segLen = lenWrap.createEl('input', {
            type: 'number',
            cls: 'dte-input-clean dte-number-sm',
            value: String(seg.length),
          });
          segLen.addEventListener('change', async () => {
            seg.length = Math.max(1, parseInt(segLen.value, 10) || 1);
            await this.save();
            this.updateFormatPreview(detail, currentTl);
          });

          const delSegBtn = segRow.createEl('button', { cls: 'clickable-icon dte-btn-icon' });
          setIcon(delSegBtn, 'x');
          delSegBtn.addEventListener('click', async () => {
            cycle.segments.splice(sIndex, 1);
            await this.save();
            this.renderModal();
          });
        });
      });
    }

    // ── 4. Advance Steps Section ──
    const stepsSection = detail.createDiv({ cls: 'dte-editor-section' });
    const stepsHeader = stepsSection.createDiv({ cls: 'dte-editor-section-header' });
    stepsHeader.createEl('h4', { text: `⏩ ${t('timeline.advanceSteps')}` });

    const addStepBtn = stepsHeader.createEl('button', { cls: 'dte-btn', text: t('timeline.addStep') });
    addStepBtn.addEventListener('click', async () => {
      if (!currentTl.steps) currentTl.steps = [];
      currentTl.steps.push({ id: genId(), amount: 1 });
      await this.save();
      this.renderModal();
    });

    const stepsList = stepsSection.createDiv({ cls: 'dte-steps-list' });
    if (!currentTl.steps || currentTl.steps.length === 0) {
      stepsList.createDiv({ cls: 'dte-empty-inline', text: 'Botones por defecto activos (+1, +7, -1).' });
    } else {
      currentTl.steps.forEach((step, stIndex) => {
        const stRow = stepsList.createDiv({ cls: 'dte-step-row' });

        const amountWrap = stRow.createDiv({ cls: 'dte-inline-label-input' });
        amountWrap.createSpan({ text: 'Paso:' });
        const amountInput = amountWrap.createEl('input', {
          type: 'number',
          cls: 'dte-input-clean dte-number-sm',
          value: String(step.amount),
        });
        amountInput.addEventListener('change', async () => {
          step.amount = parseInt(amountInput.value, 10) || 1;
          await this.save();
        });

        const labelInput = stRow.createEl('input', {
          type: 'text',
          cls: 'dte-input-clean dte-step-label-input',
          value: step.label || '',
        });
        labelInput.placeholder = t('timeline.stepLabel');
        labelInput.addEventListener('change', async () => {
          step.label = labelInput.value.trim() || undefined;
          await this.save();
        });

        const delStepBtn = stRow.createEl('button', { cls: 'clickable-icon dte-btn-icon' });
        setIcon(delStepBtn, 'x');
        delStepBtn.addEventListener('click', async () => {
          currentTl.steps.splice(stIndex, 1);
          await this.save();
          this.renderModal();
        });
      });
    }

    // ── 5. Delete Calendar Footer ──
    const footer = detail.createDiv({ cls: 'dte-editor-footer' });
    const delBtn = footer.createEl('button', {
      cls: 'dte-btn mod-warning',
      text: t('common.delete'),
    });
    delBtn.addEventListener('click', async () => {
      if (confirm(t('timeline.deleteConfirm', { name: currentTl.name }))) {
        delete s.timelines[currentTl.id];
        const remaining = Object.keys(s.timelines);
        this.selectedTimelineId = remaining.length > 0 ? remaining[0] : null;
        s.currentTimelineId = this.selectedTimelineId;
        await this.save();
        this.renderModal();
      }
    });
  }

  private updateFormatPreview(container: HTMLElement, tl: TimelineData): void {
    let previewEl = container.querySelector('.dte-format-preview') as HTMLElement | null;
    if (!previewEl) {
      previewEl = container.createDiv({ cls: 'dte-format-preview' });
    }
    previewEl.empty();
    const iconSpan = previewEl.createSpan({ cls: 'dte-preview-icon' });
    setIcon(iconSpan, 'calendar');
    previewEl.createSpan({ text: `${t('timeline.formatPreview')} `, cls: 'dte-preview-label' });
    previewEl.createSpan({ text: formatTimeline(tl), cls: 'dte-preview-val' });
  }

  // ── Clocks Tab ──
  private renderClocksTab(container: HTMLElement): void {
    const s = this.settings;
    const header = container.createDiv({ cls: 'dte-editor-section-header' });
    header.createEl('h3', { text: `⏱️ ${t('timeline.clocksTab')}` });

    const addClockBtn = header.createEl('button', { cls: 'dte-btn mod-cta', text: t('timeline.addClock') });
    addClockBtn.addEventListener('click', () => {
      new ClockEditModal(this.app, this.plugin, null, this.selectedTimelineId, () => this.renderModal()).open();
    });

    const grid = container.createDiv({ cls: 'dte-clocks-manager-grid' });
    const clockIds = Object.keys(s.clocks);

    if (clockIds.length === 0) {
      grid.createDiv({ cls: 'dte-hint', text: t('timeline.noClocks') });
      return;
    }

    for (const cId of clockIds) {
      const clock = s.clocks[cId];
      const card = grid.createDiv({ cls: 'dte-clock-manage-card' });

      const svgWrap = card.createDiv({ cls: 'dte-clock-svg-wrap' });
      svgWrap.appendChild(createClockSvg(clock, 60));

      const info = card.createDiv({ cls: 'dte-clock-manage-info' });
      info.createEl('h4', { text: clock.name });
      info.createDiv({ cls: 'dte-hint', text: `${clock.filled} / ${clock.segments} porciones` });

      if (clock.linkedTimelineId && s.timelines[clock.linkedTimelineId]) {
        info.createDiv({
          cls: 'dte-badge',
          text: `Vinculado a ${s.timelines[clock.linkedTimelineId].name} (cada ${clock.advanceEvery || 1})`,
        });
      }

      const actions = card.createDiv({ cls: 'dte-clock-manage-actions' });
      const editBtn = actions.createEl('button', { cls: 'dte-btn', text: t('common.edit') });
      editBtn.addEventListener('click', () => {
        new ClockEditModal(this.app, this.plugin, clock, this.selectedTimelineId, () => this.renderModal()).open();
      });

      const delBtn = actions.createEl('button', { cls: 'dte-btn mod-warning', text: t('common.delete') });
      delBtn.addEventListener('click', async () => {
        if (confirm(t('timeline.deleteClockConfirm', { name: clock.name }))) {
          delete s.clocks[cId];
          await this.save();
          this.renderModal();
        }
      });
    }
  }

  // ── Templates Tab (Import / Export JSON) ──
  private renderTemplatesTab(container: HTMLElement): void {
    const s = this.settings;
    container.createEl('h3', { text: `📦 ${t('timeline.exportJson')}` });
    container.createDiv({ cls: 'dte-hint', text: 'Exporta o importa plantillas de calendario en formato JSON.' });

    const currentTl = this.selectedTimelineId ? s.timelines[this.selectedTimelineId] : null;

    if (currentTl) {
      const expCard = container.createDiv({ cls: 'dte-form-card' });
      expCard.createDiv({ cls: 'dte-form-card-title', text: `Exportar "${currentTl.name}"` });
      const btn = expCard.createEl('button', {
        cls: 'dte-btn mod-cta',
        text: '📋 Copiar JSON al portapapeles',
      });
      btn.addEventListener('click', () => {
        const jsonStr = JSON.stringify(currentTl, null, 2);
        navigator.clipboard.writeText(jsonStr);
        new Notice('¡Plantilla JSON copiada al portapapeles!');
      });
    }

    // Import Area
    const impCard = container.createDiv({ cls: 'dte-form-card' });
    impCard.createDiv({ cls: 'dte-form-card-title', text: `Importar Plantilla` });
    const textarea = impCard.createEl('textarea', {
      cls: 'dte-textarea-json',
      attr: { rows: '8', placeholder: 'Pega aquí el JSON del calendario...' },
    });

    const importBtn = impCard.createEl('button', {
      cls: 'dte-btn mod-cta',
      text: t('timeline.importJson'),
    });
    importBtn.addEventListener('click', async () => {
      try {
        const parsed = JSON.parse(textarea.value);
        if (!parsed.name || !parsed.unit) {
          throw new Error('Falta el nombre o la unidad en la plantilla JSON');
        }
        const id = genId();
        parsed.id = id;
        s.timelines[id] = parsed;
        this.selectedTimelineId = id;
        s.currentTimelineId = id;
        await this.save();
        new Notice(t('timeline.importSuccess'));
        this.activeTab = 'timelines';
        this.renderModal();
      } catch (e) {
        new Notice(t('timeline.importError'));
      }
    });
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}

// ─── Clock Edit Modal ─────────────────────────────────────────────────────────

export class ClockEditModal extends Modal {
  plugin: any;
  clock: ClockData | null;
  defaultTimelineId: string | null;
  onSave: () => void;

  constructor(
    app: App,
    plugin: any,
    clock: ClockData | null,
    defaultTimelineId: string | null,
    onSave: () => void
  ) {
    super(app);
    this.plugin = plugin;
    this.clock = clock;
    this.defaultTimelineId = defaultTimelineId;
    this.onSave = onSave;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();

    const isEdit = !!this.clock;
    contentEl.createEl('h2', { text: isEdit ? t('common.edit') : t('timeline.addClock') });

    const s = this.plugin.settings as DinoSettings;
    const current: ClockData = this.clock
      ? { ...this.clock }
      : {
          id: genId(),
          name: 'Nuevo Reloj',
          segments: 6,
          filled: 0,
          color: '#e06c75',
          linkedTimelineId: this.defaultTimelineId,
          advanceEvery: 1,
        };

    const form = contentEl.createDiv({ cls: 'dte-form-card' });

    // Clock Name
    const nameField = form.createDiv({ cls: 'dte-form-field dte-field-wide' });
    nameField.createEl('label', { text: t('timeline.clockName') });
    const nameInput = nameField.createEl('input', {
      type: 'text',
      cls: 'dte-input-clean',
      value: current.name,
    });
    nameInput.addEventListener('input', () => {
      current.name = nameInput.value;
    });

    // Segments Dropdown
    const segField = form.createDiv({ cls: 'dte-form-field' });
    segField.createEl('label', { text: t('timeline.clockSegments') });
    const drop = segField.createEl('select', { cls: 'dropdown dte-select' });
    ['4', '6', '8', '10', '12'].forEach((n) => {
      const opt = drop.createEl('option', { value: n, text: `${n} porciones` });
      if (String(current.segments) === n) opt.selected = true;
    });
    drop.addEventListener('change', () => {
      current.segments = parseInt(drop.value, 10);
      if (current.filled > current.segments) current.filled = current.segments;
    });

    // Filled Count
    const fillField = form.createDiv({ cls: 'dte-form-field' });
    fillField.createEl('label', { text: t('timeline.clockFilled') });
    const fillInput = fillField.createEl('input', {
      type: 'number',
      cls: 'dte-input-clean',
      value: String(current.filled),
    });
    fillInput.addEventListener('input', () => {
      current.filled = Math.max(0, Math.min(current.segments, parseInt(fillInput.value, 10) || 0));
    });

    // Color
    const colorField = form.createDiv({ cls: 'dte-form-field' });
    colorField.createEl('label', { text: t('common.color') });
    const colorInput = colorField.createEl('input', {
      type: 'color',
      cls: 'dte-input-clean',
      value: current.color || '#e06c75',
    });
    colorInput.addEventListener('input', () => {
      current.color = colorInput.value;
    });

    // Linked Timeline
    const linkField = form.createDiv({ cls: 'dte-form-field dte-field-wide' });
    linkField.createEl('label', { text: t('timeline.linkedTimeline') });
    const linkDrop = linkField.createEl('select', { cls: 'dropdown dte-select' });
    linkDrop.createEl('option', { value: '', text: t('common.none') });
    for (const tId in s.timelines) {
      const opt = linkDrop.createEl('option', { value: tId, text: s.timelines[tId].name });
      if (tId === current.linkedTimelineId) opt.selected = true;
    }
    linkDrop.addEventListener('change', () => {
      current.linkedTimelineId = linkDrop.value || null;
    });

    // Advance Every
    const advField = form.createDiv({ cls: 'dte-form-field' });
    advField.createEl('label', { text: t('timeline.advanceEvery') });
    const advInput = advField.createEl('input', {
      type: 'number',
      cls: 'dte-input-clean',
      value: String(current.advanceEvery || 1),
    });
    advInput.addEventListener('input', () => {
      current.advanceEvery = Math.max(1, parseInt(advInput.value, 10) || 1);
    });

    const btnRow = contentEl.createDiv({ cls: 'dte-modal-btn-row' });
    const cancelBtn = btnRow.createEl('button', { cls: 'dte-btn', text: t('common.cancel') });
    cancelBtn.addEventListener('click', () => this.close());

    const saveBtn = btnRow.createEl('button', { cls: 'dte-btn mod-cta', text: t('common.save') });
    saveBtn.addEventListener('click', async () => {
      if (!s.clocks) s.clocks = {};
      s.clocks[current.id] = current;
      await this.plugin.saveSettings();
      this.onSave();
      this.close();
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

// ─── Module Registration ──────────────────────────────────────────────────────

export const TimelineModule: EngineModule = {
  id: 'timeline',
  nameKey: 'modules.timelineName',
  descKey: 'modules.timelineDesc',
  icon: 'calendar',
  defaultEnabled: false,

  renderToolbarButton(container: HTMLElement, view: any): void {
    const btn = container.createEl('button', {
      cls: 'clickable-icon dte-btn-icon',
      attr: { 'aria-label': t('modules.timelineName') },
    });
    setIcon(btn, 'calendar');

    btn.addEventListener('click', () => {
      if (!view.timelinePanel) {
        view.timelinePanel = new TimelinePanel(
          view.app,
          view.plugin,
          view.panelsLayer,
          () => view.render()
        );
      } else {
        view.timelinePanel.minimized = false;
        view.timelinePanel.build();
      }
    });
  },
};
