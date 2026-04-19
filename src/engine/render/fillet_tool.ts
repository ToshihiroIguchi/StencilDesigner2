import paper from 'paper';
import { CanvasRenderer } from './canvas';
import { FeatureTree } from '../core/feature';
import { FilletFeature } from '../core/fillet';
import { ModelGraph } from '../core/graph';

export class FilletTool {
    private featureIdCounter = 0;
    public activeRadius: number = 2.0;

    constructor(
        private canvasRenderer: CanvasRenderer,
        private featureTree: FeatureTree
    ) {}

    onMouseMove(screenPt: {x: number, y: number}) {
        const graph = (this.canvasRenderer as any).currentGraph as ModelGraph;
        if (!graph) return;

        const modelPt = this.canvasRenderer.transformer.screenToModel(screenPt.x, screenPt.y);
        const threshold = 15 / this.canvasRenderer.viewState.zoom;

        let bestDist = Infinity;
        let targetVertexId: string | null = null;
        let targetV: any = null;

        for (const [vid, v] of graph.vertices.entries()) {
            if (v.x == null || v.y == null) continue;
            // Check if degree is 2
            let deg = 0;
            for (const edge of graph.edges.values()) {
                if (edge.u === vid || edge.v === vid) deg++;
            }
            if (deg !== 2) continue;

            const dist = Math.hypot(v.x - modelPt.x, v.y - modelPt.y);
            if (dist <= threshold && dist < bestDist) {
                bestDist = dist;
                targetVertexId = vid;
                targetV = v;
            }
        }

        if (targetVertexId) {
            const ptScreen = this.canvasRenderer.transformer.modelToScreen(targetV.x, targetV.y);
            
            const ghost = new paper.Path.Circle(new paper.Point(ptScreen.x, ptScreen.y), 6);
            ghost.strokeColor = new paper.Color('#aa00ff');
            ghost.strokeWidth = 2;
            ghost.dashArray = [2, 2];
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

        const fId = `fillet_${this.featureIdCounter++}`;
        const filletFeature = new FilletFeature(fId, modelPt.x, modelPt.y, this.activeRadius);
        
        let hit = false;
        for (const [vid, v] of graph.vertices.entries()) {
            if (v.x == null || v.y == null) continue;
            let deg = 0;
            for (const edge of graph.edges.values()) {
                if (edge.u === vid || edge.v === vid) deg++;
            }
            if (deg !== 2) continue;

            const dist = Math.hypot(v.x - modelPt.x, v.y - modelPt.y);
            if (dist <= threshold) {
                hit = true; break;
            }
        }

        if (hit) {
            this.featureTree.addFeature(filletFeature);
            const newGraph = this.featureTree.rebuild();
            this.canvasRenderer.updateGraph(newGraph);
            this.canvasRenderer.drawFeedback(null, 'none', {x: 0, y: 0});
        }
    }
}
