import { App, Modal, Setting } from 'obsidian';
import { DrawPoint, DrawStroke, DrawTool, DrawingData, DrawingImage, IMAGE_EXTS, MapData } from '../types';
import { genId } from '../utils';
import { paintDrawingOnCanvas } from '../drawing';
import { FileSuggestModal } from './FileSuggestModal';

export class NewDrawnMapModal extends Modal {
  onCreate: (name: string, width: number, height: number) => void;

  constructor(app: App, onCreate: (name: string, width: number, height: number) => void) {
    super(app);
    this.onCreate = onCreate;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: 'Nuevo mapa dibujado' });
    let name = '';
    let width = 1600;
    let height = 1000;
    new Setting(contentEl).setName('Nombre').addText((t) => t.onChange((v) => (name = v)));
    new Setting(contentEl).setName('Ancho (px)').addText((t) => {
      t.setValue('1600');
      t.onChange((v) => {
        const n = Number(v);
        if (!isNaN(n) && n > 0) width = n;
      });
    });
    new Setting(contentEl).setName('Alto (px)').addText((t) => {
      t.setValue('1000');
      t.onChange((v) => {
        const n = Number(v);
        if (!isNaN(n) && n > 0) height = n;
      });
    });
    new Setting(contentEl).addButton((b) =>
      b
        .setButtonText('Crear')
        .setCta()
        .onClick(() => {
          this.close();
          this.onCreate(name || 'Mapa dibujado', width, height);
        })
    );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export class DrawingEditorModal extends Modal {
  plugin: any;
  view: any;
  map: MapData;
  drawing: DrawingData;
  tool: DrawTool;
  color: string;
  strokeWidth: number;
  selectedImageId: string | null;
  actions: Array<{ type: 'stroke' | 'image'; id: string }>;
  imageCache: Record<string, HTMLImageElement>;
  pending: DrawStroke | null;
  toolbarEl: HTMLElement;
  canvas: HTMLCanvasElement;

  constructor(app: App, plugin: any, view: any, map: MapData) {
    super(app);
    this.plugin = plugin;
    this.view = view;
    this.map = map;
    this.drawing = map.drawing as DrawingData;
    this.tool = 'pen';
    this.color = '#222222';
    this.strokeWidth = 4;
    this.selectedImageId = null;
    this.actions = [];
    this.imageCache = {};
    this.pending = null;
  }

  onOpen(): void {
    (this as any).modalEl.addClass('dte-drawing-modal');
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: `Dibujar mapa — ${this.map.name}` });
    contentEl.createDiv({
      cls: 'dte-hint',
      text:
        'Lápiz, línea o rectángulo para trazar; "Insertar imagen" para poner props/iconos que luego puedes mover y ' +
        'redimensionar con la herramienta "Mover/imagen". Se guarda solo mientras trabajas.',
    });

    this.toolbarEl = contentEl.createDiv({ cls: 'dte-drawing-toolbar' });
    this.renderToolbar();

    const wrap = contentEl.createDiv({ cls: 'dte-drawing-canvas-wrap' });
    this.canvas = wrap.createEl('canvas', { cls: 'dte-drawing-canvas' }) as HTMLCanvasElement;
    this.canvas.width = this.drawing.width;
    this.canvas.height = this.drawing.height;

    this.attachCanvasEvents();
    this.paintCanvas();
  }

  renderToolbar(): void {
    this.toolbarEl.empty();
    const mkToolBtn = (label: string, key: DrawTool) => {
      const b = this.toolbarEl.createEl('button', { text: label });
      if (this.tool === key) b.addClass('dte-tool-active');
      b.addEventListener('click', () => {
        this.tool = key;
        this.renderToolbar();
        this.paintCanvas();
      });
    };
    mkToolBtn('✏️ Lápiz', 'pen');
    mkToolBtn('📏 Línea', 'line');
    mkToolBtn('▭ Rectángulo', 'rect');
    mkToolBtn('🖼️ Mover/imagen', 'image');

    const colorInput = this.toolbarEl.createEl('input', { type: 'color' }) as HTMLInputElement;
    colorInput.value = this.color;
    colorInput.addEventListener('input', () => (this.color = colorInput.value));

    this.toolbarEl.createSpan({ text: ' Grosor ' });
    const widthInput = this.toolbarEl.createEl('input', { type: 'range' }) as HTMLInputElement;
    widthInput.min = '1';
    widthInput.max = '20';
    widthInput.value = String(this.strokeWidth);
    widthInput.addEventListener('input', () => (this.strokeWidth = Number(widthInput.value)));

    this.toolbarEl.createEl('button', { text: '+ Insertar imagen' }).addEventListener('click', () => {
      new FileSuggestModal(this.app, IMAGE_EXTS, (file) => {
        const img: DrawingImage = {
          id: genId(),
          imagePath: file.path,
          x: this.drawing.width / 2 - 75,
          y: this.drawing.height / 2 - 75,
          w: 150,
          h: 150,
        };
        this.drawing.images.push(img);
        this.actions.push({ type: 'image', id: img.id });
        this.tool = 'image';
        this.selectedImageId = img.id;
        this.plugin.saveSettings();
        this.renderToolbar();
        this.paintCanvas();
      }).open();
    });

    this.toolbarEl.createEl('button', { text: 'Fondo de referencia' }).addEventListener('click', () => {
      new FileSuggestModal(this.app, IMAGE_EXTS, (file) => {
        this.drawing.backgroundImagePath = file.path;
        this.plugin.saveSettings();
        this.paintCanvas();
      }).open();
    });
    if (this.drawing.backgroundImagePath) {
      this.toolbarEl.createEl('button', { text: 'Quitar fondo' }).addEventListener('click', () => {
        this.drawing.backgroundImagePath = null;
        this.plugin.saveSettings();
        this.paintCanvas();
      });
    }

    this.toolbarEl.createEl('button', { text: '↩️ Deshacer' }).addEventListener('click', () => this.undo());
    this.toolbarEl.createEl('button', { text: '🗑️ Limpiar todo' }).addEventListener('click', () => {
      if (!confirm('¿Borrar todo el dibujo de este mapa? Esto no se puede deshacer.')) return;
      this.drawing.strokes = [];
      this.drawing.images = [];
      this.actions = [];
      this.selectedImageId = null;
      this.plugin.saveSettings();
      this.paintCanvas();
    });

    if (this.tool === 'image' && this.selectedImageId) {
      const sel = this.drawing.images.find((i) => i.id === this.selectedImageId);
      if (sel) {
        this.toolbarEl.createSpan({ text: ' Tamaño ' });
        const wIn = this.toolbarEl.createEl('input', { type: 'number' }) as HTMLInputElement;
        wIn.value = String(Math.round(sel.w));
        wIn.style.width = '60px';
        wIn.addEventListener('input', () => {
          sel.w = Number(wIn.value) || sel.w;
          this.plugin.saveSettings();
          this.paintCanvas();
        });
        const hIn = this.toolbarEl.createEl('input', { type: 'number' }) as HTMLInputElement;
        hIn.value = String(Math.round(sel.h));
        hIn.style.width = '60px';
        hIn.addEventListener('input', () => {
          sel.h = Number(hIn.value) || sel.h;
          this.plugin.saveSettings();
          this.paintCanvas();
        });
        this.toolbarEl.createEl('button', { text: 'Eliminar imagen' }).addEventListener('click', () => {
          if (!confirm('¿Eliminar esta imagen del lienzo? Esta acción no se puede deshacer.')) return;
          this.drawing.images = this.drawing.images.filter((i) => i.id !== sel.id);
          this.selectedImageId = null;
          this.plugin.saveSettings();
          this.renderToolbar();
          this.paintCanvas();
        });
      }
    }

    this.toolbarEl.createEl('button', { text: 'Cerrar', cls: 'mod-cta' }).addEventListener('click', () => {
      this.plugin.saveSettings();
      this.view.render();
      this.close();
    });
  }

  getCanvasPos(e: PointerEvent): DrawPoint {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  hitTestImage(pos: DrawPoint): DrawingImage | null {
    const images = this.drawing.images;
    for (let i = images.length - 1; i >= 0; i--) {
      const im = images[i];
      if (pos.x >= im.x && pos.x <= im.x + im.w && pos.y >= im.y && pos.y <= im.y + im.h) return im;
    }
    return null;
  }

  attachCanvasEvents(): void {
    let draggingImage: DrawingImage | null = null;
    let dragOffset = { x: 0, y: 0 };
    let dragMoved = false;

    this.canvas.addEventListener('pointerdown', (e: PointerEvent) => {
      const pos = this.getCanvasPos(e);
      if (this.tool === 'image') {
        const hit = this.hitTestImage(pos);
        this.selectedImageId = hit ? hit.id : null;
        if (hit) {
          draggingImage = hit;
          dragOffset = { x: pos.x - hit.x, y: pos.y - hit.y };
          dragMoved = false;
        }
        this.renderToolbar();
        this.paintCanvas();
        this.canvas.setPointerCapture(e.pointerId);
        return;
      }
      this.pending = { id: genId(), tool: this.tool, color: this.color, width: this.strokeWidth, points: [pos] };
      this.canvas.setPointerCapture(e.pointerId);
    });

    this.canvas.addEventListener('pointermove', (e: PointerEvent) => {
      const pos = this.getCanvasPos(e);
      if (this.tool === 'image' && draggingImage) {
        draggingImage.x = pos.x - dragOffset.x;
        draggingImage.y = pos.y - dragOffset.y;
        dragMoved = true;
        this.paintCanvas();
        return;
      }
      if (!this.pending) return;
      if (this.pending.tool === 'pen') {
        this.pending.points.push(pos);
      } else {
        this.pending.points[1] = pos;
      }
      this.paintCanvas();
    });

    const endPointer = (e: PointerEvent) => {
      if (this.tool === 'image') {
        if (draggingImage && dragMoved) this.plugin.saveSettings();
        draggingImage = null;
        try {
          this.canvas.releasePointerCapture(e.pointerId);
        } catch (err) {
          /* noop */
        }
        return;
      }
      if (this.pending) {
        if (this.pending.points.length >= 2) {
          this.drawing.strokes.push(this.pending);
          this.actions.push({ type: 'stroke', id: this.pending.id });
          this.plugin.saveSettings();
        }
        this.pending = null;
        this.paintCanvas();
      }
      try {
        this.canvas.releasePointerCapture(e.pointerId);
      } catch (err) {
        /* noop */
      }
    };
    this.canvas.addEventListener('pointerup', endPointer);
    this.canvas.addEventListener('pointercancel', endPointer);
  }

  paintCanvas(): void {
    paintDrawingOnCanvas(this.app, this.canvas, this.drawing, {
      imageCache: this.imageCache,
      selectedImageId: this.tool === 'image' ? this.selectedImageId : null,
      pending: this.pending,
      onImageLoad: () => this.paintCanvas(),
    });
  }

  undo(): void {
    const action = this.actions.pop();
    if (!action) return;
    if (action.type === 'stroke') {
      this.drawing.strokes = this.drawing.strokes.filter((s) => s.id !== action.id);
    } else if (action.type === 'image') {
      this.drawing.images = this.drawing.images.filter((i) => i.id !== action.id);
      if (this.selectedImageId === action.id) this.selectedImageId = null;
    }
    this.plugin.saveSettings();
    this.renderToolbar();
    this.paintCanvas();
  }

  onClose(): void {
    this.plugin.saveSettings();
    this.view.render();
    this.contentEl.empty();
  }
}
