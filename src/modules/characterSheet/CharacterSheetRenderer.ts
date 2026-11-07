import { App, TFile, setIcon } from 'obsidian';
import { SheetTemplate, SheetWidget } from './types';
import { evaluateCalculated, executeSheetRoll, resolveVariables } from './formulaEvaluator';
import { DinoPlugin } from '../../types';

export interface RendererCallbacks {
  onUpdateKey?: (key: string, value: any) => void;
  onReadHeading?: (heading: string) => Promise<string>;
}

export class CharacterSheetRenderer {
  private app: App;
  private plugin: DinoPlugin;
  private template: SheetTemplate;
  private data: Record<string, any>;
  private containerEl: HTMLElement;
  private callbacks: RendererCallbacks;
  private file?: TFile;
  private scale: number = 1.0;
  private widgetElements: Map<string, HTMLElement> = new Map();

  constructor(
    app: App,
    plugin: DinoPlugin,
    template: SheetTemplate,
    data: Record<string, any>,
    containerEl: HTMLElement,
    callbacks: RendererCallbacks = {},
    file?: TFile
  ) {
    this.app = app;
    this.plugin = plugin;
    this.template = template;
    this.data = { ...data };
    this.containerEl = containerEl;
    this.callbacks = callbacks;
    this.file = file;
  }

  public setScale(scale: number): void {
    this.scale = scale;
    this.applyScale();
  }

  public updateData(newData: Record<string, any>): void {
    this.data = { ...newData };
    this.refreshWidgetValues();
  }

  public render(): void {
    this.containerEl.empty();
    this.widgetElements.clear();

    const sheetRoot = this.containerEl.createDiv({ cls: 'dte-sheet-root' });
    sheetRoot.style.width = `${this.template.width || 800}px`;
    sheetRoot.style.height = `${this.template.height || 1000}px`;
    sheetRoot.style.position = 'relative';

    // Background
    if (this.template.background && this.template.background.path) {
      const bgEl = sheetRoot.createDiv({ cls: 'dte-sheet-bg' });
      bgEl.style.position = 'absolute';
      bgEl.style.top = '0';
      bgEl.style.left = '0';
      bgEl.style.width = '100%';
      bgEl.style.height = '100%';
      bgEl.style.zIndex = '0';
      bgEl.style.pointerEvents = 'none';
      bgEl.style.opacity = String(this.template.background.opacity ?? 1);

      const bgUrl = this.resolveVaultImageUrl(this.template.background.path);
      if (bgUrl) {
        bgEl.style.backgroundImage = `url("${bgUrl}")`;
        bgEl.style.backgroundSize = this.template.background.fit === 'contain' ? 'contain' : 'cover';
        bgEl.style.backgroundPosition = 'center';
        bgEl.style.backgroundRepeat = 'no-repeat';
      }
    }

    // Render sorted widgets by Z index
    const sortedWidgets = [...this.template.widgets].sort((a, b) => (a.z || 0) - (b.z || 0));

    for (const widget of sortedWidgets) {
      const el = this.renderWidget(sheetRoot, widget);
      this.widgetElements.set(widget.id, el);
    }

    this.applyScale();
  }

  private applyScale(): void {
    const sheetRoot = this.containerEl.querySelector<HTMLElement>('.dte-sheet-root');
    if (sheetRoot) {
      sheetRoot.style.transform = `scale(${this.scale})`;
      sheetRoot.style.transformOrigin = 'top left';
      // Adjust container bounding box to scaled size
      this.containerEl.style.width = `${(this.template.width || 800) * this.scale}px`;
      this.containerEl.style.height = `${(this.template.height || 1000) * this.scale}px`;
    }
  }

  private resolveVaultImageUrl(path: string): string | null {
    if (!path) return null;
    const file = this.app.metadataCache.getFirstLinkpathDest(path, '') || this.app.vault.getAbstractFileByPath(path);
    if (file && file instanceof TFile) {
      return this.app.vault.getResourcePath(file);
    }
    return path;
  }

