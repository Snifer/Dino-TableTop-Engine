import { App, Notice, setIcon, TFile } from 'obsidian';
import { EngineModule } from '../types';
import { t } from '../../i18n';
import { DinoPlugin, DinoSettings, IDinoTabletopView } from '../../types';
import { SheetTemplate } from './types';
import { FrontmatterSyncManager } from './frontmatterSync';
import { CharacterSheetPanel } from './CharacterSheetPanel';
import { TemplateManagerModal } from './TemplateManagerModal';
import { SelectTemplateModal } from './SelectTemplateModal';

export * from './types';
export * from './formulaEvaluator';
export * from './frontmatterSync';
export * from './CharacterSheetRenderer';
export * from './CharacterSheetPanel';
export * from './TemplateEditorModal';
export * from './TemplateManagerModal';
export * from './SelectTemplateModal';
export * from './ExportSheetPackageModal';
export * from './sheetExportImport';

let syncManagerInstance: FrontmatterSyncManager | null = null;
export const activeSheetPanels: Map<string, CharacterSheetPanel> = new Map();

export function getSyncManager(app: App, plugin: DinoPlugin): FrontmatterSyncManager {
  if (!syncManagerInstance) {
    syncManagerInstance = new FrontmatterSyncManager(app, plugin);
  }
  return syncManagerInstance;
}

/**
 * Open a floating character sheet for a specific note path
 */
export async function openCharacterSheet(
  app: App,
  plugin: DinoPlugin,
  notePath: string,
  view?: IDinoTabletopView | null
): Promise<void> {
  const targetView = view || plugin.getOpenDinoView();
  if (!targetView) {
    new Notice('Abre primero la vista del tablero de Dino Tabletop.');
    return;
  }

  // Check if already open
  if (activeSheetPanels.has(notePath)) {
    const existing = activeSheetPanels.get(notePath)!;
    if (existing.minimized) {
      existing.build();
    }
    existing.el.scrollIntoView({ behavior: 'smooth' });
    return;
  }

  const abstractFile = app.vault.getAbstractFileByPath(notePath) || app.metadataCache.getFirstLinkpathDest(notePath, '');
  if (!abstractFile || !(abstractFile instanceof TFile)) {
    new Notice(`No se encontró la nota: ${notePath}`);
    return;
  }

  const file = abstractFile;
  const s = plugin.settings as DinoSettings;
  const templates = s.sheetTemplates || [];
  const propKey = s.characterSheets?.property || 'dte-sheet';

  // Check frontmatter for dte-sheet property
  const cache = app.metadataCache.getFileCache(file);
  const assignedTemplate = cache?.frontmatter?.[propKey];

  const launchPanel = (template: SheetTemplate) => {
    const container = targetView.panelsLayer || targetView.containerEl;
    const syncMgr = getSyncManager(app, plugin);
    const panel = new CharacterSheetPanel(
      app,
      plugin,
      container,
      file,
      template,
      syncMgr,
      (closedPath) => {
        activeSheetPanels.delete(closedPath);
      }
    );
    activeSheetPanels.set(notePath, panel);
    panel.open();
  };

  if (!assignedTemplate) {
    // Prompt to select template
    new SelectTemplateModal(app, plugin, file, (chosen) => {
      launchPanel(chosen);
    }).open();
    return;
  }

  // Find assigned template by name or id
  const template = templates.find((t) => t.name === assignedTemplate || t.id === assignedTemplate);
  if (!template) {
    new Notice(`No se encontró la plantilla "${assignedTemplate}". Selecciona otra.`);
    new SelectTemplateModal(app, plugin, file, (chosen) => {
      launchPanel(chosen);
    }).open();
    return;
  }

  launchPanel(template);
}

/**
 * Prompts the user to change the character sheet template assigned to a note.
 */
export async function changeCharacterSheet(
  app: App,
  plugin: DinoPlugin,
  notePath: string,
  view?: IDinoTabletopView | null
): Promise<void> {
  const abstractFile = app.vault.getAbstractFileByPath(notePath) || app.metadataCache.getFirstLinkpathDest(notePath, '');
  if (!abstractFile || !(abstractFile instanceof TFile)) {
    new Notice(`No se encontró la nota: ${notePath}`);
    return;
  }

  const file = abstractFile;
  new SelectTemplateModal(app, plugin, file, (chosen) => {
    if (activeSheetPanels.has(notePath)) {
      const panel = activeSheetPanels.get(notePath)!;
      panel.setTemplate(chosen);
    } else {
      openCharacterSheet(app, plugin, notePath, view);
    }
  }).open();
}

/**
 * Removes the assigned character sheet template from a note's frontmatter.
 */
export async function removeCharacterSheet(
  app: App,
  plugin: DinoPlugin,
  notePath: string
): Promise<void> {
  const abstractFile = app.vault.getAbstractFileByPath(notePath) || app.metadataCache.getFirstLinkpathDest(notePath, '');
  if (!abstractFile || !(abstractFile instanceof TFile)) {
    new Notice(`No se encontró la nota: ${notePath}`);
    return;
  }

  const file = abstractFile;
  const s = plugin.settings as DinoSettings;
  const propKey = s.characterSheets?.property || 'dte-sheet';

  try {
    await app.fileManager.processFrontMatter(file, (fm) => {
      delete fm[propKey];
    });

    if (activeSheetPanels.has(notePath)) {
      const panel = activeSheetPanels.get(notePath)!;
      panel.destroy();
      activeSheetPanels.delete(notePath);
    }

    new Notice(t('sheet.sheetRemoved', { name: file.basename }) || `Hoja de personaje retirada de "${file.basename}".`);
  } catch (err) {
    console.error('[CharacterSheet] Error removing sheet from note:', err);
    new Notice('Error al retirar la hoja del frontmatter.');
  }
}

// ── Toolbar button renderer ──
export function renderCharacterSheetToolbarButton(container: HTMLElement, view: IDinoTabletopView): void {
  const btn = container.createEl('button', {
    cls: 'dte-btn',
    title: t('modules.characterSheetDesc') || 'Hojas de personaje',
  });
  const icon = btn.createSpan({ cls: 'dte-btn-icon-prefix' });
  setIcon(icon, 'file-text');
  btn.prepend(icon);
  btn.createSpan({ text: t('modules.characterSheetShort') || 'Fichas' });

  btn.addEventListener('click', () => {
    new TemplateManagerModal(view.app, view.plugin).open();
  });
}

// ── Module registration ──
export const CharacterSheetModule: EngineModule = {
  id: 'character-sheet',
  nameKey: 'modules.characterSheetName',
  descKey: 'modules.characterSheetDesc',
  icon: 'file-text',
  defaultEnabled: false,
  renderToolbarButton: renderCharacterSheetToolbarButton,
};
