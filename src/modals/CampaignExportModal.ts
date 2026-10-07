import { App, Modal, Setting, Notice } from 'obsidian';
import type DinoTabletopEnginePlugin from '../../main';
import { CampaignData } from '../types';
import { exportCampaignToFile, CampaignExportOptions } from '../modules/campaignExportImport';
import { t } from '../i18n';

export class CampaignExportModal extends Modal {
  plugin: DinoTabletopEnginePlugin;
  campaignId: string;
  campaign: CampaignData;
  availablePacks: string[];

  options: CampaignExportOptions = {
    includeImages: true,
    includeNotes: true,
    includeDiary: true,
    bestiaryMode: 'used',
    selectedPacks: [],
  };

  constructor(app: App, plugin: DinoTabletopEnginePlugin, campaignId: string) {
    super(app);
    this.plugin = plugin;
    this.campaignId = campaignId;
    this.campaign = plugin.settings.campaigns[campaignId];

    // Obtener todos los paquetes del bestiario únicos
    const packSet = new Set<string>(plugin.settings.bestiaryPacks || []);
    for (const b of Object.values(plugin.settings.bestiary || {})) {
      if (b.pack) packSet.add(b.pack);
    }
    this.availablePacks = Array.from(packSet).sort();
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('dte-export-modal');

    contentEl.createEl('h2', {
      text: t('exportImport.exportCampaignTitle', { name: this.campaign.name }),
    });

    contentEl.createEl('p', {
      cls: 'dte-hint',
      text: t('exportImport.exportCampaignDesc'),
    });

    // 1. Incluir imágenes / assets
    new Setting(contentEl)
      .setName(t('exportImport.includeImages'))
      .setDesc(t('exportImport.includeImagesDesc'))
      .addToggle((toggle) => {
        toggle.setValue(this.options.includeImages).onChange((v) => {
          this.options.includeImages = v;
        });
      });

    // 2. Incluir notas vinculadas
    new Setting(contentEl)
      .setName(t('exportImport.includeNotes'))
      .setDesc(t('exportImport.includeNotesDesc'))
      .addToggle((toggle) => {
        toggle.setValue(this.options.includeNotes).onChange((v) => {
          this.options.includeNotes = v;
        });
      });

    // 3. Incluir diario de campaña si tiene carpeta configurada
    if (this.campaign.diaryFolderPath) {
      new Setting(contentEl)
        .setName(t('exportImport.includeDiary'))
        .setDesc(t('exportImport.includeDiaryDesc', { folder: this.campaign.diaryFolderPath }))
        .addToggle((toggle) => {
          toggle.setValue(this.options.includeDiary).onChange((v) => {
            this.options.includeDiary = v;
          });
        });
    }

    // 4. Modo de exportación de Bestiario
    const bestiarySection = contentEl.createDiv({ cls: 'dte-export-bestiary-section' });
    bestiarySection.createEl('h3', { text: t('exportImport.bestiarySection') });

    const packsContainer = bestiarySection.createDiv({ cls: 'dte-export-packs-container' });

    const updatePacksVisibility = (mode: string) => {
      packsContainer.empty();
      if (mode === 'selected') {
        packsContainer.createEl('p', {
          cls: 'dte-hint',
          text: t('exportImport.selectPacksDesc'),
        });

        if (this.availablePacks.length === 0) {
          packsContainer.createEl('span', {
            cls: 'dte-empty-hint',
            text: t('exportImport.noPacksAvailable'),
          });
          return;
        }

        const packList = packsContainer.createDiv({ cls: 'dte-export-pack-list' });
        for (const pack of this.availablePacks) {
          const packRow = packList.createDiv({ cls: 'dte-export-pack-row' });
          const isSelected = this.options.selectedPacks.includes(pack);

          const checkbox = packRow.createEl('input', { type: 'checkbox' });
          checkbox.checked = isSelected;
          checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
              if (!this.options.selectedPacks.includes(pack)) {
                this.options.selectedPacks.push(pack);
              }
            } else {
              this.options.selectedPacks = this.options.selectedPacks.filter((p) => p !== pack);
            }
          });

          packRow.createEl('label', { text: pack });
        }
      }
    };

    new Setting(bestiarySection)
      .setName(t('exportImport.bestiaryExportMode'))
      .setDesc(t('exportImport.bestiaryExportModeDesc'))
      .addDropdown((dropdown) => {
        dropdown
          .addOption('used', t('exportImport.bestiaryModeUsed'))
          .addOption('selected', t('exportImport.bestiaryModeSelected'))
          .addOption('all', t('exportImport.bestiaryModeAll'))
          .addOption('none', t('exportImport.bestiaryModeNone'))
          .setValue(this.options.bestiaryMode)
          .onChange((v: any) => {
            this.options.bestiaryMode = v;
            updatePacksVisibility(v);
          });
      });

    updatePacksVisibility(this.options.bestiaryMode);

    // Botones de acción
    const actionSetting = new Setting(contentEl);
    actionSetting.addButton((btn) => {
      btn.setButtonText(t('common.cancel')).onClick(() => this.close());
    });

    actionSetting.addButton((btn) => {
      btn
        .setButtonText(t('exportImport.exportButton'))
        .setCta()
        .onClick(async () => {
          btn.setDisabled(true);
          btn.setButtonText(t('exportImport.exporting'));
          try {
            await exportCampaignToFile(this.plugin, this.campaignId, this.options);
            this.close();
          } catch (err) {
            console.error('[DinoVTT] Error exporting campaign:', err);
            new Notice(t('exportImport.exportError', { error: String(err) }));
            btn.setDisabled(false);
            btn.setButtonText(t('exportImport.exportButton'));
          }
        });
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
