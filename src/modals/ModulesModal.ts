import { App, Modal, Setting } from 'obsidian';
import { moduleRegistry } from '../modules/registry';
import { t } from '../i18n';

export class ModulesModal extends Modal {
  plugin: any;
  view: any;

  constructor(app: App, plugin: any, view: any) {
    super(app);
    this.plugin = plugin;
    this.view = view;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: `🧩 ${t('modules.modalTitle')}` });
    contentEl.createDiv({
      cls: 'dte-hint',
      text: t('modules.modalDesc'),
    });

    const modules = moduleRegistry.getAll();
    for (const mod of modules) {
      const isEnabled = moduleRegistry.isEnabled(this.plugin.settings, mod.id);
      new Setting(contentEl)
        .setName(t(mod.nameKey))
        .setDesc(t(mod.descKey))
        .addToggle((toggle) =>
          toggle.setValue(isEnabled).onChange(async (val) => {
            moduleRegistry.setEnabled(this.plugin.settings, mod.id, val);
            await this.plugin.saveSettings();
            this.view.render();
          })
        );
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
