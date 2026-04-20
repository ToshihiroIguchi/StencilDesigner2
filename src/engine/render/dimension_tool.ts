import paper from 'paper';
import { CanvasRenderer } from './canvas';
import { FeatureTree, DimensionFeature } from '../core/feature';
import { ToleranceManager } from '../core/viewport';
import type { ModelUnits } from '../core/viewport';

export class DimensionTool {
    private startPt: {x: ModelUnits, y: ModelUnits} | null = null;
    private startVid: string | undefined = undefined;
    private featureIdCounter = 0;

    constructor(
        private canvasRenderer: CanvasRenderer,
        private featureTree: FeatureTree
    ) {}

    onMouseDown(snap: {modelPt: {x:number, y:number}, modelUnits?: {x:ModelUnits, y:ModelUnits}, vertexId?: string}) {
        // We use modelUnits if provided, or convert from modelPt
        if (snap.modelUnits) {
            this.startPt = snap.modelUnits;
        } else {
            this.startPt = {
                x: ToleranceManager.mmToUnits(snap.modelPt.x),
                y: ToleranceManager.mmToUnits(snap.modelPt.y)
            };
        }
        this.startVid = snap.vertexId;
    }

    onMouseMove(screenPt: {x: number, y: number}, snap: {modelPt: {x:number, y:number}, snappedPt?: {x:number, y:number}, modelUnits?: {x:ModelUnits, y:ModelUnits}, type?: string}) {
        if (!this.startPt) return;

        // Hybrid logic: use snappedPt if we have a real snap target, otherwise raw float
        const useSnapped = snap.type && snap.type !== 'none';
        const displayPt = (useSnapped && snap.snappedPt) ? snap.snappedPt : snap.modelPt;

        const dxMm = displayPt.x - ToleranceManager.unitsToMm(this.startPt.x);
        const dyMm = displayPt.y - ToleranceManager.unitsToMm(this.startPt.y);
        const distMm = Math.hypot(dxMm, dyMm);

        const pt1 = this.canvasRenderer.transformer.modelToScreen(
            ToleranceManager.unitsToMm(this.startPt.x), 
            ToleranceManager.unitsToMm(this.startPt.y)
        );
        const pt2 = screenPt;

        // Visual feedback
        const group = new paper.Group();
        
        const line = new paper.Path.Line(new paper.Point(pt1.x, pt1.y), new paper.Point(pt2.x, pt2.y));
        line.strokeColor = new paper.Color('#ffaa00');
        line.strokeWidth = 1;
        line.dashArray = [2, 2];
        group.addChild(line);

        const text = new paper.PointText(new paper.Point((pt1.x + pt2.x) / 2, (pt1.y + pt2.y) / 2 - 10));
        text.content = `${distMm.toFixed(2)} mm`;
        text.fillColor = new paper.Color('#ffaa00');
        text.fontSize = 12;
        text.justification = 'center';
        group.addChild(text);

        this.canvasRenderer.drawFeedback(group, 'none', {x: 0n, y: 0n});
    }

    onMouseUp(snap: {modelPt: {x:number, y:number}, modelUnits?: {x:ModelUnits, y:ModelUnits}, vertexId?: string}) {
        if (!this.startPt) return;

        const endUnits = snap.modelUnits || {
            x: ToleranceManager.mmToUnits(snap.modelPt.x),
            y: ToleranceManager.mmToUnits(snap.modelPt.y)
        };

        const dxMm = ToleranceManager.unitsToMm(endUnits.x - this.startPt.x);
        const dyMm = ToleranceManager.unitsToMm(endUnits.y - this.startPt.y);
        const distMm = Math.hypot(dxMm, dyMm);

        if (distMm > 0.01) {
            const fId = `dim_${Date.now()}_${this.featureIdCounter++}`;
            const label = `${distMm.toFixed(2)} mm`;
            // Sticky logic: store v1Id and v2Id if they exist
            this.featureTree.addFeature(new DimensionFeature(
                fId, 
                this.startPt.x, this.startPt.y, 
                endUnits.x, endUnits.y, 
                label,
                this.startVid,
                snap.vertexId
            ));
            
            const graph = this.featureTree.rebuild();
            this.canvasRenderer.updateGraph(graph);
        }

        this.startPt = null;
        this.startVid = undefined;
        this.canvasRenderer.drawFeedback(null, 'none', {x: 0n, y: 0n});
    }
}
