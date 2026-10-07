import { App, PluginSettingTab, Setting } from 'obsidian';
import { SupportedLanguage } from '../types';
import { setLanguage, t } from '../i18n';
import { moduleRegistry } from '../modules/registry';
import { DinoTabletopView } from '../views/DinoTabletopView';

export class DinoSettingTab extends PluginSettingTab {
  plugin: any;

  constructor(app: App, plugin: any) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: t('settings.title') });

    // --- Sección: General e Internacionalización ---
    containerEl.createEl('h3', { text: t('settings.generalSection') });

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
            this.display();

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
    containerEl.createEl('h3', { text: t('settings.interfaceSection') });

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
          .onChange(async (val: any) => {
            this.plugin.settings.toolbarLayout = val;
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
    containerEl.createEl('h3', { text: t('settings.modulesSection') });
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

    // --- Sección: Acerca de / About ---
    containerEl.createEl('h3', { text: t('settings.aboutSection') });

    const aboutBox = containerEl.createDiv({ cls: 'dte-settings-about-box' });

    const titleRow = aboutBox.createDiv({ cls: 'dte-settings-about-header' });
    titleRow.createEl('strong', { text: 'Dino Tabletop Engine' });
    titleRow.createSpan({ cls: 'dte-settings-badge', text: 'ALPHA v0.1.3' });

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
