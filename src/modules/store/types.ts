export type StorePackageType =
  | 'campaign'
  | 'sheet'
  | 'oracle'
  | 'tables'
  | 'wargame'
  | 'assets'
  | 'bundle';

export interface StorePackage {
  id: string;
  name: string;
  type: StorePackageType;
  version: string;
  author: string;
  license: string;
  description: string;
  tags: string[];
  language: string;
  dteMinVersion?: string;
  requiresModules?: string[];
  requiresPlugins?: string[]; // Obsidian community plugin IDs (e.g. 'obsidian-dice-roller', 'dataview')
  size?: number;
  sha256?: string;
  downloadUrl: string;
  manifestUrl?: string;
  previewUrl?: string | null;
  readmeUrl?: string | null;
  purchaseUrl?: string | null;
  updatedAt?: string;
  sourceId?: string;
  sourceBaseUrl?: string;
}

export interface StoreCatalog {
  schema: number;
  name: string;
  description?: string;
  updatedAt: string;
  totalPackages: number;
  packages: StorePackage[];
}

export interface StoreSource {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
}

export interface StoreInstalledReceipt {
  packageId: string;
  name: string;
  type: StorePackageType;
  version: string;
  sourceId: string;
  installedAt: string;
  sha256?: string;
  installedPath?: string;
  campaignId?: string;
}

export interface StoreSettings {
  sources: StoreSource[];
  installFolder: string;
  cacheMinutes: number;
  installed: Record<string, StoreInstalledReceipt>;
  submitFormUrl: string;
}

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  sources: [
    {
      id: 'official',
      name: 'DTE Official Store',
      url: 'https://raw.githubusercontent.com/Snifer/dino-tabletop-engine-store/main/catalog.json',
      enabled: true,
    },
  ],
  installFolder: 'DTE/Store',
  cacheMinutes: 60,
  installed: {},
  submitFormUrl: 'https://forms.gle/QafjhDjpHxTYrahw8',
};

