import { TranslationKey } from '../i18n';

export interface EngineModule {
  id: string;
  nameKey: TranslationKey;
  descKey: TranslationKey;
  icon: string;
  defaultEnabled: boolean;
  renderToolbarButton?(container: HTMLElement, view: any): void;
  renderPanels?(container: HTMLElement, view: any): void;
}