  private renderWidget(parent: HTMLElement, widget: SheetWidget): HTMLElement {
    const wrapper = parent.createDiv({ cls: `dte-sheet-widget dte-sheet-widget-${widget.type}` });
    wrapper.dataset.widgetId = widget.id;
    wrapper.style.position = 'absolute';
    wrapper.style.left = `${widget.x}px`;
    wrapper.style.top = `${widget.y}px`;
    wrapper.style.width = `${widget.w}px`;
    wrapper.style.height = `${widget.h}px`;
    wrapper.style.zIndex = String(widget.z || 1);
    wrapper.style.boxSizing = 'border-box';

    // Apply custom styling
    const st = widget.style || {};
    if (st.border) {
      wrapper.style.border = `${st.borderWidth || 1}px ${st.borderStyle || 'solid'} ${st.borderColor || 'var(--text-muted)'}`;
    }
    if (st.backgroundColor) {
      wrapper.style.backgroundColor = st.backgroundColor;
    }
    if (st.borderRadius !== undefined) {
      wrapper.style.borderRadius = `${st.borderRadius}px`;
    }
    if (st.opacity !== undefined) {
      wrapper.style.opacity = String(st.opacity);
    }
    if (st.textColor) {
      wrapper.style.color = st.textColor;
    }
    if (st.fontFamily) {
      wrapper.style.fontFamily = st.fontFamily;
    }
    if (st.fontSize) {
      wrapper.style.fontSize = `${st.fontSize}px`;
    }
    if (st.fontWeight) {
      wrapper.style.fontWeight = st.fontWeight;
    }
    if (st.fontStyle) {
      wrapper.style.fontStyle = st.fontStyle;
    }
    if (st.textDecoration && st.textDecoration !== 'none') {
      wrapper.style.textDecoration = st.textDecoration;
    }
    if (st.textAlign) {
      wrapper.style.textAlign = st.textAlign;
    }

    switch (widget.type) {
      case 'frame':
        this.renderFrame(wrapper, widget);
        break;
      case 'label':
        this.renderLabel(wrapper, widget);
        break;
      case 'text':
        this.renderText(wrapper, widget);
        break;
      case 'counter':
        this.renderCounter(wrapper, widget);
        break;
      case 'check':
        this.renderCheck(wrapper, widget);
        break;
      case 'button':
        this.renderButton(wrapper, widget);
        break;
      case 'image':
        this.renderImage(wrapper, widget);
        break;
      case 'list':
        this.renderList(wrapper, widget);
        break;
      case 'grid':
        this.renderGrid(wrapper, widget);
        break;
      case 'calculated':
        this.renderCalculated(wrapper, widget);
        break;
    }

    return wrapper;
  }

  /* ---------------- Specific Widget Renderers ---------------- */

  private renderFrame(wrapper: HTMLElement, widget: SheetWidget): void {
    wrapper.addClass('dte-widget-frame-box');
    if (widget.style?.title) {
      const titleEl = wrapper.createDiv({ cls: 'dte-widget-frame-title' });
      titleEl.setText(widget.style.title);
      titleEl.style.textAlign = widget.style.titleAlign || 'left';
      if (widget.style.fontSize) titleEl.style.fontSize = `${widget.style.fontSize}px`;
      if (widget.style.textColor) titleEl.style.color = widget.style.textColor;
      if (widget.style.fontWeight) titleEl.style.fontWeight = widget.style.fontWeight;
    }
  }

  private renderLabel(wrapper: HTMLElement, widget: SheetWidget): void {
    wrapper.addClass('dte-widget-label-box');
    const st = widget.style || {};
    const textEl = wrapper.createDiv({ cls: 'dte-widget-label-text' });
    textEl.setText(st.title || 'Label');
    if (st.fontSize) textEl.style.fontSize = `${st.fontSize}px`;
    if (st.textColor) textEl.style.color = st.textColor;
    if (st.fontWeight) textEl.style.fontWeight = st.fontWeight;
    if (st.textAlign) textEl.style.textAlign = st.textAlign;
  }

