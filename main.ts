import { Notice, Plugin } from 'obsidian';
import {
  VIEW_TYPE_DINO,
  DEFAULT_SETTINGS,
  DinoSettings,
  TokenData,
  HP_KEYS,
  MAXHP_KEYS,
  IMAGE_KEYS,
} from './src/types';
import { genId, readFrontmatterStat, readFrontmatterImagePath } from './src/utils';
import { setLanguage, t } from './src/i18n';
import { DinoTabletopView } from './src/views/DinoTabletopView';
import { DinoSettingTab } from './src/settings/DinoSettingTab';

export default class DinoTabletopEnginePlugin extends Plugin {
  settings: DinoSettings;

  async onload(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
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
                if ((tok as any).counters && (tok as any).counters.length && !tok.inventory) {
                  tok.inventory = {
                    items: (tok as any).counters.map((c: any) => ({
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
                  delete (tok as any).counters;
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
        if ((entry as any).counters && (entry as any).counters.length && !entry.inventory) {
          entry.inventory = {
            items: (entry as any).counters.map((c: any) => ({
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
          delete (entry as any).counters;
          migrated = true;
        }
      }
    }

    if (migrated) {
      await this.saveSettings();
    }

    this.registerView(VIEW_TYPE_DINO, (leaf) => new DinoTabletopView(leaf, this));

    this.addRibbonIcon('swords', t('commands.openView'), () => this.activateView());

    this.addSettingTab(new DinoSettingTab(this.app, this));

    this.addCommand({
      id: 'open-dino-tabletop-engine',
      name: t('commands.openView'),
      callback: () => this.activateView(),
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
