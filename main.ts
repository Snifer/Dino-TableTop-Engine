import { Notice, Plugin, TFile } from 'obsidian';
import {
  VIEW_TYPE_DINO,
  DEFAULT_SETTINGS,
  DEFAULT_CUSTOM_FONT_CSS,
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
    if (this.settings.enableCustomFont === undefined) this.settings.enableCustomFont = true;
    if (!this.settings.customFontCssUrl) this.settings.customFontCssUrl = DEFAULT_CUSTOM_FONT_CSS;
    if (!this.settings.customFontPrefix) this.settings.customFontPrefix = 'ra';
    if (!this.settings.language) this.settings.language = 'auto';

    setLanguage(this.settings.language);

    this.registerView(VIEW_TYPE_DINO, (leaf) => new DinoTabletopView(leaf, this));

    this.addRibbonIcon('swords', t('commands.openView'), () => this.activateView());

    this.addSettingTab(new DinoSettingTab(this.app, this));

    await this.applyCustomFontCss();

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
            counters: [],
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

  async applyCustomFontCss(): Promise<void> {
    const existingLink = document.getElementById('dte-custom-font-link');
    const existingStyle = document.getElementById('dte-custom-font-style');
    if (existingLink) existingLink.remove();
    if (existingStyle) existingStyle.remove();

    if (!this.settings.enableCustomFont || !this.settings.customFontCssUrl) {
      return;
    }

    const url = this.settings.customFontCssUrl.trim();
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')) {
      const link = document.createElement('link');
      link.id = 'dte-custom-font-link';
      link.rel = 'stylesheet';
      link.href = url;
      document.head.appendChild(link);
    } else {
      const file = this.app.vault.getAbstractFileByPath(url);
      if (file && file instanceof TFile) {
        const content = await this.app.vault.read(file);
        const style = document.createElement('style');
        style.id = 'dte-custom-font-style';
        style.textContent = content;
        document.head.appendChild(style);
      }
    }
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

  onunload(): void {
    const link = document.getElementById('dte-custom-font-link');
    if (link) link.remove();
    const style = document.getElementById('dte-custom-font-style');
    if (style) style.remove();
  }
}