  private renderText(wrapper: HTMLElement, widget: SheetWidget): void {
    wrapper.addClass('dte-widget-text-box');
    const bindKey = widget.bind;
    let initialValue = bindKey ? this.data[bindKey] ?? '' : '';

    const lines = widget.lines || 1;
    let inputEl: HTMLInputElement | HTMLTextAreaElement;

    if (lines > 1) {
      inputEl = wrapper.createEl('textarea', { cls: 'dte-widget-textarea' });
      inputEl.rows = lines;
    } else {
      inputEl = wrapper.createEl('input', { type: 'text', cls: 'dte-widget-input' });
    }

    inputEl.placeholder = widget.placeholder || '';
    if (widget.readOnly) inputEl.readOnly = true;
    inputEl.value = String(initialValue);

    // If bind is a markdown heading (# Heading), read asynchronously
    if (bindKey && bindKey.startsWith('#') && this.callbacks.onReadHeading) {
      this.callbacks.onReadHeading(bindKey).then((headingText) => {
        if (headingText !== undefined && inputEl) {
          inputEl.value = headingText;
        }
      });
    }

    inputEl.addEventListener('input', () => {
      if (!bindKey || widget.readOnly) return;
      this.data[bindKey] = inputEl.value;
      if (this.callbacks.onUpdateKey) {
        this.callbacks.onUpdateKey(bindKey, inputEl.value);
      }
      this.refreshCalculatedWidgets();
    });
  }

  private resolveBoundNumber(spec: number | string | undefined, defaultVal: number): number {
    if (typeof spec === 'number') return spec;
    if (typeof spec === 'string') {
      if (spec.startsWith('@')) {
        const key = spec.slice(1);
        const val = Number(this.data[key]);
        return isNaN(val) ? defaultVal : val;
      }
      const num = parseFloat(spec);
      return isNaN(num) ? defaultVal : num;
    }
    return defaultVal;
  }

  private renderCounter(wrapper: HTMLElement, widget: SheetWidget): void {
    wrapper.addClass('dte-widget-counter-box');
    const bindKey = widget.bind;
    const currentVal = bindKey ? Number(this.data[bindKey] ?? 0) : 0;
    
    const hasMin = widget.min !== undefined && widget.min !== null && String(widget.min).trim() !== '' && String(widget.min).trim().toLowerCase() !== 'none';
    const minVal = hasMin ? this.resolveBoundNumber(widget.min, 0) : -Infinity;

    const hasMax = widget.max !== undefined && widget.max !== null && String(widget.max).trim() !== '' && String(widget.max).trim().toLowerCase() !== 'none';
    const maxVal = hasMax ? this.resolveBoundNumber(widget.max, Infinity) : Infinity;

    const step = widget.step || 1;
    const displayMode = widget.display || (hasMax ? 'both' : 'number');

    // Header label / roll button
    if (widget.style?.title || widget.action?.formula) {
      const header = wrapper.createDiv({ cls: 'dte-counter-header' });
      const label = header.createSpan({ text: widget.style?.title || (widget.action ? 'Tirada' : '') });
      if (widget.action?.formula) {
        header.addClass('dte-counter-clickable');
        header.title = `Tirar: ${widget.action.formula}`;
        header.addEventListener('click', async () => {
          if (!widget.action?.formula) return;
          try {
            await executeSheetRoll(
              this.app,
              this.plugin,
              widget.action.formula,
              widget.action.reason || widget.style?.title,
              this.data,
              widget.action.render !== false
            );
          } catch (e) {
            // Handled in evaluator
          }
        });
      }
    }

    // Number controls row
    const row = wrapper.createDiv({ cls: 'dte-counter-row' });
    const decBtn = row.createEl('button', { text: '−', cls: 'dte-counter-btn dte-counter-dec' });
    const valInput = row.createEl('input', { type: 'number', cls: 'dte-counter-input' });
    valInput.value = String(currentVal);
    const incBtn = row.createEl('button', { text: '+', cls: 'dte-counter-btn dte-counter-inc' });

    // Optional max label display "12 / 20" - only if max is defined and finite!
    if (hasMax && isFinite(maxVal)) {
      row.createSpan({ text: `/ ${maxVal}`, cls: 'dte-counter-max-label' });
    }

    // Optional progress bar - only if max is defined and finite
    let barFill: HTMLElement | null = null;
    if (hasMax && isFinite(maxVal) && (displayMode === 'bar' || displayMode === 'both')) {
      const barContainer = wrapper.createDiv({ cls: 'dte-counter-bar-wrap' });
      barFill = barContainer.createDiv({ cls: 'dte-counter-bar-fill' });
      const baseMin = isFinite(minVal) ? minVal : 0;
      const percent = maxVal > baseMin ? Math.min(100, Math.max(0, ((currentVal - baseMin) / (maxVal - baseMin)) * 100)) : 100;
      barFill.style.width = `${percent}%`;
    }

    const updateValue = (newVal: number) => {
      let clamped = newVal;
      if (hasMin && isFinite(minVal) && clamped < minVal) clamped = minVal;
      if (hasMax && isFinite(maxVal) && clamped > maxVal) clamped = maxVal;

      valInput.value = String(clamped);
      if (barFill && hasMax && isFinite(maxVal)) {
        const baseMin = isFinite(minVal) ? minVal : 0;
        const percent = maxVal > baseMin ? Math.min(100, Math.max(0, ((clamped - baseMin) / (maxVal - baseMin)) * 100)) : 100;
        barFill.style.width = `${percent}%`;
      }

      if (bindKey) {
        this.data[bindKey] = clamped;
        if (this.callbacks.onUpdateKey) {
          this.callbacks.onUpdateKey(bindKey, clamped);
        }
      }
      this.refreshCalculatedWidgets();
    };

    decBtn.addEventListener('click', () => {
      const cur = parseFloat(valInput.value) || 0;
      updateValue(cur - step);
    });

    incBtn.addEventListener('click', () => {
      const cur = parseFloat(valInput.value) || 0;
      updateValue(cur + step);
    });

    valInput.addEventListener('change', () => {
      const cur = parseFloat(valInput.value) || 0;
      updateValue(cur);
    });
  }

