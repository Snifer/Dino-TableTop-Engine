import { App, Modal, Notice, setIcon, TFile } from 'obsidian';
import JSZip from 'jszip';
import { DinoPlugin } from '../../types';
import { SheetTemplate } from './types';
import { sanitizeFileName } from '../campaignExportImport';
import { computeSha256 } from '../store/storeClient';

export interface SheetPackageManifest {
  schema: number;
  id: string;
  type: 'sheet';
  name: string;
  version: string;
  author: string;
  license: string;
  description: string;
  tags: string[];
  language: string;
  dteMinVersion: string;
  requiresModules: string[];
  exportedAt: string;
  assetMap: Record<string, string>; // originalPath -> assets/<name>
}

export class ExportSheetPackageModal extends Modal {
  private plugin: DinoPlugin;
  private template: SheetTemplate;

  private pkgId = '';
  private pkgName = '';
  private pkgVersion = '1.0.0';
  private pkgAuthor = '';
  private pkgLicense = 'CC-BY-4.0';
  private pkgDesc = '';
  private pkgTags = 'ficha, personaje, plantilla';
  private pkgLanguage = 'es';
  private includeAssets = true;
  private isExporting = false;

  constructor(app: App, plugin: DinoPlugin, template: SheetTemplate) {
    super(app);
    this.plugin = plugin;
    this.template = template;

    this.pkgName = template.name;
    this.pkgId = this.slugify(template.name || 'ficha');
    this.pkgAuthor = (plugin.manifest && plugin.manifest.author) || 'Comunidad';
  }

