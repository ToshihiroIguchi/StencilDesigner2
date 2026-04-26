import paper from 'paper';
import { CanvasRenderer } from './canvas';
import { FeatureTree, DimensionFeature } from '../core/feature';
import { worldToScreen } from '../core/viewport';

export class DimensionTool {
    private startWorldPt: {x: bigint, y: bigint} | null = null;
    private startVid: string | undefined = undefined;
    private featureIdCounter = 0;

    constructor(
        private canvasRenderer: CanvasRenderer,
        private featureTree: FeatureTree
    ) {}

    onMouseDown(snap: {worldX: bigint, worldY: bigint, vertexId?: string}) {
        this.startWorldPt = { x: snap.worldX, y: snap.worldY };
        this.startVid = snap.vertexId;
    }

    onMouseMove(screenPt: {x: number, y: number}, snap: {worldX: bigint, worldY: bigint}) {
        if (!this.startWorldPt) return;

        const p1 = worldToScreen(this.startWorldPt.x, this.startWorldPt.y, this.canvasRenderer.viewTransform);
        const p2 = { sx: screenPt.x, sy: screenPt.y };

        const dx = Number(snap.worldX - this.startWorldPt.x);
        const dy = Number(snap.worldY - this.startWorldPt.y);
        const distMm = Math.hypot(dx, dy) / 1000;

        // Visual feedback
        const group = new paper.Group();
        
        const line = new paper.Path.Line(new paper.Point(p1.sx, p1.sy), new paper.Point(p2.sx, p2.sy));
        line.strokeColor = new paper.Color('#ffaa00');
        line.strokeWidth = 1.5;
        line.dashArray = [2, 2];
        group.addChild(line);

        const text = new paper.PointText(new paper.Point((p1.sx + p2.sx) / 2, (p1.sy + p2.sy) / 2 - 10));
        text.content = `${distMm.toFixed(2)} mm`;
        text.fillColor = new paper.Color('#ffaa00');
        text.fontSize = 12;
        text.justification = 'center';
        group.addChild(text);

        this.canvasRenderer.drawFeedback(group, 'none', {x: 0n, y: 0n});
    }

    onMouseUp(snap: {worldX: bigint, worldY: bigint, vertexId?: string}) {
        if (!this.startWorldPt) return;

        const dx = Number(snap.worldX - this.startWorldPt.x);
        const dy = Number(snap.worldY - this.startWorldPt.y);
        const distMm = Math.hypot(dx, dy) / 1000;

        if (distMm > 0.001) {
            const fId = `dim_${Date.now()}_${this.featureIdCounter++}`;
            const label = `${distMm.toFixed(2)} mm`;
            
            // Feature expects properties in mm for core compatibility (legacy bridge)
            const dimFeature = new DimensionFeature(
                fId,
                Number(this.startWorldPt.x) / 1000, Number(this.startWorldPt.y) / 1000,
                Number(snap.worldX) / 1000, Number(snap.worldY) / 1000,
                label,
                this.startVid,
                snap.vertexId
            );
            
            this.featureTree.addFeature(dimFeature);
            const graph = this.featureTree.rebuild();
            this.canvasRenderer.updateGraph(graph);
        }

        this.startWorldPt = null;
        this.startVid = undefined;
        this.canvasRenderer.drawFeedback(null, 'none', {x: 0n, y: 0n});
    }
}