  private renderCheck(wrapper: HTMLElement, widget: SheetWidget): void {
    wrapper.addClass('dte-widget-check-box');
    const bindKey = widget.bind;
    const isChecked = bindKey ? Boolean(this.data[bindKey]) : false;

    const labelEl = wrapper.createEl('label', { cls: 'dte-check-label' });
    const checkEl = labelEl.createEl('input', { type: 'checkbox', cls: 'dte-check-input' });
    checkEl.checked = isChecked;

    if (widget.style?.title) {
      labelEl.createSpan({ text: widget.style.title, cls: 'dte-check-title' });
    }

    checkEl.addEventListener('change', () => {
      if (!bindKey) return;
      this.data[bindKey] = checkEl.checked;
      if (this.callbacks.onUpdateKey) {
        this.callbacks.onUpdateKey(bindKey, checkEl.checked);
      }
      this.refreshCalculatedWidgets();
    });
  }

  private renderButton(wrapper: HTMLElement, widget: SheetWidget): void {
    wrapper.addClass('dte-widget-button-box');
    const btn = wrapper.createEl('button', { cls: 'dte-sheet-action-btn' });
    btn.setText(widget.style?.title || 'Tirar');

    const resultSpan = wrapper.createSpan({ cls: 'dte-btn-result-bubble' });
    resultSpan.style.display = 'none';

    btn.addEventListener('click', async () => {
      if (!widget.action?.formula) return;
      btn.disabled = true;
      try {
        const roll = await executeSheetRoll(
          this.app,
          this.plugin,
          widget.action.formula,
          widget.action.reason || widget.style?.title,
          this.data,
          widget.action.render !== false
        );
        resultSpan.setText(`${roll.total}`);
        resultSpan.style.display = 'inline-block';
        window.setTimeout(() => {
          resultSpan.style.display = 'none';
        }, 4000);
      } catch (err) {
        console.error('[CharacterSheet] Roll failed:', err);
      } finally {
        btn.disabled = false;
      }
    });
  }

