import { RandomTable, TableRow, TableRollMode, TableScope, NoteTableFrontmatter } from './types';

/** Regex to match dice formulas like d6, 1d20, 2d6, 3d8+2, d100 */
export const DICE_FORMULA_REGEX = /^(\d*)d(\d+)([+-]\d+)?$/i;

/** Regex to match weighted header labels */
export const WEIGHTED_HEADER_REGEX = /^(peso|weight|%|ponderad[oa])$/i;

/** Regex for separator cell in markdown tables: :---:, ---, :---, ---: */
const SEPARATOR_CELL_REGEX = /^:?-+:?$/;

/** Helper to split a line by unescaped pipe | */
export function splitRowPipes(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let escaped = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (escaped) {
      current += char;
      escaped = false;
    } else if (char === '\\') {
      escaped = true;
    } else if (char === '|') {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current);

  // If line had leading and/or trailing pipes, trim those blank edge cells
  if (cells.length > 0 && cells[0].trim() === '') {
    cells.shift();
  }
  if (cells.length > 0 && cells[cells.length - 1].trim() === '') {
    cells.pop();
  }

  return cells.map((c) => c.trim().replace(/\\\|/g, '|'));
}

/** Check if all cells in a row are markdown table separators (:---, ---:, etc.) */
export function isSeparatorRow(cells: string[]): boolean {
  if (cells.length === 0) return false;
  return cells.every((cell) => SEPARATOR_CELL_REGEX.test(cell.trim()));
}

/** Parse min/max bounds from dice formula string e.g. "2d6+3" -> min 5, max 15 */
export function getDiceFormulaBounds(formula: string): { min: number; max: number } | null {
  const match = formula.replace(/\s+/g, '').match(DICE_FORMULA_REGEX);
  if (!match) return null;
  const count = parseInt(match[1] || '1', 10);
  const sides = parseInt(match[2], 10);
  const mod = match[3] ? parseInt(match[3], 10) : 0;
  if (isNaN(count) || isNaN(sides) || sides <= 0 || count <= 0) return null;
  return {
    min: count + mod,
    max: count * sides + mod,
  };
}

/** Normalize dice formula string e.g. "d20" -> "1d20" */
export function normalizeDiceFormula(formula: string): string {
  const match = formula.replace(/\s+/g, '').match(DICE_FORMULA_REGEX);
  if (!match) return formula.trim();
  const count = match[1] || '1';
  const sides = match[2];
  const mod = match[3] || '';
  return `${count}d${sides}${mod}`.toLowerCase();
}

