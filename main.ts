import { Notice, Plugin } from 'obsidian';
import {
  VIEW_TYPE_DINO,
  DEFAULT_SETTINGS,
  DinoSettings,
  DinoPlugin,
  TokenData,
  HP_KEYS,
  MAXHP_KEYS,
  IMAGE_KEYS,
} from './src/types';
import { genId, readFrontmatterStat, readFrontmatterImagePath } from './src/utils';
import { setLanguage, t } from './src/i18n';
import { DinoTabletopView } from './src/views/DinoTabletopView';
import { DinoSettingTab } from './src/settings/DinoSettingTab';
import { VIEW_TYPE_DINO_PROJECTION, DinoProjectionView, openProjectionWindow } from './src/modules/playerView';
import { RandomTablesPanel } from './src/modules/randomTables';
import { RegisterTableModal } from './src/modals/RegisterTableModal';
import { TemplateManagerModal, openCharacterSheet } from './src/modules/characterSheet';
import { StoreModal } from './src/modals/StoreModal';

interface LegacyCounterItem {
  id: string;
  label: string;
  value: number;
  max: number;
}

interface LegacyWithCounters {
  counters?: LegacyCounterItem[];
  inventory?: unknown;
}

export default class DinoTabletopEnginePlugin extends Plugin implements DinoPlugin {
  settings: DinoSettings;

  async onload(): Promise<void> {
    const loadedData = (await this.loadData()) as Partial<DinoSettings> | null;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData ?? {});
    if (!this.settings.bestiary) this.settings.bestiary = {};
    if (!this.settings.language) this.settings.language = 'auto';

    setLanguage(this.settings.language);

    // ── Migración transparente: token.counters -> token.inventory ──
    let migrated = false;
    if (this.settings.campaigns) {
      for (const campId in this.settings.campaigns) {
        const camp = this.settings.campaigns[campId];
        if (camp.maps) {
          for (const mapId in camp.maps) {
            const map = camp.maps[mapId];
            if (map.tokens) {
              for (const tok of map.tokens) {
                const legacyTok = tok as unknown as LegacyWithCounters;
                if (legacyTok.counters && legacyTok.counters.length && !tok.inventory) {
                  tok.inventory = {
                    items: legacyTok.counters.map((c) => ({
                      id: c.id,
                      label: c.label,
                      value: c.value,
                      max: c.max,
                      weight: null,
                      imagePath: null,
                      note: null,
                      pinned: true,
                    })),
                    capacity: { mode: 'none', value: 0, label: '' },
                  };
                  delete legacyTok.counters;
                  migrated = true;
                }
              }
            }
          }
        }
      }
    }

    if (this.settings.bestiary) {
      for (const bId in this.settings.bestiary) {
        const entry = this.settings.bestiary[bId];
        const legacyEntry = entry as unknown as LegacyWithCounters;
        if (legacyEntry.counters && legacyEntry.counters.length && !entry.inventory) {
          entry.inventory = {
            items: legacyEntry.counters.map((c) => ({
              id: c.id,
              label: c.label,
              value: c.value,
              max: c.max,
              weight: null,
              imagePath: null,
              note: null,
              pinned: true,
            })),
            capacity: { mode: 'none', value: 0, label: '' },
          };
          delete legacyEntry.counters;
          migrated = true;
        }
      }
    }

    if (migrated) {
      await this.saveSettings();
    }

    this.registerView(VIEW_TYPE_DINO, (leaf) => new DinoTabletopView(leaf, this));
    this.registerView(VIEW_TYPE_DINO_PROJECTION, (leaf) => new DinoProjectionView(leaf, this));

    this.addRibbonIcon('swords', t('commands.openView'), () => this.activateView());

    this.addSettingTab(new DinoSettingTab(this.app, this));

    this.addCommand({
      id: 'open-view',
      name: t('commands.openView'),
      callback: () => this.activateView(),
    });

    this.addCommand({
      id: 'open-player-projection-view',
      name: 'Abrir ventana de proyección / Vista de jugador (Testeo)',
      callback: () => openProjectionWindow(this.app, this),
    });

    this.addCommand({
      id: 'open-random-tables',
      name: 'Abrir Tablas Aleatorias',
      callback: () => {
        const view = this.getOpenDinoView();
        if (view) {
          if (!view.randomTablesPanel) {
            view.randomTablesPanel = new RandomTablesPanel(
              this.app,
              this,
              view.panelsLayer || view.containerEl
            );
          }
          (view.randomTablesPanel as RandomTablesPanel).open();
        } else {
          this.activateView().then(() => {
            const openView = this.getOpenDinoView();
            if (openView) {
              if (!openView.randomTablesPanel) {
                openView.randomTablesPanel = new RandomTablesPanel(
                  this.app,
                  this,
                  openView.panelsLayer || openView.containerEl
                );
              }
              (openView.randomTablesPanel as RandomTablesPanel).open();
            }
          });
        }
      },
    });

    this.addCommand({
      id: 'register-note-as-table',
      name: 'Registrar nota activa como tabla aleatoria',
      callback: () => {
        const activeFile = this.app.workspace.getActiveFile();
        new RegisterTableModal(this.app, this, activeFile || undefined).open();
      },
    });

    this.addCommand({
      id: 'open-character-sheet-templates',
      name: 'Abrir gestor de plantillas de hoja de personaje',
      callback: () => {
        new TemplateManagerModal(this.app, this).open();
      },
    });

    this.addCommand({
      id: 'open-active-note-sheet',
      name: 'Abrir hoja de personaje de la nota activa',
      callback: () => {
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile) {
          openCharacterSheet(this.app, this, activeFile.path);
        } else {
          new Notice('No hay ninguna nota activa abierta.');
        }
      },
    });

    this.addCommand({
      id: 'open-store',
      name: 'Abrir Tienda de Paquetes Dino / Store',
      callback: () => {
        new StoreModal(this.app, this).open();
      },
    });

    this.addCommand({
      id: 'add-active-note-as-token',
      name: t('commands.addActiveNote'),
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile();
        const view = this.getOpenDinoView();
        const map = view ? view.getCurrentMap() : null;
        const ok = !!(file && map);
        if (ok && !checking && file && map) {
          const hp = readFrontmatterStat(this.app, file.path, HP_KEYS);
          const maxHp = readFrontmatterStat(this.app, file.path, MAXHP_KEYS);
          const img = readFrontmatterImagePath(this.app, file.path, IMAGE_KEYS);
          const center = (view as DinoTabletopView).getViewportCenterCoords ? (view as DinoTabletopView).getViewportCenterCoords() : { x: 50, y: 50 };
          const token: TokenData = {
            id: genId(),
            name: file.basename,
            color: '#4c8bf5',
            size: 44,
            x: center.x,
            y: center.y,
            hp: hp ?? 10,
            maxHp: maxHp ?? 10,
            linkedNote: file.path,
            imagePath: img || null,
            icon: null,
          };
          map.tokens.push(token);
          this.saveSettings();
          (view as DinoTabletopView).render();
          new Notice(t('commands.tokenCreatedNotice', { name: file.basename }));
        }
        return ok;
      },
    });
  }

  getOpenDinoView(): DinoTabletopView | null {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_DINO);
    return leaves.length ? (leaves[0].view as DinoTabletopView) : null;
  }

  async activateView(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_DINO);
    if (existing.length) {
      this.app.workspace.revealLeaf(existing[0]);
      return;
    }
    const leaf = this.app.workspace.getLeaf('tab');
    await leaf.setViewState({ type: VIEW_TYPE_DINO, active: true });
    this.app.workspace.revealLeaf(leaf);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  onunload(): void {}
}
