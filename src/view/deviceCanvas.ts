import Phaser from 'phaser';

/**
 * Keeps the Phaser canvas at physical-pixel resolution (D-026).
 *
 * The canvas bitmap is `floor(css size * devicePixelRatio)` device pixels and its CSS size is set
 * to exactly that many device pixels, so the browser never resamples it. The camera then uses
 * integer zoom in canvas pixels, i.e. whole device pixels per art pixel, also at fractional DPR.
 */
export function deviceCanvasSize(host: HTMLElement): {
  width: number;
  height: number;
  dpr: number;
} {
  const dpr = window.devicePixelRatio || 1;
  const rect = host.getBoundingClientRect();
  return {
    width: Math.max(1, Math.floor(rect.width * dpr)),
    height: Math.max(1, Math.floor(rect.height * dpr)),
    dpr,
  };
}

function applySize(game: Phaser.Game, host: HTMLElement): void {
  const { width, height, dpr } = deviceCanvasSize(host);
  const canvas = game.canvas;
  if (canvas.width !== width || canvas.height !== height) game.scale.resize(width, height);
  canvas.style.width = `${width / dpr}px`;
  canvas.style.height = `${height / dpr}px`;
}

/** Re-applies the device-pixel canvas size on window resize / rotation / DPR change. */
export function attachDeviceCanvas(game: Phaser.Game, host: HTMLElement): void {
  const update = () => applySize(game, host);
  window.addEventListener('resize', update);
  window.addEventListener('orientationchange', update);
  window.visualViewport?.addEventListener('resize', update);
  game.events.once(Phaser.Core.Events.READY, update);
  update();
}