/** Extract simple frontmatter object and remaining body from markdown text */
export function extractFrontmatter(content: string): { frontmatter: NoteTableFrontmatter; body: string } {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith('---')) {
    return { frontmatter: {}, body: content };
  }

  const endIdx = trimmed.indexOf('\n---', 3);
  if (endIdx === -1) {
    return { frontmatter: {}, body: content };
  }

  const rawYaml = trimmed.substring(3, endIdx).trim();
  const body = trimmed.substring(endIdx + 4);
  const frontmatter: NoteTableFrontmatter = {};

  const lines = rawYaml.split('\n');
  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.substring(0, colonIdx).trim();
    let val = line.substring(colonIdx + 1).trim();

    // Map common keys
    if (key === 'dte-table' || key === 'dteTable') {
      frontmatter.dteTable = val.toLowerCase() === 'true';
    } else if (key === 'dte-name' || key === 'dteName') {
      frontmatter.dteName = val.replace(/^["']|["']$/g, '');
    } else if (key === 'dte-roll' || key === 'dteRoll') {
      frontmatter.dteRoll = val.replace(/^["']|["']$/g, '');
    } else if (key === 'dte-campaign' || key === 'dteCampaign') {
      frontmatter.dteCampaign = val.replace(/^["']|["']$/g, '');
    } else if (key === 'dte-tags' || key === 'dteTags' || key === 'tags') {
      if (val.startsWith('[') && val.endsWith(']')) {
        frontmatter.dteTags = val
          .substring(1, val.length - 1)
          .split(',')
          .map((s) => s.trim().replace(/^["']|["']$/g, ''))
          .filter(Boolean);
      } else if (val) {
        frontmatter.dteTags = [val.replace(/^["']|["']$/g, '')];
      }
    } else {
      frontmatter[key] = val;
    }
  }

  return { frontmatter, body };
}

interface RawTableBlock {
  heading: string | null;
  headingPath: string[];
  headerRow: string[];
  dataRows: { cells: string[]; lineIndex: number }[];
  startLine: number;
}

/** Extract table blocks and headings from markdown body */
export function extractTableBlocks(markdown: string): RawTableBlock[] {
  const lines = markdown.split('\n');
  const blocks: RawTableBlock[] = [];
  const currentHeadingHierarchy: { level: number; text: string }[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Track markdown headings (# Heading 1, ## Heading 2, etc.)
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2].replace(/#+\s*$/, '').trim();

      while (currentHeadingHierarchy.length > 0 && currentHeadingHierarchy[currentHeadingHierarchy.length - 1].level >= level) {
        currentHeadingHierarchy.pop();
      }
      currentHeadingHierarchy.push({ level, text });
      i++;
      continue;
    }

    // Check if line looks like a table row: must contain pipe
    if (trimmed.includes('|') && i + 1 < lines.length) {
      const headerCells = splitRowPipes(trimmed);
      const nextTrimmed = lines[i + 1].trim();
      const nextCells = splitRowPipes(nextTrimmed);

      if (headerCells.length > 0 && isSeparatorRow(nextCells)) {
        // Table found! Read data rows
        const startLine = i;
        const currentHeading = currentHeadingHierarchy.length > 0
          ? currentHeadingHierarchy[currentHeadingHierarchy.length - 1].text
          : null;
        const headingPath = currentHeadingHierarchy.map((h) => h.text);

        const dataRows: { cells: string[]; lineIndex: number }[] = [];
        i += 2; // skip header and separator

        while (i < lines.length) {
          const rowLine = lines[i].trim();
          if (!rowLine.includes('|') || rowLine.startsWith('#')) {
            break;
          }
          const cells = splitRowPipes(rowLine);
          if (cells.length === 0) break;
          // Ignore accidental duplicate separator rows
          if (!isSeparatorRow(cells)) {
            dataRows.push({ cells, lineIndex: i });
          }
          i++;
        }

        blocks.push({
          heading: currentHeading,
          headingPath,
          headerRow: headerCells,
          dataRows,
          startLine,
        });
        continue;
      }
    }

    i++;
  }

  return blocks;
}

/** Validate ranges and check for overlaps and gaps */
export function validateTableRanges(
  rows: TableRow[],
  rollFormula: string | null
): string[] {
  const warnings: string[] = [];

  // Check inverted ranges
  for (const row of rows) {
    if (row.min !== null && row.max !== null && row.min > row.max) {
      warnings.push(`Rango invertido ${row.min}-${row.max} en la fila ${row.rawRowIndex + 1}`);
    }
  }

  const validRows = rows.filter((r) => r.min !== null && r.max !== null && r.min <= r.max);

  // Check overlaps
  for (let i = 0; i < validRows.length; i++) {
    for (let j = i + 1; j < validRows.length; j++) {
      const a = validRows[i];
      const b = validRows[j];
      const overlap = !(a.max! < b.min! || b.max! < a.min!);
      if (overlap) {
        const rangeA = a.min === a.max ? `${a.min}` : `${a.min}-${a.max}`;
        const rangeB = b.min === b.max ? `${b.min}` : `${b.min}-${b.max}`;
        warnings.push(`Rangos solapados: fila ${a.rawRowIndex + 1} (${rangeA}) y fila ${b.rawRowIndex + 1} (${rangeB})`);
      }
    }
  }

  // Check formula bounds and gaps
  if (rollFormula) {
    const bounds = getDiceFormulaBounds(rollFormula);
    if (bounds) {
      // Check if rows exceed formula bounds
      for (const r of validRows) {
        if (r.min! < bounds.min || r.max! > bounds.max) {
          const range = r.min === r.max ? `${r.min}` : `${r.min}-${r.max}`;
          warnings.push(`El rango (${range}) excede los límites de la tirada ${rollFormula} (${bounds.min}-${bounds.max})`);
        }
      }

      // Check missing numbers / gaps within formula bounds
      const covered = new Set<number>();
      for (const r of validRows) {
        for (let num = r.min!; num <= r.max!; num++) {
          covered.add(num);
        }
      }

      const missing: number[] = [];
      for (let num = bounds.min; num <= bounds.max; num++) {
        if (!covered.has(num)) {
          missing.push(num);
        }
      }

      if (missing.length > 0) {
        if (missing.length <= 10) {
          warnings.push(`Hueco en rangos: faltan los valores [${missing.join(', ')}] para la fórmula ${rollFormula}`);
        } else {
          warnings.push(`Hueco en rangos: faltan ${missing.length} valores (ej. ${missing.slice(0, 5).join(', ')}...) para la fórmula ${rollFormula}`);
        }
      }
    }
  } else if (validRows.length > 1) {
    // No specific formula: check internal gaps between min and max observed
    const minObs = Math.min(...validRows.map((r) => r.min!));
    const maxObs = Math.max(...validRows.map((r) => r.max!));
    const covered = new Set<number>();
    for (const r of validRows) {
      for (let num = r.min!; num <= r.max!; num++) {
        covered.add(num);
      }
    }
    const missing: number[] = [];
    for (let num = minObs; num <= maxObs; num++) {
      if (!covered.has(num)) {
        missing.push(num);
      }
    }
    if (missing.length > 0 && missing.length <= 15) {
      warnings.push(`Hueco en rangos: faltan los valores [${missing.join(', ')}] entre ${minObs} y ${maxObs}`);
    }
  }

  return warnings;
}

/** Parse range from cell string, supporting formats: "3", "2-4", "2–4", "2—4", "01-05" */
export function parseRangeCell(raw: string): { min: number | null; max: number | null } {
  const trimmed = raw.trim();
  if (!trimmed) return { min: null, max: null };

  // Match range: "2-4", "2–4", "2—4"
  const rangeMatch = trimmed.match(/^(\d+)\s*[-–—]\s*(\d+)$/);
  if (rangeMatch) {
    return {
      min: parseInt(rangeMatch[1], 10),
      max: parseInt(rangeMatch[2], 10),
    };
  }

  // Match single integer: "3" or "05"
  const singleMatch = trimmed.match(/^(\d+)$/);
  if (singleMatch) {
    const val = parseInt(singleMatch[1], 10);
    return { min: val, max: val };
  }

  return { min: null, max: null };
}

/**
 * Parse markdown note content into structured RandomTable instances with full validation
 */
export function parseMarkdownTables(
  notePath: string,
  content: string,
  options?: {
    tags?: string[];
    defaultScope?: TableScope;
    defaultCampaignId?: string;
  }
): RandomTable[] {
  const { frontmatter, body } = extractFrontmatter(content);
  const blocks = extractTableBlocks(body);

  if (blocks.length === 0) {
    return [];
  }

  // Scope determination
  let scope: TableScope = options?.defaultScope || { type: 'global' };
  if (frontmatter.dteCampaign) {
    scope = { type: 'campaign', campaignId: frontmatter.dteCampaign };
  } else if (options?.defaultCampaignId) {
    scope = { type: 'campaign', campaignId: options.defaultCampaignId };
  }

  // Tags aggregation
  const groupTags: string[] = [];
  if (frontmatter.dteTags && Array.isArray(frontmatter.dteTags)) {
    groupTags.push(...frontmatter.dteTags);
  }
  if (options?.tags) {
    for (const t of options.tags) {
      if (!groupTags.includes(t)) groupTags.push(t);
    }
  }

  const tables: RandomTable[] = [];

  blocks.forEach((block, index) => {
    const warnings: string[] = [];
    const columns = block.headerRow;
    const firstColHeader = columns[0] || '';

    // Determine mode and roll formula
    let mode: TableRollMode = 'uniform';
    let rollFormula: string | null = null;

    if (DICE_FORMULA_REGEX.test(firstColHeader.replace(/\s+/g, ''))) {
      mode = 'range';
      rollFormula = normalizeDiceFormula(firstColHeader);
    } else if (WEIGHTED_HEADER_REGEX.test(firstColHeader.trim())) {
      mode = 'weighted';
    } else if (frontmatter.dteRoll && DICE_FORMULA_REGEX.test(frontmatter.dteRoll.replace(/\s+/g, ''))) {
      // Frontmatter provided a dice formula
      mode = 'range';
      rollFormula = normalizeDiceFormula(frontmatter.dteRoll);
    }

    // Name determination
    const baseName = notePath.split('/').pop()?.replace(/\.md$/, '') || 'Tabla';
    let tableName: string;
    if (block.heading) {
      tableName = block.heading;
    } else if (frontmatter.dteName && blocks.length === 1) {
      tableName = frontmatter.dteName;
    } else if (blocks.length === 1) {
      tableName = baseName;
    } else {
      tableName = `${baseName} (Tabla ${index + 1})`;
    }

    // Parse rows
    const rows: TableRow[] = [];
    for (let rIdx = 0; rIdx < block.dataRows.length; rIdx++) {
      const { cells } = block.dataRows[rIdx];
      const col0 = cells[0] || '';
      const col1 = cells[1] !== undefined ? cells[1] : (cells.length === 1 ? cells[0] : '');

      let min: number | null = null;
      let max: number | null = null;
      let weight = 1;

      if (mode === 'range') {
        const range = parseRangeCell(col0);
        min = range.min;
        max = range.max;
        if (min === null || max === null) {
          warnings.push(`Fila ${rIdx + 1} no tiene un rango numérico válido ("${col0}")`);
        }
      } else if (mode === 'weighted') {
        const parsedWeight = parseFloat(col0);
        if (isNaN(parsedWeight) || parsedWeight <= 0) {
          weight = 1;
          warnings.push(`Fila ${rIdx + 1} tiene un peso inválido ("${col0}"), se usó peso 1`);
        } else {
          weight = parsedWeight;
        }
      } else {
        // Uniform mode: check if col0 contains optional range anyway
        const range = parseRangeCell(col0);
        if (range.min !== null) {
          min = range.min;
          max = range.max;
        }
      }

      // Extra columns
      const extra: Record<string, string> = {};
      for (let c = 2; c < columns.length; c++) {
        const colName = columns[c];
        if (colName && cells[c] !== undefined) {
          extra[colName] = cells[c];
        }
      }

      rows.push({
        min,
        max,
        weight,
        text: col1,
        extra: Object.keys(extra).length > 0 ? extra : undefined,
        rawRowIndex: rIdx,
      });
    }

    if (rows.length === 0) {
      warnings.push('La tabla no contiene filas de resultados');
    }

    // Additional validations
    if (mode === 'range') {
      const rangeWarnings = validateTableRanges(rows, rollFormula);
      warnings.push(...rangeWarnings);
    } else if (mode === 'weighted') {
      const totalWeight = rows.reduce((sum, r) => sum + r.weight, 0);
      if (totalWeight <= 0) {
        warnings.push('El peso total de la tabla es 0 o menor');
      }
    }

    const tableId = `${notePath}#${block.heading ? block.heading.toLowerCase().replace(/\s+/g, '-') : index}`;

    tables.push({
      id: tableId,
      notePath,
      name: tableName,
      headingPath: block.headingPath.length > 0 ? block.headingPath.join(' > ') : undefined,
      scope,
      rollFormula,
      mode,
      groupTags,
      columns,
      rows,
      warnings,
    });
  });

  return tables;
}
