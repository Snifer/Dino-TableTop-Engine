import { App, TFile, TFolder, TAbstractFile, setIcon, Notice } from 'obsidian';
import { EngineModule } from './types';
import { t, TranslationKey } from '../i18n';
import { DinoSettings, CampaignData } from '../types';
import { genId } from '../utils';

function getConfiguredFolder(app: App, campaign: CampaignData): TFolder | null {
  const path = campaign.diaryFolderPath;
  if (!path) return null;
  const af = app.vault.getAbstractFileByPath(path);
  return af instanceof TFolder ? af : null;
}

/** Build a sorted tree from a TFolder. Folders first, then files, alphabetically. */
interface TreeNode {
  file: TAbstractFile;
  children?: TreeNode[];
}

function buildTree(folder: TFolder): TreeNode[] {
  const nodes: TreeNode[] = [];
  for (const child of folder.children) {
    if (child instanceof TFolder) {
      nodes.push({ file: child, children: buildTree(child) });
    } else if (child instanceof TFile && child.extension === 'md') {
      nodes.push({ file: child });
    }
  }
  // Folders first, then files. Alphabetical within each group.
  nodes.sort((a, b) => {
    const aIsFolder = a.children !== undefined ? 0 : 1;
    const bIsFolder = b.children !== undefined ? 0 : 1;
    if (aIsFolder !== bIsFolder) return aIsFolder - bIsFolder;
    return a.file.name.localeCompare(b.file.name);
  });
  return nodes;
}

/** Suggest a filename for a new diary entry */
function suggestEntryName(app: App, plugin: any): string {
  const settings = plugin.settings as DinoSettings;

  // Try to get in-game date from timeline module if active
  if (settings.enabledModules?.['timeline'] && settings.currentTimelineId) {
    const tl = settings.timelines?.[settings.currentTimelineId];
    if (tl) {
      // Dynamic import avoided — use the exported formatTimeline if available
      try {
        const { formatTimeline } = require('./timeline');
        const formatted = formatTimeline(tl);
        if (formatted && formatted.trim()) {
          return `${formatted}`;
        }
      } catch {
        // Timeline module not available, fall back
      }
    }
  }

  // Fall back to system date
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// ─── Folder Suggest Modal ─────────────────────────────────────────────────────

import { Modal, Setting } from 'obsidian';

class FolderSuggestModal extends Modal {
  private onChoose: (folder: TFolder) => void;

  constructor(app: App, onChoose: (folder: TFolder) => void) {
    super(app);
    this.onChoose = onChoose;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('dte-folder-suggest-modal');
    contentEl.createEl('h3', { text: t('diary.selectFolder') });

    const searchInput = contentEl.createEl('input', {
      type: 'text',
      cls: 'dte-input-clean dte-folder-search',
      placeholder: t('common.search'),
    });

    const listEl = contentEl.createDiv({ cls: 'dte-folder-suggest-list' });

    const allFolders = this.getAllFolders();

    const renderList = (filter: string) => {
      listEl.empty();
      const lower = filter.toLowerCase();
      const filtered = filter
        ? allFolders.filter((f) => f.path.toLowerCase().includes(lower))
        : allFolders;

      if (filtered.length === 0) {
        listEl.createDiv({ cls: 'dte-hint', text: t('diary.noFolders') });
        return;
      }

      for (const folder of filtered) {
        const item = listEl.createDiv({ cls: 'dte-folder-suggest-item' });
        const icon = item.createSpan({ cls: 'dte-folder-suggest-icon' });
        setIcon(icon, 'folder');
        item.createSpan({ text: folder.path });
        item.addEventListener('click', () => {
          this.onChoose(folder);
          this.close();
        });
      }
    };

    renderList('');
    searchInput.addEventListener('input', () => renderList(searchInput.value));
    searchInput.focus();
  }

  private getAllFolders(): TFolder[] {
    const folders: TFolder[] = [];
    const recurse = (folder: TFolder) => {
      folders.push(folder);
      for (const child of folder.children) {
        if (child instanceof TFolder) recurse(child);
      }
    };
    recurse(this.app.vault.getRoot());
    // Remove root
    return folders.filter((f) => f.path !== '/');
  }
}

// ─── New Entry Name Modal ─────────────────────────────────────────────────────

class NewEntryModal extends Modal {
  private suggestedName: string;
  private parentPath: string;
  private onConfirm: (name: string) => void;

  constructor(app: App, suggestedName: string, parentPath: string, onConfirm: (name: string) => void) {
    super(app);
    this.suggestedName = suggestedName;
    this.parentPath = parentPath;
    this.onConfirm = onConfirm;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h3', { text: t('diary.newEntryTitle') });

    const pathHint = contentEl.createDiv({ cls: 'dte-hint' });
    pathHint.textContent = `📁 ${this.parentPath}/`;

    let entryName = this.suggestedName;

    new Setting(contentEl)
      .setName(t('diary.entryName'))
      .addText((txt) => {
        txt.setValue(entryName)
          .setPlaceholder(t('diary.entryNamePlaceholder'))
          .onChange((v) => { entryName = v; });
        txt.inputEl.focus();
        txt.inputEl.select();
        txt.inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            this.onConfirm(entryName.trim() || this.suggestedName);
            this.close();
          }
        });
      });

    new Setting(contentEl)
      .addButton((btn) => {
        btn.setButtonText(t('common.create'))
          .setCta()
          .onClick(() => {
            this.onConfirm(entryName.trim() || this.suggestedName);
            this.close();
          });
      });
  }
}

