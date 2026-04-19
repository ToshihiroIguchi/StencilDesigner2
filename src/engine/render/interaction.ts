import paper from 'paper';
import { FeatureTree, LineFeature, RectFeature } from '../core/feature';
import { SnapEngine } from '../core/snap';
import type { SnapResult } from '../core/snap';
import { CanvasRenderer } from './canvas';
import { ModelGraph } from '../core/graph';
import { CoordinateTransformer } from '../core/viewport';
import { SelectionManager } from './selection';
import { TrimTool } from './trim_tool';
import { FilletTool } from './fillet_tool';
import { DimensionTool } from './dimension_tool';

export class InteractionController {
    public activeTool: 'Line' | 'Rect' | 'Select' | 'Trim' | 'Fillet' | 'Dim' = 'Select';
    private currentStart: {x: number, y: number} | null = null;
    private featureIdCounter = 0;

    private tool: paper.Tool;

    constructor(
        private canvasRenderer: CanvasRenderer,
        public featureTree: FeatureTree,
        private snapEngine: SnapEngine,
        private selectionManager: SelectionManager,
        private trimTool: TrimTool,
        private filletTool: FilletTool,
        private dimensionTool: DimensionTool
    ) {
        // Register Paper.js Tool
        this.tool = new paper.Tool();
        this.tool.activate();
        
        this.tool.onMouseDown = (event: paper.ToolEvent) => {
            if (this.activeTool === 'Trim' || this.activeTool === 'Fillet') return;
            if (this.activeTool === 'Dim') {
                const snap = this.snapEngine.snap(event.point.x, event.point.y);
                this.dimensionTool.onMouseDown(snap);
                return;
            }
            if (this.activeTool === 'Select') {
                this.currentStart = { x: event.point.x, y: event.point.y }; 
                return;
            }
            const snapRes = this.snapEngine.snap(event.point.x, event.point.y);
            this.currentStart = snapRes.modelPt;
        };

        this.tool.onMouseDrag = (event: paper.ToolEvent) => {
            if (this.activeTool === 'Trim' || this.activeTool === 'Fillet' || this.activeTool === 'Dim') return;
            if (!this.currentStart) return;
            if (this.activeTool === 'Select') {
                const rect = new paper.Path.Rectangle(
                    new paper.Point(this.currentStart.x, this.currentStart.y),
                    event.point
                );
                rect.strokeColor = new paper.Color('#00aaee');
                rect.fillColor = new paper.Color(0, 0.66, 0.93, 0.2); 
                rect.strokeWidth = 1;
                rect.dashArray = [4, 4];
                rect.strokeScaling = false;
                this.canvasRenderer.drawFeedback(rect, 'none', {x:0, y:0});
                return;
            }
            this.handleGhosting(event.point, event.modifiers.shift);
        };

        this.tool.onMouseMove = (event: paper.ToolEvent) => {
            if (this.activeTool === 'Trim') {
                this.trimTool.onMouseMove(event.point);
                return;
            }
            if (this.activeTool === 'Fillet') {
                this.filletTool.onMouseMove(event.point);
                return;
            }
            if (this.activeTool === 'Dim') {
                const snap = this.snapEngine.snap(event.point.x, event.point.y);
                this.dimensionTool.onMouseMove(event.point, snap);
                return;
            }
            if (this.activeTool === 'Select') return;
            this.handleGhosting(event.point, event.modifiers.shift); 
        };

        this.tool.onMouseUp = (event: paper.ToolEvent) => {
            if (this.activeTool === 'Trim') {
                this.trimTool.onMouseUp(event.point);
                return;
            }
            if (this.activeTool === 'Fillet') {
                this.filletTool.onMouseUp(event.point);
                return;
            }
            if (this.activeTool === 'Dim') {
                const snap = this.snapEngine.snap(event.point.x, event.point.y);
                this.dimensionTool.onMouseUp(snap);
                return;
            }
            if (!this.currentStart) return;
            
            if (this.activeTool === 'Select') {
                const startScreen = this.currentStart;
                const endScreen = event.point;
                const dist = Math.hypot(endScreen.x - startScreen.x, endScreen.y - startScreen.y);
                
                const graph = (this.canvasRenderer as any).currentGraph as ModelGraph;

                if (dist < 2) { // Single click
                    const threshold = 10 / this.canvasRenderer.viewState.zoom;
                    const modelPt = this.canvasRenderer.transformer.screenToModel(endScreen.x, endScreen.y);
                    const hitFeatureId = this.selectionManager.hitTestSegment(modelPt, graph, threshold);
                    
                    if (hitFeatureId) {
                        this.selectionManager.select(hitFeatureId, event.modifiers.shift);
                    } else if (!event.modifiers.shift) {
                        this.selectionManager.clear();
                    }
                } else { // Box Select
                    const p1 = this.canvasRenderer.transformer.screenToModel(startScreen.x, startScreen.y);
                    const p2 = this.canvasRenderer.transformer.screenToModel(endScreen.x, endScreen.y);
                    const min = { x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y) };
                    const max = { x: Math.max(p1.x, p2.x), y: Math.max(p1.y, p2.y) };
                    
                    const found = this.selectionManager.boxSelect(min, max, graph);
                    if (!event.modifiers.shift) this.selectionManager.clear();
                    found.forEach(id => this.selectionManager.select(id, true));
                }
                
                this.canvasRenderer.drawAll();
                this.canvasRenderer.drawFeedback(null, 'none', {x:0, y:0});
                this.currentStart = null;
                return;
            }
            
            // Drawing logic
            const rawSnap = this.snapEngine.snap(event.point.x, event.point.y);
            let endPt = rawSnap.modelPt;
            
            if (event.modifiers.shift) endPt = this.applyShiftConstraint(this.currentStart, endPt);
            
            const fId = `f_${this.featureIdCounter++}`;
            if (this.activeTool === 'Line') {
                this.featureTree.addFeature(new LineFeature(fId, this.currentStart.x, this.currentStart.y, endPt.x, endPt.y));
            } else if (this.activeTool === 'Rect') {
                this.featureTree.addFeature(new RectFeature(fId, this.currentStart.x, this.currentStart.y, endPt.x, endPt.y));
            }

            const graph = this.featureTree.rebuild();
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
            this.canvasRenderer.drawFeedback(null, snapRes.type, snapRes.screenPt);
        }
    }

    private applyShiftConstraint(start: {x:number, y:number}, end: {x:number, y:number}): {x:number, y:number} {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        
        if (this.activeTool === 'Line') {
            if (Math.abs(dx) > Math.abs(dy)) {
                return { x: end.x, y: start.y };
            } else {
                return { x: start.x, y: end.y };
            }
        } else if (this.activeTool === 'Rect') {
            const signX = Math.sign(dx) || 1;
            const signY = Math.sign(dy) || 1;
            const min = Math.min(Math.abs(dx), Math.abs(dy));
            return { x: start.x + min * signX, y: start.y + min * signY };
        }
        return end;
    }
}
