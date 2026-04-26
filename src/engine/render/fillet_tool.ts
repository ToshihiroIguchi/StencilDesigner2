import paper from 'paper';
import { CanvasRenderer } from './canvas';
import { FeatureTree } from '../core/feature';
import { FilletFeature } from '../core/fillet';
import { screenToWorld, worldToScreen } from '../core/viewport';

export class FilletTool {
    private featureIdCounter = 0;
    public activeRadius: number = 2.0;

    constructor(
        private canvasRenderer: CanvasRenderer,
        private featureTree: FeatureTree
    ) {}

    onMouseMove(screenPt: {x: number, y: number}) {
        const graph = this.canvasRenderer.currentGraph;
        if (!graph) return;

        const wPt = screenToWorld(screenPt.x, screenPt.y, this.canvasRenderer.viewTransform);
        const thresholdUm = 15 / this.canvasRenderer.viewTransform.scale;

        let bestDistSq = thresholdUm * thresholdUm;
        let targetVertexId: string | null = null;
        let targetV: any = null;

        for (const [vid, v] of graph.vertices.entries()) {
            if (v.isDeleted) continue;
            // Check if degree is 2
            let deg = 0;
            for (const edge of graph.edges.values()) {
                if (edge.v1 === vid || edge.v2 === vid) deg++;
            }
            if (deg !== 2) continue;

            const dx = Number(v.x - wPt.x);
            const dy = Number(v.y - wPt.y);
            const distSq = dx * dx + dy * dy;

            if (distSq <= bestDistSq) {
                bestDistSq = distSq;
                targetVertexId = vid;
                targetV = v;
            }
        }

        if (targetVertexId) {
            const sPt = worldToScreen(targetV.x, targetV.y, this.canvasRenderer.viewTransform);
            
            const ghost = new paper.Path.Circle(new paper.Point(sPt.sx, sPt.sy), 8);
            ghost.strokeColor = new paper.Color('#aa00ff');
            ghost.strokeWidth = 2;
            ghost.dashArray = [2, 2];

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

        const fId = `fillet_${this.featureIdCounter++}`;
        const filletFeature = new FilletFeature(fId, Number(wPt.x) / 1000, Number(wPt.y) / 1000, this.activeRadius);
        
        let hit = false;
        for (const [vid, v] of graph.vertices.entries()) {
            if (v.isDeleted) continue;
            let deg = 0;
            for (const edge of graph.edges.values()) {
                if (edge.v1 === vid || edge.v2 === vid) deg++;
            }
            if (deg !== 2) continue;

            const dx = Number(v.x - wPt.x);
            const dy = Number(v.y - wPt.y);
            const distSq = dx * dx + dy * dy;

            if (distSq <= thresholdUm * thresholdUm) {
                hit = true; break;
            }
        }

        if (hit) {
            this.featureTree.addFeature(filletFeature);
            const newGraph = this.featureTree.rebuild();
            this.canvasRenderer.updateGraph(newGraph);
            this.canvasRenderer.drawFeedback(null, 'none', {x: 0n, y: 0n});
        }
    }
}
