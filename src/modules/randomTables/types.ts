export type TableRollMode = 'range' | 'weighted' | 'uniform';

export interface TableRow {
  min: number | null;
  max: number | null;
  weight: number;
  text: string;
  extra?: Record<string, string>;
  rawRowIndex: number;
}

export type TableScope =
  | { type: 'global' }
  | { type: 'campaign'; campaignId: string };

export interface RandomTable {
  id: string;
  notePath: string;
  name: string;
  headingPath?: string;
  scope: TableScope;
  rollFormula: string | null;
  mode: TableRollMode;
  groupTags: string[];
  columns: string[];
  rows: TableRow[];
  warnings: string[];
}

export interface NoteTableFrontmatter {
  dteTable?: boolean;
  dteTags?: string[];
  dteName?: string;
  dteRoll?: string;
  dteCampaign?: string;
  [key: string]: unknown;
}

export interface TableHistoryEntry {
  id: string;
  tableId: string;
  tableName: string;
  campaignId: string | null;
  roll: number | string | null;
  rowIndex: number;
  text: string;
  extra?: Record<string, string>;
  timestamp: number;
  note?: string;
}

export interface RandomTablesSettings {
  tagPrefix: string;
  folders: string[];
  noRepeat: Record<string, number[]>; // tableId -> list of used rowIndexes
}

export const DEFAULT_RANDOM_TABLES_SETTINGS: RandomTablesSettings = {
  tagPrefix: 'dte-table',
  folders: [],
  noRepeat: {},
};
