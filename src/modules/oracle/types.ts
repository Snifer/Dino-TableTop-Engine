export interface OracleCard {
  id: string;
  name: string;
  category: string;           // "Arcano Mayor", "Copa", "Pentáculo", "Espada", "Basto"
  rank: number | null;        // 1–10 in suit cards; null in major arcana and figures
  isFigure: boolean;          // true for Paje, Caballero, Reina, Rey
  meaning: string;            // Keywords and meaning text
  imageFile: string;          // Original image filename (e.g. "Cups01.jpg") for matching
  imagePath: string | null;   // Actual vault path if configured
}

export interface ConditionRank {
  op: '>=' | '<';
  var: string;                // Name of variable (e.g. "difficulty")
}

export interface InterpretationCondition {
  category?: string[];        // Categories that match (e.g. ["Arcano Mayor"])
  isFigure?: boolean;         // Figures only if true, non-figures if false
  reversed?: boolean;         // Inverted if true, upright if false
  rank?: ConditionRank;       // Comparison against variable
}

export interface InterpretationOutput {
  when: InterpretationCondition; // {} matches any
  answer: string;                // e.g. "SÍ", "NO catastrófico"
  detail: string;                // Explanation with tokens
}

export interface RuleVariable {
  key: string;                // e.g. "difficulty"
  label: string;              // e.g. "Dificultad (1-10)"
  min: number;
  max: number;
  default: number;
}

export interface InterpretationRule {
  id: string;
  label: string;              // e.g. "Modo Sí/No", "Evento aleatorio"
  style: 'answer' | 'event';
  askQuestion: boolean;
  vars: RuleVariable[];
  reversedSuffix?: string;
  outputs: InterpretationOutput[];
}

export interface OracleDeck {
  id: string;
  name: string;
  backImagePath: string | null;
  orientationMode: 'normal' | 'upDown';
  reversedChance: number;     // Default 0.5
  cards: OracleCard[];
  rules: InterpretationRule[];
  varValues: Record<string, number>;
}

export interface OracleReadingEntry {
  id: string;
  deckId: string;
  ruleId: string | null;
  date: string;
  timestamp: number;
  card: string;
  type: string;               // Category name for backward-compatibility with original log
  meaning: string;
  orientation: 'Normal' | 'Invertida';
  question?: string;
  answer?: string;
  detail?: string;
  eventType?: string;
  eventDescription?: string;
}
