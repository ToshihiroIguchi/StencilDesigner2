import paper from 'paper';

/**
 * ViewState & Coordinate Transformation Manager
 */

export class ToleranceManager {
  // Precision limit for canonicalization, e.g., 10^-6 mm
  private static EPSILON = 1e-6;

  static canonicalize(value: number): number {
    return Math.round(value / this.EPSILON) * this.EPSILON;
  }

  static arePointsEqual(x1: number, y1: number, x2: number, y2: number): boolean {
    return Math.hypot(x1 - x2, y1 - y2) <= this.EPSILON;
  }

  static getGridInterval(zoom: number): number {
    if (zoom > 500) return 0.05;
    if (zoom > 200) return 0.1;
    if (zoom > 50) return 0.5;
    if (zoom > 10) return 1;
    if (zoom > 2) return 10;
    return 100;
  }
}

export class ViewState {
  constructor(
    public offsetX: number = 0,
    public offsetY: number = 0,
    public zoom: number = 10
  ) {}

  log() {
    console.log(`[Viewport] Zoom: ${this.zoom.toFixed(4)}, Offset: [${this.offsetX.toFixed(1)}, ${this.offsetY.toFixed(1)}]`);
  }
}

export class CoordinateTransformer {
  constructor(private viewState: ViewState) {}

  /**
   * Generates a Paper.js Matrix representing the current ViewState.
   */
  getMatrix(): paper.Matrix {
    const m = new paper.Matrix();
    m.translate(this.viewState.offsetX, this.viewState.offsetY);
    m.scale(this.viewState.zoom, -this.viewState.zoom);
    return m;
  }

  modelToScreen(mx: number, my: number): { x: number; y: number } {
    const pt = this.getMatrix().transform(new paper.Point(mx, my));
    return { x: pt.x, y: pt.y };
  }

  screenToModel(sx: number, sy: number): { x: number; y: number } {
    const pt = this.getMatrix().inverted().transform(new paper.Point(sx, sy));
    return {
      x: ToleranceManager.canonicalize(pt.x),
      y: ToleranceManager.canonicalize(pt.y)
    };
  }
}
