import { App, Notice } from 'obsidian';
import { DinoPlugin } from '../../types';
import { getDiceRollerPlugin } from '../diceTray';

/**
 * Replace @key or @{key} variables in a string with values from data
 */
export function resolveVariables(
  str: string,
  data: Record<string, any> = {}
): { resolved: string; missing: string[] } {
  const missing: string[] = [];
  
  const resolved = str.replace(/@(?:\{([a-zA-Z0-9_-]+)\}|([a-zA-Z0-9_-]+))/g, (_match, g1, g2) => {
    const key = g1 || g2;
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      const val = data[key];
      return val !== null && val !== undefined ? String(val) : '0';
    }
    missing.push(key);
    return '0';
  });

  return { resolved, missing };
}

/**
 * Tokenize and safely evaluate mathematical expressions with + - * / () and math functions
 */
export function evaluateMath(expression: string): number {
  const expr = expression
    .replace(/\s+/g, '')
    .replace(/floor/gi, 'Math.floor')
    .replace(/ceil/gi, 'Math.ceil')
    .replace(/round/gi, 'Math.round')
    .replace(/abs/gi, 'Math.abs')
    .replace(/min/gi, 'Math.min')
    .replace(/max/gi, 'Math.max');

  // Strict validation: allow only numbers, math operators, parentheses, commas, and safe Math functions
  const safeRegex = /^[0-9+\-*/().,Mathfloorceilroundabsminmax\s]+$/;
  if (!safeRegex.test(expr)) {
    throw new Error('Invalid characters in mathematical expression');
  }

  // Use Function constructor in a sandbox with restricted scope
  try {
    const fn = new Function('Math', `"use strict"; return (${expr});`);
    const res = fn(Math);
    if (typeof res !== 'number' || isNaN(res) || !isFinite(res)) {
      return 0;
    }
    return res;
  } catch (e) {
    console.warn('[CharacterSheet] Math evaluation failed:', expr, e);
    return 0;
  }
}

/**
 * Evaluate a calculated formula for a widget
 */
export function evaluateCalculated(
  formula: string,
  data: Record<string, any>
): { value: number; error?: string } {
  if (!formula || !formula.trim()) {
    return { value: 0 };
  }

  const { resolved, missing } = resolveVariables(formula, data);
  if (missing.length > 0) {
    return {
      value: 0,
      error: `Missing variable(s): ${missing.join(', ')}`,
    };
  }

  try {
    const val = evaluateMath(resolved);
    return { value: val };
  } catch (err: any) {
    return { value: 0, error: err?.message || 'Calculation error' };
  }
}

/**
 * Simple internal dice roller fallback if DiceRoller plugin is not available
 */
export function internalDiceRoll(formula: string): { total: number; summary: string } {
  // Support formulas like: 1d20 + 5, 2d6+1d4 - 2, etc.
  let cleaned = formula.replace(/\s+/g, '');
  let summaryParts: string[] = [];

  // Replace each XdY with simulated rolls
  const diceRegex = /(\d*)d(\d+)/gi;
  cleaned = cleaned.replace(diceRegex, (_match, countStr, sidesStr) => {
    const count = parseInt(countStr || '1', 10);
    const sides = parseInt(sidesStr, 10);
    const rolls: number[] = [];
    let sum = 0;
    for (let i = 0; i < count; i++) {
      const r = Math.floor(Math.random() * sides) + 1;
      rolls.push(r);
      sum += r;
    }
    summaryParts.push(`[${rolls.join(', ')}]`);
    return String(sum);
  });

  try {
    const total = evaluateMath(cleaned);
    const summary = summaryParts.length > 0 ? `${summaryParts.join(' + ')} = ${total}` : String(total);
    return { total, summary };
  } catch {
    return { total: 0, summary: 'Error' };
  }
}

export interface RollResult {
  formula: string;
  resolvedFormula: string;
  reason?: string;
  total: number;
  displayText: string;
}

/**
 * Execute a dice roll triggered from a button or counter shortcut
 */
export async function executeSheetRoll(
  app: App,
  plugin: DinoPlugin,
  formula: string,
  reason?: string,
  data: Record<string, any> = {},
  render3D: boolean = true
): Promise<RollResult> {
  const { resolved, missing } = resolveVariables(formula, data);
  if (missing.length > 0) {
    new Notice(`Falta la propiedad: ${missing.join(', ')}`);
    throw new Error(`Missing property: ${missing.join(', ')}`);
  }

  // Pre-evaluate simple math inside the formula if needed (e.g. 1d20 + 14 - 2 -> 1d20 + 12)
  const resolvedFormula = resolved;
  let total = 0;
  let displayText = '';

  const diceRoller = getDiceRollerPlugin(app);
  if (diceRoller && render3D) {
    const getRollerFn = diceRoller.getRoller || diceRoller.api?.getRoller;
    if (typeof getRollerFn === 'function') {
      try {
        const target = diceRoller.api || diceRoller;
        const roller = await getRollerFn.call(target, resolvedFormula, '');
        if (roller && typeof roller.roll === 'function') {
          const res = await roller.roll();
          if (typeof res === 'number') {
            total = res;
          } else if (res && typeof (res as any).total === 'number') {
            total = (res as any).total;
          } else if (res !== null && res !== undefined) {
            total = parseFloat(String(res)) || 0;
          }
          displayText = `${total}`;
        }
      } catch (err) {
        console.warn('[CharacterSheet] DiceRoller roll error, falling back:', err);
      }
    }
  }

  if (!displayText) {
    // Fallback: internal pseudo-random roll
    const fallback = internalDiceRoll(resolvedFormula);
    total = fallback.total;
    displayText = fallback.summary;
    if (!diceRoller && render3D) {
      new Notice(`Dice Roller no disponible. Tirada calculada: ${resolvedFormula} -> ${displayText}`);
    }
  }

  const result: RollResult = {
    formula,
    resolvedFormula,
    reason,
    total,
    displayText,
  };

  // Add to dice tray history if dice tray module is active
  try {
    const view = plugin.getOpenDinoView();
    if (view && view.diceTrayPanel && typeof (view.diceTrayPanel as any).addHistoryEntry === 'function') {
      (view.diceTrayPanel as any).addHistoryEntry({
        expression: resolvedFormula,
        reason: reason || 'Hoja de personaje',
        result: total,
      });
    }
  } catch (err) {
    // Non-blocking bridge
  }

  return result;
}
