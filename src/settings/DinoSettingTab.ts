import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import { DEFAULT_CUSTOM_FONT_CSS } from '../types';

export class DinoSettingTab extends PluginSettingTab {
  plugin: any;

  constructor(app: App, plugin: any) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Configuración de Dino Tabletop Engine' });

    // --- Sección: Fuentes e Íconos ---
    containerEl.createEl('h3', { text: 'Íconos y Fuentes Personalizadas' });

    new Setting(containerEl)
      .setName('Habilitar fuente de íconos personalizados')
      .setDesc('Permite usar íconos personalizados (RPG-Awesome, FontAwesome, etc.) en tokens, criaturas del bestiario y puntos de interés.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableCustomFont)
          .onChange(async (val) => {
            this.plugin.settings.enableCustomFont = val;
            await this.plugin.saveSettings();
            await this.plugin.applyCustomFontCss();
          })
      );

    new Setting(containerEl)
      .setName('URL o ruta del archivo CSS de la fuente')
      .setDesc(
        'Por defecto se utiliza el CDN de RPG-Awesome (https://github.com/nagoshiashumari/Rpg-Awesome). Puedes cambiarla por otra URL remota (CDN) o por la ruta relativa a un archivo .css dentro de tu bóveda.',
      )
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_CUSTOM_FONT_CSS)
          .setValue(this.plugin.settings.customFontCssUrl || '')
          .onChange(async (val) => {
            this.plugin.settings.customFontCssUrl = val.trim();
            await this.plugin.saveSettings();
          })
      )
      .addButton((btn) =>
        btn
          .setButtonText('Restablecer por defecto')
          .setTooltip('Restablece a la CDN oficial de RPG-Awesome')
          .onClick(async () => {
            this.plugin.settings.customFontCssUrl = DEFAULT_CUSTOM_FONT_CSS;
            await this.plugin.saveSettings();
            await this.plugin.applyCustomFontCss();
            this.display();
            new Notice('Ruta de fuente restablecida a RPG-Awesome por defecto.');
          })
      );

    new Setting(containerEl)
      .setName('Prefijo de clase CSS del ícono')
      .setDesc('Prefijo usado para construir la clase del ícono. Para RPG-Awesome es "ra", para FontAwesome es "fa", etc.')
      .addText((text) =>
        text
          .setPlaceholder('ra')
          .setValue(this.plugin.settings.customFontPrefix || 'ra')
          .onChange(async (val) => {
            this.plugin.settings.customFontPrefix = val.trim() || 'ra';
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Recargar estilos de fuente')
      .setDesc('Vuelve a aplicar y cargar los estilos CSS en Obsidian inmediatamente.')
      .addButton((btn) =>
        btn
          .setButtonText('Recargar fuente')
          .setIcon('refresh-cw')
          .onClick(async () => {
            await this.plugin.applyCustomFontCss();
            new Notice('Estilos de fuente de íconos recargados.');
          })
      );

    // --- Sección: Acerca de / About ---
    containerEl.createEl('h3', { text: 'Acerca de' });

    const aboutBox = containerEl.createDiv({ cls: 'dte-settings-about-box' });

    const titleRow = aboutBox.createDiv({ cls: 'dte-settings-about-header' });
    titleRow.createEl('strong', { text: 'Dino Tabletop Engine' });
    titleRow.createSpan({ cls: 'dte-settings-badge', text: 'ALPHA v0.1.0' });

    const descEl = aboutBox.createDiv({ cls: 'dte-settings-about-desc' });
    descEl.createEl('p', {
      text: 'Motor de tablero de juego virtual (VTT) dentro de Obsidian para partidas de rol en solitario o multijugador, con gestión de campañas, mapas dibujados o con imágenes, tokens con barras de vida y contadores en tiempo real, puntos de interés con notas flotantes y bestiario integrado.',
    });

    const warningEl = aboutBox.createDiv({ cls: 'dte-settings-warning-card' });
    warningEl.createDiv({
      cls: 'dte-settings-warning-text',
      text: '⚠️ Plugin en desarrollo activo (versión alpha). Actualmente NO está disponible en el repositorio oficial de plugins de la comunidad de Obsidian.',
    });

    const authorRow = aboutBox.createDiv({ cls: 'dte-settings-author-row' });
    authorRow.createSpan({ text: 'Desarrollado por: ' });
    authorRow.createEl('strong', { text: 'Snifer - Bastión del Dinosaurio' });

    const btnRow = aboutBox.createDiv({ cls: 'dte-settings-buttons-row' });

    const ytBtn = btnRow.createEl('button', { cls: 'mod-cta dte-btn-youtube' });
    ytBtn.setText('▶ Canal de YouTube (Snifer - Bastión del Dinosaurio)');
    ytBtn.addEventListener('click', () => {
      window.open('https://www.youtube.com/@SniferL4bs', '_blank');
    });

    const rpgBtn = btnRow.createEl('button', { cls: 'dte-btn-secondary' });
    rpgBtn.setText('⚔ Repositorio RPG-Awesome');
    rpgBtn.addEventListener('click', () => {
      window.open('https://github.com/nagoshiashumari/Rpg-Awesome', '_blank');
    });
  }
}
