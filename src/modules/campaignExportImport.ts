import { App, getAllTags, Notice, TFile, TFolder } from 'obsidian';
import JSZip from 'jszip';
import {
  CampaignData,
  BestiaryEntry,
  DeckData,
  TimelineData,
  ClockData,
  DinoPlugin,
  SheetTemplate,
} from '../types';
import { genId } from '../utils';
import { t } from '../i18n';
import { computeSha256 } from './store/storeClient';

export interface CampaignExportOptions {
  includeImages: boolean;
  includeNotes: boolean;
  includeDiary: boolean;
  includeTableNotes: boolean;
  bestiaryMode: 'none' | 'used' | 'selected' | 'all';
  selectedPacks: string[];
  selectedPlugins?: string[];
}

export interface CampaignPackageManifest {
  version: number;
  appName: string;
  exportedAt: string;
  campaignName: string;
  campaign: CampaignData;
  bestiaryEntries?: BestiaryEntry[];
  decks?: Record<string, DeckData>;
  timelines?: Record<string, TimelineData>;
  clocks?: Record<string, ClockData>;
  sheetTemplates?: SheetTemplate[];
  requiresPlugins?: string[];
  assetMap: Record<string, string>; // originalVaultPath -> zipRelativePath
  noteMap: Record<string, string>;  // originalVaultPath -> zipRelativePath
}

/** Helper para sanitizar nombres de archivo o carpeta */
export function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim();
}

/** Helper para convertir cadenas en slugs válidos para paquetes */
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Asegura recursivamente que una carpeta exista en el Vault */
export async function ensureFolder(app: App, folderPath: string): Promise<void> {
  const cleanPath = folderPath.replace(/\/+$/, '').trim();
  if (!cleanPath) return;
  const parts = cleanPath.split('/');
  let current = '';
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    const existing = app.vault.getAbstractFileByPath(current);
    if (!existing) {
      try {
        await app.vault.createFolder(current);
      } catch {
        // Ignorar si ya fue creada por race condition
      }
    }
  }
}

