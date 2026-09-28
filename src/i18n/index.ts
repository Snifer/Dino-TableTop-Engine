import { en, TranslationKey } from './locales/en';
import { es } from './locales/es';

export type SupportedLanguage = 'auto' | 'es' | 'en';

const locales: Record<'es' | 'en', Record<TranslationKey, string>> = {
  en,
  es,
};

let currentLanguageSetting: SupportedLanguage = 'auto';

export function setLanguage(lang: SupportedLanguage): void {
  currentLanguageSetting = lang;
}

export function getCurrentLanguageSetting(): SupportedLanguage {
  return currentLanguageSetting;
}

export function getEffectiveLanguage(): 'es' | 'en' {
  if (currentLanguageSetting === 'es' || currentLanguageSetting === 'en') {
    return currentLanguageSetting;
  }
  
  // Auto-detection based on Obsidian/Moment locale or browser
  try {
    const obsidianLang = (window as any).moment?.locale?.() || navigator.language || 'en';
    if (obsidianLang.toLowerCase().startsWith('es')) {
      return 'es';
    }
  } catch {
    // fallback
  }
  
  return 'en';
}

export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  const lang = getEffectiveLanguage();
  const dict = locales[lang] || locales.en;
  let text = dict[key] || locales.en[key] || (key as string);

  if (params) {
    for (const paramKey in params) {
      const val = String(params[paramKey]);
      text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), val);
    }
  }

  return text;
}

export { en, es };
export type { TranslationKey };
