export const VIEW_TYPE_DINO = 'dino-tabletop-engine-view';

export const HP_KEYS = ['hp', 'HP', 'puntosDeVida', 'puntos_de_vida', 'vida', 'Vida', 'PV', 'pv'];
export const MAXHP_KEYS = [
  'maxHp', 'maxHP', 'hpMax', 'hp_max', 'puntosDeVidaMax',
  'puntos_de_vida_max', 'vidaMax', 'vida_max', 'PVMax', 'pv_max',
];

export const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'];
export const IMAGE_KEYS = ['image', 'imagen', 'img', 'foto', 'picture', 'avatar', 'token', 'tokenImage', 'imagenToken', 'retrato'];
export const WEIGHT_KEYS = ['weight', 'peso', 'peso_unitario', 'carga', 'weight_unit'];

export interface InventoryItem {
  id: string;
  label: string;
  value: number;
  max: number | null;
  weight: number | null;      // null = does not add weight
  imagePath: string | null;
  note: string | null;        // linked note path
  pinned: boolean;            // true = shown as badge on token in map
}

export interface InventoryCapacity {
  mode: 'none' | 'weight' | 'slots';
  value: number;
  label: string;              // e.g. "kg", "lbs", "espacios", "slots"
}

export interface TokenInventory {
  items: InventoryItem[];
  capacity: InventoryCapacity;
}

export interface CounterData {
  id: string;
  label: string;
  value: number;
  max: number | null;
}

export interface ConditionData {
  id: string;
  name: string;
  icon?: string | null;
  roundsRemaining: number | null; // null = permanente / indefinido
  color?: string | null;
}

export interface TokenData {
  id: string;
  name: string;
  color: string;
  size: number;
  x: number; // porcentaje 0-100 dentro del mapa
  y: number;
  hp: number;
  maxHp: number;
  linkedNote: string | null;
  imagePath: string | null;
  icon?: string | null;
  inventory?: TokenInventory;
  counters?: CounterData[]; // legacy fallback for backward compatibility
  conditions?: ConditionData[];
}

export interface POIData {
  id: string;
  name: string;
  size: number;
  x: number;
  y: number;
  color?: string | null;
  imagePath: string | null;
  icon?: string | null;
  linkedNote: string | null;
}

export interface CombatantData {
  id: string;
  tokenId: string | null;
  name: string;
  initiative: number | null;
  hp: number;
  maxHp: number;
  color: string;
  imagePath: string | null;
  icon?: string | null;
  conditions?: ConditionData[];
}

export interface CombatData {
  active: boolean;
  round: number;
  turnIndex: number;
  combatants: CombatantData[];
}

// ─── Card Module ──────────────────────────────────────────────────────────

export interface CardDefinition {
  id: string;
  name: string;
  frontImage: string | null;
  /** Overrides deck-level backImage when set */
  backImage: string | null;
  copies: number;
  linkedNote: string | null;
}

export type CardRotationMode = 'normal' | 'updown' | 'foursides' | 'custom';

export interface DeckData {
  id: string;
  name: string;
  /** Default back image for every card in this deck */
  backImage: string | null;
  rotationMode: CardRotationMode;
  /** Used only when rotationMode === 'custom' */
  customAngles: number[];
  cards: CardDefinition[];
  /** Ordered list of instanceIds currently in the draw pile */
  drawPile: string[];
  /** Ordered list of instanceIds in the discard pile */
  discardPile: string[];
}

/**
 * A card placed on a specific map.
 * instanceId format: `${cardDefId}-${copyIndex}` (unique per deck).
 */
export interface CardOnTable {
  instanceId: string;
  deckId: string;
  cardId: string;
  x: number;   // percentage 0-100
  y: number;   // percentage 0-100
  rotation: number; // 0 | 90 | 180 | 270
  faceUp: boolean;
  z: number;   // stacking order
}

// ──────────────────────────────────────────────────────────────────────────

// ─── Timeline & Clocks Module ──────────────────────────────────────────────

export interface TimelineCycleSegment {
  name: string;
  length: number; // in timeline units
}

export interface TimelineCycle {
  id: string;
  name: string;
  segments: TimelineCycleSegment[];
  offset: number; // initial offset in units
  showRepeatCount?: boolean;
  repeatStart?: number; // e.g. 1 (Year 1)
}