  private renderImage(wrapper: HTMLElement, widget: SheetWidget): void {
    wrapper.addClass('dte-widget-image-box');
    const bindKey = widget.bind;
    const imgPath = (bindKey && this.data[bindKey]) || widget.imagePath || '';

    const imgContainer = wrapper.createDiv({ cls: 'dte-widget-image-container' });
    if (widget.shape === 'circle') {
      imgContainer.style.borderRadius = '50%';
      imgContainer.style.overflow = 'hidden';
    }

    if (imgPath) {
      const url = this.resolveVaultImageUrl(imgPath);
      if (url) {
        const img = imgContainer.createEl('img', { cls: 'dte-widget-img' });
        img.src = url;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = widget.fit === 'contain' ? 'contain' : 'cover';
      }
    } else {
      const placeholder = imgContainer.createDiv({ cls: 'dte-widget-image-placeholder' });
      setIcon(placeholder, 'image');
    }
  }

  private renderList(wrapper: HTMLElement, widget: SheetWidget): void {
    wrapper.addClass('dte-widget-list-box');
    const bindKey = widget.bind;
    let listData: string[] = bindKey && Array.isArray(this.data[bindKey]) ? [...this.data[bindKey]] : [];

    if (widget.style?.title) {
      wrapper.createDiv({ cls: 'dte-list-title', text: widget.style.title });
    }

    const itemsContainer = wrapper.createDiv({ cls: 'dte-list-items-container' });

    const renderItems = () => {
      itemsContainer.empty();
      listData.forEach((itemText, idx) => {
        const row = itemsContainer.createDiv({ cls: 'dte-list-item-row' });
        const input = row.createEl('input', { type: 'text', cls: 'dte-list-item-input' });
        input.value = itemText;

        input.addEventListener('change', () => {
          listData[idx] = input.value;
          saveList();
        });

        const delBtn = row.createEl('button', { cls: 'dte-list-btn dte-list-del-btn' });
        setIcon(delBtn, 'trash');
        delBtn.addEventListener('click', () => {
          listData.splice(idx, 1);
          renderItems();
          saveList();
        });
      });
    };

    const saveList = () => {
      if (!bindKey) return;
      this.data[bindKey] = listData;
      if (this.callbacks.onUpdateKey) {
        this.callbacks.onUpdateKey(bindKey, listData);
      }
    };

    renderItems();

    const addBtn = wrapper.createEl('button', { cls: 'dte-list-add-btn', text: '+ Añadir' });
    addBtn.addEventListener('click', () => {
      listData.push('');
      renderItems();
      saveList();
    });
  }

  private renderGrid(wrapper: HTMLElement, widget: SheetWidget): void {
    wrapper.addClass('dte-widget-grid-box');
    const bindKey = widget.bind;
    const columns = widget.columns || [{ key: 'name', label: 'Nombre', type: 'text' }];
    let rows: Record<string, any>[] = bindKey && Array.isArray(this.data[bindKey]) ? [...this.data[bindKey]] : [];

    if (widget.style?.title) {
      wrapper.createDiv({ cls: 'dte-grid-title', text: widget.style.title });
    }

    const tableWrap = wrapper.createDiv({ cls: 'dte-grid-table-wrap' });
    const table = tableWrap.createEl('table', { cls: 'dte-grid-table' });
    const thead = table.createEl('thead');
    const headerRow = thead.createEl('tr');
    columns.forEach((col) => {
      headerRow.createEl('th', { text: col.label });
    });
    headerRow.createEl('th', { text: '', cls: 'dte-grid-th-actions' });

    const tbody = table.createEl('tbody');

    const renderRows = () => {
      tbody.empty();
      rows.forEach((rowObj, rIdx) => {
        const tr = tbody.createEl('tr');
        columns.forEach((col) => {
          const td = tr.createEl('td');
          if (col.type === 'check') {
            const chk = td.createEl('input', { type: 'checkbox' });
            chk.checked = Boolean(rowObj[col.key]);
            chk.addEventListener('change', () => {
              rowObj[col.key] = chk.checked;
              saveGrid();
            });
          } else if (col.type === 'number') {
            const num = td.createEl('input', { type: 'number' });
            num.value = String(rowObj[col.key] ?? 0);
            num.addEventListener('change', () => {
              rowObj[col.key] = parseFloat(num.value) || 0;
              saveGrid();
            });
          } else {
            const txt = td.createEl('input', { type: 'text' });
            txt.value = String(rowObj[col.key] ?? '');
            txt.addEventListener('change', () => {
              rowObj[col.key] = txt.value;
              saveGrid();
            });
          }
        });

        const actionTd = tr.createEl('td', { cls: 'dte-grid-td-actions' });
        const delBtn = actionTd.createEl('button', { cls: 'dte-grid-del-btn' });
        setIcon(delBtn, 'trash-2');
        delBtn.addEventListener('click', () => {
          rows.splice(rIdx, 1);
          renderRows();
          saveGrid();
        });
      });
    };

    const saveGrid = () => {
      if (!bindKey) return;
      this.data[bindKey] = rows;
      if (this.callbacks.onUpdateKey) {
        this.callbacks.onUpdateKey(bindKey, rows);
      }
    };

    renderRows();

    const addRowBtn = wrapper.createEl('button', { cls: 'dte-grid-add-btn', text: '+ Fila' });
    addRowBtn.addEventListener('click', () => {
      const newObj: Record<string, any> = {};
      columns.forEach((c) => {
        newObj[c.key] = c.type === 'check' ? false : c.type === 'number' ? 0 : '';
      });
      rows.push(newObj);
      renderRows();
      saveGrid();
    });
  }

