import { App, MarkdownView, Notice, setIcon, TFile } from 'obsidian';
import { RegisterTableModal } from '../../modals/RegisterTableModal';
import { DinoPlugin, DinoSettings, CampaignData } from '../../types';
import { TableIndexer } from './tableIndexer';
import { RandomTable, TableHistoryEntry, RandomTablesSettings } from './types';
import { rollRandomTable, RollResult } from './tableRoller';
import { t } from '../../i18n';

export class RandomTablesPanel {
  private app: App;
  private plugin: DinoPlugin;
  private container: HTMLElement;
  public el: HTMLElement;
  public minimized = false;

  private indexer: TableIndexer;
  private unsubscribeIndexer: (() => void) | null = null;

  // UI state
  private searchQuery = '';
  private selectedTag = '';
  private lastResult: RollResult | null = null;
  private lastRolledTable: RandomTable | null = null;
  private isHistoryOpen = false;
  private expandedTableIds = new Set<string>();

  constructor(app: App, plugin: DinoPlugin, container: HTMLElement, indexer?: TableIndexer) {
    this.app = app;
    this.plugin = plugin;
    this.container = container;

    const s = this.plugin.settings as DinoSettings;
    this.indexer = indexer || new TableIndexer(this.app, () => s.randomTables || {
      tagPrefix: 'dte-table',
      folders: [],
      noRepeat: {},
    });

    this.el = this.container.createDiv({ cls: 'dte-tables-panel dte-floating-panel' });
    this.setupPosition();

    this.unsubscribeIndexer = this.indexer.onChange(() => {
      this.build();
    });

    this.build();
  }

  private getCurrentCampaign(): CampaignData | null {
    const s = this.plugin.settings as DinoSettings;
    if (!s.currentCampaignId || !s.campaigns) return null;
    return s.campaigns[s.currentCampaignId] || null;
  }

  private getCurrentCampaignId(): string | null {
    const s = this.plugin.settings as DinoSettings;
    return s.currentCampaignId || null;
  }

  private getHistory(): TableHistoryEntry[] {
    const camp = this.getCurrentCampaign();
    if (camp) {
      if (!camp.tableHistory) camp.tableHistory = [];
      return camp.tableHistory;
    }
    const s = this.plugin.settings as DinoSettings;
    if (!s._orphanTableHistory) s._orphanTableHistory = [];
    return s._orphanTableHistory;
  }

  private getSettings(): RandomTablesSettings {
    const s = this.plugin.settings as DinoSettings;
    if (!s.randomTables) {
      s.randomTables = {
        tagPrefix: 'dte-table',
        folders: [],
        noRepeat: {},
      };
    }
    if (!s.randomTables.noRepeat) {
      s.randomTables.noRepeat = {};
    }
    return s.randomTables;
  }

  public open(): void {
    this.el.style.display = 'flex';
    this.minimized = false;
    this.el.removeClass('is-minimized');
    this.build();
  }

  public close(): void {
    this.el.style.display = 'none';
  }

  public destroy(): void {
    if (this.unsubscribeIndexer) {
      this.unsubscribeIndexer();
      this.unsubscribeIndexer = null;
    }
    this.el.remove();
  }

  private setupPosition(): void {
    const s = this.plugin.settings as DinoSettings;
    const pos = s.randomTablesPanelPosition || { x: 140, y: 140 };
    this.el.setCssStyles({
      position: 'absolute',
      left: `${pos.x}px`,
      top: `${pos.y}px`,
    });
  }

