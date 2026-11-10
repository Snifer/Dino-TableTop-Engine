import { App, PluginSettingTab, Setting } from 'obsidian';
import { SupportedLanguage, DinoPlugin, ToolbarLayout } from '../types';
import { setLanguage, t } from '../i18n';
import { moduleRegistry } from '../modules/registry';
import { DinoTabletopView } from '../views/DinoTabletopView';
import { TemplateManagerModal } from '../modules/characterSheet';
import { ensureStoreSettings } from '../modules/store/storeClient';
import { StoreModal } from '../modals/StoreModal';

export class DinoSettingTab extends PluginSettingTab {
  plugin: DinoPlugin;

  constructor(app: App, plugin: DinoPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    this.renderSettings();
  }

  getSettingDefinitions(): [] {
    return [];
  }

  private renderSettings(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl).setName(t('settings.title')).setHeading();

    // --- Sección: General e Internacionalización ---
    new Setting(containerEl).setName(t('settings.generalSection')).setHeading();

    new Setting(containerEl)
      .setName(t('settings.languageName'))
      .setDesc(t('settings.languageDesc'))
      .addDropdown((dropdown) =>
        dropdown
          .addOption('auto', t('settings.langAuto'))
          .addOption('es', t('settings.langEs'))
          .addOption('en', t('settings.langEn'))
          .setValue(this.plugin.settings.language || 'auto')
          .onChange(async (val: string) => {
            const lang = val as SupportedLanguage;
            this.plugin.settings.language = lang;
            setLanguage(lang);
            await this.plugin.saveSettings();
            this.renderSettings();

            // Refresh open DinoTabletopView if active
            const leaves = this.app.workspace.getLeavesOfType('dino-tabletop-engine-view');
            for (const leaf of leaves) {
              if (leaf.view instanceof DinoTabletopView) {
                leaf.view.render();
              }
            }
          })
      );

    // --- Sección: Interfaz y Apariencia ---
    new Setting(containerEl).setName(t('settings.interfaceSection')).setHeading();

    new Setting(containerEl)
      .setName(t('settings.toolbarLayoutName'))
      .setDesc(t('settings.toolbarLayoutDesc'))
      .addDropdown((dropdown) =>
        dropdown
          .addOption('top', t('settings.toolbarLayoutTop'))
          .addOption('floating', t('settings.toolbarLayoutFloatingFree'))
          .addOption('floating-left', t('settings.toolbarLayoutFloatingLeft'))
          .addOption('floating-right', t('settings.toolbarLayoutFloatingRight'))
          .setValue(this.plugin.settings.toolbarLayout || 'top')
          .onChange(async (val: string) => {
            this.plugin.settings.toolbarLayout = val as ToolbarLayout;
            await this.plugin.saveSettings();

            // Refresh open DinoTabletopView if active
            const leaves = this.app.workspace.getLeavesOfType('dino-tabletop-engine-view');
            for (const leaf of leaves) {
              if (leaf.view instanceof DinoTabletopView) {
                leaf.view.render();
              }
            }
          })
      );

    // --- Sección: Módulos Opcionales Integrados ---
    new Setting(containerEl).setName(t('settings.modulesSection')).setHeading();
    containerEl.createDiv({
      cls: 'dte-hint',
      text: t('settings.modulesSectionDesc'),
    });

    const modules = moduleRegistry.getAll();
    for (const mod of modules) {
      const isEnabled = moduleRegistry.isEnabled(this.plugin.settings, mod.id);
      new Setting(containerEl)
        .setName(t(mod.nameKey))
        .setDesc(t(mod.descKey))
        .addToggle((toggle) =>
          toggle.setValue(isEnabled).onChange(async (val) => {
            moduleRegistry.setEnabled(this.plugin.settings, mod.id, val);
            await this.plugin.saveSettings();

            // Refresh open DinoTabletopView if active
            const leaves = this.app.workspace.getLeavesOfType('dino-tabletop-engine-view');
            for (const leaf of leaves) {
              if (leaf.view instanceof DinoTabletopView) {
                leaf.view.render();
              }
            }
          })
        );
    }

    // --- Sección: Tablas Aleatorias / Random Tables ---
    if (moduleRegistry.isEnabled(this.plugin.settings, 'random-tables')) {
      new Setting(containerEl).setName(t('tables.panelTitle')).setHeading();
      new Setting(containerEl)
        .setName('Prefijo de etiqueta (Tag Prefix)')
        .setDesc('Prefijo de tag para detectar notas de tablas (ej: dte-table, dte-table/<campaña>).')
        .addText((text) =>
          text
            .setValue(this.plugin.settings.randomTables?.tagPrefix || 'dte-table')
            .onChange(async (val) => {
              if (!this.plugin.settings.randomTables) {
                this.plugin.settings.randomTables = { tagPrefix: 'dte-table', folders: [], noRepeat: {} };
              }
              this.plugin.settings.randomTables.tagPrefix = val.trim() || 'dte-table';
              await this.plugin.saveSettings();
            })
        );
    }