// ─── Campaign Diary Floating Panel ────────────────────────────────────────────

export class CampaignDiaryPanel {
  app: App;
  plugin: any;
  el: HTMLElement;
  minimized = false;
  private dragOffsetX = 0;
  private dragOffsetY = 0;
  private isDragging = false;
  private collapsedFolders: Set<string> = new Set();

  constructor(app: App, plugin: any, panelsLayer: HTMLElement) {
    this.app = app;
    this.plugin = plugin;

    this.el = panelsLayer.createDiv({ cls: 'dte-panel dte-diary-panel' });
    this.el.style.right = '16px';
    this.el.style.bottom = '60px';
    this.el.style.left = 'auto';
    this.el.style.top = 'auto';
    this.el.style.pointerEvents = 'auto';

    this.build();
  }

  private get settings(): DinoSettings {
    return this.plugin.settings as DinoSettings;
  }

  private getCurrentCampaign(): CampaignData | null {
    const s = this.settings;
    return s.currentCampaignId ? s.campaigns[s.currentCampaignId] ?? null : null;
  }

  private async save(): Promise<void> {
    await this.plugin.saveSettings();
  }

  // ── Build ──────────────────────────────────────────────────────────────────

  public build(): void {
    this.el.empty();
    this.buildHeader();
    if (!this.minimized) {
      this.buildBody();
    }
  }

  private buildHeader(): void {
    const header = this.el.createDiv({ cls: 'dte-panel-header dte-diary-header' });
    this.setupDrag(header);

    const titleWrap = header.createDiv({ cls: 'dte-panel-title' });
    const iconSpan = titleWrap.createSpan({ cls: 'dte-panel-icon' });
    setIcon(iconSpan, 'book-open');

    const camp = this.getCurrentCampaign();
    const titleText = camp
      ? `${t('diary.title')} — ${camp.name}`
      : t('diary.title');
    titleWrap.createSpan({ text: titleText, cls: 'dte-panel-title-text' });

    const actions = header.createDiv({ cls: 'dte-panel-actions' });

    // Configure folder
    const configBtn = actions.createEl('button', {
      cls: 'clickable-icon dte-panel-btn',
      attr: { 'aria-label': t('diary.configureFolder') },
    });
    setIcon(configBtn, 'folder-cog');
    configBtn.addEventListener('click', () => {
      const campaign = this.getCurrentCampaign();
      if (!campaign) {
        new Notice(t('diary.noCampaign'));
        return;
      }
      new FolderSuggestModal(this.app, async (folder) => {
        campaign.diaryFolderPath = folder.path;
        await this.save();
        this.build();
      }).open();
    });

    // Minimize
    const minBtn = actions.createEl('button', {
      cls: 'clickable-icon dte-panel-btn',
      attr: { 'aria-label': this.minimized ? t('modules.combatExpand') : t('modules.combatMinimize') },
    });
    setIcon(minBtn, this.minimized ? 'chevron-down' : 'chevron-up');
    minBtn.addEventListener('click', () => {
      this.minimized = !this.minimized;
      this.build();
    });
  }