export interface TimelineAdvanceStep {
  id: string;
  label?: string; // e.g. "+1 jornada" or custom
  amount: number; // e.g. 1, 7, 30, -1
}

export interface TimelineEvent {
  id: string;
  name: string;
  description?: string;
  counter?: number | null; // specific absolute counter value
  cycleId?: string | null; // or recurring on a cycle
  segmentIndex?: number | null; // segment within cycle (0-indexed)
  segmentDay?: number | null; // day within segment (1-indexed)
  color?: string | null;
}

export interface ClockData {
  id: string;
  name: string;
  segments: number; // e.g. 4, 6, 8, 10, 12
  filled: number;   // 0 to segments
  color?: string | null;
  linkedTimelineId?: string | null;
  advanceEvery?: number | null; // advance 1 filled segment every N timeline units
}

export interface TimelineData {
  id: string;
  name: string;
  unit: string;      // e.g. "jornada", "turno", "día", "hora"
  counter: number;
  allowNegative?: boolean;
  cycles: TimelineCycle[];
  format: string;    // e.g. "{Estación}, {Mes} · {unit} {counter}"
  steps: TimelineAdvanceStep[];
  events?: TimelineEvent[];
}

// ─── Map Grid & Measure Config ─────────────────────────────────────────────

export type GridType = 'square' | 'hex';
export type GridSizeMode = 'cellSize' | 'count';
export type GridHexOrientation = 'pointy' | 'flat';
export type DiagonalRule = 'euclidean' | 'chebyshev' | 'manhattan' | 'alternating' | 'diagonal1_5';
export type MeasureUnit = 'in' | 'cm' | 'm';

export interface MapGridConfig {
  enabled: boolean;
  cellSizePx: number;        // pixel size of a grid cell on map
  offsetX: number;           // grid offset X in pixels
  offsetY: number;           // grid offset Y in pixels
  cellRealSize: number;      // how much a cell measures in real units (e.g. 5, 1.5)
  unit: MeasureUnit;         // 'in' | 'cm' | 'm'
  diagonalRule: DiagonalRule;// counting rule for diagonals
  showOverlay: boolean;      // whether grid is visually drawn
  color: string;             // hex color string (e.g. '#ffffff')
  opacity: number;           // 0.1 to 1.0 (e.g. 0.35)
  thickness?: number;        // line width in px (1-5)
  type?: GridType;           // 'square' | 'hex'
  hexOrientation?: GridHexOrientation; // 'pointy' | 'flat'
  snapTokens?: boolean;      // whether tokens snap to cell centers
  mode?: GridSizeMode;       // 'cellSize' | 'count'
  cellSize?: number;         // legacy alias for cellSizePx
  columns?: number;          // column count when mode === 'count'
  rows?: number;             // row count when mode === 'count'
}

export interface MapRuler {
  id: string;
  kind: 'line' | 'radius';
  from: { x: number; y: number }; // percentage 0-100
  to: { x: number; y: number };   // percentage 0-100
  distanceMm: number;
  color: string;
  label?: string;
}

// ─── Wargame Module Data ──────────────────────────────────────────────────

export interface WargameArcs {
  front: number; // degrees, default 90
  flank: number; // degrees, default 90
  rear: number;  // degrees, default 180
}

export interface WargameRosterUnit {
  id: string;
  name: string;
  pointCost: number;
  modelsCount: number;
  imagePath: string | null;
  linkedNote: string | null;
  woundsPerModel: number;
  arcs: WargameArcs;
  baseSizePx?: number;
  cohesionDistanceMm?: number | null;
  color?: string;
}

export interface WargameRoster {
  id: string;
  name: string;
  units: WargameRosterUnit[];
}

export interface WargameSide {
  id: string;
  name: string;
  color: string;
  victoryPoints: number;
}

export interface WargameModel {
  id: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  facing: number; // degrees 0-359
  woundsCurrent: number;
  woundsMax: number;
}

export interface WargameUnitOnTable {
  id: string;
  rosterUnitId: string | null;
  name: string;
  sideId: string;
  cohesionDistanceMm: number | null;
  color?: string;
  imagePath?: string | null;
  baseSizePx?: number;
  arcs?: WargameArcs;
  models: WargameModel[];
}

