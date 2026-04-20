import paper from 'paper';
import { CanvasRenderer } from './canvas';
import { FeatureTree } from '../core/feature';
import { FilletFeature } from '../core/fillet';
import { ModelGraph } from '../core/graph';
import { ToleranceManager } from '../core/viewport';
import type { ModelUnits } from '../core/viewport';

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

        const modelPt = this.canvasRenderer.transformer.screenToModelUnits(screenPt.x, screenPt.y);
        const threshold = ToleranceManager.mmToUnits(2.0); // 2mm hover radius

        let bestDistSq = BigInt(threshold) * BigInt(threshold);
        let targetVertexId: string | null = null;
        let targetV: any = null;

        for (const [vid, v] of graph.vertices.entries()) {
            if (v.x === undefined || v.y === undefined) continue;
            // Check if degree is 2
            let deg = 0;
            for (const edge of graph.edges.values()) {
                if (edge.u === vid || edge.v === vid) deg++;
            }
            if (deg !== 2) continue;

            const dx = v.x - modelPt.x;
            const dy = v.y - modelPt.y;
            const distSq = dx * dx + dy * dy;
            
            if (distSq <= bestDistSq) {
                bestDistSq = distSq;
                targetVertexId = vid;
                targetV = v;
            }
        }

        if (targetVertexId) {
            const ptScreen = this.canvasRenderer.transformer.modelToScreen(
                ToleranceManager.unitsToMm(targetV.x), 
                ToleranceManager.unitsToMm(targetV.y)
            );
            
            const ghost = new paper.Path.Circle(new paper.Point(ptScreen.x, ptScreen.y), 6);
            ghost.strokeColor = new paper.Color('#aa00ff');
            ghost.strokeWidth = 2;
            ghost.dashArray = [2, 2];
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
        const threshold = ToleranceManager.mmToUnits(2.0);

        const fId = `fillet_${this.featureIdCounter++}`;
        const filletFeature = new FilletFeature(fId, modelPt.x, modelPt.y, this.activeRadius);
        
        let hit = false;
        const thresholdSq = BigInt(threshold) * BigInt(threshold);
        for (const [vid, v] of graph.vertices.entries()) {
            if (v.x === undefined || v.y === undefined) continue;
            let deg = 0;
            for (const edge of graph.edges.values()) {
                if (edge.u === vid || edge.v === vid) deg++;
            }
            if (deg !== 2) continue;

            const dx = v.x - modelPt.x;
            const dy = v.y - modelPt.y;
            const distSq = dx * dx + dy * dy;
            if (distSq <= thresholdSq) {
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
