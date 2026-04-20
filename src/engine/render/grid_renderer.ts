import { ViewState, CoordinateTransformer, ToleranceManager } from '../core/viewport';
import type { ModelUnits } from '../core/viewport';

/**
 * High-Performance Index-Based Grid Renderer
 * 
 * Ensures zero error accumulation and absolute phase-locking with the origin.
 */
export class GridRenderer {
    private ctx: CanvasRenderingContext2D;
    private transformer: CoordinateTransformer;

    constructor(private canvas: HTMLCanvasElement, private viewState: ViewState) {
        this.ctx = canvas.getContext('2d', { alpha: true })!;
        this.transformer = new CoordinateTransformer(this.viewState);
    }

    public syncSize(width: number, height: number) {
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = width * dpr;
        this.canvas.height = height * dpr;
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;
    }

    public render() {
        const dpr = window.devicePixelRatio || 1;
        const ctx = this.ctx;
        const vs = this.viewState;

        // Reset to identity for clear, then use physical pixel space
        ctx.setTransform(1, 0, 0, 1, 0, 0); 
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Pre-calculate constants for the loop in screen-space units (number)
        const scale = vs.zoom * dpr;
        const offX = vs.offsetX * dpr;
        const offY = vs.offsetY * dpr;

        // 1. Determine Discrete Interval (µm)
        const gridUnits = ToleranceManager.getGridIntervalUnits(vs.zoom);
        const majorGridUnits = this.getMajorIntervalUnits(gridUnits);

        // 2. Identify Bounds in Model Space
        const screenW = this.canvas.width / dpr;
        const screenH = this.canvas.height / dpr;
        const p1 = this.transformer.screenToModel(0, 0);
        const p2 = this.transformer.screenToModel(screenW, screenH);
        
        const minX_mm = Math.min(p1.x, p2.x);
        const maxX_mm = Math.max(p1.x, p2.x);
        const minY_mm = Math.min(p1.y, p2.y);
        const maxY_mm = Math.max(p1.y, p2.y);

        // 3. Draw Grid Levels
        // Minor Grid
        this.drawIndexBasedGrid(ctx, gridUnits, minX_mm, maxX_mm, minY_mm, maxY_mm, scale, offX, offY, '#222222', false);
        // Major Grid (Nested subset)
        this.drawIndexBasedGrid(ctx, majorGridUnits, minX_mm, maxX_mm, minY_mm, maxY_mm, scale, offX, offY, '#333333', true);

        // 4. Draw Origin Axis
        this.drawAxis(ctx, offX, offY);
    }

    private drawIndexBasedGrid(
        ctx: CanvasRenderingContext2D, 
        intervalUnits: ModelUnits,
        minX_mm: number, maxX_mm: number, minY_mm: number, maxY_mm: number,
        scale: number, offX: number, offY: number,
        color: string,
        isMajor: boolean
    ) {
        const interval_mm = ToleranceManager.unitsToMm(intervalUnits);
        
        // Calculate start/end indices relative to origin (BigInt phase-lock)
        const startIndexX = Math.floor(minX_mm / interval_mm);
        const endIndexX = Math.ceil(maxX_mm / interval_mm);
        const startIndexY = Math.floor(minY_mm / interval_mm);
        const endIndexY = Math.ceil(maxY_mm / interval_mm);

        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = isMajor ? 1.2 : 1.0;

        // Column optimization: only render if interval is visually significant
        const screenDist = interval_mm * (scale / window.devicePixelRatio);
        if (screenDist < 10 && !isMajor) return; 

        // VERTICAL LINES
        for (let i = startIndexX; i <= endIndexX; i++) {
            // Index-based calculation prevents error accumulation
            const modelX = i * interval_mm;
            const xPhys = Math.round(modelX * scale + offX) + 0.5;
            ctx.moveTo(xPhys, 0);
            ctx.lineTo(xPhys, this.canvas.height);
        }

        // HORIZONTAL LINES
        for (let i = startIndexY; i <= endIndexY; i++) {
            const modelY = i * interval_mm;
            const yPhys = Math.round(modelY * (-scale) + offY) + 0.5;
            ctx.moveTo(0, yPhys);
            ctx.lineTo(this.canvas.width, yPhys);
        }
        ctx.stroke();
    }

    private getMajorIntervalUnits(minor: ModelUnits): ModelUnits {
        // Standard CAD convention: major grid is 10x minor grid
        // Since we use 1-2-5 series, 10x always results in a strict subset
        return minor * 10n;
    }

    private drawAxis(ctx: CanvasRenderingContext2D, offX: number, offY: number) {
        ctx.lineWidth = 1.5;
        const x0 = Math.round(offX) + 0.5;
        const y0 = Math.round(offY) + 0.5;

        // X-Axis (Positive Model-Y is Up, but Screen-Y is Down)
        ctx.strokeStyle = '#ff4444';
        ctx.beginPath(); ctx.moveTo(0, y0); ctx.lineTo(this.canvas.width, y0); ctx.stroke();

        // Y-Axis
        ctx.strokeStyle = '#44ff44';
        ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0, this.canvas.height); ctx.stroke();
    }
}
