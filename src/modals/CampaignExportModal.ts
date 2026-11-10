import { App, Modal, Setting, Notice } from 'obsidian';
import JSZip from 'jszip';
import { CampaignData, DinoPlugin } from '../types';
import {
  exportCampaignToFile,
  buildCampaignPackageBlob,
  slugify,
  CampaignExportOptions,
} from '../modules/campaignExportImport';
import { t } from '../i18n';

interface InstalledPluginInfo {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
}

export class CampaignExportModal extends Modal {
  plugin: DinoPlugin;
  campaignId: string;
  campaign: CampaignData;
  availablePacks: string[];
  installedPlugins: InstalledPluginInfo[] = [];

  // Opciones de exportación de contenido
  options: CampaignExportOptions = {
    includeImages: true,
    optimizeImages: true,
    includeNotes: true,
    includeDiary: true,
    includeTableNotes: true,
    bestiaryMode: 'used',
    selectedPacks: [],
    selectedPlugins: [],
  };

  private selectedPlugins: string[] = [];

  // Metadatos para el paquete de la tienda
  private pkgId = '';
  private pkgVersion = '1.0.0';
  private pkgAuthor = '';
  private pkgLicense = 'CC-BY-4.0';
  private pkgLanguage = 'es';
  private pkgDesc = '';
  private pkgTags = 'campana, aventura, rol';

  private isExporting = false;

