import { App, Modal, Setting, Notice, setIcon } from 'obsidian';
import type DinoTabletopEnginePlugin from '../../main';
import { DinoTabletopView } from '../views/DinoTabletopView';
import { importCampaignFromBuffer } from '../modules/campaignExportImport';
import { t } from '../i18n';

export class CampaignImportModal extends Modal {
  plugin: DinoTabletopEnginePlugin;
  view: DinoTabletopView;
  selectedFile: File | null = null;
  customFolder: string = '';

  constructor(app: App, plugin: DinoTabletopEnginePlugin, view: DinoTabletopView) {
    super(app);
    this.plugin = plugin;
    this.view = view;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('dte-import-modal');

    contentEl.createEl('h2', {
      text: t('exportImport.importCampaignTitle'),
    });

    contentEl.createEl('p', {
      cls: 'dte-hint',
      text: t('exportImport.importCampaignDesc'),
    });

    // Zona de archivo
    const dropZone = contentEl.createDiv({ cls: 'dte-import-dropzone' });
    const dropIcon = dropZone.createDiv({ cls: 'dte-dropzone-icon' });
    setIcon(dropIcon, 'upload-cloud');

    const fileLabel = dropZone.createEl('div', {
      cls: 'dte-dropzone-label',
      text: t('exportImport.dropFileHere'),
    });

    const fileInput = dropZone.createEl('input', {
      type: 'file',
      attr: { accept: '.dinovtt,.zip' },
    });
    fileInput.style.display = 'none';

    dropZone.addEventListener('click', () => {
      fileInput.click();
    });

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.addClass('dte-dragover');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.removeClass('dte-dragover');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.removeClass('dte-dragover');
      if (e.dataTransfer && e.dataTransfer.files.length > 0) {
        this.selectedFile = e.dataTransfer.files[0];
        fileLabel.setText(this.selectedFile.name);
        dropZone.addClass('dte-file-selected');
      }
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files.length > 0) {
        this.selectedFile = fileInput.files[0];
        fileLabel.setText(this.selectedFile.name);
        dropZone.addClass('dte-file-selected');
      }
    });

    // Carpeta destino opcional en el vault
    new Setting(contentEl)
      .setName(t('exportImport.targetFolder'))
      .setDesc(t('exportImport.targetFolderDesc'))
      .addText((text) => {
        text
          .setPlaceholder('DinoVTT/Campaigns')
          .setValue(this.customFolder)
          .onChange((v) => {
            this.customFolder = v.trim();
          });
      });

    // Botones de acción
    const actionSetting = new Setting(contentEl);
    actionSetting.addButton((btn) => {
      btn.setButtonText(t('common.cancel')).onClick(() => this.close());
    });

    actionSetting.addButton((btn) => {
      btn
        .setButtonText(t('exportImport.importButton'))
        .setCta()
        .onClick(async () => {
          if (!this.selectedFile) {
            new Notice(t('exportImport.noFileSelected'));
            return;
          }

          btn.setDisabled(true);
          btn.setButtonText(t('exportImport.importing'));

          try {
            const buffer = await this.selectedFile.arrayBuffer();
            await importCampaignFromBuffer(
              this.plugin,
              buffer,
              this.customFolder || undefined
            );
            this.view.render();
            this.close();
          } catch (err) {
            console.error('[DinoVTT] Error importing campaign:', err);
            new Notice(t('exportImport.importError', { error: String(err) }));
            btn.setDisabled(false);
            btn.setButtonText(t('exportImport.importButton'));
          }
        });
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
