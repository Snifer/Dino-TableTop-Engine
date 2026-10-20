import { TranslationKey } from '../i18n';
import { IDinoTabletopView } from '../types';

export interface EngineModule {
  id: string;
  nameKey: TranslationKey;
  descKey: TranslationKey;
  icon: string;
  defaultEnabled: boolean;
  renderToolbarButton?(container: HTMLElement, view: IDinoTabletopView): void;
  renderPanels?(container: HTMLElement, view: IDinoTabletopView): void;
}
