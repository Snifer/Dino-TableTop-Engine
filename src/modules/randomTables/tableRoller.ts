import { RandomTable, TableRow, TableHistoryEntry } from './types';
import { TableIndexer } from './tableIndexer';
import { genId } from '../../utils';

export interface RollResult {
  entry: TableHistoryEntry;
  row: TableRow | null;
  resolvedText: string;
  isExhausted: boolean;
  rawRoll: number | string | null;
  nestedRolls: { formula: string; result: number }[];
  chainedTables: { tableName: string; resultText: string }[];
}

export interface RollOptions {
  campaignId?: string | null;
  noRepeat?: boolean;
  usedRowIndexes?: number[];
  resolveNestedRolls?: boolean;
  resolveChainedTables?: boolean;
  indexer?: TableIndexer;
  depth?: number;
}

/** Roll NdS+M fallback */
export function rollFormula(formula: string): { total: number; rolls: number[] } {
  const match = formula.replace(/\s+/g, '').match(/^(\d*)d(\d+)([+-]\d+)?$/i);
  if (!match) return { total: 0, rolls: [] };
  const count = parseInt(match[1] || '1', 10);
  const sides = parseInt(match[2], 10);
  const mod = match[3] ? parseInt(match[3], 10) : 0;
  const rolls: number[] = [];
  let sum = 0;
  for (let i = 0; i < count; i++) {
    const r = Math.floor(Math.random() * sides) + 1;
    rolls.push(r);
    sum += r;
  }
  return { total: sum + mod, rolls };
}

/**
 * Execute a roll on a RandomTable
 */
export async function rollRandomTable(
  table: RandomTable,
  options?: RollOptions
): Promise<RollResult> {
  const campaignId = options?.campaignId || null;
  const used = new Set<number>(options?.usedRowIndexes || []);
  const noRepeat = !!options?.noRepeat;
  const depth = options?.depth || 0;

  // Filter rows if no-repeat
  const eligibleRows = table.rows.filter((r) => !noRepeat || !used.has(r.rawRowIndex));

  if (table.rows.length === 0 || eligibleRows.length === 0) {
    const historyEntry: TableHistoryEntry = {
      id: genId(),
      tableId: table.id,
      tableName: table.name,
      campaignId,
      roll: null,
      rowIndex: -1,
      text: table.rows.length === 0 ? '(Tabla vacía)' : '(Tabla agotada)',
      timestamp: Date.now(),
    };

    return {
      entry: historyEntry,
      row: null,
      resolvedText: historyEntry.text,
      isExhausted: table.rows.length > 0,
      rawRoll: null,
      nestedRolls: [],
      chainedTables: [],
    };
  }

  let selectedRow: TableRow | null = null;
  let rawRoll: number | string | null = null;

  if (table.mode === 'range') {
    if (table.rollFormula) {
      const rolled = rollFormula(table.rollFormula);
      rawRoll = rolled.total;
    } else {
      // Find min and max among eligible rows
      const validMin = Math.min(...table.rows.map((r) => (r.min !== null ? r.min : 1)));
      const validMax = Math.max(...table.rows.map((r) => (r.max !== null ? r.max : table.rows.length)));
      rawRoll = Math.floor(Math.random() * (validMax - validMin + 1)) + validMin;
    }

    const rollNum = typeof rawRoll === 'number' ? rawRoll : Number(rawRoll);
    // Find row whose range matches rollNum
    const matched = eligibleRows.find(
      (r) => r.min !== null && r.max !== null && rollNum >= r.min && rollNum <= r.max
    );

    if (matched) {
      selectedRow = matched;
    } else {
      // Gap or outside range: try first eligible or nearest
      selectedRow = eligibleRows[0];
    }
  } else if (table.mode === 'weighted') {
    const totalWeight = eligibleRows.reduce((sum, r) => sum + r.weight, 0);
    const rnd = Math.random() * totalWeight;
    let acc = 0;
    for (const r of eligibleRows) {
      acc += r.weight;
      if (rnd <= acc) {
        selectedRow = r;
        break;
      }
    }
    if (!selectedRow) selectedRow = eligibleRows[eligibleRows.length - 1];
    rawRoll = `${selectedRow.weight}/${totalWeight}`;
  } else {
    // Uniform mode
    const idx = Math.floor(Math.random() * eligibleRows.length);
    selectedRow = eligibleRows[idx];
    rawRoll = selectedRow.rawRowIndex + 1;
  }

  // Nested dice rolls and chained tables
  let resolvedText = selectedRow.text;
  const nestedRolls: { formula: string; result: number }[] = [];
  const chainedTables: { tableName: string; resultText: string }[] = [];

  if (options?.resolveNestedRolls !== false) {
    // Replace inline dice expressions like "2d6 monedas" or "1d4 pociones"
    resolvedText = resolvedText.replace(/\b(\d+d\d+(?:[+-]\d+)?)\b/gi, (match) => {
      const { total } = rollFormula(match);
      nestedRolls.push({ formula: match, result: total });
      return `${total} (${match})`;
    });
  }

  if (options?.resolveChainedTables !== false && options?.indexer && depth < 4) {
    // Match [[Nombre de Tabla]]
    const linkRegex = /\[\[(.*?)\]\]/g;
    let match: RegExpExecArray | null;
    const tableNamesToResolve: string[] = [];

    while ((match = linkRegex.exec(selectedRow.text)) !== null) {
      const targetName = match[1].split('|')[0].trim();
      tableNamesToResolve.push(targetName);
    }

    for (const childName of tableNamesToResolve) {
      const childTable = options.indexer.getTableByName(childName);
      if (childTable && childTable.id !== table.id) {
        const childRes = await rollRandomTable(childTable, {
          ...options,
          depth: depth + 1,
        });
        chainedTables.push({
          tableName: childTable.name,
          resultText: childRes.resolvedText,
        });
      }
    }
  }

  // Format final text with chained tables if any
  if (chainedTables.length > 0) {
    const chainedPart = chainedTables
      .map((c) => ` ➔ [${c.tableName}: ${c.resultText}]`)
      .join('');
    resolvedText += chainedPart;
  }

  const historyEntry: TableHistoryEntry = {
    id: genId(),
    tableId: table.id,
    tableName: table.name,
    campaignId,
    roll: rawRoll,
    rowIndex: selectedRow.rawRowIndex,
    text: resolvedText,
    extra: selectedRow.extra,
    timestamp: Date.now(),
  };

  return {
    entry: historyEntry,
    row: selectedRow,
    resolvedText,
    isExhausted: false,
    rawRoll,
    nestedRolls,
    chainedTables,
  };
}
