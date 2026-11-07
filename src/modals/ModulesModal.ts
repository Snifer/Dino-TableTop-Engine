import { App, Modal, setIcon, ToggleComponent } from 'obsidian';
import { DinoPlugin, IDinoTabletopView } from '../types';
import { moduleRegistry } from '../modules/registry';
import { t } from '../i18n';

type CategoryKey = 'combat' | 'campaign' | 'tabletop';

interface ModuleCategory {
  key: CategoryKey;
  icon: string;
  titleKey: string;
  moduleIds: string[];
}

const MODULE_CATEGORIES: ModuleCategory[] = [
  {
    key: 'combat',
    icon: 'swords',
    titleKey: 'modules.categoryCombat',
    moduleIds: ['combat-tracker', 'measure', 'wargame'],
  },
  {
    key: 'campaign',
    icon: 'book-open',
    titleKey: 'modules.categoryCampaign',
    moduleIds: [
      'persistent-characters',
      'character-sheet',
      'campaign-diary',
      'missions',
      'timeline',
    ],
  },
  {
    key: 'tabletop',
    icon: 'dice-6',
    titleKey: 'modules.categoryTabletop',
    moduleIds: ['random-tables', 'dice-tray', 'cards', 'oracle'],
  },
];

// Lightweight profile includes the essential core modules
const LIGHTWEIGHT_MODULE_IDS = [
  'combat-tracker',
  'dice-tray',
  'persistent-characters',
  'character-sheet',
  'random-tables',
];

type FilterKey = 'all' | CategoryKey;

export class ModulesModal extends Modal {
  plugin: DinoPlugin;
  view: IDinoTabletopView;
  private activeFilter: FilterKey = 'all';
  private searchQuery: string = '';
  private gridContainer!: HTMLElement;
  private filterButtons: Map<FilterKey, HTMLElement> = new Map();
  private countBadgeEl!: HTMLElement;

  constructor(app: App, plugin: DinoPlugin, view: IDinoTabletopView) {
    super(app);
    this.plugin = plugin;
    this.view = view;
  }

  onOpen(): void {
    const { contentEl, modalEl } = this;
    modalEl.addClass('dte-modules-modal');
    contentEl.empty();

    // ── Header (with padding-right to avoid close button collision) ──
    const header = contentEl.createDiv({ cls: 'dte-modules-header' });
    const titleRow = header.createDiv({ cls: 'dte-modules-title-row' });
    titleRow.createEl('h2', { text: `🧩 ${t('modules.modalTitle')}` });

    this.countBadgeEl = titleRow.createEl('span', {
      cls: 'dte-modules-count-badge',
    });
    this.updateActiveCount();

    header.createDiv({ cls: 'dte-hint', text: t('modules.modalDesc') });

    // ── Search & Controls bar ──
    const searchBar = contentEl.createDiv({ cls: 'dte-modules-search-bar' });
    const searchInput = searchBar.createEl('input', {
      type: 'text',
      cls: 'dte-modules-search-input',
      attr: { placeholder: t('modules.searchPlaceholder' as any) },
    });
    searchInput.addEventListener('input', () => {
      this.searchQuery = searchInput.value.toLowerCase().trim();
      this.renderCategories();
    });

    const controls = contentEl.createDiv({ cls: 'dte-modules-controls' });

    // Filter pills
    const filters = controls.createDiv({ cls: 'dte-modules-filters' });
    const filterDefs: { key: FilterKey; labelKey: string }[] = [
      { key: 'all', labelKey: 'modules.filterAll' },
      { key: 'combat', labelKey: 'modules.filterCombat' },
      { key: 'campaign', labelKey: 'modules.filterCampaign' },
      { key: 'tabletop', labelKey: 'modules.filterTabletop' },
    ];
    for (const fd of filterDefs) {
      const pill = filters.createEl('button', {
        cls: `dte-filter-pill${fd.key === 'all' ? ' is-active' : ''}`,
        text: t(fd.labelKey as any),
      });
      pill.addEventListener('click', () => this.setFilter(fd.key));
      this.filterButtons.set(fd.key, pill);
    }

    // Quick action buttons
    const actions = controls.createDiv({ cls: 'dte-modules-actions' });

    const enableAllBtn = actions.createEl('button', {
      cls: 'dte-modules-action-btn',
      text: t('modules.enableAll'),
    });
    enableAllBtn.addEventListener('click', () => this.setBatchEnabled(null, true));

    const lightProfileBtn = actions.createEl('button', {
      cls: 'dte-modules-action-btn dte-modules-action-btn--accent',
      text: `⚡ ${t('modules.profileLight' as any)}`,
    });
    lightProfileBtn.addEventListener('click', () => this.applyLightProfile());

    const disableAllBtn = actions.createEl('button', {
      cls: 'dte-modules-action-btn',
      text: t('modules.disableAll'),
    });
    disableAllBtn.addEventListener('click', () => this.setBatchEnabled(null, false));

    // ── Grid container ──
    this.gridContainer = contentEl.createDiv({ cls: 'dte-modules-grid-container' });
    this.renderCategories();
  }

