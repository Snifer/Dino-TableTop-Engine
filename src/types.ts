export const VIEW_TYPE_DINO = 'dino-tabletop-engine-view';

export const HP_KEYS = ['hp', 'HP', 'puntosDeVida', 'puntos_de_vida', 'vida', 'Vida', 'PV', 'pv'];
export const MAXHP_KEYS = [
  'maxHp', 'maxHP', 'hpMax', 'hp_max', 'puntosDeVidaMax',
  'puntos_de_vida_max', 'vidaMax', 'vida_max', 'PVMax', 'pv_max',
];

export const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'];
export const IMAGE_KEYS = ['image', 'imagen', 'img', 'foto', 'picture', 'avatar', 'token', 'tokenImage', 'imagenToken', 'retrato'];

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
  counters: CounterData[];
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

export interface MapData {
  name: string;
  imagePath: string | null;
  drawing: DrawingData | null;
  tokens: TokenData[];
  pois: POIData[];
  combat?: CombatData | null;
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
}

export interface BestiaryEntry {
  id: string;
  name: string;
  color: string;
  size: number;
  imagePath: string | null;
  icon?: string | null;
  linkedNote: string | null;
  defaultHp: number;
  defaultMaxHp: number;
  counters: CounterData[];
}

import { SupportedLanguage } from './i18n';
export type { SupportedLanguage };

export interface DinoSettings {
  language: SupportedLanguage;
  enabledModules: Record<string, boolean>;
  campaigns: Record<string, CampaignData>;
  currentCampaignId: string | null;
  bestiary: Record<string, BestiaryEntry>;
  enableCustomFont: boolean;
  customFontCssUrl: string;
  customFontPrefix: string;
}

export const DEFAULT_CUSTOM_FONT_CSS = 'https://cdn.jsdelivr.net/npm/rpg-awesome@0.2.0/css/rpg-awesome.min.css';

export const DEFAULT_SETTINGS: DinoSettings = {
  language: 'auto',
  enabledModules: {
    'combat-tracker': false,
    'cards': false,
  },
  campaigns: {},
  currentCampaignId: null,
  bestiary: {},
  enableCustomFont: true,
  customFontCssUrl: DEFAULT_CUSTOM_FONT_CSS,
  customFontPrefix: 'ra',
};

export const RPG_AWESOME_ICONS = [
  'ra-sword', 'ra-swords-power', 'ra-crossed-swords', 'ra-shield', 'ra-knight-helmet',
  'ra-player', 'ra-player-king', 'ra-player-lift', 'ra-player-teleport', 'ra-player-dodge',
  'ra-dragon', 'ra-dragon-breath', 'ra-hydra', 'ra-monster-skull', 'ra-skull', 'ra-skull-trophy',
  'ra-axe', 'ra-battle-axe', 'ra-bow', 'ra-archery-target', 'ra-arrow-cluster', 'ra-crossbow',
  'ra-hammer', 'ra-warhammer', 'ra-mace', 'ra-spear', 'ra-daggers', 'ra-knife',
  'ra-wand', 'ra-crystal-wand', 'ra-fairy-wand', 'ra-fire-shield', 'ra-frostfire', 'ra-lightning',
  'ra-fire', 'ra-water-drop', 'ra-aura', 'ra-sun', 'ra-moon-sun', 'ra-moon',
  'ra-campfire', 'ra-candle', 'ra-torch', 'ra-castle-emblem', 'ra-tower', 'ra-village',
  'ra-scroll-unfurled', 'ra-quill-ink', 'ra-book', 'ra-spell-book', 'ra-tome',
  'ra-potion', 'ra-vial', 'ra-flask', 'ra-cauldron', 'ra-gem', 'ra-crystal-cluster',
  'ra-key', 'ra-chest', 'ra-locked-chest', 'ra-gold-bar', 'ra-coins',
  'ra-compass', 'ra-anvil', 'ra-hourglass', 'ra-footprint', 'ra-eye', 'ra-bleeding-eye',
  'ra-heart', 'ra-hearts', 'ra-heart-bottle', 'ra-heart-shield', 'ra-broken-heart',
  'ra-meat', 'ra-apple', 'ra-mushroom', 'ra-fish', 'ra-clover', 'ra-clover-spiked',
  'ra-wolf-howl', 'ra-wolf-head', 'ra-cat', 'ra-bear-head', 'ra-bat', 'ra-spider-face',
  'ra-snake', 'ra-tentacles', 'ra-kraken', 'ra-egg', 'ra-feather-wing', 'ra-fairy'
];

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
