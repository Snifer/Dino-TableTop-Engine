import { App, Notice, requestUrl } from 'obsidian';
import JSZip from 'jszip';
import { DinoPlugin, DinoSettings } from '../../types';
import { StoreCatalog, StoreInstalledReceipt, StorePackage, StoreSettings, DEFAULT_STORE_SETTINGS } from './types';
import { ensureFolder, importCampaignFromBuffer, sanitizeFileName } from '../campaignExportImport';
import { SheetTemplate } from '../characterSheet/types';

/**
 * Asegura que la configuración de la tienda esté inicializada
 */
export function ensureStoreSettings(plugin: DinoPlugin): StoreSettings {
  const s = plugin.settings as DinoSettings;
  if (!s.store) {
    s.store = JSON.parse(JSON.stringify(DEFAULT_STORE_SETTINGS));
  }
  if (!s.store.sources || s.store.sources.length === 0) {
    s.store.sources = JSON.parse(JSON.stringify(DEFAULT_STORE_SETTINGS.sources));
  }
  if (!s.store.installed) {
    s.store.installed = {};
  }
  if (!s.store.installFolder) {
    s.store.installFolder = 'DTE/Store';
  }
  if (!s.store.submitFormUrl) {
    s.store.submitFormUrl = DEFAULT_STORE_SETTINGS.submitFormUrl;
  }
  return s.store;
}

/**
 * Calcula el hash SHA-256 de un ArrayBuffer utilizando la Web Crypto API nativa
 */