  constructor(app: App, plugin: DinoPlugin, campaignId: string) {
    super(app);
    this.plugin = plugin;
    this.campaignId = campaignId;
    this.campaign = plugin.settings.campaigns[campaignId];

    // Inicializar metadatos de tienda
    this.pkgId = slugify(this.campaign.name || 'campana');
    this.pkgAuthor = (plugin.manifest && plugin.manifest.author) || 'Comunidad';
    this.pkgDesc = (this.campaign as any).description || '';

    // Obtener todos los paquetes del bestiario únicos
    const packSet = new Set<string>(plugin.settings.bestiaryPacks || []);
    for (const b of Object.values(plugin.settings.bestiary || {})) {
      if (b.pack) packSet.add(b.pack);
    }
    this.availablePacks = Array.from(packSet).sort();

    // Obtener plugins comunitarios de Obsidian instalados (excluyendo a este plugin)
    const pluginsObj = (this.app as any).plugins;
    const manifests = (pluginsObj?.manifests || {}) as Record<string, { id?: string; name?: string; version?: string }>;
    const enabledSet = (pluginsObj?.enabledPlugins instanceof Set)
      ? pluginsObj.enabledPlugins
      : new Set<string>();

    this.installedPlugins = Object.values(manifests)
      .filter((m) => m && m.id && m.id !== plugin.manifest.id)
      .map((m) => ({
        id: m.id!,
        name: m.name || m.id!,
        version: m.version || '',
        enabled: enabledSet.has(m.id!),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
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

    // 1b. Optimizar y comprimir imágenes (WebP)
    new Setting(contentEl)
      .setName(t('exportImport.optimizeImages'))
      .setDesc(t('exportImport.optimizeImagesDesc'))
      .addToggle((toggle) => {
        toggle.setValue(this.options.optimizeImages !== false).onChange((v) => {
          this.options.optimizeImages = v;
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

    // 4. Incluir notas de tablas de esta campaña
    new Setting(contentEl)
      .setName(t('exportImport.includeTableNotes'))
      .setDesc(t('exportImport.includeTableNotesDesc'))
      .addToggle((toggle) => {
        toggle.setValue(this.options.includeTableNotes).onChange((v) => {
          this.options.includeTableNotes = v;
        });
      });

    // 5. Modo de exportación de Bestiario
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
          .onChange((v: string) => {
            this.options.bestiaryMode = v as CampaignExportOptions['bestiaryMode'];
            updatePacksVisibility(this.options.bestiaryMode);
          });
      });

    updatePacksVisibility(this.options.bestiaryMode);

    // ── 6. Plugins comunitarios de Obsidian requeridos / compatibles ──
    const pluginsSection = contentEl.createDiv({ cls: 'dte-export-plugins-section' });
    pluginsSection.style.marginTop = '16px';
    pluginsSection.createEl('h3', { text: `🔌 ${t('exportImport.compatiblePluginsSection')}` });
    pluginsSection.createEl('p', {
      cls: 'dte-hint',
      text: t('exportImport.compatiblePluginsDesc'),
    });

    if (this.installedPlugins.length === 0) {
      pluginsSection.createEl('span', {
        cls: 'dte-empty-hint',
        text: t('exportImport.noPluginsInstalled'),
      });
    } else {
      const pluginList = pluginsSection.createDiv({ cls: 'dte-export-plugin-list' });
      pluginList.style.maxHeight = '140px';
      pluginList.style.overflowY = 'auto';
      pluginList.style.border = '1px solid var(--background-modifier-border)';
      pluginList.style.borderRadius = '6px';
      pluginList.style.padding = '8px 12px';
      pluginList.style.backgroundColor = 'var(--background-secondary)';

      for (const p of this.installedPlugins) {
        const row = pluginList.createDiv({ cls: 'dte-export-pack-row' });
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.gap = '8px';
        row.style.padding = '4px 0';

        const checkbox = row.createEl('input', { type: 'checkbox' });
        checkbox.checked = this.selectedPlugins.includes(p.id);
        checkbox.addEventListener('change', () => {
          if (checkbox.checked) {
            if (!this.selectedPlugins.includes(p.id)) {
              this.selectedPlugins.push(p.id);
            }
          } else {
            this.selectedPlugins = this.selectedPlugins.filter((id) => id !== p.id);
          }
          this.options.selectedPlugins = this.selectedPlugins;
        });

        const label = row.createEl('label', { text: `${p.name} (${p.id})` });
        label.style.cursor = 'pointer';
        label.style.fontSize = '12px';
        if (p.version) {
          const vSpan = row.createSpan({ text: `v${p.version}`, cls: 'dte-text-muted' });
          vSpan.style.fontSize = '11px';
          vSpan.style.marginLeft = 'auto';
        }
      }
    }

    // ── 7. Metadatos de la Tienda Comunitaria (Desplegable) ──
    const details = contentEl.createEl('details', { cls: 'dte-store-export-details' });
    details.style.margin = '16px 0';
    details.style.padding = '12px 14px';
    details.style.border = '1px solid var(--background-modifier-border)';
    details.style.borderRadius = '8px';
    details.style.backgroundColor = 'var(--background-secondary)';

    const summary = details.createEl('summary');
    summary.style.cursor = 'pointer';
    summary.style.fontWeight = 'bold';
    summary.style.fontSize = '13px';
    summary.setText(`📦 ${t('exportImport.storeMetadataSection')} (GitHub PR)`);

    const storeForm = details.createDiv({ cls: 'dte-store-form' });
    storeForm.style.marginTop = '12px';

    new Setting(storeForm)
      .setName(t('exportImport.pkgIdLabel'))
      .setDesc('ID único en minúsculas y sin espacios (ej: sombras-de-korkith)')
      .addText((txt) => {
        txt.setValue(this.pkgId).onChange((v) => {
          this.pkgId = slugify(v);
        });
      });

    new Setting(storeForm)
      .setName(t('exportImport.pkgAuthorLabel'))
      .addText((txt) => {
        txt.setValue(this.pkgAuthor).onChange((v) => {
          this.pkgAuthor = v;
        });
      });

    new Setting(storeForm)
      .setName(t('exportImport.pkgVersionLabel'))
      .addText((txt) => {
        txt.setValue(this.pkgVersion).onChange((v) => {
          this.pkgVersion = v;
        });
      });

    new Setting(storeForm)
      .setName(t('exportImport.pkgLicenseLabel'))
      .addText((txt) => {
        txt.setValue(this.pkgLicense).onChange((v) => {
          this.pkgLicense = v;
        });
      });

    new Setting(storeForm)
      .setName(t('exportImport.pkgLanguageLabel'))
      .addText((txt) => {
        txt.setValue(this.pkgLanguage).onChange((v) => {
          this.pkgLanguage = v;
        });
      });

    new Setting(storeForm)
      .setName(t('exportImport.pkgDescLabel'))
      .addTextArea((ta) => {
        ta.setValue(this.pkgDesc).onChange((v) => {
          this.pkgDesc = v;
        });
        ta.inputEl.rows = 2;
        ta.setPlaceholder('Breve resumen de la campaña o aventura...');
      });

    new Setting(storeForm)
      .setName(t('exportImport.pkgTagsLabel'))
      .addText((txt) => {
        txt.setValue(this.pkgTags).onChange((v) => {
          this.pkgTags = v;
        });
      });

    // ── Botones de acción ──
    const actionSetting = new Setting(contentEl);
    actionSetting.addButton((btn) => {
      btn.setButtonText(t('common.cancel')).onClick(() => this.close());
    });

    // Botón estándar: Exportar .dinovtt suelto
    actionSetting.addButton((btn) => {
      btn
        .setButtonText(t('exportImport.exportButton'))
        .setCta()
        .onClick(async () => {
          if (this.isExporting) return;
          this.isExporting = true;
          btn.setDisabled(true);
          btn.setButtonText(t('exportImport.exporting'));
          try {
            this.options.selectedPlugins = this.selectedPlugins;
            await exportCampaignToFile(this.plugin, this.campaignId, this.options);
            this.close();
          } catch (err) {
            console.error('[DinoVTT] Error exporting campaign:', err);
            new Notice(t('exportImport.exportError', { error: String(err) }));
            btn.setDisabled(false);
            btn.setButtonText(t('exportImport.exportButton'));
          } finally {
            this.isExporting = false;
          }
        });
    });

    // Botón tienda: Generar ZIP completo con manifest y README para PR
    actionSetting.addButton((btn) => {
      btn
        .setButtonText(t('exportImport.exportStoreZipButton'))
        .setTooltip(t('exportImport.exportStoreZipDesc'))
        .onClick(async () => {
          if (this.isExporting) return;
          await this.exportFullStoreZip(btn);
        });
    });

    // Botón formulario directo: Descarga ZIP y abre Google Forms
    actionSetting.addButton((btn) => {
      btn
        .setButtonText(t('exportImport.submitViaFormBtn'))
        .setTooltip(t('exportImport.submitViaFormDesc'))
        .onClick(async () => {
          if (this.isExporting) return;
          await this.exportAndOpenForm(btn);
        });
    });
  }

  /**
   * Genera el archivo ZIP del paquete de la tienda (<pkgId>-store-package.zip)
   * que contiene: <pkgId>/<pkgId>.dinovtt + package.json + README.md
   */
  private async exportFullStoreZip(btn: any): Promise<string | null> {
    this.isExporting = true;
    btn.setDisabled(true);
    btn.setButtonText(t('exportImport.exporting'));

    try {
      this.options.selectedPlugins = this.selectedPlugins;

      const { buffer, sha256, size, detectedModules } = await buildCampaignPackageBlob(
        this.plugin,
        this.campaignId,
        this.options
      );

      const pkgId = this.pkgId || slugify(this.campaign.name || 'campana');
      const dinovttName = `${pkgId}.dinovtt`;

      const tagsArray = this.pkgTags
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length > 0);

      const selectedPluginDetails = this.selectedPlugins.map((id) => {
        const found = this.installedPlugins.find((p) => p.id === id);
        return found ? { id: found.id, name: found.name, version: found.version } : { id, name: id, version: '' };
      });

      const storePackageJson = {
        id: pkgId,
        type: 'campaign',
        name: this.campaign.name,
        version: this.pkgVersion || '1.0.0',
        author: this.pkgAuthor || 'Comunidad',
        license: this.pkgLicense || 'CC-BY-4.0',
        description: this.pkgDesc || '',
        tags: tagsArray,
        language: this.pkgLanguage || 'es',
        dteMinVersion: '0.1.11',
        requiresModules: detectedModules,
        requiresPlugins: this.selectedPlugins,
        file: dinovttName,
        preview: 'preview.png',
        readme: 'README.md',
        size,
        sha256,
        purchaseUrl: null,
      };

      const moduleList = detectedModules.map((m) => `- \`${m}\``).join('\n');
      let pluginsMarkdown = '';
      if (selectedPluginDetails.length > 0) {
        pluginsMarkdown = `\n\n## Plugins de Obsidian recomendados / compatibles\nEsta campaña fue diseñada y testeada junto a los siguientes plugins comunitarios de Obsidian:\n${selectedPluginDetails
          .map((p) => `- **${p.name}** (\`${p.id}\`)${p.version ? ` v${p.version}` : ''}`)
          .join('\n')}\n`;
      }

      const readmeMd = `# ${this.campaign.name}\n\n${
        this.pkgDesc || 'Campaña para Dino Tabletop Engine (Obsidian VTT).'
      }\n\n## Autor\n${this.pkgAuthor || 'Comunidad'}\n\n## Licencia\n${
        this.pkgLicense || 'CC-BY-4.0'
      }\n\n## Módulos requeridos de DTE\n${moduleList}${pluginsMarkdown}\n`;

      const prZip = new JSZip();
      const folder = prZip.folder(pkgId) || prZip;
      folder.file(dinovttName, buffer);
      folder.file('package.json', JSON.stringify(storePackageJson, null, 2) + '\n');
      folder.file('README.md', readmeMd);

      const prBuffer = await prZip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      const downloadName = `${pkgId}-store-package.zip`;

      const url = URL.createObjectURL(prBuffer);
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      new Notice(t('exportImport.storeExportSuccess', { file: downloadName }), 6000);
      this.close();
      return downloadName;
    } catch (e) {
      console.error('[DinoVTT] Error generando paquete de tienda para campaña:', e);
      new Notice(t('exportImport.exportError', { error: String(e) }), 6000);
      btn.setDisabled(false);
      btn.setButtonText(t('exportImport.exportStoreZipButton'));
      return null;
    } finally {
      this.isExporting = false;
    }
  }

  /**
   * Genera el paquete de la tienda, dispara la descarga y abre el formulario web en el navegador
   */
  private async exportAndOpenForm(btn: any): Promise<void> {
    const fileName = await this.exportFullStoreZip(btn);
    if (!fileName) return;

    const submitUrl = (this.plugin.settings as any)?.store?.submitFormUrl || 'https://forms.gle/QafjhDjpHxTYrahw8';
    window.open(submitUrl, '_blank');
    new Notice(t('exportImport.submitFormOpened', { file: fileName }), 8000);
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
