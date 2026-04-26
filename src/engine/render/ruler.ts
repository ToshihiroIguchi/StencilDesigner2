import paper from 'paper';
import { type ViewTransform, worldToScreen, screenToWorld } from '../core/viewport';
import { getTheme } from '../core/theme';

/**
 * Ruler Manager
 * Draws X and Y reference rulers linked to the viewport.
 * Now using View Layer separation (explicit transforms).
 */
export class RulerManager {
    constructor(
        private view: ViewTransform,
        private layer: paper.Layer
    ) {}

    draw(): void {
        this.layer.activate();
        this.layer.removeChildren();
        
        const theme = getTheme();
        const bounds = paper.view.bounds;
        
        // Define intervals in μm
        // 1mm = 1000μm, 10mm = 10000μm, 0.1mm = 100μm
        const scale = this.view.scale;
        
        let small = 1000n; // 1mm
        let medium = 5000n; // 5mm
        let large = 10000n; // 10mm

        if (scale > 0.5) { // Highly zoomed in
            small = 100n;
            medium = 500n;
            large = 1000n;
        } else if (scale < 0.02) { // Zoomed out
            small = 10000n;
            medium = 50000n;
            large = 100000n;
        }

        this.drawXRuler(bounds, large, medium, small, theme);
        this.drawYRuler(bounds, large, medium, small, theme);
    }

    private drawXRuler(bounds: paper.Rectangle, large: bigint, medium: bigint, small: bigint, theme: any): void {
        const rulerHeight = 25;
        const pTL = screenToWorld(bounds.left, bounds.top, this.view);
        const pBR = screenToWorld(bounds.right, bounds.bottom, this.view);
        
        const startX_world = (pTL.x < pBR.x ? pTL.x : pBR.x) / small * small - small;
        const endX_world = (pTL.x > pBR.x ? pTL.x : pBR.x) / small * small + small;

        for (let x = startX_world; x <= endX_world; x += small) {
            const screen = worldToScreen(x, 0n, this.view);
            if (screen.sx < bounds.left || screen.sx > bounds.right) continue;

            let h = 5;
            let isLarge = false;
            let isMedium = false;

            if (x % large === 0n) { h = 15; isLarge = true; }
            else if (x % medium === 0n) { h = 10; isMedium = true; }

            const line = new paper.Path.Line(
                new paper.Point(screen.sx, bounds.top),
                new paper.Point(screen.sx, bounds.top + h)
            );
            line.strokeColor = new paper.Color(theme.gridMajor);
            line.strokeWidth = 1;

            if (isLarge || (isMedium && this.view.scale > 0.1)) {
                const text = new paper.PointText(new paper.Point(screen.sx + 2, bounds.top + 18));
                text.content = (Number(x) / 1000).toString(); // Display in mm
                text.fillColor = new paper.Color(theme.edge);
                text.fontSize = 10;
            }
        }

        const base = new paper.Path.Line(
            new paper.Point(bounds.left, bounds.top + rulerHeight),
            new paper.Point(bounds.right, bounds.top + rulerHeight)
        );
        base.strokeColor = new paper.Color(theme.gridMajor);
    }

    private drawYRuler(bounds: paper.Rectangle, large: bigint, medium: bigint, small: bigint, theme: any): void {
        const rulerWidth = 25;
        const pTL = screenToWorld(bounds.left, bounds.top, this.view);
        const pBR = screenToWorld(bounds.right, bounds.bottom, this.view);
        
        const startY_world = (pTL.y < pBR.y ? pTL.y : pBR.y) / small * small - small;
        const endY_world = (pTL.y > pBR.y ? pTL.y : pBR.y) / small * small + small;

        for (let y = startY_world; y <= endY_world; y += small) {
            const screen = worldToScreen(0n, y, this.view);
            if (screen.sy < bounds.top || screen.sy > bounds.bottom) continue;

            let w = 5;
            let isLarge = false;
            let isMedium = false;

            if (y % large === 0n) { w = 15; isLarge = true; }
            else if (y % medium === 0n) { w = 10; isMedium = true; }

            const line = new paper.Path.Line(
                new paper.Point(bounds.left, screen.sy),
                new paper.Point(bounds.left + w, screen.sy)
            );
            line.strokeColor = new paper.Color(theme.gridMajor);
            line.strokeWidth = 1;

            if (isLarge || (isMedium && this.view.scale > 0.1)) {
                const text = new paper.PointText(new paper.Point(bounds.left + 2, screen.sy - 2));
                text.content = (Number(y) / 1000).toString();
                text.fillColor = new paper.Color(theme.edge);
                text.fontSize = 10;
                text.rotate(-90);
            }
        }

        const base = new paper.Path.Line(
            new paper.Point(bounds.left + rulerWidth, bounds.top),
            new paper.Point(bounds.left + rulerWidth, bounds.bottom)
        );
        base.strokeColor = new paper.Color(theme.gridMajor);
    }
}
