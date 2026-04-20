import paper from 'paper';
import { ViewState, CoordinateTransformer, ToleranceManager } from '../core/viewport';

/**
 * Ruler Manager
 * Draws X and Y reference rulers linked to the viewport.
 */
export class RulerManager {
    constructor(
        private viewState: ViewState,
        private transformer: CoordinateTransformer,
        private layer: paper.Layer
    ) {}

    draw(): void {
        this.layer.activate();
        this.layer.removeChildren();
        this.layer.matrix = new paper.Matrix(); // Force identity for UI

        const bounds = paper.view.bounds;
        const gridMm = ToleranceManager.unitsToMm(ToleranceManager.getGridIntervalUnits(this.viewState.zoom));
        
        const largeInterval = gridMm * 10;
        const mediumInterval = gridMm;
        const smallInterval = gridMm / 10;

        this.drawXRuler(bounds, largeInterval, mediumInterval, smallInterval);
        this.drawYRuler(bounds, largeInterval, mediumInterval, smallInterval);
    }

    private drawXRuler(bounds: paper.Rectangle, large: number, medium: number, small: number): void {
        const rulerHeight = 25;
        const p1 = this.transformer.screenToModel(bounds.left, 0);
        const p2 = this.transformer.screenToModel(bounds.right, 0);
        
        const startX_model = Math.floor(Math.min(p1.x, p2.x) / small) * small;
        const endX_model = Math.ceil(Math.max(p1.x, p2.x) / small) * small;

        for (let x = startX_model; x <= endX_model; x += small) {
            const screenX = this.transformer.modelToScreen(x, 0).x;
            if (screenX < bounds.left || screenX > bounds.right) continue;

            let h = 5;
            let isLarge = false;
            let isMedium = false;

            if (Math.abs(x % large) < 1e-9 || Math.abs(x % large - large) < 1e-9) {
                h = 15;
                isLarge = true;
            } else if (Math.abs(x % medium) < 1e-9 || Math.abs(x % medium - medium) < 1e-9) {
                h = 10;
                isMedium = true;
            }

            const line = new paper.Path.Line(
                new paper.Point(screenX, bounds.top),
                new paper.Point(screenX, bounds.top + h)
            );
            line.strokeColor = new paper.Color('#888888');
            line.strokeWidth = 1;
            line.strokeScaling = false;

            if (isLarge || (isMedium && this.viewState.zoom > 50)) {
                const text = new paper.PointText(new paper.Point(screenX + 2, bounds.top + 18));
                const isInt = Math.abs(x - Math.round(x)) < 1e-7;
                text.content = isInt ? Math.round(x).toString() : x.toFixed(1);
                text.fillColor = new paper.Color('#aaaaaa');
                text.fontSize = 10;
            }
        }

        const base = new paper.Path.Line(
            new paper.Point(bounds.left, bounds.top + rulerHeight),
            new paper.Point(bounds.right, bounds.top + rulerHeight)
        );
        base.strokeColor = new paper.Color('#444444');
    }

    private drawYRuler(bounds: paper.Rectangle, large: number, medium: number, small: number): void {
        const rulerWidth = 25;
        const p1 = this.transformer.screenToModel(0, bounds.top);
        const p2 = this.transformer.screenToModel(0, bounds.bottom);
        
        const startY_model = Math.floor(Math.min(p1.y, p2.y) / small) * small;
        const endY_model = Math.ceil(Math.max(p1.y, p2.y) / small) * small;

        for (let y = startY_model; y <= endY_model; y += small) {
            const screenY = this.transformer.modelToScreen(0, y).y;
            if (screenY < bounds.top || screenY > bounds.bottom) continue;

            let w = 5;
            let isLarge = false;
            let isMedium = false;

            if (Math.abs(y % large) < 1e-9 || Math.abs(y % large - large) < 1e-9) {
                w = 15;
                isLarge = true;
            } else if (Math.abs(y % medium) < 1e-9 || Math.abs(y % medium - medium) < 1e-9) {
                w = 10;
                isMedium = true;
            }

            const line = new paper.Path.Line(
                new paper.Point(bounds.left, screenY),
                new paper.Point(bounds.left + w, screenY)
            );
            line.strokeColor = new paper.Color('#888888');
            line.strokeWidth = 1;
            line.strokeScaling = false;

            if (isLarge || (isMedium && this.viewState.zoom > 50)) {
                const text = new paper.PointText(new paper.Point(bounds.left + 2, screenY - 2));
                const isInt = Math.abs(y - Math.round(y)) < 1e-7;
                text.content = isInt ? Math.round(y).toString() : y.toFixed(1);
                text.fillColor = new paper.Color('#aaaaaa');
                text.fontSize = 10;
                text.rotate(-90);
            }
        }

        const base = new paper.Path.Line(
            new paper.Point(bounds.left + rulerWidth, bounds.top),
            new paper.Point(bounds.left + rulerWidth, bounds.bottom)
        );
        base.strokeColor = new paper.Color('#444444');
    }
}