    // --- Sección: Hojas de Personaje / Character Sheets ---
    if (moduleRegistry.isEnabled(this.plugin.settings, 'character-sheet')) {
      new Setting(containerEl).setName(t('modules.characterSheetName') || 'Hojas de Personaje').setHeading();
      new Setting(containerEl)
        .setName('Propiedad Frontmatter (Property)')
        .setDesc('Clave frontmatter que vincula una nota con su plantilla (por defecto: dte-sheet).')
        .addText((text) =>
          text
            .setValue(this.plugin.settings.characterSheets?.property || 'dte-sheet')
            .onChange(async (val) => {
              if (!this.plugin.settings.characterSheets) {
                this.plugin.settings.characterSheets = { property: 'dte-sheet', templates: [] };
              }
              this.plugin.settings.characterSheets.property = val.trim() || 'dte-sheet';
              await this.plugin.saveSettings();
            })
        );

      new Setting(containerEl)
        .setName('Plantillas de Hoja')
        .setDesc('Diseña, edita o importa plantillas visuales con widgets.')
        .addButton((btn) =>
          btn.setButtonText('Gestionar Plantillas').onClick(() => {
            new TemplateManagerModal(this.app, this.plugin).open();
          })
        );
    }

    // --- Sección: Tienda Comunitaria / Community Store ---
    const storeSettings = ensureStoreSettings(this.plugin);
    new Setting(containerEl).setName('Tienda Comunitaria (DTE Store)').setHeading();

    new Setting(containerEl)
      .setName('Explorar Tienda')
      .setDesc('Descarga e instala campañas, fichas y tablas compartidas por la comunidad.')
      .addButton((btn) =>
        btn.setButtonText('Abrir Tienda').setCta().onClick(() => {
          new StoreModal(this.app, this.plugin).open();
        })
      );

    new Setting(containerEl)
      .setName('Carpeta de Importación e Instalación de Paquetes')
      .setDesc('Ruta en tu bóveda donde se guardan automáticamente las notas, mapas y activos al instalar paquetes de la tienda o importar campañas (por defecto: DTE/Store). Se creará una carpeta para cada paquete con subcarpetas separadas: "notes/" (para notas Markdown, bitácoras y fichas) y "assets/" (para mapas tácticos, imágenes y tokens).')
      .addText((txt) =>
        txt
          .setPlaceholder('DTE/Store')
          .setValue(storeSettings.installFolder || 'DTE/Store')
          .onChange(async (val) => {
            storeSettings.installFolder = val.trim() || 'DTE/Store';
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Exportación de Paquetes y Campañas')
      .setDesc('Al exportar (.dinovtt), DTE recopila automáticamente las notas y mapas asociados, optimizando las imágenes (WebP) para mantener el archivo comprimido y por debajo de 100 MB. Al importarse en otra bóveda, se extraerán en la estructura "notes/" y "assets/" dentro del directorio configurado arriba.')
      .addButton((btn) =>
        btn.setButtonText('Comunidad DTE').onClick(() => {
          window.open('https://github.com/Snifer/dino-tabletop-engine-store', '_blank');
        })
      );

    new Setting(containerEl)
      .setName('URL del Formulario de Envío de Paquetes')
      .setDesc('Enlace al formulario donde los creadores pueden enviar paquetes para publicación comunitaria sin usar GitHub.')
      .addText((txt) =>
        txt
          .setPlaceholder('https://forms.gle/...')
          .setValue(storeSettings.submitFormUrl || 'https://forms.gle/QafjhDjpHxTYrahw8')
          .onChange(async (val) => {
            storeSettings.submitFormUrl = val.trim() || 'https://forms.gle/QafjhDjpHxTYrahw8';
            await this.plugin.saveSettings();
          })
      );

    // --- Sección: Acerca de / About ---
    new Setting(containerEl).setName(t('settings.aboutSection')).setHeading();

    const aboutBox = containerEl.createDiv({ cls: 'dte-settings-about-box' });

    const titleRow = aboutBox.createDiv({ cls: 'dte-settings-about-header' });
    titleRow.createEl('strong', { text: 'Dino Tabletop Engine' });
    titleRow.createSpan({ cls: 'dte-settings-badge', text: `ALPHA v${this.plugin.manifest?.version || '0.1.14'}` });

    const descEl = aboutBox.createDiv({ cls: 'dte-settings-about-desc' });
    descEl.createEl('p', {
      text: t('settings.aboutDesc'),
    });

    const warningEl = aboutBox.createDiv({ cls: 'dte-settings-warning-card' });
    warningEl.createDiv({
      cls: 'dte-settings-warning-text',
      text: t('settings.alphaWarning'),
    });

    const authorRow = aboutBox.createDiv({ cls: 'dte-settings-author-row' });
    authorRow.createSpan({ text: t('settings.developedBy') });
    authorRow.createEl('strong', { text: 'Snifer - Bastión del Dinosaurio' });

    const btnRow = aboutBox.createDiv({ cls: 'dte-settings-buttons-row' });

    const ytBtn = btnRow.createEl('button', { cls: 'mod-cta dte-btn-youtube' });
    ytBtn.setText(t('settings.youtubeBtn'));
    ytBtn.addEventListener('click', () => {
      window.open('https://www.youtube.com/@SniferL4bs', '_blank');
    });

    const rpgBtn = btnRow.createEl('button', { cls: 'dte-btn-secondary' });
    rpgBtn.setText(t('settings.rpgRepoBtn'));
    rpgBtn.addEventListener('click', () => {
      window.open('https://github.com/nagoshiashumari/Rpg-Awesome', '_blank');
    });
  }
}
