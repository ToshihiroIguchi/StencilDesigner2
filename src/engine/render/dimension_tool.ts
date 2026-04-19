import paper from 'paper';
import { CanvasRenderer } from './canvas';
import { FeatureTree, DimensionFeature } from '../core/feature';

export class DimensionTool {
    private startPt: {x: number, y: number} | null = null;
    private startVid: string | undefined = undefined;
    private featureIdCounter = 0;

    constructor(
        private canvasRenderer: CanvasRenderer,
        private featureTree: FeatureTree
    ) {}

    onMouseDown(snap: {modelPt: {x:number, y:number}, vertexId?: string}) {
        this.startPt = snap.modelPt;
        this.startVid = snap.vertexId;
    }

    onMouseMove(screenPt: {x: number, y: number}, snap: {modelPt: {x:number, y:number}}) {
        if (!this.startPt) return;

        const endModel = snap.modelPt;
        const dist = Math.hypot(endModel.x - this.startPt.x, endModel.y - this.startPt.y);

        const pt1 = this.canvasRenderer.transformer.modelToScreen(this.startPt.x, this.startPt.y);
        const pt2 = screenPt;

        // Visual feedback
        const group = new paper.Group();
        
        const line = new paper.Path.Line(new paper.Point(pt1.x, pt1.y), new paper.Point(pt2.x, pt2.y));
        line.strokeColor = new paper.Color('#ffaa00');
        line.strokeWidth = 1;
        line.dashArray = [2, 2];
        group.addChild(line);

        const text = new paper.PointText(new paper.Point((pt1.x + pt2.x) / 2, (pt1.y + pt2.y) / 2 - 10));
        text.content = `${dist.toFixed(2)} mm`;
        text.fillColor = new paper.Color('#ffaa00');
        text.fontSize = 12;
        text.justification = 'center';
        group.addChild(text);

        this.canvasRenderer.drawFeedback(group, 'none', {x: 0, y: 0});
    }

    onMouseUp(snap: {modelPt: {x:number, y:number}, vertexId?: string}) {
        if (!this.startPt) return;

        const endModel = snap.modelPt;
        const dist = Math.hypot(endModel.x - this.startPt.x, endModel.y - this.startPt.y);

        if (dist > 0.1) {
            const fId = `dim_${Date.now()}_${this.featureIdCounter++}`;
            const label = `${dist.toFixed(2)} mm`;
            // Sticky logic: store v1Id and v2Id if they exist
            this.featureTree.addFeature(new DimensionFeature(
                fId, 
                this.startPt.x, this.startPt.y, 
                endModel.x, endModel.y, 
                label,
                this.startVid,
                snap.vertexId
            ));
            
            const graph = this.featureTree.rebuild();
            this.canvasRenderer.updateGraph(graph);
        }

        this.startPt = null;
        this.startVid = undefined;
        this.canvasRenderer.drawFeedback(null, 'none', {x: 0, y: 0});
    }
}
