import { App, TFile, TFolder, normalizePath } from 'obsidian';
import { InterpretationRule, OracleCard, OracleDeck } from './types';
import { HIEROFANTE_RULES } from './ruleEngine';
import { genId } from '../../utils';

export interface RawCardData {
  name: string;
  type?: string;
  category?: string;
  image?: string;
  imageFile?: string;
  meaning?: string;
}

/**
 * Infer rank (1-10) and isFigure flag based on standard Spanish tarot card naming.
 */
export function inferRankAndFigure(name: string, category: string): { rank: number | null; isFigure: boolean } {
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();

  // Major Arcana cards do not have suit ranks or figure roles
  if (category.toLowerCase().includes('arcano mayor')) {
    return { rank: null, isFigure: false };
  }

  // Figures
  if (lower.startsWith('paje') || lower.startsWith('caballero') || lower.startsWith('reina') || lower.startsWith('rey')) {
    return { rank: null, isFigure: true };
  }

  // Numbered suit cards
  if (lower.startsWith('as de') || lower.startsWith('as ')) return { rank: 1, isFigure: false };
  if (lower.startsWith('dos de') || lower.startsWith('dos ')) return { rank: 2, isFigure: false };
  if (lower.startsWith('tres de') || lower.startsWith('tres ')) return { rank: 3, isFigure: false };
  if (lower.startsWith('cuatro de') || lower.startsWith('cuatro ')) return { rank: 4, isFigure: false };
  if (lower.startsWith('cinco de') || lower.startsWith('cinco ')) return { rank: 5, isFigure: false };
  if (lower.startsWith('seis de') || lower.startsWith('seis ')) return { rank: 6, isFigure: false };
  if (lower.startsWith('siete de') || lower.startsWith('siete ')) return { rank: 7, isFigure: false };
  if (lower.startsWith('ocho de') || lower.startsWith('ocho ')) return { rank: 8, isFigure: false };
  if (lower.startsWith('nueve de') || lower.startsWith('nueve ')) return { rank: 9, isFigure: false };
  if (lower.startsWith('diez de') || lower.startsWith('diez ')) return { rank: 10, isFigure: false };

  // Fallback for numbered digits
  const digitMatch = lower.match(/^(\d+)\s+de/);
  if (digitMatch) {
    const num = parseInt(digitMatch[1], 10);
    if (num >= 1 && num <= 10) {
      return { rank: num, isFigure: false };
    }
  }

  return { rank: null, isFigure: false };
}

/**
 * Safely parse a javascript or json string without using eval() or Function().
 */
export function parseCardsScriptOrJson(content: string): RawCardData[] {
  let clean = content.trim();

  // Strip single-line comments
  clean = clean.replace(/\/\/.*$/gm, '');
  // Strip multi-line comments
  clean = clean.replace(/\/\*[\s\S]*?\*\//g, '');

  // Extract array between first [ and last ]
  const firstBracket = clean.indexOf('[');
  const lastBracket = clean.lastIndexOf(']');
  if (firstBracket === -1 || lastBracket === -1 || lastBracket <= firstBracket) {
    throw new Error('No se encontró un arreglo [ ... ] válido en el archivo.');
  }

  let arrayText = clean.substring(firstBracket, lastBracket + 1);

  // Quote unquoted object property keys: { name: "..." } => { "name": "..." }
  arrayText = arrayText.replace(/([{,]\s*)([a-zA-Z0-9_$]+)\s*:/g, '$1"$2":');

  // Remove trailing commas before } or ]
  arrayText = arrayText.replace(/,\s*([}\]])/g, '$1');

  const parsed: unknown = JSON.parse(arrayText);
  if (!Array.isArray(parsed)) {
    throw new Error('El contenido analizado no es un arreglo.');
  }

  const items = parsed as Array<Record<string, unknown>>;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item || typeof item !== 'object' || !item.name) {
      throw new Error(`El elemento #${i + 1} no tiene un campo 'name' válido.`);
    }
  }

  return parsed as RawCardData[];
}

/**
 * Convert raw card data into full OracleCard objects.
 */
export function convertRawCardsToOracleCards(rawList: RawCardData[]): OracleCard[] {
  return rawList.map((raw) => {
    const category = (raw.type || raw.category || 'Sin categoría').trim();
    const { rank, isFigure } = inferRankAndFigure(raw.name, category);
    return {
      id: genId(),
      name: raw.name.trim(),
      category,
      rank,
      isFigure,
      meaning: (raw.meaning || '').trim(),
      imageFile: (raw.image || raw.imageFile || '').trim(),
      imagePath: null,
    };
  });
}

/**
 * Match image files in a vault directory against card imageFile names.
 */
export function matchImagesInFolder(
  app: App,
  folderPath: string,
  cards: OracleCard[]
): { matchedCount: number; totalCount: number; missing: string[] } {
  const norm = normalizePath(folderPath.trim());
  const folder = app.vault.getAbstractFileByPath(norm);
  if (!folder || !(folder instanceof TFolder)) {
    throw new Error(`La carpeta especificada "${folderPath}" no existe en la bóveda.`);
  }

  // Build lookup of filenames to vault paths
  const fileMap = new Map<string, string>();
  for (const child of folder.children) {
    if (child instanceof TFile) {
      fileMap.set(child.name.toLowerCase(), child.path);
    }
  }

  let matchedCount = 0;
  const missing: string[] = [];

  for (const card of cards) {
    if (!card.imageFile) {
      missing.push(card.name);
      continue;
    }

    const exactMatch = fileMap.get(card.imageFile.toLowerCase());
    if (exactMatch) {
      card.imagePath = exactMatch;
      matchedCount++;
    } else {
      missing.push(`${card.name} (${card.imageFile})`);
    }
  }

  return {
    matchedCount,
    totalCount: cards.length,
    missing,
  };
}

import { RAW_HIEROFANTE_DECK } from './defaultDeckData';

/**
 * Create a fresh Hierofante deck instance with default configuration and 78 cards.
 */
export function createHierofanteDeck(deckName = 'Hierofante', cards?: OracleCard[]): OracleDeck {
  const initialCards = cards && cards.length > 0 ? cards : convertRawCardsToOracleCards(RAW_HIEROFANTE_DECK);

  return {
    id: 'hierofante-deck',
    name: deckName,
    backImagePath: null,
    orientationMode: 'upDown',
    reversedChance: 0.5,
    cards: initialCards,
    rules: JSON.parse(JSON.stringify(HIEROFANTE_RULES)) as InterpretationRule[],
    varValues: {
      difficulty: 5,
    },
  };
}

