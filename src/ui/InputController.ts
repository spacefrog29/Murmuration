/**
 * InputController: bridges DOM mouse events to the simulation's Pointer.
 *
 * Responsibilities:
 *   - Listen for mousedown / mousemove / mouseup on the canvas.
 *   - Ignore events that originate inside the GUI panel (UI is outside the world).
 *   - Translate screen coordinates to canvas coordinates.
 *   - Suppress the browser's default context menu on right-click so we can
 *     use the right button for "repel" without the menu popping up.
 *
 * Mouse button mapping:
 *   - Left button (0)  → attract
 *   - Right button (2) → repel
 *
 * The Pointer object is shared by reference with the Flock; mutations here
 * are visible there next frame.
 */

import type { Pointer } from '../simulation/Pointer.ts';

export class InputController {
  constructor(
    private canvas: HTMLCanvasElement,
    private pointer: Pointer,
    /** A function returning the GUI's root DOM element, so we can ignore clicks on it. */
    private getGuiElement: () => HTMLElement | null,
  ) {
    this.attach();
  }

  private attach(): void {
    // Suppress browser context menu on the canvas so right-click works as input.
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    // mousemove on the window so we keep tracking even if cursor leaves canvas mid-drag.
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));
    window.addEventListener('mouseup', (e) => this.onMouseUp(e));
  }

  private isInsideGui(target: EventTarget | null): boolean {
    const gui = this.getGuiElement();
    if (!gui || !target) return false;
    return target instanceof Node && gui.contains(target);
  }

  private updatePosition(e: MouseEvent): void {
    // Canvas is full-bleed and positioned at (0, 0), so client coords ≈ canvas coords.
    // Using getBoundingClientRect would also handle the case if that ever changes.
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.position.x = e.clientX - rect.left;
    this.pointer.position.y = e.clientY - rect.top;
  }

  private onMouseDown(e: MouseEvent): void {
    if (this.isInsideGui(e.target)) return;
    this.updatePosition(e);
    if (e.button === 0) this.pointer.mode = 'attract';
    else if (e.button === 2) this.pointer.mode = 'repel';
  }

  private onMouseMove(e: MouseEvent): void {
    // Position update is cheap; do it unconditionally so attract/repel
    // tracks the cursor smoothly even if it briefly enters the GUI.
    if (this.pointer.mode !== 'off') {
      this.updatePosition(e);
    }
  }

  private onMouseUp(e: MouseEvent): void {
    // Only clear the mode if the released button matches the active mode.
    // (Edge case: left held while right is tapped — releasing right shouldn't
    // disable attract. In practice we don't support both-at-once; whichever
    // mousedown fired last wins. mouseup just clears whatever's active.)
    if (e.button === 0 && this.pointer.mode === 'attract') this.pointer.mode = 'off';
    else if (e.button === 2 && this.pointer.mode === 'repel') this.pointer.mode = 'off';
  }
}