export async function computeSha256(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Resuelve una URL relativa a la URL base del catálogo
 */
function resolveUrl(relativeOrAbsolute: string, baseUrl: string): string {
  if (/^https?:\/\//i.test(relativeOrAbsolute)) {
    return relativeOrAbsolute;
  }
  const cleanBase = baseUrl.replace(/\/[^/]*$/, '/');
  const cleanRelative = relativeOrAbsolute.replace(/^\.?\//, '');
  return `${cleanBase}${cleanRelative}`;
}

/**
 * Obtiene y agrega paquetes de todas las fuentes habilitadas
 */
export async function fetchAllCatalogs(
  plugin: DinoPlugin
): Promise<{ packages: StorePackage[]; errors: string[] }> {
  const settings = ensureStoreSettings(plugin);
  const packages: StorePackage[] = [];
  const errors: string[] = [];

  for (const source of settings.sources) {
    if (!source.enabled) continue;

    try {
      const response = await requestUrl({
        url: source.url,
        headers: { 'Cache-Control': 'no-cache' },
      });

      if (response.status !== 200) {
        errors.push(`${source.name}: HTTP ${response.status}`);
        continue;
      }

      const catalog = response.json as StoreCatalog;
      if (!catalog || !Array.isArray(catalog.packages)) {
        errors.push(`${source.name}: Formato de catálogo inválido`);
        continue;
      }

      for (const rawPkg of catalog.packages) {
        // Resolver URLs relativas respecto a la fuente
        const pkg: StorePackage = {
          ...rawPkg,
          sourceId: source.id,
          sourceBaseUrl: source.url,
          downloadUrl: resolveUrl(rawPkg.downloadUrl, source.url),
          previewUrl: rawPkg.previewUrl ? resolveUrl(rawPkg.previewUrl, source.url) : null,
          readmeUrl: rawPkg.readmeUrl ? resolveUrl(rawPkg.readmeUrl, source.url) : null,
          manifestUrl: rawPkg.manifestUrl ? resolveUrl(rawPkg.manifestUrl, source.url) : null,
        };

        // Evitar duplicados por id (la primera fuente habilitada tiene precedencia)
        if (!packages.some(p => p.id === pkg.id)) {
          packages.push(pkg);
        }
      }
    } catch (err) {
      console.error(`[DTE Store] Error al obtener catálogo de ${source.name}:`, err);
      errors.push(`${source.name}: No se pudo conectar (${String(err)})`);
    }
  }

  // Ordenar alfabéticamente por nombre
  packages.sort((a, b) => a.name.localeCompare(b.name));
  return { packages, errors };
}

/**
 * Descarga el README en Markdown de un paquete
 */
export async function fetchPackageReadme(pkg: StorePackage): Promise<string | null> {
  if (!pkg.readmeUrl) return null;
  try {
    const res = await requestUrl({ url: pkg.readmeUrl });
    if (res.status === 200) {
      return res.text;
    }
  } catch (err) {
    console.warn(`[DTE Store] No se pudo descargar el README de ${pkg.id}:`, err);
  }
  return null;
}

/**
 * Descarga, verifica e instala un paquete .dinovtt en el Vault
 */
export async function installPackage(
  plugin: DinoPlugin,
  pkg: StorePackage,
  onProgress?: (message: string) => void
): Promise<StoreInstalledReceipt> {
  const storeSettings = ensureStoreSettings(plugin);
  onProgress?.(`Descargando ${pkg.name}...`);

  const response = await requestUrl({
    url: pkg.downloadUrl,
    headers: { 'Cache-Control': 'no-cache' },
  });

  if (response.status !== 200 || !response.arrayBuffer) {
    throw new Error(`Error en descarga: HTTP ${response.status}`);
  }

  const dataBuffer = response.arrayBuffer;

  // 1. Verificación de integridad SHA-256
  if (pkg.sha256) {
    onProgress?.('Verificando integridad criptográfica SHA-256...');
    const computedHash = await computeSha256(dataBuffer);
    if (computedHash.toLowerCase() !== pkg.sha256.toLowerCase()) {
      throw new Error(`Fallo de integridad: SHA-256 no coincide.\nEsperado: ${pkg.sha256}\nCalculado: ${computedHash}`);
    }
  }

  onProgress?.('Procesando paquete .dinovtt...');
  const zip = await JSZip.loadAsync(dataBuffer);

  let installedCampaignId: string | undefined;
  let installedTemplateId: string | undefined;
  let targetPath = `${storeSettings.installFolder}/${sanitizeFileName(pkg.name)}`;

  // 2. Extracción según el tipo de paquete
  if (pkg.type === 'campaign') {
    onProgress?.('Importando campaña táctica...');
    installedCampaignId = await importCampaignFromBuffer(plugin, dataBuffer, targetPath);
  } else if (pkg.type === 'sheet') {
    onProgress?.('Registrando plantilla de hoja de personaje...');
    // Buscar archivo de plantilla en el zip
    const templateFile = zip.file('sheet.json') || zip.file('template.json');
    if (templateFile) {
      const templateStr = await templateFile.async('string');
      const templateData = JSON.parse(templateStr) as SheetTemplate;
      installedTemplateId = templateData.id;
      const s = plugin.settings as DinoSettings;
      if (!s.sheetTemplates) s.sheetTemplates = [];
      const idx = s.sheetTemplates.findIndex(t => t.id === templateData.id);
      if (idx !== -1) {
        s.sheetTemplates[idx] = templateData;
      } else {
        s.sheetTemplates.push(templateData);
      }
    }
  } else if (pkg.type === 'tables') {
    onProgress?.('Extrayendo tablas aleatorias al Vault...');
    const tablesFolder = `${storeSettings.installFolder}/Tablas/${sanitizeFileName(pkg.name)}`;
    await ensureFolder(plugin.app, tablesFolder);
    targetPath = tablesFolder;

    for (const relativePath in zip.files) {
      const file = zip.files[relativePath];
      if (!file.dir && relativePath.endsWith('.md')) {
        const content = await file.async('string');
        const fileName = relativePath.split('/').pop() || 'tabla.md';
        const filePath = `${tablesFolder}/${fileName}`;
        const existing = plugin.app.vault.getAbstractFileByPath(filePath);
        if (existing) {
          await plugin.app.vault.modify(existing as any, content);
        } else {
          await plugin.app.vault.create(filePath, content);
        }
      }
    }
  } else {
    // Instalación genérica (extrae notas y assets en la carpeta del paquete)
    onProgress?.('Descomprimiendo archivos en el Vault...');
    await ensureFolder(plugin.app, targetPath);

    for (const relativePath in zip.files) {
      const file = zip.files[relativePath];
      if (!file.dir) {
        const subPath = `${targetPath}/${relativePath}`;
        const dirPath = subPath.replace(/\/[^/]*$/, '');
        await ensureFolder(plugin.app, dirPath);

        const data = await file.async('arraybuffer');
        const existing = plugin.app.vault.getAbstractFileByPath(subPath);
        if (existing) {
          await plugin.app.vault.modifyBinary(existing as any, data);
        } else {
          await plugin.app.vault.createBinary(subPath, data);
        }
      }
    }
  }

  // 3. Crear recibo de instalación
  const receipt: StoreInstalledReceipt = {
    packageId: pkg.id,
    name: pkg.name,
    type: pkg.type,
    version: pkg.version,
    sourceId: pkg.sourceId || 'official',
    installedAt: new Date().toISOString(),
    sha256: pkg.sha256,
    installedPath: targetPath,
    campaignId: installedCampaignId,
    templateId: installedTemplateId,
  };

  storeSettings.installed[pkg.id] = receipt;
  await plugin.saveSettings();

  onProgress?.('¡Instalación completada!');
  return receipt;
}

/**
 * Desinstala un paquete y actualiza settings
 */
export async function uninstallPackage(plugin: DinoPlugin, packageId: string): Promise<void> {
  const storeSettings = ensureStoreSettings(plugin);
  const receipt = storeSettings.installed[packageId];
  if (!receipt) return;

  // Si tiene campaña asociada, eliminarla
  const s = plugin.settings as DinoSettings;
  if (receipt.campaignId && s.campaigns && s.campaigns[receipt.campaignId]) {
    delete s.campaigns[receipt.campaignId];
    if (s.currentCampaignId === receipt.campaignId) {
      s.currentCampaignId = null;
    }
  }

  // Si es plantilla de hoja de personaje, desregistrarla
  if (receipt.type === 'sheet' && s.sheetTemplates) {
    s.sheetTemplates = s.sheetTemplates.filter(
      (t) => t.id !== receipt.packageId && (!receipt.templateId || t.id !== receipt.templateId)
    );
  }

  // Si tiene carpeta en el vault, podemos intentar removerla
  if (receipt.installedPath) {
    const folder = plugin.app.vault.getAbstractFileByPath(receipt.installedPath);
    if (folder) {
      try {
        await plugin.app.vault.trash(folder, true);
      } catch (e) {
        console.warn(`[DTE Store] No se pudo enviar a la papelera ${receipt.installedPath}:`, e);
      }
    }
  }

  delete storeSettings.installed[packageId];
  await plugin.saveSettings();
  new Notice(`Paquete desinstalado: ${receipt.name}`, 3000);
}

