/**
 * Laser pointer and Attention Ping visual effects and event synchronization.
 */

export interface LaserEventDetail {
  x?: number;
  y?: number;
  color?: string;
  active: boolean;
}

export interface PingEventDetail {
  x: number;
  y: number;
  color?: string;
  icon?: string;
}

export function broadcastLaser(detail: LaserEventDetail): void {
  window.dispatchEvent(new CustomEvent('dino-tabletop:laser', { detail }));
}

export function broadcastPing(detail: PingEventDetail): void {
  window.dispatchEvent(new CustomEvent('dino-tabletop:ping', { detail }));
}

/**
 * Creates an animated expanding ping ripple in the specified container at (worldX, worldY).
 */
export function spawnPingEffect(
  containerEl: HTMLElement,
  worldX: number,
  worldY: number,
  color: string = '#ff4757',
  icon: string = '📍'
): void {
  const pingEl = containerEl.createDiv({ cls: 'dte-ping-wave' });
  pingEl.style.left = `${worldX}px`;
  pingEl.style.top = `${worldY}px`;
  pingEl.style.setProperty('--dte-ping-color', color);

  pingEl.createDiv({ cls: 'dte-ping-ring ring-1' });
  pingEl.createDiv({ cls: 'dte-ping-ring ring-2' });
  const center = pingEl.createDiv({ cls: 'dte-ping-center' });
  center.setText(icon);

  // Auto remove after animation completes (1.8s)
  window.setTimeout(() => {
    pingEl.remove();
  }, 1800);
}

/**
 * Updates or creates a glowing laser pointer dot in the specified container.
 */
export function updateLaserOverlay(
  containerEl: HTMLElement,
  worldX: number,
  worldY: number,
  color: string = '#ff3838',
  active: boolean = true
): void {
  let laserEl = containerEl.querySelector('.dte-laser-pointer-dot') as HTMLElement | null;
  if (!active) {
    if (laserEl) laserEl.remove();
    return;
  }

  if (!laserEl) {
    laserEl = containerEl.createDiv({ cls: 'dte-laser-pointer-dot' });
    laserEl.createDiv({ cls: 'dte-laser-dot-inner' });
  }

  laserEl.style.left = `${worldX}px`;
  laserEl.style.top = `${worldY}px`;
  laserEl.style.setProperty('--dte-laser-color', color);
}