  private setupDrag(handleEl: HTMLElement): void {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let origLeft = 0;
    let origTop = 0;

    const onMouseDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('button, select, input, textarea')) {
        return;
      }
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = this.el.getBoundingClientRect();
      const parentRect = this.container.getBoundingClientRect();
      origLeft = rect.left - parentRect.left;
      origTop = rect.top - parentRect.top;

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      e.preventDefault();
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const newX = Math.max(0, origLeft + dx);
      const newY = Math.max(0, origTop + dy);
      this.el.style.left = `${newX}px`;
      this.el.style.top = `${newY}px`;
    };

    const onMouseUp = () => {
      if (!isDragging) return;
      isDragging = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      const s = this.plugin.settings as DinoSettings;
      s.randomTablesPanelPosition = {
        x: parseInt(this.el.style.left || '140', 10),
        y: parseInt(this.el.style.top || '140', 10),
      };
      this.plugin.saveSettings();
    };

    handleEl.addEventListener('mousedown', onMouseDown);
  }

  public build(): void {
    this.el.empty();

    if (this.minimized) {
      this.el.addClass('is-minimized');
      const minBtn = this.el.createEl('button', {
        cls: 'dte-minimized-handle',
      });
      const icon = minBtn.createSpan();
      setIcon(icon, 'dice-6');
      minBtn.createSpan({ text: t('tables.panelTitle') });
      minBtn.addEventListener('click', () => {
        this.minimized = false;
        this.el.removeClass('is-minimized');
        this.build();
      });
      return;
    }

    this.el.removeClass('is-minimized');

    // Header
    const header = this.el.createDiv({ cls: 'dte-panel-header' });
    this.setupDrag(header);

    const title = header.createDiv({ cls: 'dte-panel-title dte-drag-handle' });
    const titleIcon = title.createSpan({ cls: 'dte-panel-icon' });
    setIcon(titleIcon, 'dice-6');
    title.createSpan({ text: t('tables.panelTitle'), cls: 'dte-panel-title-text' });

    const headerControls = header.createDiv({ cls: 'dte-panel-header-controls' });

    // Register note as table button
    const registerBtn = headerControls.createEl('button', {
      cls: 'dte-icon-btn',
      title: t('tables.registerAsTable'),
    });
    setIcon(registerBtn, 'file-plus');
    registerBtn.addEventListener('click', () => {
      const activeFile = this.app.workspace.getActiveFile();
      new RegisterTableModal(this.app, this.plugin, activeFile instanceof TFile ? activeFile : undefined).open();
    });

    // Reindex button
    const refreshBtn = headerControls.createEl('button', {
      cls: 'dte-icon-btn',
      title: 'Reindexar tablas',
    });
    setIcon(refreshBtn, 'refresh-cw');
    refreshBtn.addEventListener('click', async () => {
      refreshBtn.addClass('is-spinning');
      await this.indexer.indexAll();
      refreshBtn.removeClass('is-spinning');
      new Notice('Tablas reindexadas con éxito.', 2000);
    });

    // Minimize button
    const minBtn = headerControls.createEl('button', {
      cls: 'dte-icon-btn',
      title: 'Minimizar',
    });
    setIcon(minBtn, 'chevron-down');
    minBtn.addEventListener('click', () => {
      this.minimized = true;
      this.build();
    });

    // Close button
    const closeBtn = headerControls.createEl('button', {
      cls: 'dte-icon-btn',
      title: 'Cerrar',
    });
    setIcon(closeBtn, 'x');
    closeBtn.addEventListener('click', () => this.close());

    // Search and filters
    this.renderSearchAndFilters();

    // Table lists
    const content = this.el.createDiv({ cls: 'dte-panel-content' });
    this.renderTableLists(content);

    // Last result card
    if (this.lastResult) {
      this.renderLastResult(content);
    }

    // History drawer
    this.renderHistory(content);
  }

  private renderSearchAndFilters(): void {
    const bar = this.el.createDiv({ cls: 'dte-tables-search-bar' });

    // Search Input
    const searchInput = bar.createEl('input', {
      type: 'text',
      cls: 'dte-input dte-tables-search-input',
      placeholder: t('tables.searchPlaceholder'),
      value: this.searchQuery,
    });
    searchInput.addEventListener('input', () => {
      this.searchQuery = searchInput.value.toLowerCase().trim();
      const content = this.el.querySelector('.dte-panel-content') as HTMLElement;
      if (content) {
        content.empty();
        this.renderTableLists(content);
        if (this.lastResult) this.renderLastResult(content);
        this.renderHistory(content);
      }
    });

    // Tag filter
    const allTables = this.indexer.getAllTables();
    const tagsSet = new Set<string>();
    for (const t of allTables) {
      for (const tag of t.groupTags) {
        tagsSet.add(tag);
      }
    }

    if (tagsSet.size > 0) {
      const tagSelect = bar.createEl('select', { cls: 'dte-select dte-tables-tag-select' });
      const optAll = tagSelect.createEl('option', { value: '', text: t('tables.allTags') });
      if (!this.selectedTag) optAll.selected = true;

      for (const tag of Array.from(tagsSet).sort()) {
        const opt = tagSelect.createEl('option', { value: tag, text: `#${tag}` });
        if (this.selectedTag === tag) opt.selected = true;
      }

      tagSelect.addEventListener('change', () => {
        this.selectedTag = tagSelect.value;
        const content = this.el.querySelector('.dte-panel-content') as HTMLElement;
        if (content) {
          content.empty();
          this.renderTableLists(content);
          if (this.lastResult) this.renderLastResult(content);
          this.renderHistory(content);
        }
      });
    }
  }

  private filterTables(tables: RandomTable[]): RandomTable[] {
    return tables.filter((t) => {
      if (this.selectedTag && !t.groupTags.includes(this.selectedTag)) {
        return false;
      }
      if (this.searchQuery) {
        const matchName = t.name.toLowerCase().includes(this.searchQuery);
        const matchPath = t.notePath.toLowerCase().includes(this.searchQuery);
        const matchTags = t.groupTags.some((g) => g.toLowerCase().includes(this.searchQuery));
        if (!matchName && !matchPath && !matchTags) return false;
      }
      return true;
    });
  }

  private renderTableLists(container: HTMLElement): void {
    const campaignId = this.getCurrentCampaignId();
    const { campaignTables, globalTables } = this.indexer.getTablesForCampaign(campaignId);

    const filteredCampaign = this.filterTables(campaignTables);
    const filteredGlobal = this.filterTables(globalTables);

    if (filteredCampaign.length === 0 && filteredGlobal.length === 0) {
      const emptyDiv = container.createDiv({ cls: 'dte-empty-state dte-tables-empty-state' });
      setIcon(emptyDiv.createSpan({ cls: 'dte-empty-icon' }), 'info');
      emptyDiv.createDiv({ text: t('tables.empty'), cls: 'dte-empty-text' });

      // Button to create example tables note with full guide
      if (this.indexer.getAllTables().length === 0) {
        const createBtn = emptyDiv.createEl('button', {
          cls: 'dte-btn dte-btn-primary dte-tables-create-example-btn',
          text: ` ${t('tables.createExampleNote')}`,
        });
        const icon = createBtn.createSpan();
        setIcon(icon, 'sparkles');
        createBtn.prepend(icon);
        createBtn.addEventListener('click', async () => {
          await this.createExampleTablesNote();
        });
      }
      return;
    }

    // Campaign tables section
    if (filteredCampaign.length > 0) {
      this.renderTableSection(container, t('tables.campaignSection'), filteredCampaign, 'flag');
    }

    // Global tables section
    if (filteredGlobal.length > 0) {
      this.renderTableSection(container, t('tables.globalSection'), filteredGlobal, 'globe');
    }
  }

  /** Create an example markdown note with comprehensive tables and guide */
  private async createExampleTablesNote(): Promise<void> {
    const baseName = 'Tablas de Ejemplo - Dino';
    let targetPath = `${baseName}.md`;
    let counter = 1;
    while (this.app.vault.getAbstractFileByPath(targetPath) !== null) {
      targetPath = `${baseName} (${counter}).md`;
      counter++;
    }

    const content = `---
dte-table: true
dte-tags: [ejemplo, botin, encuentros, clima]
dte-name: Guía y Tablas de Ejemplo - Dino Tabletop Engine
---

# Guía y Tablas de Ejemplo (Dino Tabletop Engine)

¡Bienvenido al módulo de **Tablas Aleatorias**! Esta nota sirve como guía de uso y contiene tablas listas para tirar en el tablero.

---

## ¿Cómo funciona el módulo?

1. **Detección automática**: Toda nota con el tag \`#dte-table\` o \`dte-table: true\` en el frontmatter es indexada automáticamente en tiempo real.
2. **Alcance**:
   - \`#dte-table\` → **Global** (disponible en todas las campañas).
   - \`#dte-table/<nombre-campaña>\` → **Específica** de esa campaña.
3. **Múltiples tablas**: Cada encabezado Markdown (\`##\`) dentro de una nota define una tabla independiente.
4. **Modos de tirada según el encabezado de la 1ª columna**:
   - **Fórmula de dados** (ej. \`d6\`, \`1d20\`, \`2d6\`, \`d100\`): Tira esa fórmula y busca la fila cuyo rango numérico coincide.
   - **Peso** o **%**: Selección ponderada (la probabilidad es proporcional a su peso).
   - **Cualquier otro / vacío**: Selección uniforme (todas las filas tienen la misma probabilidad).
5. **Tiradas anidadas**: Si una fila contiene fórmulas como \`2d6 monedas\` o \`1d4 gemas\`, el motor tira los dados automáticamente al seleccionarla.
6. **Tablas encadenadas**: Si una fila enlaza a otra tabla con \`[[Nombre de Tabla]]\`, el motor tira esa tabla en cadena.
7. **Modo sin reposición**: Puedes activar la casilla "Sin reposición" para no repetir resultados hasta agotar la tabla.

---

## Botín de Mazmorra
| d100 | Resultado | Rareza | Valor |
|---|---|---|---|
| 01-35 | 2d6 monedas de cobre y raciones de viaje | Común | 5 pc |
| 36-65 | 1d4 gemas pequeñas y una daga afilada | Poco común | 25 po |
| 66-90 | Poción curativa básica (restaura 2d4+2 PV) | Raro | 50 po |
| 91-100 | Cofre ornamentado con [[Tesoros Legendarios]] | Muy raro | Invaluable |

## Tesoros Legendarios
| d6 | Artefacto mágico |
|---|---|
| 1-2 | Espada Flamígera (+1d6 daño de fuego) |
| 3-4 | Escudo de la Égida Celestial (+2 CA) |
| 5-6 | Anillo de Invisibilidad Temporal |

## Encuentros en el Camino
| Peso | Encuentro | Peligro |
|---|---|---|
| 45 | Caravana de mercaderes ambulantes con escolta | Pacífico |
| 30 | Patrulla de guardias explorando la zona | Bajo |
| 18 | Emboscada de 1d4+2 bandidos del bosque | Medio |
| 7 | Bestia monstruosa acechando entre los árboles | Alto |

## Clima y Entorno
| Clima | Efecto en Juego |
|---|---|
| Soleado y despejado | Visibilidad óptima en todo el mapa |
| Niebla densa y fría | Visibilidad reducida a corta distancia |
| Lluvia torrencial y fango | Terreno difícil en caminos exteriores |
| Tormenta eléctrica violenta | Desventaja en ataques con proyectiles |
`;

    try {
      const file = await this.app.vault.create(targetPath, content);
      if (file instanceof TFile) {
        await this.indexer.reindexFile(file);
        await this.app.workspace.openLinkText(file.path, '', true);
      }
      new Notice(t('tables.exampleNoteCreated'), 4000);
      this.build();
    } catch (err) {
      console.error('[RandomTables] Error creating example note:', err);
      new Notice('Error al crear la nota de ejemplo.', 3000);
    }
  }

  private renderTableSection(
    container: HTMLElement,
    title: string,
    tables: RandomTable[],
    iconName: string
  ): void {
    const section = container.createDiv({ cls: 'dte-tables-section' });
    const secHeader = section.createDiv({ cls: 'dte-tables-section-header' });

    const secTitle = secHeader.createSpan({ cls: 'dte-tables-section-title' });
    const secIcon = secTitle.createSpan({ cls: 'dte-tables-section-icon' });
    setIcon(secIcon, iconName);
    secTitle.createSpan({ text: title });

    secHeader.createSpan({ cls: 'dte-badge', text: String(tables.length) });

    const list = section.createDiv({ cls: 'dte-tables-list' });
    for (const table of tables) {
      this.renderTableItem(list, table);
    }
  }

  private renderTableItem(container: HTMLElement, table: RandomTable): void {
    const item = container.createDiv({ cls: 'dte-table-item' });
    const settings = this.getSettings();
    const usedRows = settings.noRepeat[table.id] || [];
    const isExhausted = table.rows.length > 0 && usedRows.length >= table.rows.length;

    const rowTop = item.createDiv({ cls: 'dte-table-item-top' });

    // Expand arrow
    const isExpanded = this.expandedTableIds.has(table.id);
    const expandBtn = rowTop.createEl('button', { cls: 'dte-icon-btn dte-table-expand-btn' });
    setIcon(expandBtn, isExpanded ? 'chevron-down' : 'chevron-right');
    expandBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (isExpanded) {
        this.expandedTableIds.delete(table.id);
      } else {
        this.expandedTableIds.add(table.id);
      }
      this.build();
    });

    // Info group
    const info = rowTop.createDiv({ cls: 'dte-table-item-info' });
    const nameLine = info.createDiv({ cls: 'dte-table-item-name-line' });

    const nameSpan = nameLine.createSpan({ cls: 'dte-table-item-name', text: table.name });
    nameSpan.title = table.notePath;

    // Warning indicator
    if (table.warnings.length > 0) {
      const warnIcon = nameLine.createSpan({ cls: 'dte-table-item-warning', title: table.warnings.join('\n') });
      setIcon(warnIcon, 'alert-triangle');
    }

    // Formula or mode badge
    const formulaBadge = nameLine.createSpan({ cls: 'dte-badge dte-badge-formula' });
    if (table.rollFormula) {
      formulaBadge.setText(table.rollFormula);
    } else if (table.mode === 'weighted') {
      formulaBadge.setText('Peso');
    } else {
      formulaBadge.setText(`${table.rows.length} filas`);
    }

    // No repeat status
    if (usedRows.length > 0) {
      const remaining = Math.max(0, table.rows.length - usedRows.length);
      const noRepBadge = nameLine.createSpan({
        cls: `dte-badge ${isExhausted ? 'dte-badge-danger' : 'dte-badge-subtle'}`,
        text: isExhausted ? t('tables.exhausted') : `${remaining}/${table.rows.length}`,
      });
      noRepBadge.title = `Usadas: ${usedRows.length}`;
    }

    // Controls
    const controls = rowTop.createDiv({ cls: 'dte-table-item-controls' });

    // Reset no-repeat button if rows were used
    if (usedRows.length > 0) {
      const resetBtn = controls.createEl('button', {
        cls: 'dte-icon-btn',
        title: t('tables.resetNoRepeat'),
      });
      setIcon(resetBtn, 'undo-2');
      resetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        delete settings.noRepeat[table.id];
        this.plugin.saveSettings();
        new Notice(`Tabla "${table.name}" reiniciada.`, 2000);
        this.build();
      });
    }

    // Roll button
    const rollBtn = controls.createEl('button', {
      cls: 'dte-btn dte-btn-primary dte-table-roll-btn',
      title: t('tables.roll'),
    });
    const rollIcon = rollBtn.createSpan();
    setIcon(rollIcon, 'dice-6');
    rollBtn.createSpan({ text: t('tables.roll') });
    rollBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await this.handleRollTable(table);
    });

    // Expanded details
    if (isExpanded) {
      const details = item.createDiv({ cls: 'dte-table-item-details' });

      // Warnings box if any
      if (table.warnings.length > 0) {
        const warnBox = details.createDiv({ cls: 'dte-table-warnings-box' });
        for (const w of table.warnings) {
          const wRow = warnBox.createDiv({ cls: 'dte-table-warning-row' });
          const icon = wRow.createSpan();
          setIcon(icon, 'alert-triangle');
          wRow.createSpan({ text: w });
        }
      }

      // No-repeat toggle
      const optionsRow = details.createDiv({ cls: 'dte-table-options-row' });
      const noRepLabel = optionsRow.createEl('label', { cls: 'dte-checkbox-label' });
      const noRepCheckbox = noRepLabel.createEl('input', {
        type: 'checkbox',
      });
      noRepCheckbox.checked = usedRows.length > 0;
      noRepLabel.createSpan({ text: t('tables.noRepeat') });

      noRepCheckbox.addEventListener('change', () => {
        if (!noRepCheckbox.checked) {
          delete settings.noRepeat[table.id];
        } else if (!settings.noRepeat[table.id]) {
          settings.noRepeat[table.id] = [];
        }
        this.plugin.saveSettings();
        this.build();
      });

      // Rows preview table
      const previewWrapper = details.createDiv({ cls: 'dte-table-preview-wrapper' });
      const tblEl = previewWrapper.createEl('table', { cls: 'dte-table-preview' });
      const thead = tblEl.createEl('thead');
      const trHead = thead.createEl('tr');
      for (const col of table.columns) {
        trHead.createEl('th', { text: col });
      }

      const tbody = tblEl.createEl('tbody');
      const usedSet = new Set(usedRows);

      for (let i = 0; i < table.rows.length; i++) {
        const r = table.rows[i];
        const tr = tbody.createEl('tr');
        if (usedSet.has(r.rawRowIndex)) {
          tr.addClass('is-used-row');
        }

        // Col 0: range or weight
        let col0Text = '';
        if (r.min !== null && r.max !== null) {
          col0Text = r.min === r.max ? `${r.min}` : `${r.min}-${r.max}`;
        } else if (table.mode === 'weighted') {
          col0Text = String(r.weight);
        } else {
          col0Text = String(i + 1);
        }
        tr.createEl('td', { text: col0Text, cls: 'dte-table-cell-range' });

        // Col 1: text
        tr.createEl('td', { text: r.text, cls: 'dte-table-cell-text' });

        // Extra columns
        for (let c = 2; c < table.columns.length; c++) {
          const colName = table.columns[c];
          tr.createEl('td', { text: (r.extra && r.extra[colName]) || '' });
        }
      }
    }
  }

  private async handleRollTable(table: RandomTable): Promise<void> {
    const settings = this.getSettings();
    const usedRows = settings.noRepeat[table.id] || [];
    const isNoRepeatActive = usedRows.length > 0 || settings.noRepeat[table.id] !== undefined;

    const res = await rollRandomTable(table, {
      campaignId: this.getCurrentCampaignId(),
      noRepeat: isNoRepeatActive,
      usedRowIndexes: usedRows,
      resolveNestedRolls: true,
      resolveChainedTables: true,
      indexer: this.indexer,
    });

    if (res.row && isNoRepeatActive) {
      if (!settings.noRepeat[table.id]) {
        settings.noRepeat[table.id] = [];
      }
      if (!settings.noRepeat[table.id].includes(res.row.rawRowIndex)) {
        settings.noRepeat[table.id].push(res.row.rawRowIndex);
      }
      this.plugin.saveSettings();
    }

    // Save to history
    const history = this.getHistory();
    history.unshift(res.entry);
    if (history.length > 100) history.pop();
    this.plugin.saveSettings();

    this.lastResult = res;
    this.lastRolledTable = table;

    this.build();
  }

  private renderLastResult(container: HTMLElement): void {
    if (!this.lastResult) return;

    const card = container.createDiv({ cls: 'dte-tables-result-card' });
    const top = card.createDiv({ cls: 'dte-tables-result-top' });

    const titleArea = top.createSpan({ cls: 'dte-tables-result-title' });
    const diceIcon = titleArea.createSpan();
    setIcon(diceIcon, 'sparkles');
    titleArea.createSpan({ text: `${t('tables.lastResult')}: ` });
    titleArea.createEl('strong', { text: this.lastResult.entry.tableName });

    if (this.lastResult.rawRoll !== null) {
      top.createSpan({
        cls: 'dte-badge dte-badge-primary',
        text: `🎲 ${this.lastResult.rawRoll}`,
      });
    }

    const body = card.createDiv({ cls: 'dte-tables-result-body' });
    body.createDiv({ cls: 'dte-tables-result-text', text: this.lastResult.resolvedText });

    // Extra columns display
    if (this.lastResult.row?.extra) {
      const extraWrap = body.createDiv({ cls: 'dte-tables-result-extra' });
      for (const [k, v] of Object.entries(this.lastResult.row.extra)) {
        const item = extraWrap.createSpan({ cls: 'dte-badge dte-badge-subtle' });
        item.setText(`${k}: ${v}`);
      }
    }

    // Actions
    const actions = card.createDiv({ cls: 'dte-tables-result-actions' });

    // Roll again
    if (this.lastRolledTable) {
      const rerollBtn = actions.createEl('button', {
        cls: 'dte-btn dte-btn-sm',
        text: t('tables.rollAgain'),
      });
      const icon = rerollBtn.createSpan();
      setIcon(icon, 'refresh-cw');
      rerollBtn.prepend(icon);
      rerollBtn.addEventListener('click', () => {
        if (this.lastRolledTable) {
          this.handleRollTable(this.lastRolledTable);
        }
      });
    }

    // Copy button
    const copyBtn = actions.createEl('button', {
      cls: 'dte-btn dte-btn-sm',
      text: t('tables.copy'),
    });
    const copyIcon = copyBtn.createSpan();
    setIcon(copyIcon, 'copy');
    copyBtn.prepend(copyIcon);
    copyBtn.addEventListener('click', () => {
      const textToCopy = `**${this.lastResult?.entry.tableName}** [${this.lastResult?.rawRoll ?? '-'}] ➔ ${this.lastResult?.resolvedText}`;
      navigator.clipboard.writeText(textToCopy);
      new Notice(t('tables.copied'), 2000);
    });

    // Open note
    if (this.lastRolledTable) {
      const openBtn = actions.createEl('button', {
        cls: 'dte-btn dte-btn-sm',
        text: t('tables.openNote'),
      });
      const openIcon = openBtn.createSpan();
      setIcon(openIcon, 'external-link');
      openBtn.prepend(openIcon);
      openBtn.addEventListener('click', () => {
        if (this.lastRolledTable) {
          this.app.workspace.openLinkText(this.lastRolledTable.notePath, '', true);
        }
      });
    }

    // Insert into active note
    const insertBtn = actions.createEl('button', {
      cls: 'dte-btn dte-btn-sm',
      text: t('tables.insertInNote'),
    });
    const insertIcon = insertBtn.createSpan();
    setIcon(insertIcon, 'file-text');
    insertBtn.prepend(insertIcon);
    insertBtn.addEventListener('click', () => {
      const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (activeView && activeView.editor) {
        const textToInsert = `> [!tip] ${this.lastResult?.entry.tableName} (${this.lastResult?.rawRoll ?? '-'})\n> ${this.lastResult?.resolvedText}\n\n`;
        activeView.editor.replaceSelection(textToInsert);
        new Notice(t('tables.insertedInNote'), 2000);
      } else {
        new Notice(t('tables.noActiveEditor'), 2000);
      }
    });
  }

  private renderHistory(container: HTMLElement): void {
    const history = this.getHistory();
    const historySection = container.createDiv({ cls: 'dte-tables-history-section' });

    const header = historySection.createDiv({ cls: 'dte-tables-history-header' });
    const titleSpan = header.createSpan({ cls: 'dte-tables-history-title' });
    const arrow = titleSpan.createSpan();
    setIcon(arrow, this.isHistoryOpen ? 'chevron-down' : 'chevron-right');
    titleSpan.createSpan({ text: ` ${t('tables.history')} (${history.length})` });

    titleSpan.addEventListener('click', () => {
      this.isHistoryOpen = !this.isHistoryOpen;
      this.build();
    });

    if (this.isHistoryOpen && history.length > 0) {
      const clearBtn = header.createEl('button', {
        cls: 'dte-icon-btn dte-btn-danger',
        title: t('tables.clearHistory'),
      });
      setIcon(clearBtn, 'trash-2');
      clearBtn.addEventListener('click', () => {
        if (confirm(t('tables.clearHistoryConfirm'))) {
          const camp = this.getCurrentCampaign();
          if (camp) {
            camp.tableHistory = [];
          } else {
            (this.plugin.settings as DinoSettings)._orphanTableHistory = [];
          }
          this.plugin.saveSettings();
          this.build();
        }
      });

      const list = historySection.createDiv({ cls: 'dte-tables-history-list' });
      for (const entry of history) {
        const row = list.createDiv({ cls: 'dte-tables-history-item' });

        const topRow = row.createDiv({ cls: 'dte-tables-history-item-top' });
        const timeStr = new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        topRow.createSpan({ cls: 'dte-tables-history-time', text: timeStr });
        topRow.createEl('strong', { text: entry.tableName });

        if (entry.roll !== null) {
          topRow.createSpan({ cls: 'dte-badge dte-badge-subtle', text: `🎲 ${entry.roll}` });
        }

        const delBtn = topRow.createEl('button', { cls: 'dte-icon-btn dte-history-del-btn' });
        setIcon(delBtn, 'x');
        delBtn.addEventListener('click', () => {
          const idx = history.findIndex((h) => h.id === entry.id);
          if (idx !== -1) {
            history.splice(idx, 1);
            this.plugin.saveSettings();
            this.build();
          }
        });

        row.createDiv({ cls: 'dte-tables-history-text', text: entry.text });

        // Note field
        const noteInput = row.createEl('input', {
          type: 'text',
          cls: 'dte-input dte-tables-history-note',
          placeholder: 'Nota o comentario...',
          value: entry.note || '',
        });
        noteInput.addEventListener('change', () => {
          entry.note = noteInput.value.trim();
          this.plugin.saveSettings();
        });
      }
    }
  }
}
