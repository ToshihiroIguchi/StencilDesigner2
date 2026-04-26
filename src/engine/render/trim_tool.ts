import paper from 'paper';
import { CanvasRenderer } from './canvas';
import { FeatureTree, TrimFeature } from '../core/feature';
import { SelectionManager } from './selection';
import { ModelGraph } from '../core/graph';

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

        const modelPt = this.canvasRenderer.transformer.screenToModel(screenPt.x, screenPt.y);
        const threshold = 15 / this.canvasRenderer.viewState.zoom; // Generous hover hit test radius

        // We can reuse selection manager hit test to find the closest edge!
        // But hitTestSegment gives FeatureId. We actually need the exact split Segment ID!
        // SelectionManager extracts feature ID. Let's write a targeted hit test here.
        let bestDist = Infinity;
        let targetEdge: any = null;

        for (const edge of graph.edges.values()) {
            const v1 = graph.vertices.get(edge.v1);
            const v2 = graph.vertices.get(edge.v2);
            if (!v1 || !v2 || v1.isDeleted || v2.isDeleted) continue;
            
            const dist = this.distToSegment(modelPt, {x: Number(v1.x)/1000, y: Number(v1.y)/1000}, {x: Number(v2.x)/1000, y: Number(v2.y)/1000});
            if (dist <= threshold && dist < bestDist) {
                bestDist = dist;
                targetEdge = edge;
            }
        }

        if (targetEdge) {
            const v1 = graph.vertices.get(targetEdge.v1)!;
            const v2 = graph.vertices.get(targetEdge.v2)!;
            
            const pt1 = this.canvasRenderer.transformer.modelToScreen(Number(v1.x)/1000, Number(v1.y)/1000);
            const pt2 = this.canvasRenderer.transformer.modelToScreen(Number(v2.x)/1000, Number(v2.y)/1000);
            
            const ghost = new paper.Path.Line(new paper.Point(pt1.x, pt1.y), new paper.Point(pt2.x, pt2.y));
            ghost.strokeColor = new paper.Color('#ff0000'); // Red dash highlight
            ghost.strokeWidth = 3;
            ghost.dashArray = [4, 4];
            ghost.strokeScaling = false;

            this.canvasRenderer.drawFeedback(ghost, 'none', {x: 0, y: 0});
        } else {
            this.canvasRenderer.drawFeedback(null, 'none', {x: 0, y: 0});
        }
    }

    onMouseUp(screenPt: {x: number, y: number}) {
        const graph = (this.canvasRenderer as any).currentGraph as ModelGraph;
        if (!graph) return;

        const modelPt = this.canvasRenderer.transformer.screenToModel(screenPt.x, screenPt.y);
        const threshold = 15 / this.canvasRenderer.viewState.zoom;

        const fId = `trim_${this.featureIdCounter++}`;
        const trimFeature = new TrimFeature(fId, modelPt.x, modelPt.y);
        
        // We temporarily test it internally to see if it even hits anything.
        // If it does, we record it.
        let hit = false;
        for (const edge of graph.edges.values()) {
            const v1 = graph.vertices.get(edge.v1);
            const v2 = graph.vertices.get(edge.v2);
            if (!v1 || !v2 || v1.isDeleted || v2.isDeleted) continue;
            const dist = this.distToSegment(modelPt, {x: Number(v1.x)/1000, y: Number(v1.y)/1000}, {x: Number(v2.x)/1000, y: Number(v2.y)/1000});
            if (dist <= threshold) {
                hit = true; break;
            }
        }

        if (hit) {
            this.featureTree.addFeature(trimFeature);
            const newGraph = this.featureTree.rebuild();
            this.canvasRenderer.updateGraph(newGraph);
            this.canvasRenderer.drawFeedback(null, 'none', {x: 0, y: 0});
        }
    }

    private distToSegment(p: {x:number, y:number}, v: {x:number, y:number}, w: {x:number, y:number}) {
        const l2 = Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2);
        if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
        let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
    }
}
