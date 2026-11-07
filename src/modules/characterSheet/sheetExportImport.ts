import { App, Notice, TFile } from 'obsidian';
import JSZip from 'jszip';
import { DinoPlugin, DinoSettings } from '../../types';
import { SheetTemplate } from './types';
import { genId } from '../../utils';
import { ensureFolder, sanitizeFileName } from '../campaignExportImport';
import { SheetPackageManifest } from './ExportSheetPackageModal';

/**
 * Importa una plantilla de hoja de personaje desde un búfer .dinovtt o .json
 */
export async function importSheetFromBuffer(
  app: App,
  plugin: DinoPlugin,
  dataBuffer: ArrayBuffer
): Promise<SheetTemplate> {
  let template: SheetTemplate | null = null;
  let manifest: SheetPackageManifest | null = null;
  let zip: JSZip | null = null;

  // 1. Intentar cargar como ZIP (.dinovtt)
  try {
    zip = await JSZip.loadAsync(dataBuffer);
    const sheetFile = zip.file('sheet.json') || zip.file('template.json');
    if (sheetFile) {
      const sheetStr = await sheetFile.async('string');
      template = JSON.parse(sheetStr) as SheetTemplate;
    }

    const manifestFile = zip.file('manifest.json');
    if (manifestFile) {
      const manifestStr = await manifestFile.async('string');
      manifest = JSON.parse(manifestStr) as SheetPackageManifest;
    }
  } catch {
    // Si no es un ZIP, intentar parsear como JSON directo
    try {
      const textDecoder = new TextDecoder('utf-8');
      const text = textDecoder.decode(dataBuffer);
      template = JSON.parse(text) as SheetTemplate;
    } catch (e) {
      throw new Error('El archivo no es un paquete .dinovtt ni un JSON válido.');
    }
  }

  if (!template || !template.name || !Array.isArray(template.widgets)) {
    throw new Error('El archivo no contiene una estructura de plantilla de hoja válida.');
  }

  // 2. Extraer assets asociados si vienen dentro del .dinovtt
  if (zip) {
    const safeName = sanitizeFileName(template.name) || 'plantilla';
    const assetsFolder = `DTE/Sheets/Assets/${safeName}`;
    await ensureFolder(app, assetsFolder);

    const assetFiles = Object.keys(zip.files).filter(p => p.startsWith('assets/') && !zip!.files[p].dir);

    if (assetFiles.length > 0) {
      const zipToVaultMap: Record<string, string> = {};

      for (const assetPath of assetFiles) {
        const file = zip.file(assetPath);
        if (file) {
          const fileName = assetPath.split('/').pop() || 'image.png';
          const newVaultPath = `${assetsFolder}/${fileName}`;
          const binData = await file.async('arraybuffer');

          const existing = app.vault.getAbstractFileByPath(newVaultPath);
          if (existing instanceof TFile) {
            await app.vault.modifyBinary(existing, binData);
          } else {
            await app.vault.createBinary(newVaultPath, binData);
          }
          zipToVaultMap[assetPath] = newVaultPath;
        }
      }

      // Remapear ruta del fondo
      if (template.background && template.background.path) {
        if (zipToVaultMap[template.background.path]) {
          template.background.path = zipToVaultMap[template.background.path];
        }
      }

      // Remapear imágenes de widgets
      for (const w of template.widgets) {
        if (w.type === 'image' && w.imagePath && zipToVaultMap[w.imagePath]) {
          w.imagePath = zipToVaultMap[w.imagePath];
        }
      }
    }
  }

  // 3. Asignar nuevo ID para evitar colisiones
  template.id = genId();

  // 4. Guardar en los settings del plugin
  const s = plugin.settings as DinoSettings;
  if (!s.sheetTemplates) s.sheetTemplates = [];
  s.sheetTemplates.push(template);
  await plugin.saveSettings();

  return template;
}
