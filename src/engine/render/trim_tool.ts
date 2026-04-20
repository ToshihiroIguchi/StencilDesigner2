import paper from 'paper';
import { CanvasRenderer } from './canvas';
import { FeatureTree, TrimFeature } from '../core/feature';
import { SelectionManager } from './selection';
import { ModelGraph } from '../core/graph';
import { ToleranceManager } from '../core/viewport';
import type { ModelUnits } from '../core/viewport';

export class TrimTool {
    private featureIdCounter = 0;

    constructor(
        private canvasRenderer: CanvasRenderer,
        private featureTree: FeatureTree,
        _selectionManager: SelectionManager
    ) {}

    onMouseMove(screenPt: {x: number, y: number}) {
        const graph = (this.canvasRenderer as any).currentGraph as ModelGraph;
        if (!graph) return;

        const modelPt = this.canvasRenderer.transformer.screenToModelUnits(screenPt.x, screenPt.y);
        const threshold = ToleranceManager.mmToUnits(1.5); // 1.5mm hit test radius in µm

        let bestDistSq = BigInt(threshold) * BigInt(threshold);
        let targetEdge: any = null;

        for (const edge of graph.edges.values()) {
            const v1 = graph.vertices.get(edge.u);
            const v2 = graph.vertices.get(edge.v);
            if (!v1 || !v2 || v1.x === undefined || v1.y === undefined || v2.x === undefined || v2.y === undefined) continue;
            
            const distSq = this.distToSegmentUnitsSq(modelPt, {x: v1.x, y: v1.y}, {x: v2.x, y: v2.y});
            if (distSq <= bestDistSq) {
                bestDistSq = distSq;
                targetEdge = edge;
            }
        }

        if (targetEdge) {
            const v1 = graph.vertices.get(targetEdge.u)!;
            const v2 = graph.vertices.get(targetEdge.v)!;
            
            const pt1 = this.canvasRenderer.transformer.modelToScreen(ToleranceManager.unitsToMm(v1.x!), ToleranceManager.unitsToMm(v1.y!));
            const pt2 = this.canvasRenderer.transformer.modelToScreen(ToleranceManager.unitsToMm(v2.x!), ToleranceManager.unitsToMm(v2.y!));
            
            const ghost = new paper.Path.Line(new paper.Point(pt1.x, pt1.y), new paper.Point(pt2.x, pt2.y));
            ghost.strokeColor = new paper.Color('#ff0000'); 
            ghost.strokeWidth = 3;
            ghost.dashArray = [4, 4];
            ghost.strokeScaling = false;

            this.canvasRenderer.drawFeedback(ghost, 'none', {x: 0n, y: 0n});
        } else {
            this.canvasRenderer.drawFeedback(null, 'none', {x: 0n, y: 0n});
        }
    }

    onMouseUp(screenPt: {x: number, y: number}) {
        const graph = (this.canvasRenderer as any).currentGraph as ModelGraph;
        if (!graph) return;

        const modelPt = this.canvasRenderer.transformer.screenToModelUnits(screenPt.x, screenPt.y);
        const threshold = ToleranceManager.mmToUnits(1.5);

        const fId = `trim_${this.featureIdCounter++}`;
        const trimFeature = new TrimFeature(fId, modelPt.x, modelPt.y);
        
        // We temporarily test it internally to see if it even hits anything.
        let hit = false;
        const thresholdSq = BigInt(threshold) * BigInt(threshold);
        for (const edge of graph.edges.values()) {
            const v1 = graph.vertices.get(edge.u);
            const v2 = graph.vertices.get(edge.v);
            if (!v1 || !v2 || v1.x === undefined || v1.y === undefined || v2.x === undefined || v2.y === undefined) continue;
            const distSq = this.distToSegmentUnitsSq(modelPt, {x: v1.x, y: v1.y}, {x: v2.x, y: v2.y});
            if (distSq <= thresholdSq) {
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

    private distToSegmentUnitsSq(p: {x:ModelUnits, y:ModelUnits}, v: {x:ModelUnits, y:ModelUnits}, w: {x:ModelUnits, y:ModelUnits}): bigint {
        const l2 = (v.x - w.x) * (v.x - w.x) + (v.y - w.y) * (v.y - w.y);
        if (l2 === 0n) return (p.x - v.x) * (p.x - v.x) + (p.y - v.y) * (p.y - v.y);
        
        // Projection calculation using BigInt with rounding
        // t = ((px - vx) * (wx - vx) + (py - vy) * (wy - vy)) / l2
        const dot = (p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y);
        
        if (dot <= 0n) return (p.x - v.x) * (p.x - v.x) + (p.y - v.y) * (p.y - v.y);
        if (dot >= l2) return (p.x - w.x) * (p.x - w.x) + (p.y - w.y) * (p.y - w.y);
        
        // Perpendicular distance squared: distSq = (distP-V)^2 - (dot^2 / l2)
        // using (a^2 - b^2/c) = (a^2*c - b^2)/c
        const distSqV = (p.x - v.x) * (p.x - v.x) + (p.y - v.y) * (p.y - v.y);
        return distSqV - (dot * dot) / l2;
    }
}
