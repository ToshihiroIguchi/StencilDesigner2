import paper from 'paper';
import { FeatureTree, LineFeature, RectFeature } from '../core/feature';
import { SnapEngine } from '../core/snap';
import { CanvasRenderer } from './canvas';
import { ModelGraph } from '../core/graph';
import { SelectionManager } from './selection';
import { TrimTool } from './trim_tool';
import { FilletTool } from './fillet_tool';
import { DimensionTool } from './dimension_tool';
import { HUDManager } from './hud';

export class InteractionController {
    public activeTool: 'Line' | 'Rect' | 'Select' | 'Trim' | 'Fillet' | 'Dim' = 'Select';
    private currentStart: {x: number, y: number} | null = null;
    private featureIdCounter = 0;
    private lastMouseModel: {x: number, y: number} = {x: 0, y: 0};
    private lastMouseScreen: paper.Point = new paper.Point(0, 0);

    private tool: paper.Tool;
    private hudManager: HUDManager;

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
        
        this.hudManager = new HUDManager((this.canvasRenderer as any).uiLayer);

        this.tool.onKeyDown = (event: paper.KeyEvent) => {
            // Priority 1: HUD Input
            if (this.hudManager.handleKey(event.key)) {
                this.applyNumericalConstraint();
                return;
            }

            // Priority 2: Zoom Shortcuts
            if (event.key === '+' || event.key === ';') {
                this.zoomAround(this.lastMouseScreen, 1.2);
            } else if (event.key === '-') {
                this.zoomAround(this.lastMouseScreen, 0.8333);
            } else if (event.key === '0') {
                this.resetZoom();
            }
        };

        // DOM Wheel Listener for precise zooming
        paper.view.element.addEventListener('wheel', (e: WheelEvent) => {
            e.preventDefault();
            const zoomSpeed = 0.05;
            const delta = -e.deltaY;
            const factor = Math.pow(1 + zoomSpeed, delta / 100);
            
            this.zoomAround(new paper.Point(e.offsetX, e.offsetY), factor);
        }, { passive: false });

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
            if (this.activeTool === 'Line' || this.activeTool === 'Rect') {
                this.hudManager.activateInput();
            }
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
            const snap = this.snapEngine.snap(event.point.x, event.point.y);
            