  onOpen(): void {
    this.modalEl.addClass('dte-export-modal');
    this.modalEl.style.width = '640px';
    this.modalEl.style.maxWidth = '95vw';
    this.render();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private render(): void {
    this.contentEl.empty();

    // ── Header ──
    const header = this.contentEl.createDiv({ cls: 'dte-modal-header' });
    const titleWrap = header.createDiv({ cls: 'dte-modal-title-wrap' });
    const icon = titleWrap.createSpan({ cls: 'dte-modal-icon' });
    setIcon(icon, 'package');
    titleWrap.createEl('h2', { text: `Exportar Hoja: ${this.template.name}` });

    this.contentEl.createEl('p', {
      cls: 'dte-text-muted',
      text: 'Empaqueta esta plantilla en un archivo .dinovtt listo para compartir o subir a la Tienda Comunitaria.',
    });

    // ── Formulario ──
    const form = this.contentEl.createDiv({ cls: 'dte-export-form' });

    // ID del paquete
    this.createField(form, 'ID único del paquete (slug)', (input) => {
      input.value = this.pkgId;
      input.addEventListener('input', () => {
        this.pkgId = this.slugify(input.value);
      });
    }, 'Solo letras minúsculas, números y guiones. Ej: ficha-aventurero-5e');

    // Nombre
    this.createField(form, 'Nombre visible', (input) => {
      input.value = this.pkgName;
      input.addEventListener('input', () => {
        this.pkgName = input.value;
      });
    });

    // Versión y Autor en 2 columnas
    const row1 = form.createDiv({ cls: 'dte-form-row-2col' });
    this.createField(row1, 'Versión', (input) => {
      input.value = this.pkgVersion;
      input.addEventListener('input', () => {
        this.pkgVersion = input.value;
      });
    }, 'Ej: 1.0.0');

    this.createField(row1, 'Autor', (input) => {
      input.value = this.pkgAuthor;
      input.addEventListener('input', () => {
        this.pkgAuthor = input.value;
      });
    });

    // Licencia e Idioma en 2 columnas
    const row2 = form.createDiv({ cls: 'dte-form-row-2col' });
    this.createField(row2, 'Licencia', (input) => {
      input.value = this.pkgLicense;
      input.addEventListener('input', () => {
        this.pkgLicense = input.value;
      });
    }, 'Ej: CC-BY-4.0, MIT, CC0');

    this.createField(row2, 'Idioma', (input) => {
      input.value = this.pkgLanguage;
      input.addEventListener('input', () => {
        this.pkgLanguage = input.value;
      });
    }, 'Código ISO (ej. es, en)');

    // Descripción
    this.createTextAreaField(form, 'Descripción del paquete', (textarea) => {
      textarea.value = this.pkgDesc;
      textarea.placeholder = 'Resumen de qué sistema o tipo de juego cubre esta plantilla...';
      textarea.rows = 3;
      textarea.addEventListener('input', () => {
        this.pkgDesc = textarea.value;
      });
    });

    // Etiquetas
    this.createField(form, 'Etiquetas (separadas por coma)', (input) => {
      input.value = this.pkgTags;
      input.addEventListener('input', () => {
        this.pkgTags = input.value;
      });
    }, 'Ej: dnd, fantasia, oscura, basica');

    // Checkbox incluir imágenes
    const checkWrap = form.createDiv({ cls: 'dte-checkbox-row' });
    const check = checkWrap.createEl('input', { type: 'checkbox' });
    check.checked = this.includeAssets;
    check.id = 'dte-check-assets';
    check.addEventListener('change', () => {
      this.includeAssets = check.checked;
    });
    const label = checkWrap.createEl('label', { text: 'Empaquetar imágenes asociadas (fondo y widgets) en el paquete' });
    label.htmlFor = 'dte-check-assets';

    // ── Botones de Acción ──
    const actions = this.contentEl.createDiv({ cls: 'dte-export-actions' });
    actions.style.display = 'flex';
    actions.style.gap = '10px';
    actions.style.marginTop = '20px';
    actions.style.justifyContent = 'flex-end';

    const cancelBtn = actions.createEl('button', { cls: 'dte-btn', text: 'Cancelar' });
    cancelBtn.addEventListener('click', () => this.close());

    const downloadDinovttBtn = actions.createEl('button', {
      cls: 'mod-cta dte-btn',
      text: this.isExporting ? 'Generando...' : 'Descargar paquete (.dinovtt)',
    });
    downloadDinovttBtn.disabled = this.isExporting;
    downloadDinovttBtn.addEventListener('click', async () => {
      await this.exportDinovttPackage();
    });

    const downloadFullStoreZipBtn = actions.createEl('button', {
      cls: 'dte-btn dte-btn-secondary',
      text: '📦 Paquete completo para GitHub PR',
      title: 'Descarga un .zip con el .dinovtt + package.json + README.md listo para subir a store/packages/',
    });
    downloadFullStoreZipBtn.addEventListener('click', async () => {
      await this.exportFullStoreZip();
    });
  }

  private createField(
    parent: HTMLElement,
    labelText: string,
    setup: (input: HTMLInputElement) => void,
    hintText?: string
  ): void {
    const wrap = parent.createDiv({ cls: 'dte-field-wrap' });
    wrap.createEl('label', { text: labelText, cls: 'dte-field-label' });
    const input = wrap.createEl('input', { type: 'text', cls: 'dte-input' });
    setup(input);
    if (hintText) {
      wrap.createEl('small', { text: hintText, cls: 'dte-field-hint' });
    }
  }

  private createTextAreaField(
    parent: HTMLElement,
    labelText: string,
    setup: (textarea: HTMLTextAreaElement) => void
  ): void {
    const wrap = parent.createDiv({ cls: 'dte-field-wrap' });
    wrap.createEl('label', { text: labelText, cls: 'dte-field-label' });
    const textarea = wrap.createEl('textarea', { cls: 'dte-input dte-textarea' });
    setup(textarea);
  }

  private slugify(text: string): string {
    return text
      .toString()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Genera el archivo .dinovtt empaquetando la plantilla y assets
   */
  private async buildDinovttBlob(): Promise<{ blob: Blob; buffer: ArrayBuffer; sha256: string; size: number }> {
    const zip = new JSZip();
    const assetMap: Record<string, string> = {};

    // Clonar plantilla para remapear rutas relativas en el zip
    const templateCopy: SheetTemplate = JSON.parse(JSON.stringify(this.template));

    if (this.includeAssets) {
      let assetIndex = 1;

      // 1. Fondo de la plantilla
      if (templateCopy.background && templateCopy.background.path) {
        const origPath = templateCopy.background.path;
        const file = this.app.vault.getAbstractFileByPath(origPath);
        if (file instanceof TFile) {
          const ext = file.extension || 'png';
          const zipName = `assets/background_${assetIndex}.${ext}`;
          const data = await this.app.vault.readBinary(file);
          zip.file(zipName, data);
          assetMap[origPath] = zipName;
          templateCopy.background.path = zipName;
          assetIndex++;
        }
      }

      // 2. Imágenes estáticas en widgets (ej. tipo image)
      for (const w of templateCopy.widgets) {
        if (w.type === 'image' && w.imagePath && !w.imagePath.startsWith('frontmatter:')) {
          const origPath = w.imagePath;
          const file = this.app.vault.getAbstractFileByPath(origPath);
          if (file instanceof TFile) {
            const ext = file.extension || 'png';
            const zipName = `assets/widget_${assetIndex}.${ext}`;
            const data = await this.app.vault.readBinary(file);
            zip.file(zipName, data);
            assetMap[origPath] = zipName;
            w.imagePath = zipName;
            assetIndex++;
          }
        }
      }
    }

    const tagsArray = this.pkgTags
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);

    const manifest: SheetPackageManifest = {
      schema: 1,
      id: this.pkgId || 'sheet-template',
      type: 'sheet',
      name: this.pkgName || this.template.name,
      version: this.pkgVersion || '1.0.0',
      author: this.pkgAuthor || 'Comunidad',
      license: this.pkgLicense || 'CC-BY-4.0',
      description: this.pkgDesc || '',
      tags: tagsArray,
      language: this.pkgLanguage || 'es',
      dteMinVersion: '0.1.11',
      requiresModules: ['character-sheet'],
      exportedAt: new Date().toISOString(),
      assetMap,
    };

    zip.file('manifest.json', JSON.stringify(manifest, null, 2));
    zip.file('sheet.json', JSON.stringify(templateCopy, null, 2));

    const buffer = await zip.generateAsync({
      type: 'arraybuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    const sha256 = await computeSha256(buffer);
    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    return { blob, buffer, sha256, size: buffer.byteLength };
  }

  private async exportDinovttPackage(): Promise<void> {
    this.isExporting = true;
    this.render();

    try {
      const { blob } = await this.buildDinovttBlob();
      const fileName = `${this.pkgId || 'sheet'}.dinovtt`;
      this.triggerDownload(blob, fileName);
      new Notice(`¡Paquete "${fileName}" exportado con éxito!`, 4000);
      this.close();
    } catch (e) {
      console.error('[DTE] Error exportando .dinovtt:', e);
      new Notice(`Error al exportar: ${String(e)}`, 5000);
    } finally {
      this.isExporting = false;
    }
  }

  /**
   * Exporta un ZIP de PR para GitHub que contiene:
   * - <id>.dinovtt
   * - package.json (con sha256 y size calculados)
   * - README.md
   */
  private async exportFullStoreZip(): Promise<void> {
    this.isExporting = true;
    this.render();

    try {
      const { buffer, sha256, size } = await this.buildDinovttBlob();
      const dinovttName = `${this.pkgId}.dinovtt`;

      const tagsArray = this.pkgTags
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length > 0);

      const storePackageJson = {
        id: this.pkgId,
        type: 'sheet',
        name: this.pkgName,
        version: this.pkgVersion,
        author: this.pkgAuthor,
        license: this.pkgLicense,
        description: this.pkgDesc,
        tags: tagsArray,
        language: this.pkgLanguage,
        dteMinVersion: '0.1.11',
        requiresModules: ['character-sheet'],
        file: dinovttName,
        preview: 'preview.png',
        readme: 'README.md',
        size,
        sha256,
        purchaseUrl: null,
      };

      const readmeMd = `# ${this.pkgName}\n\n${this.pkgDesc || 'Plantilla de hoja de personaje para Dino Tabletop Engine.'}\n\n## Autor\n${this.pkgAuthor}\n\n## Licencia\n${this.pkgLicense}\n`;

      const prZip = new JSZip();
      const folder = prZip.folder(this.pkgId) || prZip;
      folder.file(dinovttName, buffer);
      folder.file('package.json', JSON.stringify(storePackageJson, null, 2) + '\n');
      folder.file('README.md', readmeMd);

      const prBuffer = await prZip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      const downloadName = `${this.pkgId}-store-package.zip`;
      this.triggerDownload(prBuffer, downloadName);

      new Notice(`¡Paquete completo "${downloadName}" generado para Pull Request!`, 5000);
      this.close();
    } catch (e) {
      console.error('[DTE] Error generando store package zip:', e);
      new Notice(`Error al generar paquete de tienda: ${String(e)}`, 5000);
    } finally {
      this.isExporting = false;
    }
  }

  private triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