/** Escanea todos los assets y notas usados en la campaña y en el bestiario seleccionado */
export function collectCampaignDependencies(
  campaign: CampaignData,
  plugin: DinoPlugin,
  options: CampaignExportOptions
): {
  imagePaths: Set<string>;
  notePaths: Set<string>;
  bestiaryEntries: BestiaryEntry[];
  sheetTemplates: SheetTemplate[];
} {
  const imagePaths = new Set<string>();
  const notePaths = new Set<string>();
  const bestiaryEntries: BestiaryEntry[] = [];
  const sheetTemplates: SheetTemplate[] = [];

  // 1. Escanear mapas de la campaña
  if (campaign.maps) {
    for (const mapId in campaign.maps) {
      const map = campaign.maps[mapId];
      if (map.imagePath) imagePaths.add(map.imagePath);

      // Dibujo y background
      if (map.drawing) {
        if (map.drawing.backgroundImagePath) imagePaths.add(map.drawing.backgroundImagePath);
        if (map.drawing.images) {
          for (const img of map.drawing.images) {
            if (img.imagePath) imagePaths.add(img.imagePath);
          }
        }
      }

      // Tokens
      if (map.tokens) {
        for (const tok of map.tokens) {
          if (tok.imagePath) imagePaths.add(tok.imagePath);
          if (tok.linkedNote) notePaths.add(tok.linkedNote);
          if (tok.inventory && tok.inventory.items) {
            for (const item of tok.inventory.items) {
              if (item.imagePath) imagePaths.add(item.imagePath);
              if (item.note) notePaths.add(item.note);
            }
          }
        }
      }

      // POIs
      if (map.pois) {
        for (const poi of map.pois) {
          if (poi.imagePath) imagePaths.add(poi.imagePath);
          if (poi.linkedNote) notePaths.add(poi.linkedNote);
        }
      }

      // Combatantes
      if (map.combat && map.combat.combatants) {
        for (const cob of map.combat.combatants) {
          if (cob.imagePath) imagePaths.add(cob.imagePath);
        }
      }

      // Wargame
      if (map.wargame) {
        if (map.wargame.units) {
          for (const u of map.wargame.units) {
            if (u.imagePath) imagePaths.add(u.imagePath);
          }
        }
      }
    }
  }

  // Escanear misiones de la campaña
  if (campaign.missions) {
    for (const missionId in campaign.missions) {
      const mission = campaign.missions[missionId];
      if (mission.linkedNote) notePaths.add(mission.linkedNote);
      if (mission.relatedNotes) {
        for (const notePath of mission.relatedNotes) {
          if (notePath) notePaths.add(notePath);
        }
      }
    }
  }

  // Escanear personajes de campaña (Party)
  if (campaign.characters) {
    for (const charId in campaign.characters) {
      const char = campaign.characters[charId];
      if (char.imagePath) imagePaths.add(char.imagePath);
      if (char.linkedNote) notePaths.add(char.linkedNote);
      if (char.inventory && char.inventory.items) {
        for (const item of char.inventory.items) {
          if (item.imagePath) imagePaths.add(item.imagePath);
          if (item.note) notePaths.add(item.note);
        }
      }
    }
  }

  // 2. Diario de campaña (notas dentro de la carpeta del diario)
  if (options.includeDiary && campaign.diaryFolderPath) {
    const folder = plugin.app.vault.getAbstractFileByPath(campaign.diaryFolderPath);
    if (folder instanceof TFolder) {
      for (const child of folder.children) {
        if (child instanceof TFile && child.extension === 'md') {
          notePaths.add(child.path);
        }
      }
    }
  }

  // 2b. Notas de tablas aleatorias de esta campaña
  if (options.includeTableNotes) {
    const settings = plugin.settings;
    const tagPrefix = (settings.randomTables?.tagPrefix || 'dte-table').toLowerCase().replace(/^#/, '');

    // Find the campaignId for the exported campaign
    let exportedCampaignId: string | null = null;
    for (const [id, c] of Object.entries(settings.campaigns || {})) {
      if (c === campaign) {
        exportedCampaignId = id;
        break;
      }
    }

    if (exportedCampaignId) {
      const campaignTag = `${tagPrefix}/${exportedCampaignId}`;
      for (const file of plugin.app.vault.getMarkdownFiles()) {
        const cache = plugin.app.metadataCache.getFileCache(file);
        if (!cache) continue;

        // Check via tags
        const fileTags = (getAllTags(cache) || []).map((t: string) => t.toLowerCase().replace(/^#/, ''));
        if (fileTags.includes(campaignTag)) {
          notePaths.add(file.path);
          continue;
        }

        // Check via frontmatter dte-campaign
        const fm = cache.frontmatter || {};
        if (
          (fm['dte-table'] === true || fm['dteTable'] === true) &&
          (fm['dte-campaign'] === exportedCampaignId || fm['dteCampaign'] === exportedCampaignId)
        ) {
          notePaths.add(file.path);
        }
      }
    }
  }

  // 3. Bestiario según el modo y paquetes
  const allBestiary = Object.values(plugin.settings.bestiary || {});
  if (options.bestiaryMode === 'all') {
    bestiaryEntries.push(...allBestiary);
  } else if (options.bestiaryMode === 'selected') {
    const packSet = new Set(options.selectedPacks);
    for (const b of allBestiary) {
      if (b.pack && packSet.has(b.pack)) {
        bestiaryEntries.push(b);
      }
    }
  } else if (options.bestiaryMode === 'used') {
    // Buscar criaturas cuyos nombres o notas coincidan con tokens en los mapas
    const usedTokenNames = new Set<string>();
    const usedNotes = new Set<string>();
    if (campaign.maps) {
      for (const mapId in campaign.maps) {
        for (const tok of campaign.maps[mapId].tokens || []) {
          usedTokenNames.add(tok.name.toLowerCase().trim());
          if (tok.linkedNote) usedNotes.add(tok.linkedNote);
        }
      }
    }
    for (const b of allBestiary) {
      if (
        usedTokenNames.has(b.name.toLowerCase().trim()) ||
        (b.linkedNote && usedNotes.has(b.linkedNote))
      ) {
        bestiaryEntries.push(b);
      }
    }
  }

  // Recolectar assets/notas de las criaturas exportadas
  for (const b of bestiaryEntries) {
    if (b.imagePath) imagePaths.add(b.imagePath);
    if (b.linkedNote) notePaths.add(b.linkedNote);
    if (b.inventory && b.inventory.items) {
      for (const item of b.inventory.items) {
        if (item.imagePath) imagePaths.add(item.imagePath);
        if (item.note) notePaths.add(item.note);
      }
    }
  }

  // Recolectar plantillas de hoja usadas por los personajes/tokens
  const propKey = plugin.settings.characterSheets?.property || 'dte-sheet';
  const allTemplates = plugin.settings.sheetTemplates || [];

  for (const notePath of notePaths) {
    const file = plugin.app.vault.getAbstractFileByPath(notePath);
    if (file instanceof TFile) {
      const cache = plugin.app.metadataCache.getFileCache(file);
      const tplNameOrId = cache?.frontmatter?.[propKey];
      if (tplNameOrId) {
        const found = allTemplates.find((t) => t.name === tplNameOrId || t.id === tplNameOrId);
        if (found && !sheetTemplates.some((ut) => ut.id === found.id)) {
          sheetTemplates.push(found);
          if (found.background?.path) imagePaths.add(found.background.path);
          for (const w of found.widgets) {
            if (w.imagePath) imagePaths.add(w.imagePath);
          }
        }
      }
    }
  }

  return { imagePaths, notePaths, bestiaryEntries, sheetTemplates };
}

/**
 * Empaqueta la campaña activa en memoria y calcula metadatos para exportación o tienda
 */
export async function buildCampaignPackageBlob(
  plugin: DinoPlugin,
  campaignId: string,
  options: CampaignExportOptions
): Promise<{
  blob: Blob;
  buffer: ArrayBuffer;
  sha256: string;
  size: number;
  safeCampaignName: string;
  detectedModules: string[];
}> {
  const campaign = plugin.settings.campaigns[campaignId];
  if (!campaign) {
    throw new Error(t('exportImport.campaignNotFound'));
  }

  const { imagePaths, notePaths, bestiaryEntries, sheetTemplates } = collectCampaignDependencies(
    campaign,
    plugin,
    options
  );

  const zip = new JSZip();
  const assetMap: Record<string, string> = {};
  const noteMap: Record<string, string> = {};

  const assetsFolder = zip.folder('assets');
  const notesFolder = zip.folder('notes');

  let assetIndex = 1;
  let noteIndex = 1;

  // Empaquetar imágenes
  if (options.includeImages && assetsFolder) {
    for (const imgPath of imagePaths) {
      const file = plugin.app.vault.getAbstractFileByPath(imgPath);
      if (file instanceof TFile) {
        try {
          const buffer = await plugin.app.vault.readBinary(file);
          const ext = file.extension || 'png';
          const safeName = `asset_${assetIndex++}_${sanitizeFileName(file.basename)}.${ext}`;
          assetsFolder.file(safeName, buffer);
          assetMap[imgPath] = `assets/${safeName}`;
        } catch (e) {
          console.error(`[DinoVTT] Error leyendo asset: ${imgPath}`, e);
        }
      }
    }
  }

  // Empaquetar notas vinculadas
  if (options.includeNotes && notesFolder) {
    for (const notePath of notePaths) {
      const file = plugin.app.vault.getAbstractFileByPath(notePath);
      if (file instanceof TFile) {
        try {
          const content = await plugin.app.vault.read(file);
          const safeName = `note_${noteIndex++}_${sanitizeFileName(file.basename)}.md`;
          notesFolder.file(safeName, content);
          noteMap[notePath] = `notes/${safeName}`;
        } catch (e) {
          console.error(`[DinoVTT] Error leyendo nota: ${notePath}`, e);
        }
      }
    }
  }

  // Manifest del paquete
  const manifest: CampaignPackageManifest = {
    version: 2,
    appName: 'Dino Tabletop Engine',
    exportedAt: new Date().toISOString(),
    campaignName: campaign.name,
    campaign: JSON.parse(JSON.stringify(campaign)) as CampaignData,
    bestiaryEntries: bestiaryEntries.length ? bestiaryEntries : undefined,
    sheetTemplates: sheetTemplates.length ? sheetTemplates : undefined,
    requiresPlugins: options.selectedPlugins?.length ? options.selectedPlugins : undefined,
    assetMap,
    noteMap,
  };

  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  // Generar el archivo .dinovtt (ArrayBuffer y Blob)
  const buffer = await zip.generateAsync({
    type: 'arraybuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const blob = new Blob([buffer], { type: 'application/zip' });
  const sha256 = await computeSha256(buffer);
  const size = buffer.byteLength;
  const safeCampaignName = sanitizeFileName(campaign.name) || 'campaign';

  // Detectar módulos requeridos
  const detectedModules: string[] = ['combat'];
  if (sheetTemplates && sheetTemplates.length > 0) {
    detectedModules.push('character-sheet');
  }
  if (campaign.characters && Object.keys(campaign.characters).length > 0) {
    if (!detectedModules.includes('character-sheet')) detectedModules.push('character-sheet');
    detectedModules.push('persistent-characters');
  }
  if ((campaign.tableHistory && campaign.tableHistory.length > 0) || options.includeTableNotes) {
    detectedModules.push('random-tables');
  }
  if (campaign.oracleHistory && campaign.oracleHistory.length > 0) {
    detectedModules.push('oracles');
  }

  return {
    blob,
    buffer,
    sha256,
    size,
    safeCampaignName,
    detectedModules,
  };
}

/**
 * Exporta la campaña activa empaquetando todo en un archivo .dinovtt
 */
export async function exportCampaignToFile(
  plugin: DinoPlugin,
  campaignId: string,
  options: CampaignExportOptions
): Promise<void> {
  const campaign = plugin.settings.campaigns[campaignId];
  if (!campaign) {
    new Notice(t('exportImport.campaignNotFound'));
    return;
  }

  const { blob, safeCampaignName } = await buildCampaignPackageBlob(plugin, campaignId, options);
  const fileName = `${safeCampaignName}.dinovtt`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  new Notice(t('exportImport.exportSuccess', { name: campaign.name, file: fileName }));
}

/**
 * Importa un paquete .dinovtt y remapea notas, imágenes y criaturas en el Vault
 */
export async function importCampaignFromBuffer(
  plugin: DinoPlugin,
  dataBuffer: ArrayBuffer,
  customTargetFolder?: string
): Promise<string> {
  const zip = await JSZip.loadAsync(dataBuffer);
  const manifestFile = zip.file('manifest.json');
  if (!manifestFile) {
    throw new Error(t('exportImport.invalidPackage'));
  }

  const manifestStr = await manifestFile.async('string');
  const manifest = JSON.parse(manifestStr) as CampaignPackageManifest;

  const campaign = manifest.campaign;
  if (!campaign || !campaign.name) {
    throw new Error(t('exportImport.invalidManifest'));
  }

  const baseFolder = customTargetFolder
    ? customTargetFolder.replace(/\/+$/, '')
    : `DinoVTT/Campaigns/${sanitizeFileName(campaign.name)}`;

  const assetsTargetFolder = `${baseFolder}/assets`;
  const notesTargetFolder = `${baseFolder}/notes`;

  await ensureFolder(plugin.app, baseFolder);
  await ensureFolder(plugin.app, assetsTargetFolder);
  await ensureFolder(plugin.app, notesTargetFolder);

  // Mapas de conversión de rutas: originalVaultPath -> newVaultPath
  const newAssetPaths: Record<string, string> = {};
  const newNotePaths: Record<string, string> = {};

  // 1. Extraer y escribir assets
  if (manifest.assetMap) {
    for (const origPath in manifest.assetMap) {
      const zipPath = manifest.assetMap[origPath];
      const fileInZip = zip.file(zipPath);
      if (fileInZip) {
        const fileData = await fileInZip.async('arraybuffer');
        const fileName = zipPath.split('/').pop() || 'asset.png';
        const targetPath = `${assetsTargetFolder}/${fileName}`;
        
        const existing = plugin.app.vault.getAbstractFileByPath(targetPath);
        if (existing instanceof TFile) {
          await plugin.app.vault.modifyBinary(existing, fileData);
        } else {
          await plugin.app.vault.createBinary(targetPath, fileData);
        }
        newAssetPaths[origPath] = targetPath;
      }
    }
  }

  // 2. Extraer y escribir notas
  if (manifest.noteMap) {
    for (const origPath in manifest.noteMap) {
      const zipPath = manifest.noteMap[origPath];
      const fileInZip = zip.file(zipPath);
      if (fileInZip) {
        const fileContent = await fileInZip.async('string');
        const fileName = zipPath.split('/').pop() || 'note.md';
        const targetPath = `${notesTargetFolder}/${fileName}`;
        
        const existing = plugin.app.vault.getAbstractFileByPath(targetPath);
        if (existing instanceof TFile) {
          await plugin.app.vault.modify(existing, fileContent);
        } else {
          await plugin.app.vault.create(targetPath, fileContent);
        }
        newNotePaths[origPath] = targetPath;
      }
    }
  }

  // Helper para remapear una ruta de asset
  const remapAsset = (p: string | null | undefined): string | null => {
    if (!p) return null;
    return newAssetPaths[p] || p;
  };

  // Helper para remapear una ruta de nota
  const remapNote = (p: string | null | undefined): string | null => {
    if (!p) return null;
    return newNotePaths[p] || p;
  };

  // 3. Remapear toda la estructura de la campaña
  if (campaign.maps) {
    for (const mapId in campaign.maps) {
      const map = campaign.maps[mapId];
      if (map.imagePath) map.imagePath = remapAsset(map.imagePath);

      if (map.drawing) {
        if (map.drawing.backgroundImagePath) {
          map.drawing.backgroundImagePath = remapAsset(map.drawing.backgroundImagePath);
        }
        if (map.drawing.images) {
          for (const img of map.drawing.images) {
            img.imagePath = remapAsset(img.imagePath) || img.imagePath;
          }
        }
      }

      if (map.tokens) {
        for (const tok of map.tokens) {
          tok.imagePath = remapAsset(tok.imagePath);
          tok.linkedNote = remapNote(tok.linkedNote);
          if (tok.inventory && tok.inventory.items) {
            for (const item of tok.inventory.items) {
              item.imagePath = remapAsset(item.imagePath);
              item.note = remapNote(item.note);
            }
          }
        }
      }

      if (map.pois) {
        for (const poi of map.pois) {
          poi.imagePath = remapAsset(poi.imagePath);
          poi.linkedNote = remapNote(poi.linkedNote);
        }
      }

      if (map.combat && map.combat.combatants) {
        for (const cob of map.combat.combatants) {
          cob.imagePath = remapAsset(cob.imagePath);
        }
      }

      if (map.wargame && map.wargame.units) {
        for (const u of map.wargame.units) {
          u.imagePath = remapAsset(u.imagePath);
        }
      }
    }
  }

  // Remapear personajes de la campaña (Party)
  if (campaign.characters) {
    for (const charId in campaign.characters) {
      const char = campaign.characters[charId];
      char.imagePath = remapAsset(char.imagePath);
      char.linkedNote = remapNote(char.linkedNote);
      if (char.inventory && char.inventory.items) {
        for (const item of char.inventory.items) {
          item.imagePath = remapAsset(item.imagePath);
          item.note = remapNote(item.note);
        }
      }
    }
  }

  // 4. Importar bestiario si viene incluido
  if (manifest.bestiaryEntries && manifest.bestiaryEntries.length > 0) {
    if (!plugin.settings.bestiary) plugin.settings.bestiary = {};
    if (!plugin.settings.bestiaryPacks) plugin.settings.bestiaryPacks = [];

    const existingPacks = new Set(plugin.settings.bestiaryPacks);

    for (const entry of manifest.bestiaryEntries) {
      const clonedEntry = JSON.parse(JSON.stringify(entry)) as BestiaryEntry;
      clonedEntry.imagePath = remapAsset(clonedEntry.imagePath);
      clonedEntry.linkedNote = remapNote(clonedEntry.linkedNote);

      if (clonedEntry.inventory && clonedEntry.inventory.items) {
        for (const item of clonedEntry.inventory.items) {
          item.imagePath = remapAsset(item.imagePath);
          item.note = remapNote(item.note);
        }
      }

      // Si el ID ya existe en el bestiario local, generar un nuevo ID para evitar pisar
      if (plugin.settings.bestiary[clonedEntry.id]) {
        clonedEntry.id = genId();
      }

      plugin.settings.bestiary[clonedEntry.id] = clonedEntry;

      if (clonedEntry.pack && !existingPacks.has(clonedEntry.pack)) {
        existingPacks.add(clonedEntry.pack);
        plugin.settings.bestiaryPacks.push(clonedEntry.pack);
      }
    }
  }

  // 4b. Importar plantillas de hoja si vienen incluidas
  if (manifest.sheetTemplates && manifest.sheetTemplates.length > 0) {
    if (!plugin.settings.sheetTemplates) plugin.settings.sheetTemplates = [];
    for (const impTpl of manifest.sheetTemplates) {
      const clonedTpl = JSON.parse(JSON.stringify(impTpl)) as SheetTemplate;
      if (clonedTpl.background?.path) {
        clonedTpl.background.path = remapAsset(clonedTpl.background.path);
      }
      for (const w of clonedTpl.widgets) {
        if (w.imagePath) w.imagePath = remapAsset(w.imagePath);
      }

      const existingIdx = plugin.settings.sheetTemplates.findIndex((t) => t.id === clonedTpl.id || t.name === clonedTpl.name);
      if (existingIdx === -1) {
        plugin.settings.sheetTemplates.push(clonedTpl);
      }
    }
  }

  // 5. Asignar nombre único de campaña si ya existe
  let finalCampName = campaign.name;
  let counter = 1;
  const existingNames = new Set(Object.values(plugin.settings.campaigns).map((c) => c.name));
  while (existingNames.has(finalCampName)) {
    finalCampName = `${campaign.name} (${counter++})`;
  }
  campaign.name = finalCampName;

  // Registrar la nueva campaña
  const newCampId = genId();
  plugin.settings.campaigns[newCampId] = campaign;
  plugin.settings.currentCampaignId = newCampId;

  await plugin.saveSettings();

  new Notice(t('exportImport.importSuccess', { name: campaign.name }));
  return newCampId;
}
