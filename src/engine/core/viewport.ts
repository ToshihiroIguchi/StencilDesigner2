import paper from 'paper';

/**
 * ViewState & Coordinate Transformation Manager
 */

/**
 * ModelUnits: 1 unit = 1 µm (0.001 mm)
 * Uses BigInt for zero-error integer arithmetic in the model layer.
 */
export type ModelUnits = bigint;

export class ToleranceManager {
  public static readonly MM_TO_UNITS = 1000n;
  public static readonly TOLERANCE_UNITS = 5n; // 5µm matching 0.005mm engineering standards

  static mmToUnits(mm: number): ModelUnits {
    if (isNaN(mm) || !isFinite(mm)) return 0n;
    return BigInt(Math.round(mm * 1000));
  }

  static unitsToMm(u: ModelUnits): number {
    return Number(u) / 1000;
  }

  static getGridIntervalUnits(zoom: number): ModelUnits {
    if (zoom > 500) return 50n;    // 0.05mm
    if (zoom > 200) return 100n;   // 0.1mm
    if (zoom > 50) return 500n;    // 0.5mm
    if (zoom > 10) return 1000n;   // 1mm
    if (zoom > 2) return 10000n;   // 10mm
    return 100000n;                // 100mm
  }
}

export class ViewState {
  public needsUpdate: boolean = true; // Flag for rAF loop

  constructor(
    private _offsetX: number = 0,
    private _offsetY: number = 0,
    private _zoom: number = 10
  ) {}

  get offsetX() { return this._offsetX; }
  set offsetX(val: number) { 
    if (this._offsetX !== val) { this._offsetX = val; this.needsUpdate = true; }
  }

  get offsetY() { return this._offsetY; }
  set offsetY(val: number) { 
    if (this._offsetY !== val) { this._offsetY = val; this.needsUpdate = true; }
  }

  get zoom() { return this._zoom; }
  set zoom(val: number) { 
    if (this._zoom !== val) { this._zoom = val; this.needsUpdate = true; }
  }

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

  /**
   * Continuous projection for Input/Mouse space (mm)
   */
  screenToModel(sx: number, sy: number): { x: number; y: number } {
    const pt = this.getMatrix().inverted().transform(new paper.Point(sx, sy));
    return { x: pt.x, y: pt.y };
  }

  /**
   * Quantized projection for Input -> Model (Units)
   */
  screenToModelUnits(sx: number, sy: number): { x: ModelUnits; y: ModelUnits } {
    const mm = this.screenToModel(sx, sy);
    return {
      x: ToleranceManager.mmToUnits(mm.x),
      y: ToleranceManager.mmToUnits(mm.y)
    };
  }

  /**
   * Final projection for Rendering (Model -> Screen)
   */
  modelToScreen(mx: number, my: number): { x: number, y: number } {
    const pt = this.getMatrix().transform(new paper.Point(mx, my));
    return { x: pt.x, y: pt.y };
  }

  modelUnitsToScreen(ux: ModelUnits, uy: ModelUnits): { x: number; y: number } {
    const mmX = ToleranceManager.unitsToMm(ux);
    const mmY = ToleranceManager.unitsToMm(uy);
    return this.modelToScreen(mmX, mmY);
  }
}
