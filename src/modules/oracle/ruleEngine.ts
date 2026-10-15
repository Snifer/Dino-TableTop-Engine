import { OracleCard, InterpretationRule, InterpretationOutput } from './types';

export interface EvaluationResult {
  answer?: string;
  detail?: string;
  eventType?: string;
  eventDescription?: string;
}

export function interpolateTokens(
  template: string,
  card: OracleCard,
  reversed: boolean,
  varValues: Record<string, number>
): string {
  let result = template;
  const orientationText = reversed ? 'invertida' : 'al derecho';
  
  result = result.replace(/{card}/g, card.name);
  result = result.replace(/{category}/g, card.category);
  result = result.replace(/{rank}/g, card.rank !== null ? String(card.rank) : '');
  result = result.replace(/{orientation}/g, orientationText);

  for (const [k, v] of Object.entries(varValues)) {
    result = result.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
  }

  return result;
}

export function evaluateRule(
  rule: InterpretationRule,
  card: OracleCard,
  reversed: boolean,
  varValues: Record<string, number>
): EvaluationResult {
  const effectiveVars: Record<string, number> = {};
  for (const v of rule.vars) {
    effectiveVars[v.key] = varValues[v.key] ?? v.default;
  }

  let matchedOutput: InterpretationOutput | null = null;

  for (const out of rule.outputs) {
    const cond = out.when;

    // Check category condition
    if (cond.category && cond.category.length > 0) {
      if (!cond.category.includes(card.category)) {
        continue;
      }
    }

    // Check isFigure condition
    if (cond.isFigure !== undefined) {
      if (card.isFigure !== cond.isFigure) {
        continue;
      }
    }

    // Check reversed condition
    if (cond.reversed !== undefined) {
      if (reversed !== cond.reversed) {
        continue;
      }
    }

    // Check rank condition
    if (cond.rank) {
      if (card.rank === null) {
        continue;
      }
      const targetVal = effectiveVars[cond.rank.var] ?? 0;
      if (cond.rank.op === '>=') {
        if (!(card.rank >= targetVal)) {
          continue;
        }
      } else if (cond.rank.op === '<') {
        if (!(card.rank < targetVal)) {
          continue;
        }
      }
    }

    // All conditions met
    matchedOutput = out;
    break;
  }

  if (!matchedOutput) {
    matchedOutput = {
      when: {},
      answer: 'Indeterminado',
      detail: 'No se pudo interpretar la carta.',
    };
  }

  let answerText = interpolateTokens(matchedOutput.answer, card, reversed, effectiveVars);
  let detailText = interpolateTokens(matchedOutput.detail, card, reversed, effectiveVars);

  if (reversed && rule.reversedSuffix) {
    detailText += rule.reversedSuffix;
  }

  if (rule.style === 'event') {
    return {
      eventType: answerText,
      eventDescription: detailText,
    };
  }

  return {
    answer: answerText,
    detail: detailText,
  };
}

export const HIEROFANTE_RULES: InterpretationRule[] = [
  {
    id: 'hierofante-binary',
    label: 'Modo Sí/No',
    style: 'answer',
    askQuestion: true,
    vars: [
      {
        key: 'difficulty',
        label: 'Dificultad (1-10)',
        min: 1,
        max: 10,
        default: 5,
      },
    ],
    outputs: [
      {
        when: { category: ['Arcano Mayor'], reversed: false },
        answer: 'SÍ',
        detail: 'Respuesta rotunda: éxito completo o evento significativo',
      },
      {
        when: { category: ['Arcano Mayor'], reversed: true },
        answer: 'NO',
        detail: 'Respuesta rotunda: fracaso o barrera infranqueable',
      },
      {
        when: { isFigure: true, reversed: false },
        answer: 'SÍ',
        detail: 'Éxito completo con resultado positivo',
      },
      {
        when: { isFigure: true, reversed: true },
        answer: 'SÍ con complicación',
        detail: 'Éxito con coste o complicación asociada a la carta',
      },
      {
        when: { rank: { op: '>=', var: 'difficulty' }, reversed: false },
        answer: 'SÍ',
        detail: 'Éxito ({rank} >= {difficulty})',
      },
      {
        when: { rank: { op: '>=', var: 'difficulty' }, reversed: true },
        answer: 'SÍ con coste',
        detail: 'Éxito con complicación ({rank} >= {difficulty})',
      },
      {
        when: { rank: { op: '<', var: 'difficulty' }, reversed: false },
        answer: 'NO',
        detail: 'Fracaso ({rank} < {difficulty})',
      },
      {
        when: { rank: { op: '<', var: 'difficulty' }, reversed: true },
        answer: 'NO catastrófico',
        detail: 'Fracaso con complicación ({rank} < {difficulty})',
      },
      {
        when: {},
        answer: 'Indeterminado',
        detail: 'No se pudo interpretar la carta',
      },
    ],
  },
  {
    id: 'hierofante-event',
    label: 'Evento aleatorio',
    style: 'event',
    askQuestion: false,
    vars: [],
    reversedSuffix: ' Al estar invertida, el evento puede tener un giro inesperado o complicaciones.',
    outputs: [
      {
        when: { category: ['Arcano Mayor'] },
        answer: 'Evento para el PJ',
        detail: 'La carta “{card}” {orientation} afecta directamente a tu Personaje Jugador. Inspírate en su significado para describir lo que le sucede.',
      },
      {
        when: { category: ['Basto'] },
        answer: 'Nuevo PNJ/Trama/Localización',
        detail: 'La carta “{card}” {orientation} sugiere un nuevo elemento en la historia. Crea un nuevo PNJ, trama o localización inspirado en su significado.',
      },
      {
        when: { category: ['Copa'] },
        answer: 'PNJ conocido',
        detail: 'La carta “{card}” {orientation} se relaciona con un PNJ ya conocido. Elige uno de tu lista y desata un evento que lo involucre.',
      },
      {
        when: { category: ['Espada'] },
        answer: 'Trama existente',
        detail: 'La carta “{card}” {orientation} afecta a una de las tramas existentes. Haz que la trama avance o se complique según su significado.',
      },
      {
        when: { category: ['Pentáculo'] },
        answer: 'Localización',
        detail: 'La carta “{card}” {orientation} afecta a una localización. Describe un cambio o evento que ocurre en un lugar importante de la historia.',
      },
      {
        when: {},
        answer: 'Evento indeterminado',
        detail: 'La carta “{card}” {orientation} no pudo ser interpretada para un evento específico.',
      },
    ],
  },
];
