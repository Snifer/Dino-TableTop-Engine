import { Setting } from 'obsidian';
import { CounterData } from '../types';
import { newCounter } from '../utils';

/**
 * Editor de contadores en línea, reusado por TokenEditModal y BestiaryEntryEditModal.
 * `counters` es el arreglo real (se muta in place). `refresh` vuelve a dibujar el modal.
 */
export function renderCountersEditor(
  contentEl: HTMLElement,
  counters: CounterData[],
  refresh: () => void
): void {
  const sec = contentEl.createDiv();
  sec.createEl('h3', { text: 'Contadores adicionales' });
  const desc = sec.createDiv({ cls: 'dte-hint' });
  desc.setText('Recursos secundarios (maná, munición, espacios de conjuro, etc.) con valor actual y máximo opcional.');

  if (!counters.length) {
    sec.createDiv({ cls: 'dte-hint', text: 'No hay contadores asignados.' });
  }

  for (let i = 0; i < counters.length; i++) {
    const c = counters[i];
    const row = sec.createDiv({ cls: 'dte-counter-row' });

    const nameInp = row.createEl('input', {
      type: 'text',
      cls: 'dte-counter-input-name',
      placeholder: 'Etiqueta (ej. Maná)',
    });
    nameInp.value = c.label || '';
    nameInp.addEventListener('input', () => (c.label = nameInp.value));

    const valInp = row.createEl('input', {
      type: 'number',
      cls: 'dte-counter-input-value',
      placeholder: 'Valor',
    });
    valInp.value = String(c.value ?? 0);
    valInp.addEventListener('input', () => (c.value = Number(valInp.value) || 0));

    const maxInp = row.createEl('input', {
      type: 'number',
      cls: 'dte-counter-input-max',
      placeholder: 'Máx (opc)',
    });
    maxInp.value = c.max !== null && c.max !== undefined ? String(c.max) : '';
    maxInp.addEventListener('input', () => {
      const v = maxInp.value.trim();
      c.max = v === '' ? null : Number(v) || 0;
    });

    const delBtn = row.createEl('button', { text: '🗑️' });
    delBtn.addEventListener('click', () => {
      counters.splice(i, 1);
      refresh();
    });
  }

  const addRow = new Setting(sec);
  addRow.addButton((b) =>
    b.setButtonText('+ Añadir contador').onClick(() => {
      counters.push(newCounter());
      refresh();
    })
  );
}