export interface WargamePhases {
  names: string[]; // e.g. ["Movimiento", "Disparo", "Combate", "Moral"]
  turnMode: 'perSideAllPhases' | 'alternatingUnits';
  round: number;
  currentSideIndex: number;
  currentPhaseIndex: number;
}

export interface WargameZone {
  id: string;
  kind: 'terrain' | 'deployment';
  shapeType: 'rect' | 'circle' | 'polygon';
  points: { x: number; y: number }[]; // percentage 0-100
  label: string;
  color: string;
  sideId: string | null;
}

export interface WargameObjective {
  id: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  label: string;
  sideId: string | null;
  controlledBy: string | null;
  pointsPerTurn: number | null;
}

export interface WargameMatchData {
  enabled: boolean;
  sides: WargameSide[];
  units: WargameUnitOnTable[];
  phases: WargamePhases;
  zones: WargameZone[];
  objectives: WargameObjective[];
}

export interface MapData {
  name: string;
  imagePath: string | null;
  drawing: DrawingData | null;
  tokens: TokenData[];
  pois: POIData[];
  combat?: CombatData | null;
  cardsOnTable?: CardOnTable[];
  grid?: MapGridConfig;
  rulers?: MapRuler[];
  wargame?: WargameMatchData | null;
}

export interface DrawPoint {
  x: number;
  y: number;
}

export interface DrawStroke {
  id: string;
  tool: 'pen' | 'line' | 'rect';
  color: string;
  width: number;
  points: DrawPoint[];
}

