import { App, Modal, Notice, setIcon, MarkdownRenderer, Component } from 'obsidian';
import { DinoPlugin, DinoSettings } from '../types';
import { StorePackage, StorePackageType, StoreSource } from '../modules/store/types';
import {
  ensureStoreSettings,
  fetchAllCatalogs,
  fetchPackageReadme,
  installPackage,
  uninstallPackage,
} from '../modules/store/storeClient';
import { t } from '../i18n';

type StoreTab = 'explore' | 'installed' | 'sources';

export class StoreModal extends Modal {
  private plugin: DinoPlugin;
  private currentTab: StoreTab = 'explore';
  private packages: StorePackage[] = [];
  private isLoading = false;
  private fetchErrors: string[] = [];
  private searchQuery = '';
  private selectedType: StorePackageType | 'all' = 'all';
  private selectedPackage: StorePackage | null = null;
  private packageReadme: string | null = null;
  private isInstalling = false;
  private installProgressMsg = '';

  constructor(app: App, plugin: DinoPlugin) {
    super(app);
    this.plugin = plugin;
  }

  async onOpen(): Promise<void> {
    ensureStoreSettings(this.plugin);
    this.modalEl.addClass('dte-store-modal');
    this.modalEl.style.width = '880px';
    this.modalEl.style.maxWidth = '95vw';
    this.modalEl.style.height = '85vh';
    this.modalEl.style.maxHeight = '900px';

    await this.loadCatalog();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private async loadCatalog(): Promise<void> {
    this.isLoading = true;
    this.render();

    try {
      const { packages, errors } = await fetchAllCatalogs(this.plugin);
      this.packages = packages;
      this.fetchErrors = errors;
    } catch (e) {
      console.error('[DTE Store] Error loading catalog:', e);
      this.fetchErrors = [String(e)];
    } finally {
      this.isLoading = false;
      this.render();
    }
  }

  private render(): void {
    this.contentEl.empty();

    // ── Header ──
    const header = this.contentEl.createDiv({ cls: 'dte-store-header' });
    const titleWrap = header.createDiv({ cls: 'dte-store-header-title' });
    const iconSpan = titleWrap.createSpan({ cls: 'dte-store-title-icon' });
    setIcon(iconSpan, 'package');
    titleWrap.createEl('h2', { text: 'Tienda de Paquetes Dino' });

    // Pestañas
    const tabsRow = header.createDiv({ cls: 'dte-store-tabs' });

    const tabExplore = tabsRow.createEl('button', {
      cls: `dte-store-tab-btn ${this.currentTab === 'explore' ? 'is-active' : ''}`,
      text: 'Explorar',
    });
    tabExplore.addEventListener('click', () => {
      this.currentTab = 'explore';
      this.selectedPackage = null;
      this.render();
    });

    const storeSettings = ensureStoreSettings(this.plugin);
    const installedCount = Object.keys(storeSettings.installed).length;
    const tabInstalled = tabsRow.createEl('button', {
      cls: `dte-store-tab-btn ${this.currentTab === 'installed' ? 'is-active' : ''}`,
      text: `Instalados (${installedCount})`,
    });
    tabInstalled.addEventListener('click', () => {
      this.currentTab = 'installed';
      this.selectedPackage = null;
      this.render();
    });

    const tabSources = tabsRow.createEl('button', {
      cls: `dte-store-tab-btn ${this.currentTab === 'sources' ? 'is-active' : ''}`,
      text: 'Fuentes',
    });
    tabSources.addEventListener('click', () => {
      this.currentTab = 'sources';
      this.selectedPackage = null;
      this.render();
    });

    // Botón para enviar paquetes a la comunidad
    const submitBtn = tabsRow.createEl('button', {
      cls: 'dte-store-tab-btn dte-store-submit-btn',
      text: '📤 Publicar paquete',
      title: 'Envía tu campaña o plantilla para ser incluida en la tienda comunitaria',
    });
    submitBtn.style.marginLeft = 'auto';
    submitBtn.addEventListener('click', () => {
      const submitUrl = storeSettings.submitFormUrl || 'https://forms.gle/QafjhDjpHxTYrahw8';
      window.open(submitUrl, '_blank');
    });

    // ── Body ──
    const body = this.contentEl.createDiv({ cls: 'dte-store-body' });

    if (this.selectedPackage) {
      this.renderPackageDetail(body, this.selectedPackage);
      return;
    }

    if (this.currentTab === 'explore') {
      this.renderExplore(body);
    } else if (this.currentTab === 'installed') {
      this.renderInstalled(body);
    } else {
      this.renderSources(body);
    }
  }

  // ══════════════════════════════════════════════════════════
  // TAB: EXPLORAR
  // ══════════════════════════════════════════════════════════
  private renderExplore(container: HTMLElement): void {
    // Toolbar: búsqueda + filtros de tipo + botón refrescar
    const toolbar = container.createDiv({ cls: 'dte-store-toolbar' });

    // Barra de búsqueda
    const searchWrap = toolbar.createDiv({ cls: 'dte-store-search-wrap' });
    const searchInput = searchWrap.createEl('input', {
      type: 'text',
      cls: 'dte-store-search-input',
      placeholder: 'Buscar aventuras, hojas, tablas, oráculos...',
      value: this.searchQuery,
    });
    searchInput.addEventListener('input', () => {
      this.searchQuery = searchInput.value;
      this.renderExploreGrid(gridContainer);
    });

    // Filtros de tipo
    const filterPills = toolbar.createDiv({ cls: 'dte-store-filters' });
    const types: { id: StorePackageType | 'all'; label: string }[] = [
      { id: 'all', label: 'Todos' },
      { id: 'campaign', label: '⚔️ Campañas' },
      { id: 'sheet', label: '📜 Hojas' },
      { id: 'tables', label: '🎲 Tablas' },
      { id: 'oracle', label: '✨ Oráculo' },
      { id: 'wargame', label: '🛡️ Wargame' },
      { id: 'bundle', label: '📦 Todo en uno' },
    ];

    types.forEach((tOption) => {
      const pill = filterPills.createEl('button', {
        cls: `dte-filter-pill ${this.selectedType === tOption.id ? 'is-active' : ''}`,
        text: tOption.label,
      });
      pill.addEventListener('click', () => {
        this.selectedType = tOption.id;
        this.render();
      });
    });

    // Botón refrescar
    const refreshBtn = toolbar.createEl('button', {
      cls: 'dte-store-refresh-btn',
      title: 'Actualizar catálogo',
    });
    setIcon(refreshBtn, 'refresh-cw');
    refreshBtn.addEventListener('click', async () => {
      refreshBtn.addClass('is-spinning');
      await this.loadCatalog();
    });

    if (this.fetchErrors.length > 0) {
      const errBox = container.createDiv({ cls: 'dte-store-banner-warning' });
      const errIcon = errBox.createSpan();
      setIcon(errIcon, 'alert-triangle');
      errBox.createSpan({ text: `Avisos de catálogo: ${this.fetchErrors.join(' | ')}` });
    }

    if (this.isLoading) {
      const loadingBox = container.createDiv({ cls: 'dte-store-empty-state' });
      loadingBox.createEl('p', { text: 'Cargando catálogo comunitario desde GitHub...' });
      return;
    }

    const gridContainer = container.createDiv({ cls: 'dte-store-grid-container' });
    this.renderExploreGrid(gridContainer);
  }

  private renderExploreGrid(container: HTMLElement): void {
    container.empty();

    const filtered = this.packages.filter((pkg) => {
      if (this.selectedType !== 'all' && pkg.type !== this.selectedType) {
        return false;
      }
      if (this.searchQuery.trim()) {
        const q = this.searchQuery.toLowerCase();
        const matchTitle = pkg.name.toLowerCase().includes(q);
        const matchDesc = pkg.description.toLowerCase().includes(q);
        const matchAuthor = pkg.author.toLowerCase().includes(q);
        const matchTags = pkg.tags.some((t) => t.toLowerCase().includes(q));
        if (!matchTitle && !matchDesc && !matchAuthor && !matchTags) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      const empty = container.createDiv({ cls: 'dte-store-empty-state' });
      empty.createEl('p', { text: 'No se encontraron paquetes con esos filtros.' });
      return;
    }

    const grid = container.createDiv({ cls: 'dte-store-cards-grid' });
    const storeSettings = ensureStoreSettings(this.plugin);

    filtered.forEach((pkg) => {
      const card = grid.createDiv({ cls: 'dte-store-card' });
      const installedReceipt = storeSettings.installed[pkg.id];
      const isInstalled = !!installedReceipt;

      // Header de la tarjeta: Badge de tipo + Título + Versión
      const cardHeader = card.createDiv({ cls: 'dte-store-card-header' });
      const typeBadge = cardHeader.createSpan({
        cls: `dte-store-type-badge dte-store-type--${pkg.type}`,
        text: this.getTypeLabel(pkg.type),
      });

      if (isInstalled) {
        cardHeader.createSpan({ cls: 'dte-store-installed-pill', text: '✓ Instalado' });
      }

      // Título
      const title = card.createEl('h3', { cls: 'dte-store-card-title', text: pkg.name });

      // Metadata rápida: Autor + Tamaño + Licencia
      const meta = card.createDiv({ cls: 'dte-store-card-meta' });
      meta.createSpan({ text: `por ${pkg.author}` });
      if (pkg.size) {
        meta.createSpan({ text: `• ${this.formatBytes(pkg.size)}` });
      }
      meta.createSpan({ text: `• v${pkg.version}` });

      // Descripción
      card.createEl('p', { cls: 'dte-store-card-desc', text: pkg.description });

      // Etiquetas
      if (pkg.tags && pkg.tags.length > 0) {
        const tagsWrap = card.createDiv({ cls: 'dte-store-card-tags' });
        pkg.tags.forEach((tag) => {
          tagsWrap.createSpan({ cls: 'dte-store-tag', text: `#${tag}` });
        });
      }

      // Comprobar módulos requeridos
      const missingModules = this.getMissingModules(pkg.requiresModules);
      if (missingModules.length > 0) {
        const warn = card.createDiv({ cls: 'dte-store-card-warning' });
        const wIcon = warn.createSpan();
        setIcon(wIcon, 'info');
        warn.createSpan({ text: `Requiere módulos: ${missingModules.join(', ')}` });
      }

      // Footer con botón de acción y detalles
      const footer = card.createDiv({ cls: 'dte-store-card-footer' });
      const detailsBtn = footer.createEl('button', {
        cls: 'dte-store-btn-link',
        text: 'Ver detalles y README →',
      });
      detailsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openPackageDetail(pkg);
      });

      const installBtn = footer.createEl('button', {
        cls: `dte-btn ${isInstalled ? 'dte-btn-installed' : 'mod-cta'}`,
        text: isInstalled ? 'Reinstalar' : 'Instalar .dinovtt',
      });
      installBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this.handleInstall(pkg);
      });

      // Al hacer clic en la tarjeta también abre el detalle
      card.addEventListener('click', () => {
        this.openPackageDetail(pkg);
      });
    });
  }

  // ══════════════════════════════════════════════════════════
  // TAB: INSTALADOS
  // ══════════════════════════════════════════════════════════
  private renderInstalled(container: HTMLElement): void {
    const storeSettings = ensureStoreSettings(this.plugin);
    const installedList = Object.values(storeSettings.installed);

    if (installedList.length === 0) {
      const empty = container.createDiv({ cls: 'dte-store-empty-state' });
      empty.createEl('p', { text: 'Aún no tenés ningún paquete instalado.' });
      const goExplore = empty.createEl('button', { cls: 'mod-cta dte-btn', text: 'Explorar la tienda' });
      goExplore.addEventListener('click', () => {
        this.currentTab = 'explore';
        this.render();
      });
      return;
    }

    const listContainer = container.createDiv({ cls: 'dte-store-installed-list' });

    installedList.forEach((receipt) => {
      const row = listContainer.createDiv({ cls: 'dte-store-installed-row' });

      const info = row.createDiv({ cls: 'dte-store-installed-info' });
      const titleWrap = info.createDiv({ cls: 'dte-store-installed-title-wrap' });
      titleWrap.createEl('h4', { text: receipt.name });
      titleWrap.createSpan({
        cls: `dte-store-type-badge dte-store-type--${receipt.type}`,
        text: this.getTypeLabel(receipt.type),
      });
      titleWrap.createSpan({ cls: 'dte-store-installed-ver', text: `v${receipt.version}` });

      const sub = info.createDiv({ cls: 'dte-store-installed-sub' });
      const dateStr = new Date(receipt.installedAt).toLocaleDateString();
      sub.createSpan({ text: `Instalado el ${dateStr}` });
      if (receipt.installedPath) {
        sub.createSpan({ text: ` • ${receipt.installedPath}` });
      }

      const actions = row.createDiv({ cls: 'dte-store-installed-actions' });

      // Desinstalar
      const uninstallBtn = actions.createEl('button', {
        cls: 'dte-btn dte-btn-danger',
        text: 'Desinstalar',
      });
      uninstallBtn.addEventListener('click', async () => {
        if (!confirm(`¿Estás seguro de que querés desinstalar "${receipt.name}"?`)) return;
        await uninstallPackage(this.plugin, receipt.packageId);
        this.render();
      });
    });
  }

  // ══════════════════════════════════════════════════════════
  // TAB: FUENTES DE CATÁLOGO
  // ══════════════════════════════════════════════════════════
  private renderSources(container: HTMLElement): void {
    const storeSettings = ensureStoreSettings(this.plugin);

    container.createEl('h3', { text: 'Fuentes de catálogo configuradas' });
    container.createEl('p', {
      cls: 'dte-store-sources-desc',
      text: 'Podés agregar URLs a archivos catalog.json alojados en GitHub, GitLab o tu propio servidor estático.',
    });

    const sourcesList = container.createDiv({ cls: 'dte-store-sources-list' });

    storeSettings.sources.forEach((src, idx) => {
      const row = sourcesList.createDiv({ cls: 'dte-store-source-row' });
      const toggle = row.createEl('input', { type: 'checkbox' });
      toggle.checked = src.enabled;
      toggle.addEventListener('change', async () => {
        src.enabled = toggle.checked;
        await this.plugin.saveSettings();
        await this.loadCatalog();
      });

      const details = row.createDiv({ cls: 'dte-store-source-details' });
      details.createEl('strong', { text: src.name });
      details.createEl('code', { text: src.url });

      if (src.id !== 'official') {
        const deleteBtn = row.createEl('button', { cls: 'dte-icon-btn', title: 'Eliminar fuente' });
        setIcon(deleteBtn, 'trash-2');
        deleteBtn.addEventListener('click', async () => {
          storeSettings.sources.splice(idx, 1);
          await this.plugin.saveSettings();
          await this.loadCatalog();
        });
      }
    });

    // Formulario para agregar fuente
    const addBox = container.createDiv({ cls: 'dte-store-add-source-box' });
    addBox.createEl('h4', { text: 'Agregar nueva fuente' });

    const inputName = addBox.createEl('input', {
      type: 'text',
      placeholder: 'Nombre (ej. Campañas de mi Comunidad)',
      cls: 'dte-input',
    });
    const inputUrl = addBox.createEl('input', {
      type: 'text',
      placeholder: 'URL directa a catalog.json',
      cls: 'dte-input',
    });

    const addBtn = addBox.createEl('button', {
      cls: 'mod-cta dte-btn',
      text: 'Agregar fuente',
    });

    addBtn.addEventListener('click', async () => {
      const name = inputName.value.trim();
      const url = inputUrl.value.trim();
      if (!name || !url) {
        new Notice('Completá nombre y URL de la fuente.');
        return;
      }
      storeSettings.sources.push({
        id: `custom-${Date.now()}`,
        name,
        url,
        enabled: true,
      });
      await this.plugin.saveSettings();
      inputName.value = '';
      inputUrl.value = '';
      new Notice('Fuente agregada.');
      await this.loadCatalog();
    });
  }

  // ══════════════════════════════════════════════════════════
  // VISTA DE DETALLE / INSPECTOR DE PAQUETE
  // ══════════════════════════════════════════════════════════
  private async openPackageDetail(pkg: StorePackage): Promise<void> {
    this.selectedPackage = pkg;
    this.packageReadme = null;
    this.render();

    // Cargar README de fondo si existe
    if (pkg.readmeUrl) {
      this.packageReadme = await fetchPackageReadme(pkg);
      if (this.selectedPackage === pkg) {
        this.render();
      }
    }
  }

  private renderPackageDetail(container: HTMLElement, pkg: StorePackage): void {
    const storeSettings = ensureStoreSettings(this.plugin);
    const isInstalled = !!storeSettings.installed[pkg.id];

    // Botón volver
    const backBar = container.createDiv({ cls: 'dte-store-detail-backbar' });
    const backBtn = backBar.createEl('button', { cls: 'dte-btn dte-btn-secondary', text: '← Volver a la lista' });
    backBtn.addEventListener('click', () => {
      this.selectedPackage = null;
      this.render();
    });

    const detailContainer = container.createDiv({ cls: 'dte-store-detail-container' });

    // Columna izquierda: Metadata + Acciones
    const leftCol = detailContainer.createDiv({ cls: 'dte-store-detail-sidebar' });

    if (pkg.previewUrl) {
      const previewImg = leftCol.createEl('img', {
        cls: 'dte-store-detail-preview',
        attr: { src: pkg.previewUrl, alt: pkg.name },
      });
    }

    leftCol.createEl('h2', { text: pkg.name });
    leftCol.createEl('p', { cls: 'dte-store-detail-desc', text: pkg.description });

    const metaList = leftCol.createDiv({ cls: 'dte-store-detail-meta-list' });
    this.addMetaRow(metaList, 'Tipo', this.getTypeLabel(pkg.type));
    this.addMetaRow(metaList, 'Versión', pkg.version);
    this.addMetaRow(metaList, 'Autor', pkg.author);
    this.addMetaRow(metaList, 'Licencia', pkg.license);
    this.addMetaRow(metaList, 'Idioma', pkg.language.toUpperCase());
    if (pkg.size) {
      this.addMetaRow(metaList, 'Tamaño', this.formatBytes(pkg.size));
    }
    if (pkg.sha256) {
      this.addMetaRow(metaList, 'SHA-256', `${pkg.sha256.slice(0, 10)}...`);
    }

    // Módulos requeridos
    const missing = this.getMissingModules(pkg.requiresModules);
    if (pkg.requiresModules && pkg.requiresModules.length > 0) {
      const reqBox = leftCol.createDiv({ cls: 'dte-store-detail-requires' });
      reqBox.createEl('h4', { text: 'Módulos requeridos:' });
      pkg.requiresModules.forEach((modId) => {
        const isMissing = missing.includes(modId);
        const item = reqBox.createDiv({
          cls: `dte-store-req-pill ${isMissing ? 'is-missing' : 'is-ok'}`,
          text: `${isMissing ? '⚠️' : '✓'} ${modId}`,
        });
      });

      if (missing.length > 0) {
        const autoEnableBtn = reqBox.createEl('button', {
          cls: 'dte-btn dte-btn-secondary dte-btn-sm',
          text: 'Activar módulos faltantes',
        });
        autoEnableBtn.addEventListener('click', async () => {
          const s = this.plugin.settings as DinoSettings;
          if (!s.enabledModules) s.enabledModules = {};
          missing.forEach((m) => {
            s.enabledModules[m] = true;
          });
          await this.plugin.saveSettings();
          new Notice('Módulos activados con éxito.');
          this.render();
        });
      }
    }

    // Plugins comunitarios de Obsidian requeridos / compatibles
    if (pkg.requiresPlugins && pkg.requiresPlugins.length > 0) {
      const missingPlugins = this.getMissingPlugins(pkg.requiresPlugins);
      const plugBox = leftCol.createDiv({ cls: 'dte-store-detail-requires' });
      plugBox.createEl('h4', { text: 'Plugins de Obsidian compatibles / requeridos:' });
      pkg.requiresPlugins.forEach((plugId) => {
        const isMissing = missingPlugins.includes(plugId);
        plugBox.createDiv({
          cls: `dte-store-req-pill ${isMissing ? 'is-missing' : 'is-ok'}`,
          text: `${isMissing ? '⚠️' : '✓'} ${plugId}`,
        });
      });
    }

    // Acciones principales
    const actionsBox = leftCol.createDiv({ cls: 'dte-store-detail-actions' });

    if (this.isInstalling) {
      const progressBox = actionsBox.createDiv({ cls: 'dte-store-progress-box' });
      progressBox.createEl('p', { text: this.installProgressMsg || 'Instalando...' });
    } else {
      const installBtn = actionsBox.createEl('button', {
        cls: `mod-cta dte-btn dte-btn-full`,
        text: isInstalled ? 'Reinstalar paquete (.dinovtt)' : 'Instalar paquete (.dinovtt)',
      });
      installBtn.addEventListener('click', async () => {
        await this.handleInstall(pkg);
      });

      if (isInstalled) {
        const uninstallBtn = actionsBox.createEl('button', {
          cls: 'dte-btn dte-btn-danger dte-btn-full',
          text: 'Desinstalar de este Vault',
        });
        uninstallBtn.addEventListener('click', async () => {
          if (!confirm(`¿Desinstalar "${pkg.name}"?`)) return;
          await uninstallPackage(this.plugin, pkg.id);
          this.render();
        });
      }

      if (pkg.purchaseUrl) {
        const buyBtn = actionsBox.createEl('a', {
          cls: 'dte-btn dte-btn-secondary dte-btn-full',
          text: '🛒 Ver en la tienda del autor',
          href: pkg.purchaseUrl,
        });
        buyBtn.setAttr('target', '_blank');
      }
    }

    // Columna derecha: README renderizado con Markdown
    const rightCol = detailContainer.createDiv({ cls: 'dte-store-detail-readme-col' });
    rightCol.createEl('h3', { text: 'Información y Guía del Paquete' });

    const markdownArea = rightCol.createDiv({ cls: 'dte-store-markdown-content' });
    if (this.packageReadme) {
      MarkdownRenderer.render(this.app, this.packageReadme, markdownArea, '', new Component());
    } else if (pkg.readmeUrl) {
      markdownArea.createEl('p', { cls: 'dte-text-muted', text: 'Cargando README...' });
    } else {
      markdownArea.createEl('p', { cls: 'dte-text-muted', text: 'Este paquete no incluye un README adicional.' });
    }
  }

  private addMetaRow(container: HTMLElement, label: string, value: string): void {
    const row = container.createDiv({ cls: 'dte-store-meta-row' });
    row.createSpan({ cls: 'dte-store-meta-label', text: label });
    row.createSpan({ cls: 'dte-store-meta-val', text: value });
  }

  private getMissingPlugins(requiresPlugins?: string[]): string[] {
    if (!requiresPlugins || requiresPlugins.length === 0) return [];
    const pluginsObj = (this.app as any).plugins;
    const enabledSet = (pluginsObj?.enabledPlugins instanceof Set)
      ? pluginsObj.enabledPlugins
      : new Set<string>();

    return requiresPlugins.filter((pId) => !enabledSet.has(pId));
  }

  // ══════════════════════════════════════════════════════════
  // LÓGICA DE INSTALACIÓN
  // ══════════════════════════════════════════════════════════
  private async handleInstall(pkg: StorePackage): Promise<void> {
    const missing = this.getMissingModules(pkg.requiresModules);
    if (missing.length > 0) {
      const proceed = confirm(
        `Este paquete requiere los siguientes módulos que están desactivados:\n\n• ${missing.join('\n• ')}\n\n¿Deseas activarlos automáticamente y continuar con la instalación?`
      );
      if (!proceed) return;

      const s = this.plugin.settings as DinoSettings;
      if (!s.enabledModules) s.enabledModules = {};
      missing.forEach((m) => {
        s.enabledModules[m] = true;
      });
      await this.plugin.saveSettings();
    }

    const missingPlugins = this.getMissingPlugins(pkg.requiresPlugins);
    if (missingPlugins.length > 0) {
      new Notice(
        `Nota de compatibilidad: Esta campaña está diseñada para funcionar junto a los siguientes plugins de Obsidian:\n• ${missingPlugins.join('\n• ')}\n\nPuedes instalarlos desde Ajustes > Plugins de la comunidad.`,
        10000
      );
    }

    this.isInstalling = true;
    this.installProgressMsg = 'Iniciando descarga...';
    this.render();

    try {
      await installPackage(this.plugin, pkg, (msg) => {
        this.installProgressMsg = msg;
        this.render();
      });
      new Notice(`¡Paquete instalado con éxito: ${pkg.name}!`, 5000);
    } catch (err) {
      console.error('[DTE Store] Error installing package:', err);
      new Notice(`Error instalando ${pkg.name}: ${String(err)}`, 6000);
    } finally {
      this.isInstalling = false;
      this.render();
    }
  }

  private getMissingModules(required?: string[]): string[] {
    if (!required || required.length === 0) return [];
    const s = this.plugin.settings as DinoSettings;
    const enabled = s.enabledModules || {};
    return required.filter((mod) => !enabled[mod]);
  }

  private getTypeLabel(type: StorePackageType): string {
    switch (type) {
      case 'campaign':
        return 'Campaña';
      case 'sheet':
        return 'Ficha';
      case 'tables':
        return 'Tablas';
      case 'oracle':
        return 'Oráculo';
      case 'wargame':
        return 'Wargame';
      case 'assets':
        return 'Assets';
      case 'bundle':
        return 'Todo en uno';
      default:
        return type;
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

