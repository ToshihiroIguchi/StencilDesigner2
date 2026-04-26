import paper from 'paper';
import { CanvasRenderer } from './canvas';
import { FeatureTree, TrimFeature } from '../core/feature';
import { screenToWorld, worldToScreen } from '../core/viewport';

export class TrimTool {
    private featureIdCounter = 0;

    constructor(
        private canvasRenderer: CanvasRenderer,
        private featureTree: FeatureTree
    ) {}

    onMouseMove(screenPt: {x: number, y: number}) {
        const graph = this.canvasRenderer.currentGraph;
        if (!graph) return;

        const wPt = screenToWorld(screenPt.x, screenPt.y, this.canvasRenderer.viewTransform);
        const thresholdUm = BigInt(Math.round(15 / this.canvasRenderer.viewTransform.scale));

        let bestDistSq = thresholdUm * thresholdUm;
        let targetEdge: any = null;

        for (const edge of graph.edges.values()) {
            const v1 = graph.vertices.get(edge.v1);
            const v2 = graph.vertices.get(edge.v2);
            if (!v1 || !v2 || v1.isDeleted || v2.isDeleted) continue;
            
            // For simplicity in UI hover, we use Number conversion here, 
            // but we could use BigInt-pure distance if needed for perfect rigor.
            const dist = this.distToSegment(wPt, v1, v2);
            if (dist <= Number(thresholdUm) && (dist * dist) < Number(bestDistSq)) {
                bestDistSq = BigInt(Math.round(dist * dist));
                targetEdge = edge;
            }
        }

        if (targetEdge) {
            const v1 = graph.vertices.get(targetEdge.v1)!;
            const v2 = graph.vertices.get(targetEdge.v2)!;
            
            const p1 = worldToScreen(v1.x, v1.y, this.canvasRenderer.viewTransform);
            const p2 = worldToScreen(v2.x, v2.y, this.canvasRenderer.viewTransform);
            
            const ghost = new paper.Path.Line(new paper.Point(p1.sx, p1.sy), new paper.Point(p2.sx, p2.sy));
            ghost.strokeColor = new paper.Color('#ff0000'); 
            ghost.strokeWidth = 3;
            ghost.dashArray = [4, 4];

            this.canvasRenderer.drawFeedback(ghost, 'none', {x: 0n, y: 0n});
        } else {
            this.canvasRenderer.drawFeedback(null, 'none', {x: 0n, y: 0n});
        }
    }

    onMouseUp(screenPt: {x: number, y: number}) {
        const graph = this.canvasRenderer.currentGraph;
        if (!graph) return;

        const wPt = screenToWorld(screenPt.x, screenPt.y, this.canvasRenderer.viewTransform);
        const thresholdUm = 15 / this.canvasRenderer.viewTransform.scale;

        const fId = `trim_${this.featureIdCounter++}`;
        // Feature expects mm for now (Legacy Feature bridge)
        const trimFeature = new TrimFeature(fId, Number(wPt.x) / 1000, Number(wPt.y) / 1000);
        
        let hit = false;
        for (const edge of graph.edges.values()) {
            const v1 = graph.vertices.get(edge.v1);
            const v2 = graph.vertices.get(edge.v2);
            if (!v1 || !v2 || v1.isDeleted || v2.isDeleted) continue;
            const dist = this.distToSegment(wPt, v1, v2);
            if (dist <= thresholdUm) {
                hit = true; break;
            }
        }

        if (hit) {
            this.featureTree.addFeature(trimFeature);
            const newGraph = this.featureTree.rebuild();
            this.canvasRenderer.updateGraph(newGraph);
            this.canvasRenderer.drawFeedback(null, 'none', {x: 0n, y: 0n});
        }
    }

    private distToSegment(p: {x:bigint, y:bigint}, v: {x:bigint, y:bigint}, w: {x:bigint, y:bigint}): number {
        const px = Number(p.x), py = Number(p.y);
        const vx = Number(v.x), vy = Number(v.y);
        const wx = Number(w.x), wy = Number(w.y);

        const l2 = Math.pow(vx - wx, 2) + Math.pow(vy - wy, 2);
        if (l2 === 0) return Math.hypot(px - vx, py - vy);
        let t = ((px - vx) * (wx - vx) + (py - vy) * (wy - vy)) / l2;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(px - (vx + t * (wx - vx)), py - (vy + t * (wy - vy)));
    }
}