export interface DrawingImage {
  id: string;
  imagePath: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DrawingData {
  width: number;
  height: number;
  strokes: DrawStroke[];
  images: DrawingImage[];
  backgroundImagePath: string | null;
}

export interface CampaignData {
  name: string;
  maps: Record<string, MapData>;
  currentMapId: string | null;
  diaryFolderPath?: string | null;
}

export interface BestiaryEntry {
  id: string;
  name: string;
  pack?: string;
  color: string;
  size: number;
  imagePath: string | null;
  icon?: string | null;
  linkedNote: string | null;
  defaultHp: number;
  defaultMaxHp: number;
  inventory?: TokenInventory;
  counters?: CounterData[];
}

import { SupportedLanguage } from './i18n';
export type { SupportedLanguage };

export interface DiceTrayExpression {
  id: string;
  label: string;       // Friendly name: "Ataque con espada"
  expression: string;  // Raw expression: "1d20+5"
}

export interface DiceTraySettings {
  savedExpressions: DiceTrayExpression[];
  panelPosition: { x: number; y: number };
}

export type ToolbarLayout = 'top' | 'floating' | 'floating-left' | 'floating-right';

export interface DinoSettings {
  language: SupportedLanguage;
  toolbarLayout?: ToolbarLayout;
  floatingToolbarPosition?: { x: number; y: number };
  enabledModules: Record<string, boolean>;
  campaigns: Record<string, CampaignData>;
  currentCampaignId: string | null;
  bestiary: Record<string, BestiaryEntry>;
  bestiaryPacks?: string[];
  /** Global deck definitions + draw/discard state */
  decks: Record<string, DeckData>;
  /** Global timelines / calendars */
  timelines: Record<string, TimelineData>;
  /** Global clocks / progress trackers */
  clocks: Record<string, ClockData>;
  currentTimelineId: string | null;
  /** Global Wargame Rosters */
  wargameRosters?: Record<string, WargameRoster>;
  activeRosterId?: string | null;
  /** Global Dice Tray settings & saved expressions */
  diceTray?: DiceTraySettings;
}

export const DEFAULT_SETTINGS: DinoSettings = {
  language: 'auto',
  toolbarLayout: 'top',
  floatingToolbarPosition: { x: 16, y: 16 },
  enabledModules: {
    'combat-tracker': false,
    'cards': false,
    'timeline': false,
    'measure': true,
    'wargame': false,
    'dice-tray': false,
  },
  campaigns: {},
  currentCampaignId: null,
  bestiary: {},
  bestiaryPacks: [],
  decks: {},
  timelines: {},
  clocks: {},
  currentTimelineId: null,
  wargameRosters: {},
  activeRosterId: null,
  diceTray: {
    savedExpressions: [],
    panelPosition: { x: 80, y: 200 },
  },
};

export interface IconPack {
  label: string;
  emoji: string;
  icons: string[];
}

export const RPG_ICON_PACKS: Record<string, IconPack> = {
  weapons: {
    label: 'icons.packWeapons',
    emoji: '⚔️',
    icons: [
      'ra-sword', 'ra-swords-power', 'ra-crossed-swords', 'ra-spinning-sword', 'ra-lightning-sword',
      'ra-relic-blade', 'ra-plain-dagger', 'ra-daggers', 'ra-knife', 'ra-kitchen-knives',
      'ra-axe', 'ra-battle-axe', 'ra-large-hammer', 'ra-hammer', 'ra-warhammer',
      'ra-mace', 'ra-spiked-mace', 'ra-spear', 'ra-spear-head', 'ra-trident',
      'ra-bow', 'ra-crossbow', 'ra-archery-target', 'ra-arrow-cluster', 'ra-thorn-arrow', 'ra-supersonic-arrow',
      'ra-shuriken', 'ra-kunai', 'ra-sickle', 'ra-scythe', 'ra-whip',
    ],
  },
  armor: {
    label: 'icons.packArmor',
    emoji: '🛡️',
    icons: [
      'ra-shield', 'ra-round-shield', 'ra-fire-shield', 'ra-heart-shield', 'ra-zebra-shield',
      'ra-knight-helmet', 'ra-vest', 'ra-helmet',
    ],
  },
  creatures: {
    label: 'icons.packCreatures',
    emoji: '🐲',
    icons: [
      'ra-dragon', 'ra-dragon-breath', 'ra-two-dragons', 'ra-hydra', 'ra-wyvern',
      'ra-sea-serpent', 'ra-kraken', 'ra-octopus', 'ra-shark',
      'ra-wolf-howl', 'ra-wolf-head', 'ra-bear-head', 'ra-lion',
      'ra-cat', 'ra-rabbit', 'ra-bat', 'ra-raven', 'ra-seagull',
      'ra-spider-face', 'ra-snake', 'ra-venomous-snake', 'ra-snail', 'ra-maggot',
      'ra-monster-skull', 'ra-tentacle', 'ra-spiked-tentacle', 'ra-suckered-tentacle',
      'ra-fairy', 'ra-angel-wings', 'ra-feather-wing', 'ra-sheep',
    ],
  },
  magic: {
    label: 'icons.packMagic',
    emoji: '🧪',
    icons: [
      'ra-wand', 'ra-crystal-wand', 'ra-fairy-wand',
      'ra-fire', 'ra-small-fire', 'ra-frostfire', 'ra-alien-fire',
      'ra-lightning', 'ra-lightning-bolt', 'ra-lightning-storm', 'ra-lightning-trio',
      'ra-aura', 'ra-sunbeams', 'ra-snowflake', 'ra-lava',
      'ra-potion', 'ra-vial', 'ra-flask', 'ra-round-bottom-flask', 'ra-cauldron',
      'ra-crystal-cluster', 'ra-gem', 'ra-sapphire',
      'ra-scroll-unfurled', 'ra-spell-book', 'ra-rune-stone',
      'ra-poison-cloud', 'ra-regeneration', 'ra-arcane-mask',
      'ra-triforce', 'ra-ankh', 'ra-omega',
    ],
  },
  characters: {
    label: 'icons.packCharacters',
    emoji: '👤',
    icons: [
      'ra-player', 'ra-player-king', 'ra-player-lift', 'ra-player-teleport', 'ra-player-dodge',
      'ra-player-despair', 'ra-player-pain', 'ra-player-pyromaniac', 'ra-player-shot',
      'ra-player-thunder-struck', 'ra-queen-crown', 'ra-pawn', 'ra-sheriff',
      'ra-muscle-up', 'ra-muscle-fat',
    ],
  },
  places: {
    label: 'icons.packPlaces',
    emoji: '🏰',
    icons: [
      'ra-castle-emblem', 'ra-locked-fortress', 'ra-tower', 'ra-village',
      'ra-lighthouse', 'ra-ship-emblem', 'ra-pyramids', 'ra-mountains',
      'ra-palm-tree', 'ra-pine-tree', 'ra-tombstone', 'ra-wooden-sign',
      'ra-metal-gate', 'ra-mine-wagon', 'ra-anchor',
    ],
  },
  treasures: {
    label: 'icons.packTreasures',
    emoji: '💎',
    icons: [
      'ra-chest', 'ra-locked-chest', 'ra-gold-bar', 'ra-coins',
      'ra-gem', 'ra-sapphire', 'ra-mining-diamonds',
      'ra-key', 'ra-key-basic', 'ra-three-keys',
      'ra-trophy', 'ra-skull-trophy', 'ra-crown',
    ],
  },
  nature: {
    label: 'icons.packNature',
    emoji: '🌿',
    icons: [
      'ra-campfire', 'ra-candle', 'ra-torch', 'ra-lantern-flame',
      'ra-sun', 'ra-sun-symbol', 'ra-moon-sun', 'ra-moon',
      'ra-water-drop', 'ra-splash', 'ra-spiral-shell',
      'ra-leaf', 'ra-sprout', 'ra-sprout-emblem', 'ra-clover', 'ra-clover-spiked', 'ra-acorn',
      'ra-apple', 'ra-mushroom', 'ra-super-mushroom',
      'ra-egg', 'ra-pawprint', 'ra-footprint', 'ra-shoe-prints', 'ra-trail',
    ],
  },
  health: {
    label: 'icons.packHealth',
    emoji: '❤️',
    icons: [
      'ra-heart', 'ra-hearts', 'ra-two-hearts', 'ra-heart-bottle', 'ra-heart-shield',
      'ra-broken-heart', 'ra-shot-through-the-heart',
      'ra-skull', 'ra-monster-skull', 'ra-skull-trophy',
      'ra-eye', 'ra-bleeding-eye',
      'ra-meat', 'ra-roast-chicken', 'ra-fish',
      'ra-medical-pack', 'ra-pill', 'ra-pills', 'ra-syringe',
      'ra-tooth', 'ra-noose',
    ],
  },
  tools: {
    label: 'icons.packTools',
    emoji: '🔧',
    icons: [
      'ra-compass', 'ra-anvil', 'ra-hourglass', 'ra-stopwatch',
      'ra-telescope', 'ra-mirror', 'ra-lever', 'ra-shovel',
      'ra-book', 'ra-tome', 'ra-quill-ink',
      'ra-ringing-bell', 'ra-ocarina', 'ra-microphone',
      'ra-wrench', 'ra-repair', 'ra-magnet', 'ra-light-bulb',
      'ra-ammo-bag', 'ra-match', 'ra-spray-can', 'ra-load', 'ra-save',
    ],
  },
  food: {
    label: 'icons.packFood',
    emoji: '🍖',
    icons: [
      'ra-meat', 'ra-meat-hook', 'ra-roast-chicken', 'ra-fish',
      'ra-apple', 'ra-mushroom', 'ra-toast',
      'ra-knife-fork', 'ra-vase',
    ],
  },
  zodiac: {
    label: 'icons.packZodiac',
    emoji: '♈',
    icons: [
      'ra-aquarius', 'ra-pisces', 'ra-taurus', 'ra-leo',
      'ra-virgo', 'ra-libra', 'ra-scorpio', 'ra-sagittarius',
      'ra-ophiuchus',
    ],
  },
  dice: {
    label: 'icons.packDice',
    emoji: '🎲',
    icons: [
      'ra-perspective-dice-one', 'ra-perspective-dice-two', 'ra-perspective-dice-three',
      'ra-perspective-dice-four', 'ra-perspective-dice-five', 'ra-perspective-dice-six',
      'ra-perspective-dice-random',
    ],
  },
};

/** Flat array of ALL icons across packs (deduplicated) */
export const RPG_AWESOME_ICONS: string[] = (() => {
  const set = new Set<string>();
  for (const pack of Object.values(RPG_ICON_PACKS)) {
    for (const icon of pack.icons) set.add(icon);
  }
  return [...set].sort();
})();

export type DrawTool = 'pen' | 'line' | 'rect' | 'image';

export interface PaintDrawingOpts {
  imageCache?: Record<string, HTMLImageElement>;
  selectedImageId?: string | null;
  pending?: DrawStroke | null;
  onImageLoad?: () => void;
}

export interface NotePanelHandle {
  el: HTMLElement;
  file: any;
  textarea: HTMLTextAreaElement;
  previewEl: HTMLElement;
  mode: 'preview' | 'edit';
  rawContent: string;
}