  private renderCalculated(wrapper: HTMLElement, widget: SheetWidget): void {
    wrapper.addClass('dte-widget-calculated-box');
    if (widget.style?.title) {
      wrapper.createDiv({ cls: 'dte-calc-title', text: widget.style.title });
    }

    const valDisplay = wrapper.createDiv({ cls: 'dte-calc-value' });
    const formula = widget.formula || '';
    const res = evaluateCalculated(formula, this.data);
    valDisplay.setText(res.error ? '—' : String(res.value));
    if (res.error) valDisplay.title = res.error;
  }

  private refreshCalculatedWidgets(): void {
    for (const widget of this.template.widgets) {
      if (widget.type === 'calculated') {
        const el = this.widgetElements.get(widget.id);
        if (el) {
          const valDisplay = el.querySelector<HTMLElement>('.dte-calc-value');
          if (valDisplay) {
            const res = evaluateCalculated(widget.formula || '', this.data);
            valDisplay.setText(res.error ? '—' : String(res.value));
            if (res.error) valDisplay.title = res.error;
          }
        }
      }
    }
  }

  private refreshWidgetValues(): void {
    for (const widget of this.template.widgets) {
      const el = this.widgetElements.get(widget.id);
      if (!el) continue;

      if (widget.type === 'text' && widget.bind) {
        const inp = el.querySelector<HTMLInputElement | HTMLTextAreaElement>('.dte-widget-input, .dte-widget-textarea');
        if (inp && !inp.matches(':focus')) {
          inp.value = String(this.data[widget.bind] ?? '');
        }
      } else if (widget.type === 'counter' && widget.bind) {
        const inp = el.querySelector<HTMLInputElement>('.dte-counter-input');
        if (inp && !inp.matches(':focus')) {
          const currentVal = Number(this.data[widget.bind] ?? 0);
          inp.value = String(currentVal);
          const minVal = this.resolveBoundNumber(widget.min, 0);
          const maxVal = this.resolveBoundNumber(widget.max, 9999);
          const barFill = el.querySelector<HTMLElement>('.dte-counter-bar-fill');
          if (barFill && maxVal > minVal) {
            const percent = Math.min(100, Math.max(0, ((currentVal - minVal) / (maxVal - minVal)) * 100));
            barFill.style.width = `${percent}%`;
          }
        }
      } else if (widget.type === 'check' && widget.bind) {
        const chk = el.querySelector<HTMLInputElement>('.dte-check-input');
        if (chk) {
          chk.checked = Boolean(this.data[widget.bind]);
        }
      }
    }
    this.refreshCalculatedWidgets();
  }
}
