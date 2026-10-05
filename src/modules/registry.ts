import { EngineModule } from './types';
import { CombatTrackerModule } from './combatTracker';
import { CardsModule } from './cards';
import { TimelineModule } from './timeline';
import { CampaignDiaryModule } from './campaignDiary';
import { MeasureModule } from './measure';
import { WargameModule } from './wargame';
import { DinoSettings } from '../types';

class ModuleRegistry {
  private modules: Map<string, EngineModule> = new Map();

  constructor() {
    this.register(CombatTrackerModule);
    this.register(CardsModule);
    this.register(TimelineModule);
    this.register(CampaignDiaryModule);
    this.register(MeasureModule);
    this.register(WargameModule);
  }

  register(module: EngineModule): void {
    this.modules.set(module.id, module);
  }

  get(id: string): EngineModule | undefined {
    return this.modules.get(id);
  }

  getAll(): EngineModule[] {
    return Array.from(this.modules.values());
  }

  isEnabled(settings: DinoSettings, id: string): boolean {
    if (!settings.enabledModules) {
      settings.enabledModules = {};
    }
    const val = settings.enabledModules[id];
    if (val !== undefined) return val;
    const mod = this.get(id);
    return mod ? mod.defaultEnabled : false;
  }

  setEnabled(settings: DinoSettings, id: string, enabled: boolean): void {
    if (!settings.enabledModules) {
      settings.enabledModules = {};
    }
    settings.enabledModules[id] = enabled;
  }
}

export const moduleRegistry = new ModuleRegistry();
