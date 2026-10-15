import { App, Modal, setIcon } from 'obsidian';

export class OracleAboutModal extends Modal {
  constructor(app: App) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('dte-oracle-about-modal');

    // Header
    const header = contentEl.createDiv({ cls: 'dte-oracle-about-header' });
    const iconSpan = header.createSpan({ cls: 'dte-oracle-about-icon' });
    setIcon(iconSpan, 'info');
    header.createEl('h2', { text: 'Sobre el Proyecto' });

    // Official game notice
    const banner = contentEl.createDiv({ cls: 'dte-oracle-about-banner' });
    banner.createEl('p', {
      text: 'Hierofante es un Oráculo Tarot para jugar rol en Solitario, creado por Alberto Hervalejo.',
    });
    const shopLink = banner.createEl('a', {
      text: 'Comprá tu copia en El Refugio de Ryhope ↗',
      href: 'https://www.elrefugioeditorial.com/oraculo-tarot-rol-hierofante',
    });
    shopLink.setAttr('target', '_blank');
    shopLink.setAttr('rel', 'noopener noreferrer');

    // Body text
    const body = contentEl.createDiv({ cls: 'dte-oracle-about-body' });
    body.createEl('h3', { text: '¡Hola! Esto es un proyecto hecho con Cariño <3' });

    body.createEl('p', {
      text: 'He creado esta herramienta por pura pasión para usarla con Hierofante y para ayudar a la comunidad a disfrutarlo aún más.',
    });

    const disclaimer = body.createEl('p');
    disclaimer.createSpan({
      text: 'Es importante aclarar que esto es ',
    });
    disclaimer.createEl('strong', { text: 'un proyecto personal y completamente independiente' });
    disclaimer.createSpan({
      text: '. No soy el creador de Hierofante: el oráculo, ni formo parte de El Refugio de Ryhope. Todo el crédito es para ellos. Si te gusta lo que ves aquí, ¡por favor, compra el juego y apoya su increíble trabajo!',
    });

    // Author footer
    const footer = contentEl.createDiv({ cls: 'dte-oracle-about-footer' });
    footer.createEl('p', { text: 'Creado por Snifer para el proyecto Bastión del Dinosaurio' });

    const closeBtn = contentEl.createEl('button', {
      text: 'Cerrar',
      cls: 'mod-cta dte-oracle-about-close',
    });
    closeBtn.addEventListener('click', () => this.close());
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
