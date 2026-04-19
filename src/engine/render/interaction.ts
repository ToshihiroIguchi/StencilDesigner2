import paper from 'paper';
import { FeatureTree, LineFeature, RectFeature } from '../core/feature';
import { SnapEngine } from '../core/snap';
import type { SnapResult } from '../core/snap';
import { CanvasRenderer } from './canvas';
import { ModelGraph } from '../core/graph';
import { CoordinateTransformer } from '../core/viewport';

export class InteractionController {
    public activeTool: 'Line' | 'Rect' | 'Select' = 'Select';
    private currentStart: {x: number, y: number} | null = null;
    private featureIdCounter = 0;

    private tool: paper.Tool;

    constructor(
        private canvasRenderer: CanvasRenderer,
        private featureTree: FeatureTree,
        private snapEngine: SnapEngine
    ) {
        // Register Paper.js Tool
        this.tool = new paper.Tool();
        this.tool.activate();
        
        this.tool.onMouseDown = (event: paper.ToolEvent) => {
            console.log(`[Interaction] mousedown at screen X:${event.point.x}, Y:${event.point.y}`);
            if (this.activeTool === 'Select') {
                console.log('[Interaction] Tool is Select, ignoring draw.');
                return;
            }
            const snapRes = this.snapEngine.snap(event.point.x, event.point.y);
            this.currentStart = snapRes.modelPt;
            console.log(`[Interaction] snap result: ${snapRes.type}, modelPt: ${this.currentStart.x}, ${this.currentStart.y}`);
        };

        this.tool.onMouseDrag = (event: paper.ToolEvent) => {
            if (!this.currentStart || this.activeTool === 'Select') return;
            this.handleGhosting(event.point, event.modifiers.shift);
        };

        this.tool.onMouseMove = (event: paper.ToolEvent) => {
            if (this.activeTool === 'Select') return;
            this.handleGhosting(event.point, event.modifiers.shift); // Just to show the indicator
        };

        this.tool.onMouseUp = (event: paper.ToolEvent) => {
            console.log('[Interaction] mouseup triggered.');
            if (!this.currentStart || this.activeTool === 'Select') return;
            
            const rawSnap = this.snapEngine.snap(event.point.x, event.point.y);
            let endPt = rawSnap.modelPt;
            
            if (event.modifiers.shift) endPt = this.applyShiftConstraint(this.currentStart, endPt);
            
            console.log(`[Interaction] finishing ${this.activeTool} from (${this.currentStart.x}, ${this.currentStart.y}) to (${endPt.x}, ${endPt.y})`);
            
            // Generate Feature
            const fId = `f_${this.featureIdCounter++}`;
            if (this.activeTool === 'Line') {
                this.featureTree.addFeature(new LineFeature(fId, this.currentStart.x, this.currentStart.y, endPt.x, endPt.y));
            } else if (this.activeTool === 'Rect') {
                this.featureTree.addFeature(new RectFeature(fId, this.currentStart.x, this.currentStart.y, endPt.x, endPt.y));
            }

            // Rebuild Model
            const graph = this.featureTree.rebuild();
            // Update renderer state
            this.canvasRenderer.updateGraph(graph);
            this.canvasRenderer.drawFeedback(null, 'none', {x:0, y:0});
            
            this.currentStart = null;
        };
    }

    private handleGhosting(screenPt: paper.Point, shiftPressed: boolean) {
        const snapRes = this.snapEngine.snap(screenPt.x, screenPt.y);
        let endModel = snapRes.modelPt;

        if (this.currentStart) {
            if (shiftPressed) {
                endModel = this.applyShiftConstraint(this.currentStart, endModel);
            }
            
            // Draw Ghost Path
            const pt1 = this.canvasRenderer.transformer.modelToScreen(this.currentStart.x, this.currentStart.y);
            const pt2 = this.canvasRenderer.transformer.modelToScreen(endModel.x, endModel.y);
            
            let ghost: paper.Path;
            if (this.activeTool === 'Line') {
                ghost = new paper.Path.Line(new paper.Point(pt1.x, pt1.y), new paper.Point(pt2.x, pt2.y));
            } else {
                ghost = new paper.Path.Rectangle(new paper.Point(pt1.x, pt1.y), new paper.Point(pt2.x, pt2.y));
            }
            ghost.strokeColor = new paper.Color('#00aa88');
            ghost.strokeWidth = 1;
            ghost.dashArray = [4, 4];
            ghost.strokeScaling = false;

            const resScreen = this.canvasRenderer.transformer.modelToScreen(endModel.x, endModel.y);
            this.canvasRenderer.drawFeedback(ghost, snapRes.type, resScreen);
        } else {
            // Just hovering, show snap indicator
            this.canvasRenderer.drawFeedback(null, snapRes.type, snapRes.screenPt);
        }
    }

    private applyShiftConstraint(start: {x:number, y:number}, end: {x:number, y:number}): {x:number, y:number} {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        
        if (this.activeTool === 'Line') {
            // Axis constraint -> horizontal or vertical
            if (Math.abs(dx) > Math.abs(dy)) {
                return { x: end.x, y: start.y };
            } else {
                return { x: start.x, y: end.y };
            }
        } else if (this.activeTool === 'Rect') {
            // Square constraint -> min dist applied to both
            const signX = Math.sign(dx) || 1;
            const signY = Math.sign(dy) || 1;
            const min = Math.min(Math.abs(dx), Math.abs(dy));
            return { x: start.x + min * signX, y: start.y + min * signY };
        }
        return end;
    }
}
