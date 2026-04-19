/**
 * ViewState & Coordinate Transformation Manager
 * Deals with precision rounding (Canonicalization) and mapping
 * Topological Truth (Y-up, mm) <-> Display Render (Y-down, px)
 */

export class ToleranceManager {
  // Precision limit for canonicalization, e.g., 10^-6 mm
  private static EPSILON = 1e-6;

  static canonicalize(value: number): number {
    // Round to the nearest EPSILON multiple to prevent floating point drift
    return Math.round(value / this.EPSILON) * this.EPSILON;
  }

  static arePointsEqual(x1: number, y1: number, x2: number, y2: number): boolean {
    return Math.hypot(x1 - x2, y1 - y2) <= this.EPSILON;
  }

  static getGridInterval(zoom: number): number {
    // Basic dynamic grid interval based on zoom level (e.g., 1, 10, 100 mm)
    if (zoom > 100) return 0.1;
    if (zoom > 10) return 1;
    if (zoom > 1) return 10;
    return 100;
  }
}

export class ViewState {
  // origin in screen pixels (where model 0,0 is drawn)
  offsetX: number = 0;
  offsetY: number = 0;
  // pixels per mm
  zoom: number = 10; 

  constructor(offsetX: number = 0, offsetY: number = 0, zoom: number = 10) {
    this.offsetX = offsetX;
    this.offsetY = offsetY;
    this.zoom = zoom;
  }
}

export class CoordinateTransformer {
  private viewState: ViewState;

  constructor(viewState: ViewState) {
    this.viewState = viewState;
  }

  // Model (mm, Y-up) -> Screen (px, Y-down)
  modelToScreen(modelX: number, modelY: number): { x: number; y: number } {
    const x = this.viewState.offsetX + modelX * this.viewState.zoom;
    const y = this.viewState.offsetY - modelY * this.viewState.zoom;
    return { x, y };
  }

  // Screen (px, Y-down) -> Model (mm, Y-up)
  screenToModel(screenX: number, screenY: number): { x: number; y: number } {
    const mx = (screenX - this.viewState.offsetX) / this.viewState.zoom;
    const my = (this.viewState.offsetY - screenY) / this.viewState.zoom;
    return {
      x: ToleranceManager.canonicalize(mx),
      y: ToleranceManager.canonicalize(my)
    };
  }
}