            if (this.activeTool === 'Trim') {
                this.trimTool.onMouseMove(event.point);
                return;
            }
            if (this.activeTool === 'Fillet') {
                this.filletTool.onMouseMove(event.point);
                return;
            }
            if (this.activeTool === 'Dim') {
                this.dimensionTool.onMouseMove(event.point, snap);
                return;
            }
            if (this.activeTool === 'Select') return;
            this.lastMouseModel = snap.modelPt;
            this.lastMouseScreen = event.point;
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
            this.hudManager.deactivateInput();
            this.hudManager.clear();
        };
    }

    private handleGhosting(screenPt: paper.Point, shiftPressed: boolean) {
        const snapRes = this.snapEngine.snap(screenPt.x, screenPt.y);
        let endModel = snapRes.modelPt;

        if (this.currentStart) {
            if (shiftPressed) {
                endModel = this.applyShiftConstraint(this.currentStart, endModel);
            }
            
            let ghost: paper.Path;
            if (this.activeTool === 'Line') {
                ghost = new paper.Path.Line(new paper.Point(this.currentStart.x, this.currentStart.y), new paper.Point(endModel.x, endModel.y));
            } else {
                ghost = new paper.Path.Rectangle(new paper.Point(this.currentStart.x, this.currentStart.y), new paper.Point(endModel.x, endModel.y));
            }
            ghost.strokeColor = new paper.Color('#00aa88');
            ghost.strokeWidth = 1;
            ghost.dashArray = [4, 4];
            ghost.strokeScaling = false;

            this.canvasRenderer.drawFeedback(ghost, snapRes.type, endModel);

            // Update HUD
            const dims: any = {};
            if (this.activeTool === 'Line') {
                dims.l = Math.hypot(endModel.x - this.currentStart.x, endModel.y - this.currentStart.y);
            } else if (this.activeTool === 'Rect') {
                dims.w = Math.abs(endModel.x - this.currentStart.x);
                dims.h = Math.abs(endModel.y - this.currentStart.y);
            }
            this.hudManager.draw(this.lastMouseScreen, dims);
        } else {
            this.canvasRenderer.drawFeedback(null, snapRes.type, snapRes.modelPt);
            this.hudManager.clear();
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

    private applyNumericalConstraint() {
        if (!this.currentStart) return;
        const val = this.hudManager.getInputValue();
        if (val === null) return;

        const dx = this.lastMouseModel.x - this.currentStart.x;
        const dy = this.lastMouseModel.y - this.currentStart.y;
        const dist = Math.hypot(dx, dy);
        
        // Final endpoint based on value
        let finalEnd = { x: this.lastMouseModel.x, y: this.lastMouseModel.y };
        if (this.activeTool === 'Line') {
            const dirX = dist > 1e-9 ? dx / dist : 1; // Default to right if no direction
            const dirY = dist > 1e-9 ? dy / dist : 0;
            finalEnd = {
                x: this.currentStart.x + dirX * val,
                y: this.currentStart.y + dirY * val
            };
        } else if (this.activeTool === 'Rect') {
            const sx = Math.sign(dx) || 1;
            const sy = Math.sign(dy) || 1;
            finalEnd = {
                x: this.currentStart.x + val * sx,
                y: this.currentStart.y + val * sy
            };
        }

        const fId = `f_${this.featureIdCounter++}`;
        if (this.activeTool === 'Line') {
            this.featureTree.addFeature(new LineFeature(fId, this.currentStart.x, this.currentStart.y, finalEnd.x, finalEnd.y));
        } else if (this.activeTool === 'Rect') {
            this.featureTree.addFeature(new RectFeature(fId, this.currentStart.x, this.currentStart.y, finalEnd.x, finalEnd.y));
        }

        const graph = this.featureTree.rebuild();
        this.canvasRenderer.updateGraph(graph);
        this.canvasRenderer.drawFeedback(null, 'none', {x:0, y:0});
        
        this.currentStart = null;
        this.hudManager.deactivateInput();
        this.hudManager.clear();
        
        // Auto-select the newly created feature to allow immediate property editing
        if (this.selectionManager) {
            this.selectionManager.select(fId);
        }
    }

    private zoomAround(mouseScreen: paper.Point, factor: number) {
        const viewState = this.canvasRenderer.viewState;
        const transformer = this.canvasRenderer.transformer;
        
        // Model point under mouse
        const mouseModel = transformer.screenToModel(mouseScreen.x, mouseScreen.y);
        
        // Update zoom
        viewState.zoom *= factor;
        if (viewState.zoom < 0.1) viewState.zoom = 0.1;
        if (viewState.zoom > 10000) viewState.zoom = 10000;
        
        // Re-calculate offset to keep model point at screen position
        const scaleM = new paper.Matrix().scale(viewState.zoom, -viewState.zoom);
        const scaledPt = scaleM.transform(new paper.Point(mouseModel.x, mouseModel.y));
        
        viewState.offsetX = mouseScreen.x - scaledPt.x;
        viewState.offsetY = mouseScreen.y - scaledPt.y;

        viewState.log();
        this.canvasRenderer.drawAll();
    }

    private resetZoom() {
        const rect = paper.view.element.getBoundingClientRect();
        this.canvasRenderer.viewState.offsetX = rect.width / 2;
        this.canvasRenderer.viewState.offsetY = rect.height / 2;
        this.canvasRenderer.viewState.zoom = 10;
        this.canvasRenderer.drawAll();
        this.canvasRenderer.viewState.log();
    }
}
