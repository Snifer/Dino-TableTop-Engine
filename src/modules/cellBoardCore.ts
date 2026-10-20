import { ToolContext, ToolDefinition, UndoStep, ViewportState } from '../types';

export class ViewportManager {
  private viewports: Map<string, ViewportState> = new Map();

  public getViewport(mapId: string): ViewportState {
    let vp = this.viewports.get(mapId);
    if (!vp) {
      vp = { x: 0, y: 0, scale: 1 };
      this.viewports.set(mapId, vp);
    }
    return vp;
  }

  public setViewport(mapId: string, viewport: ViewportState): void {
    this.viewports.set(mapId, {
      x: viewport.x,
      y: viewport.y,
      scale: Math.max(0.1, Math.min(5, viewport.scale)),
    });
  }

  public pan(mapId: string, dx: number, dy: number): ViewportState {
    const vp = this.getViewport(mapId);
    vp.x += dx;
    vp.y += dy;
    return vp;
  }

  /**
   * Zooms in or out keeping the world position under the pointer anchored.
   */
  public zoomAtPointer(
    mapId: string,
    pointerScreenX: number,
    pointerScreenY: number,
    zoomFactor: number,
    containerRect: DOMRect
  ): ViewportState {
    const vp = this.getViewport(mapId);
    const oldScale = vp.scale;
    const newScale = Math.max(0.15, Math.min(4.0, oldScale * zoomFactor));
    if (newScale === oldScale) return vp;

    const relX = pointerScreenX - containerRect.left;
    const relY = pointerScreenY - containerRect.top;

    // World coordinate before zoom
    const worldX = (relX - vp.x) / oldScale;
    const worldY = (relY - vp.y) / oldScale;

    // Adjust viewport translation so the world coordinate stays under the cursor
    vp.x = relX - worldX * newScale;
    vp.y = relY - worldY * newScale;
    vp.scale = newScale;

    return vp;
  }

  public reset(mapId: string): ViewportState {
    const vp = { x: 0, y: 0, scale: 1 };
    this.viewports.set(mapId, vp);
    return vp;
  }
}

export class HistoryManager {
  private maxSteps: number = 200;
  private undoStacks: Map<string, UndoStep[]> = new Map();
  private redoStacks: Map<string, UndoStep[]> = new Map();

  public push(mapId: string, step: UndoStep): void {
    let uStack = this.undoStacks.get(mapId);
    if (!uStack) {
      uStack = [];
      this.undoStacks.set(mapId, uStack);
    }
    uStack.push(step);
    if (uStack.length > this.maxSteps) {
      uStack.shift();
    }
    // Clear redo stack on new action
    this.redoStacks.set(mapId, []);
  }

  public async undo(mapId: string): Promise<boolean> {
    const uStack = this.undoStacks.get(mapId);
    if (!uStack || uStack.length === 0) return false;

    const step = uStack.pop()!;
    let rStack = this.redoStacks.get(mapId);
    if (!rStack) {
      rStack = [];
      this.redoStacks.set(mapId, rStack);
    }
    rStack.push(step);

    try {
      await step.undo();
      return true;
    } catch (e) {
      console.error('[DTE] Error executing undo:', e);
      return false;
    }
  }

  public async redo(mapId: string): Promise<boolean> {
    const rStack = this.redoStacks.get(mapId);
    if (!rStack || rStack.length === 0) return false;

    const step = rStack.pop()!;
    let uStack = this.undoStacks.get(mapId);
    if (!uStack) {
      uStack = [];
      this.undoStacks.set(mapId, uStack);
    }
    uStack.push(step);

    try {
      await step.redo();
      return true;
    } catch (e) {
      console.error('[DTE] Error executing redo:', e);
      return false;
    }
  }

  public canUndo(mapId: string): boolean {
    const uStack = this.undoStacks.get(mapId);
    return !!(uStack && uStack.length > 0);
  }

  public canRedo(mapId: string): boolean {
    const rStack = this.redoStacks.get(mapId);
    return !!(rStack && rStack.length > 0);
  }

  public clear(mapId: string): void {
    this.undoStacks.delete(mapId);
    this.redoStacks.delete(mapId);
  }
}

export class ToolManager {
  private tools: Map<string, ToolDefinition> = new Map();
  private activeToolId: string = 'move';
  private onToolChangeListeners: Array<(toolId: string) => void> = [];

  public registerTool(tool: ToolDefinition): void {
    this.tools.set(tool.id, tool);
  }

  public getTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  public getTool(id: string): ToolDefinition | undefined {
    return this.tools.get(id);
  }

  public getActiveToolId(): string {
    return this.activeToolId;
  }

  public getActiveTool(): ToolDefinition | undefined {
    return this.tools.get(this.activeToolId);
  }

  public setActiveTool(id: string, deactivateCtx?: ToolContext): boolean {
    if (!this.tools.has(id)) return false;
    if (this.activeToolId === id) return true;
    // Call onDeactivate on the previous tool
    const prevTool = this.tools.get(this.activeToolId);
    if (prevTool?.onDeactivate && deactivateCtx) {
      try {
        prevTool.onDeactivate(deactivateCtx);
      } catch (err) {
        console.error('Error in tool onDeactivate:', err);
      }
    }
    this.activeToolId = id;
    this.onToolChangeListeners.forEach((fn) => fn(id));
    return true;
  }

  public onToolChange(listener: (toolId: string) => void): () => void {
    this.onToolChangeListeners.push(listener);
    return () => {
      this.onToolChangeListeners = this.onToolChangeListeners.filter((fn) => fn !== listener);
    };
  }
}

export const globalViewportManager = new ViewportManager();
export const globalHistoryManager = new HistoryManager();
export const globalToolManager = new ToolManager();
