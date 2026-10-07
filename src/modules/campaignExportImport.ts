import { App, Notice, TFile, TFolder } from 'obsidian';
import JSZip from 'jszip';
import type DinoTabletopEnginePlugin from '../../main';
import {
  CampaignData,
  BestiaryEntry,
  DeckData,
  TimelineData,
  ClockData,
  TokenData,
  POIData,
  MapData,
} from '../types';
import { genId } from '../utils';
import { t } from '../i18n';

export interface CampaignExportOptions {
  includeImages: boolean;
  includeNotes: boolean;
  includeDiary: boolean;
  bestiaryMode: 'none' | 'used' | 'selected' | 'all';
  selectedPacks: string[];
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
  assetMap: Record<string, string>; // originalVaultPath -> zipRelativePath
  noteMap: Record<string, string>;  // originalVaultPath -> zipRelativePath
}

/** Helper para sanitizar nombres de archivo o carpeta */
function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim();
}

/** Asegura recursivamente que una carpeta exista en el Vault */
async function ensureFolder(app: App, folderPath: string): Promise<void> {
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
  plugin: DinoTabletopEnginePlugin,
  options: CampaignExportOptions
): {
  imagePaths: Set<string>;
  notePaths: Set<string>;
  bestiaryEntries: BestiaryEntry[];
} {
  const imagePaths = new Set<string>();
  const notePaths = new Set<string>();
  const bestiaryEntries: BestiaryEntry[] = [];

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

  return { imagePaths, notePaths, bestiaryEntries };
}

/**
 * Exporta la campaña activa empaquetando todo en un archivo .dinovtt
 */
export async function exportCampaignToFile(
  plugin: DinoTabletopEnginePlugin,
  campaignId: string,
  options: CampaignExportOptions
): Promise<void> {
  const campaign = plugin.settings.campaigns[campaignId];
  if (!campaign) {
    new Notice(t('exportImport.campaignNotFound'));
    return;
  }

  const { imagePaths, notePaths, bestiaryEntries } = collectCampaignDependencies(
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
    version: 1,
    appName: 'Dino Tabletop Engine',
    exportedAt: new Date().toISOString(),
    campaignName: campaign.name,
    campaign: JSON.parse(JSON.stringify(campaign)),
    bestiaryEntries: bestiaryEntries.length ? bestiaryEntries : undefined,
    assetMap,
    noteMap,
  };

  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  // Generar el archivo .dinovtt (ZIP)
  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  // Disparar descarga en el navegador / Obsidian
  const safeCampaignName = sanitizeFileName(campaign.name) || 'campaign';
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
  plugin: DinoTabletopEnginePlugin,
  dataBuffer: ArrayBuffer,
  customTargetFolder?: string
): Promise<string> {
  const zip = await JSZip.loadAsync(dataBuffer);
  const manifestFile = zip.file('manifest.json');
  if (!manifestFile) {
    throw new Error(t('exportImport.invalidPackage'));
  }

  const manifestStr = await manifestFile.async('string');
  const manifest: CampaignPackageManifest = JSON.parse(manifestStr);

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

  // 4. Importar bestiario si viene incluido
  if (manifest.bestiaryEntries && manifest.bestiaryEntries.length > 0) {
    if (!plugin.settings.bestiary) plugin.settings.bestiary = {};
    if (!plugin.settings.bestiaryPacks) plugin.settings.bestiaryPacks = [];

    const existingPacks = new Set(plugin.settings.bestiaryPacks);

    for (const entry of manifest.bestiaryEntries) {
      const clonedEntry: BestiaryEntry = JSON.parse(JSON.stringify(entry));
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
