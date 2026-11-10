import { App, Modal, Setting, setIcon } from 'obsidian';
import { DinoPlugin } from '../types';
import { StoreInstalledReceipt } from '../modules/store/types';
import { uninstallPackage } from '../modules/store/storeClient';
import { t } from '../i18n';

export class UninstallPackageModal extends Modal {
  private plugin: DinoPlugin;
  private receipt: StoreInstalledReceipt;
  private onFinished: () => void;

  constructor(
    app: App,
    plugin: DinoPlugin,
    receipt: StoreInstalledReceipt,
    onFinished: () => void
  ) {
    super(app);
    this.plugin = plugin;
    this.receipt = receipt;
    this.onFinished = onFinished;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('dte-uninstall-modal');

    contentEl.createEl('h2', {
      text: `¿Desinstalar "${this.receipt.name}"?`,
    });

    const warnCard = contentEl.createDiv({ cls: 'dte-settings-warning-card' });
    warnCard.style.cssText =
      'display: flex; gap: 12px; align-items: flex-start; padding: 14px; margin: 14px 0; border: 1px solid var(--text-error); background: rgba(255, 0, 0, 0.06); border-radius: 8px;';

    const iconEl = warnCard.createDiv();
    setIcon(iconEl, 'alert-triangle');
    iconEl.style.color = 'var(--text-error)';
    iconEl.style.flexShrink = '0';
    iconEl.style.marginTop = '2px';

    const textEl = warnCard.createDiv();
    const strongTitle = textEl.createEl('strong', {
      text: '¡Atención! Esta acción eliminará archivos de tu Vault',
    });
    strongTitle.style.display = 'block';
    strongTitle.style.marginBottom = '8px';
    strongTitle.style.color = 'var(--text-error)';

    const descList = textEl.createEl('ul');
    descList.style.margin = '4px 0 0 18px';
    descList.style.padding = '0';
    descList.style.lineHeight = '1.5';

    if (this.receipt.type === 'campaign') {
      descList.createEl('li', {
        text: 'Se eliminará la configuración de la campaña en el motor táctico Dino Tabletop Engine.',
      });
      descList.createEl('li', {
        text: 'Se enviarán a la PAPELERA todas las notas creadas (bitácoras, lore, personajes, PNJ) y archivos multimedia.',
      });
    } else if (this.receipt.type === 'sheet') {
      descList.createEl('li', {
        text: 'Se eliminará la plantilla de hoja de personaje de tus configuraciones.',
      });
      descList.createEl('li', {
        text: 'Se enviarán a la PAPELERA todas las notas y assets creados para este paquete en tu bóveda.',
      });
    } else {
      descList.createEl('li', {
        text: 'Se eliminarán del motor todos los datos y registros de este paquete.',
      });
      descList.createEl('li', {
        text: 'Se enviarán a la PAPELERA todas las notas y archivos generados durante la instalación.',
      });
    }

    if (this.receipt.installedPath) {
      const pathNotice = contentEl.createEl('p', {
        cls: 'dte-hint',
        text: 'Carpeta afectada en tu bóveda: ',
      });
      pathNotice.style.margin = '10px 0 16px 0';
      pathNotice.createEl('code', { text: this.receipt.installedPath });
    }

    const actionSetting = new Setting(contentEl);
    actionSetting.addButton((btn) => {
      btn.setButtonText(t('common.cancel') || 'Cancelar').onClick(() => this.close());
    });

    actionSetting.addButton((btn) => {
      btn
        .setButtonText('Desinstalar y Eliminar Notas')
        .setWarning()
        .onClick(async () => {
          btn.setDisabled(true);
          btn.setButtonText('Desinstalando...');
          try {
            await uninstallPackage(this.plugin, this.receipt.packageId);
            this.close();
            this.onFinished();
          } catch (err) {
            console.error('[DTE Store] Error uninstalling package:', err);
            btn.setDisabled(false);
            btn.setButtonText('Desinstalar y Eliminar Notas');
          }
        });
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