  private updateActiveCount(): void {
    if (!this.countBadgeEl) return;
    const all = moduleRegistry.getAll();
    const active = all.filter((m) => moduleRegistry.isEnabled(this.plugin.settings, m.id)).length;
    this.countBadgeEl.setText(
      t('modules.activeCount' as any, { active, total: all.length })
    );
  }

  private renderCategories(): void {
    this.gridContainer.empty();

    for (const category of MODULE_CATEGORIES) {
      if (this.activeFilter !== 'all' && this.activeFilter !== category.key) {
        continue;
      }

      // Filter modules by search query if any
      const matchingModules = category.moduleIds
        .map((id) => moduleRegistry.get(id))
        .filter((mod): mod is NonNullable<typeof mod> => {
          if (!mod) return false;
          if (!this.searchQuery) return true;
          const name = t(mod.nameKey).toLowerCase();
          const desc = t(mod.descKey).toLowerCase();
          return name.includes(this.searchQuery) || desc.includes(this.searchQuery);
        });

      if (matchingModules.length === 0) continue;

      const activeInCategory = matchingModules.filter((m) =>
        moduleRegistry.isEnabled(this.plugin.settings, m.id)
      ).length;

      const section = this.gridContainer.createDiv({ cls: 'dte-modules-section' });
      const sectionHeader = section.createDiv({ cls: 'dte-modules-section-header' });

      const titleWrap = sectionHeader.createDiv({ cls: 'dte-modules-section-title-wrap' });
      const catIcon = titleWrap.createSpan({ cls: 'dte-modules-section-icon' });
      setIcon(catIcon, category.icon);
      titleWrap.createEl('h3', {
        cls: 'dte-modules-section-title',
        text: t(category.titleKey as any),
      });

      sectionHeader.createEl('span', {
        cls: 'dte-modules-section-badge',
        text: `${activeInCategory}/${matchingModules.length}`,
      });

      const grid = section.createDiv({ cls: 'dte-modules-card-grid' });

      for (const mod of matchingModules) {
        this.renderCard(grid, mod, category.key);
      }
    }
  }

  private renderCard(
    container: HTMLElement,
    mod: { id: string; nameKey: any; descKey: any; icon: string },
    categoryKey: CategoryKey
  ): void {
    const isEnabled = moduleRegistry.isEnabled(this.plugin.settings, mod.id);
    const card = container.createDiv({
      cls: `dte-module-card dte-module-card--${categoryKey}${isEnabled ? ' is-active' : ''}`,
    });

    const cardBody = card.createDiv({ cls: 'dte-module-card-body' });

    // Icon
    const iconEl = cardBody.createDiv({ cls: 'dte-module-card-icon' });
    setIcon(iconEl, mod.icon);

    // Text
    const textEl = cardBody.createDiv({ cls: 'dte-module-card-text' });
    textEl.createEl('span', { cls: 'dte-module-card-title', text: t(mod.nameKey) });
    textEl.createEl('span', { cls: 'dte-module-card-desc', text: t(mod.descKey) });

    // Toggle using native Obsidian ToggleComponent
    const toggleWrapper = card.createDiv({ cls: 'dte-module-card-toggle' });
    const toggleComp = new ToggleComponent(toggleWrapper);
    toggleComp.setValue(isEnabled);

    const onToggleChange = async (val: boolean) => {
      moduleRegistry.setEnabled(this.plugin.settings, mod.id, val);
      await this.plugin.saveSettings();
      this.view.render();

      card.toggleClass('is-active', val);
      this.updateActiveCount();

      // Update badge in section header
      const sectionEl = card.closest('.dte-modules-section');
      if (sectionEl) {
        const badge = sectionEl.querySelector('.dte-modules-section-badge');
        const activeCards = sectionEl.querySelectorAll('.dte-module-card.is-active').length;
        const totalCards = sectionEl.querySelectorAll('.dte-module-card').length;
        if (badge) badge.textContent = `${activeCards}/${totalCards}`;
      }
    };

    toggleComp.onChange((val) => onToggleChange(val));

    // Clicking anywhere on the card toggles it smoothly
    card.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.checkbox-container')) return;
      const nextVal = !toggleComp.getValue();
      toggleComp.setValue(nextVal);
      onToggleChange(nextVal);
    });
  }

  private setFilter(key: FilterKey): void {
    this.activeFilter = key;

    for (const [k, el] of this.filterButtons) {
      el.toggleClass('is-active', k === key);
    }

    this.renderCategories();
  }

  private async setBatchEnabled(ids: string[] | null, enabled: boolean): Promise<void> {
    const modules = moduleRegistry.getAll();
    for (const mod of modules) {
      if (ids === null || ids.includes(mod.id)) {
        moduleRegistry.setEnabled(this.plugin.settings, mod.id, enabled);
      }
    }
    await this.plugin.saveSettings();
    this.view.render();
    this.updateActiveCount();
    this.renderCategories();
  }

  private async applyLightProfile(): Promise<void> {
    const modules = moduleRegistry.getAll();
    for (const mod of modules) {
      const enabled = LIGHTWEIGHT_MODULE_IDS.includes(mod.id);
      moduleRegistry.setEnabled(this.plugin.settings, mod.id, enabled);
    }
    await this.plugin.saveSettings();
    this.view.render();
    this.updateActiveCount();
    this.renderCategories();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