  private buildBody(): void {
    const body = this.el.createDiv({ cls: 'dte-diary-body' });
    const campaign = this.getCurrentCampaign();

    if (!campaign) {
      body.createDiv({ cls: 'dte-panel-empty', text: t('diary.noCampaign') });
      return;
    }

    if (!campaign.diaryFolderPath) {
      const empty = body.createDiv({ cls: 'dte-panel-empty' });
      empty.createSpan({ text: t('diary.noFolderConfigured') });
      const configBtn = empty.createEl('button', {
        cls: 'dte-btn mod-cta',
        text: t('diary.configureFolder'),
      });
      configBtn.addEventListener('click', () => {
        new FolderSuggestModal(this.app, async (folder) => {
          campaign.diaryFolderPath = folder.path;
          await this.save();
          this.build();
        }).open();
      });
      return;
    }

    const rootFolder = getConfiguredFolder(this.app, campaign);
    if (!rootFolder) {
      body.createDiv({
        cls: 'dte-panel-empty',
        text: t('diary.folderNotFound').replace('{path}', campaign.diaryFolderPath),
      });
      return;
    }

    // File tree
    const treeContainer = body.createDiv({ cls: 'dte-diary-tree' });
    const tree = buildTree(rootFolder);

    if (tree.length === 0) {
      treeContainer.createDiv({ cls: 'dte-hint', text: t('diary.emptyFolder') });
    } else {
      this.renderTree(treeContainer, tree);
    }

    // New entry button
    const newBtn = body.createEl('button', {
      cls: 'dte-btn dte-diary-new-entry-btn',
      text: t('diary.newEntry'),
    });
    newBtn.addEventListener('click', () => {
      const suggested = suggestEntryName(this.app, this.plugin);
      new NewEntryModal(this.app, suggested, rootFolder.path, async (name) => {
        const filename = name.endsWith('.md') ? name : `${name}.md`;
        const fullPath = `${rootFolder.path}/${filename}`;

        // Check if file already exists
        const existing = this.app.vault.getAbstractFileByPath(fullPath);
        if (existing) {
          new Notice(t('diary.fileExists').replace('{name}', filename));
          return;
        }

        try {
          const newFile = await this.app.vault.create(fullPath, '');
          this.build();
          // Open the new file
          const leaf = this.app.workspace.getLeaf('split');
          await leaf.openFile(newFile);
          new Notice(t('diary.entryCreated').replace('{name}', filename));
        } catch (err) {
          new Notice(t('diary.createError'));
        }
      }).open();
    });
  }

  private renderTree(container: HTMLElement, nodes: TreeNode[]): void {
    for (const node of nodes) {
      if (node.children !== undefined) {
        // Folder
        const folderPath = node.file.path;
        const isCollapsed = this.collapsedFolders.has(folderPath);

        const folderRow = container.createDiv({ cls: 'dte-diary-folder-row' });
        const toggle = folderRow.createSpan({ cls: 'dte-diary-toggle' });
        setIcon(toggle, isCollapsed ? 'chevron-right' : 'chevron-down');
        const folderIcon = folderRow.createSpan({ cls: 'dte-diary-folder-icon' });
        setIcon(folderIcon, isCollapsed ? 'folder' : 'folder-open');
        folderRow.createSpan({ text: node.file.name, cls: 'dte-diary-folder-name' });

        folderRow.addEventListener('click', () => {
          if (isCollapsed) {
            this.collapsedFolders.delete(folderPath);
          } else {
            this.collapsedFolders.add(folderPath);
          }
          this.build();
        });

        if (!isCollapsed && node.children.length > 0) {
          const childContainer = container.createDiv({ cls: 'dte-diary-folder-children' });
          this.renderTree(childContainer, node.children);
        }
      } else {
        // File
        const file = node.file as TFile;
        const fileRow = container.createDiv({ cls: 'dte-diary-file-row' });
        const fileIcon = fileRow.createSpan({ cls: 'dte-diary-file-icon' });
        setIcon(fileIcon, 'file-text');
        fileRow.createSpan({
          text: file.basename,
          cls: 'dte-diary-file-name',
        });

        fileRow.addEventListener('click', async () => {
          const leaf = this.app.workspace.getLeaf('split');
          await leaf.openFile(file);
        });
      }
    }
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

// ─── Toolbar button ─────────────────────────────────────────────────────────

export function renderDiaryToolbarButton(container: HTMLElement, view: any): void {
  const btn = container.createEl('button', {
    cls: 'dte-btn',
    title: t('diary.title'),
  });
  const icon = btn.createSpan({ cls: 'dte-btn-icon-prefix' });
  setIcon(icon, 'book-open');
  btn.prepend(icon);
  btn.createSpan({ text: t('modules.diaryShort') });
  btn.addEventListener('click', () => {
    if (!view.diaryPanel) return;
    view.diaryPanel.minimized = false;
    view.diaryPanel.build();
  });
}

// ─── Module registration ───────────────────────────────────────────────────────

export const CampaignDiaryModule: EngineModule = {
  id: 'campaign-diary',
  nameKey: 'modules.diaryName' as TranslationKey,
  descKey: 'modules.diaryDesc' as TranslationKey,
  icon: 'book-open',
  defaultEnabled: false,
  renderToolbarButton: renderDiaryToolbarButton,
};
