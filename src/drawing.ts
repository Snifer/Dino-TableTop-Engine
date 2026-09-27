import { App, TFile } from 'obsidian';
import { DrawStroke, DrawingData, PaintDrawingOpts } from './types';

export function drawStrokeOnCtx(ctx: CanvasRenderingContext2D, s: DrawStroke): void {
  ctx.strokeStyle = s.color;
  ctx.lineWidth = s.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (s.tool === 'pen') {
    if (s.points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(s.points[0].x, s.points[0].y);
    for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
    ctx.stroke();
  } else if (s.tool === 'line') {
    if (s.points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(s.points[0].x, s.points[0].y);
    ctx.lineTo(s.points[1].x, s.points[1].y);
    ctx.stroke();
  } else if (s.tool === 'rect') {
    if (s.points.length < 2) return;
    const [a, b] = s.points;
    ctx.strokeRect(Math.min(a.x, b.y), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
  }
}

/**
 * Dibuja un `drawing` (fondo de referencia + imágenes insertadas + trazos) sobre un canvas.
 * `opts.imageCache` debe persistir entre llamadas para no recrear <img> en cada repintado;
 * `opts.onImageLoad` se dispara cuando una imagen nueva termina de cargar, para repintar.
 */
export function paintDrawingOnCanvas(
  app: App,
  canvas: HTMLCanvasElement,
  drawing: DrawingData,
  opts: PaintDrawingOpts = {}
): void {
  const imageCache = opts.imageCache || {};
  const selectedImageId = opts.selectedImageId || null;
  const pending = opts.pending || null;
  const onImageLoad = opts.onImageLoad || (() => {});

  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#f4f1ea';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const getImg = (path: string): HTMLImageElement | null => {
    if (imageCache[path]) return imageCache[path];
    const file = app.vault.getAbstractFileByPath(path);
    if (!file) return null;
    const img = new Image();
    img.onload = onImageLoad;
    img.src = app.vault.getResourcePath(file as TFile);
    imageCache[path] = img;
    return img;
  };

  if (drawing.backgroundImagePath) {
    const img = getImg(drawing.backgroundImagePath);
    if (img && img.complete && img.naturalWidth) ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }
  for (const im of drawing.images || []) {
    const img = getImg(im.imagePath);
    if (img && img.complete && img.naturalWidth) ctx.drawImage(img, im.x, im.y, im.w, im.h);
    if (selectedImageId && im.id === selectedImageId) {
      ctx.save();
      ctx.strokeStyle = '#2d8cff';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(im.x, im.y, im.w, im.h);
      ctx.restore();
    }
  }
  for (const s of drawing.strokes || []) drawStrokeOnCtx(ctx, s);
  if (pending) drawStrokeOnCtx(ctx, pending);
}
