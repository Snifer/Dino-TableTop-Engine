import { EngineModule } from './types';
import { CampaignCharacter, CampaignData, TokenData, IDinoTabletopView } from '../types';
import { setIcon } from 'obsidian';
import { t } from '../i18n';
import { PartyModal } from '../modals/PartyModals';
import { genId } from '../utils';

/**
 * Sincroniza en tiempo real el estado de un token hacia su personaje persistente de campaña.
 */
export function syncTokenToCampaignCharacter(camp: CampaignData | null, token: TokenData): void {
  if (!camp || !token.characterId || !camp.characters) return;
  const char = camp.characters[token.characterId];
  if (!char) return;

  char.name = token.name;
  char.color = token.color;
  char.size = token.size;
  char.hp = token.hp;
  char.maxHp = token.maxHp;
  char.linkedNote = token.linkedNote;
  char.imagePath = token.imagePath;
  char.icon = token.icon;
  char.dmOnly = token.dmOnly;
  char.revealsFog = token.revealsFog;

  if (token.conditions) {
    char.conditions = token.conditions.map((c) => ({ ...c }));
  }
  if (token.counters) {
    char.counters = token.counters.map((c) => ({ ...c }));
  }
  if (token.inventory) {
    char.inventory = {
      items: token.inventory.items.map((i) => ({ ...i })),
      capacity: { ...token.inventory.capacity },
    };
  }
}

/**
 * Promueve un token existente en el mapa a personaje persistente de campaña (Party).
 */
export function promoteTokenToCampaignCharacter(camp: CampaignData, token: TokenData): CampaignCharacter {
  if (!camp.characters) {
    camp.characters = {};
  }

  const charId = genId();
  const char: CampaignCharacter = {
    id: charId,
    name: token.name,
    color: token.color,
    size: token.size,
    hp: token.hp,
    maxHp: token.maxHp,
    linkedNote: token.linkedNote,
    imagePath: token.imagePath,
    icon: token.icon,
    dmOnly: token.dmOnly,
    revealsFog: token.revealsFog,
    currentMapId: camp.currentMapId,
    conditions: token.conditions ? token.conditions.map((c) => ({ ...c })) : [],
    counters: token.counters ? token.counters.map((c) => ({ ...c })) : [],
    inventory: token.inventory
      ? {
          items: token.inventory.items.map((i) => ({ ...i })),
          capacity: { ...token.inventory.capacity },
        }
      : undefined,
  };

  camp.characters[charId] = char;
  token.characterId = charId;
  return char;
}

/**
 * Desvincula un token de su personaje persistente de campaña.
 */
export function unlinkTokenFromCampaignCharacter(token: TokenData): void {
  token.characterId = null;
}

export function renderPartyToolbarButton(container: HTMLElement, view: IDinoTabletopView): void {
  const btn = container.createEl('button', {
    cls: 'dte-btn dte-tool-btn',
    attr: { 'aria-label': t('party.panelTitle') },
  });
  const icon = btn.createSpan({ cls: 'dte-btn-icon-prefix' });
  setIcon(icon, 'users');
  btn.createSpan({ text: t('modules.partyShort') });

  btn.addEventListener('click', () => {
    new PartyModal(view.app, view.plugin, view).open();
  });
}

export const PartyModule: EngineModule = {
  id: 'persistent-characters',
  nameKey: 'modules.partyName',
  descKey: 'modules.partyDesc',
  icon: 'users',
  defaultEnabled: false,
  renderToolbarButton: renderPartyToolbarButton,
};
