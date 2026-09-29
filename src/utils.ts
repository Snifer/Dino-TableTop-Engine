import { App, MarkdownRenderer, TFile } from 'obsidian';
import { CounterData, HP_KEYS, MAXHP_KEYS, IMAGE_KEYS } from './types';

/**
 * Renderiza markdown a HTML dentro de `el`, usando la API disponible según la
 * versión de Obsidian instalada.
 */
export async function renderMarkdownInto(
  app: App,
  el: HTMLElement,
  markdown: string,
  sourcePath: string,
  component: any
): Promise<void> {
  el.empty();
  const AnyMarkdownRenderer = MarkdownRenderer as any;
  if (typeof AnyMarkdownRenderer.render === 'function') {
    await AnyMarkdownRenderer.render(app, markdown, el, sourcePath, component);
  } else if (typeof AnyMarkdownRenderer.renderMarkdown === 'function') {
    await AnyMarkdownRenderer.renderMarkdown(markdown, el, sourcePath, component);
  }
}

export function genId(): string {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function readFrontmatterStat(app: App, path: string, keys: string[]): number | null {
  const file = app.vault.getAbstractFileByPath(path);
  if (!file) return null;
  const cache = app.metadataCache.getFileCache(file as TFile);
  const fm = cache && cache.frontmatter;
  if (!fm) return null;
  for (const k of keys) {
    if (fm[k] !== undefined && fm[k] !== null && !isNaN(Number(fm[k]))) {
      return Number(fm[k]);
    }
  }
  return null;
}

/**
 * Busca en el YAML de una nota una propiedad de imagen (image/imagen/img/...) y
 * la resuelve a una ruta real dentro de la bóveda.
 */
export function readFrontmatterImagePath(app: App, notePath: string, keys: string[]): string | null {
  const file = app.vault.getAbstractFileByPath(notePath);
  if (!file) return null;
  const cache = app.metadataCache.getFileCache(file as TFile);
  const fm = cache && cache.frontmatter;
  if (!fm) return null;
  for (const k of keys) {
    let val = fm[k];
    if (val === undefined || val === null) continue;
    if (Array.isArray(val)) val = val[0];
    val = String(val).trim();
    if (!val) continue;
    let clean = val.replace(/^!?\[\[/, '').replace(/\]\]$/, '');
    clean = clean.split('|')[0].trim();
    const dest = app.metadataCache.getFirstLinkpathDest(clean, notePath);
    if (dest) return (dest as TFile).path;
    const direct = app.vault.getAbstractFileByPath(clean);
    if (direct) return (direct as TFile).path;
  }
  return null;
}

export function readFrontmatterWeight(app: App, notePath: string, keys: string[]): number | null {
  const file = app.vault.getAbstractFileByPath(notePath);
  if (!file) return null;
  const cache = app.metadataCache.getFileCache(file as TFile);
  const fm = cache && cache.frontmatter;
  if (!fm) return null;
  for (const k of keys) {
    if (fm[k] !== undefined && fm[k] !== null && !isNaN(Number(fm[k]))) {
      return Number(fm[k]);
    }
  }
  return null;
}

export function newCounter(): CounterData {
  return { id: genId(), label: 'Contador', value: 0, max: null };
}

export function getIconClass(icon: string | null | undefined, prefix = 'ra'): string {
  if (!icon) return '';
  const clean = icon.trim();
  if (clean.includes(' ')) return clean;
  if (clean.startsWith(prefix + '-')) return `${prefix} ${clean}`;
  return `${prefix} ${prefix}-${clean}`;
}
