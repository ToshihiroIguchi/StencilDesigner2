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
import { ToleranceManager } from '../core/viewport';
import type { ModelUnits } from '../core/viewport';
import type { SnapResultScreen } from '../core/snap';
import { InteractionContext, InteractionState } from './interaction_context';
import type { InteractionPoint } from './interaction_context';

export class InteractionController {
    public activeTool: 'Line' | 'Rect' | 'Select' | 'Trim' | 'Fillet' | 'Dim' = 'Select';
    private currentStart: {x: ModelUnits, y: ModelUnits} | null = null;
    private featureIdCounter = 0;
    private lastMouseModel: {x: ModelUnits, y: ModelUnits} = {x: 0n, y: 0n};
    private lastMouseScreen: paper.Point = new paper.Point(0, 0);

    private tool: paper.Tool;
    private hudManager: HUDManager;
    private context: InteractionContext;

    constructor(
        private canvasRenderer: CanvasRenderer,
        public featureTree: FeatureTree,
        private snapEngine: SnapEngine,
        private selectionManager: SelectionManager,
        private trimTool: TrimTool,
        private filletTool: FilletTool,
        private dimensionTool: DimensionTool
    ) {
        this.context = new InteractionContext();
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
            console.debug(`[Interaction] onMouseDown: Tool=${this.activeTool}, Pt=${event.point}`);
            const rawMm = this.canvasRenderer.transformer.screenToModel(event.point.x, event.point.y);
            this.context.updateRaw(rawMm, this.canvasRenderer.viewState.zoom);
            const pt = this.context.getPoint((x,y) => this.snapEngine.snapScreen(x,y, 15));

            if (this.activeTool === 'Trim' || this.activeTool === 'Fillet') return;
            if (this.activeTool === 'Dim') {
                this.dimensionTool.onMouseDown({ 
                    modelPt: pt.visualMm, 
                    type: pt.snapType, 
                    vertexId: pt.vertexId 
                });
                return;
            }
            if (this.activeTool === 'Select') {
                (this as any)._selectStartScreen = { x: event.point.x, y: event.point.y }; 
                return;
            }

            this.currentStart = pt.logicalUnits;
            this.context.setState(InteractionState.DRAG);
            
            if (this.activeTool === 'Line' || this.activeTool === 'Rect') {
                this.hudManager.activateInput();
            }
        };

        this.tool.onMouseDrag = (event: paper.ToolEvent) => {
            if (this.activeTool === 'Trim' || this.activeTool === 'Fillet' || this.activeTool === 'Dim') return;
            
            const rawMm = this.canvasRenderer.transformer.screenToModel(event.point.x, event.point.y);
            this.context.updateRaw(rawMm, this.canvasRenderer.viewState.zoom);
            const pt = this.context.getPoint((x,y) => this.snapEngine.snapScreen(x,y, 15));

            if (this.activeTool === 'Select') {
                const start = (this as any)._selectStartScreen;
                if (!start) return;
                const rect = new paper.Path.Rectangle(
                    new paper.Point(start.x, start.y),
                    event.point
                );
                rect.strokeColor = new paper.Color('#00aaee');
                rect.fillColor = new paper.Color(0, 0.66, 0.93, 0.2); 
                rect.strokeWidth = 1;
                rect.dashArray = [4, 4];
                rect.strokeScaling = false;
                this.canvasRenderer.drawFeedback(rect, 'none', {x: 0n, y: 0n});
                return;
            }
            if (!this.currentStart) return;
            this.lastMouseModel = pt.logicalUnits;
            this.lastMouseScreen = event.point;
            this.handleGhosting(pt);
        };

        this.tool.onMouseMove = (event: paper.ToolEvent) => {
            const rawMm = this.canvasRenderer.transformer.screenToModel(event.point.x, event.point.y);
            this.context.updateRaw(rawMm, this.canvasRenderer.viewState.zoom);
            const pt = this.context.getPoint((x,y) => this.snapEngine.snapScreen(x,y, 15));

            if (this.activeTool === 'Trim') {
                this.trimTool.onMouseMove(event.point);
                return;
            }
            if (this.activeTool === 'Fillet') {
                this.filletTool.onMouseMove(event.point);
                return;
            }
            if (this.activeTool === 'Dim') {
                this.dimensionTool.onMouseMove(event.point, { 
                    modelPt: pt.rawMm, 
                    snappedPt: pt.visualMm,
                    type: pt.snapType, 
                    vertexId: pt.vertexId 
                });
                return;
            }
            if (this.activeTool === 'Select') return;
            
            this.lastMouseModel = pt.logicalUnits;
            this.lastMouseScreen = event.point;
            this.handleGhosting(pt); 
        };

        this.tool.onMouseUp = (event: paper.ToolEvent) => {
            const rawMm = this.canvasRenderer.transformer.screenToModel(event.point.x, event.point.y);
            this.context.updateRaw(rawMm, this.canvasRenderer.viewState.zoom);
            const pt = this.context.getPoint((x,y) => this.snapEngine.snapScreen(x,y, 15));

            if (this.activeTool === 'Trim') {
                this.trimTool.onMouseUp(event.point);
                return;
            }
            if (this.activeTool === 'Fillet') {
                this.filletTool.onMouseUp(event.point);
                return;
            }
            if (this.activeTool === 'Dim') {
                this.dimensionTool.onMouseUp({ 
                    modelPt: pt.visualMm, 
                    type: pt.snapType, 
                    vertexId: pt.vertexId 
                });
                return;
            }
            
            if (this.activeTool === 'Select') {
                const startScreen = (this as any)._selectStartScreen;
                if (!startScreen) return;
                const endScreen = event.point;
                const dist = Math.hypot(endScreen.x - startScreen.x, endScreen.y - startScreen.y);
                
                const graph = (this.canvasRenderer as any).currentGraph as ModelGraph;

                if (dist < 2) { // Single click
                    const threshold = 15 / this.canvasRenderer.viewState.zoom;
                    const modelPt = this.canvasRenderer.transformer.screenToModel(endScreen.x, endScreen.y);
                    
                    // Hit test for segment selection
                    let bestDist = Infinity;
                    let hitFid: string | null = null;
                    for (const edge of graph.edges.values()) {
                        const v1 = graph.vertices.get(edge.u);
                        const v2 = graph.vertices.get(edge.v);
                        if (!v1 || !v2 || v1.x === undefined || v2.x === undefined) continue;
                        const dMm = this.distToSegmentMm(modelPt, 
                            { x: ToleranceManager.unitsToMm(v1.x), y: ToleranceManager.unitsToMm(v1.y) },
                            { x: ToleranceManager.unitsToMm(v2.x), y: ToleranceManager.unitsToMm(v2.y) }
                        );
                        if (dMm < threshold && dMm < bestDist) {
                            bestDist = dMm;
                            hitFid = edge.id.split('_')[0]; 
                        }
                    }
                    
                    if (hitFid) {
                        this.selectionManager.select(hitFid, event.modifiers.shift);
                    } else if (!event.modifiers.shift) {
                        this.selectionManager.clear();
                    }
                } else { // Box Select
                    const pUnits1 = this.canvasRenderer.transformer.screenToModelUnits(startScreen.x, startScreen.y);
                    const pUnits2 = this.canvasRenderer.transformer.screenToModelUnits(endScreen.x, endScreen.y);
                    const minX = pUnits1.x < pUnits2.x ? pUnits1.x : pUnits2.x;
                    const maxX = pUnits1.x > pUnits2.x ? pUnits1.x : pUnits2.x;
                    const minY = pUnits1.y < pUnits2.y ? pUnits1.y : pUnits2.y;
                    const maxY = pUnits1.y > pUnits2.y ? pUnits1.y : pUnits2.y;
                    
                    if (!event.modifiers.shift) this.selectionManager.clear();
                    for (const v of graph.vertices.values()) {
                        if (v.x !== undefined && v.y !== undefined) {
                            if (v.x >= minX && v.x <= maxX && v.y >= minY && v.y <= maxY) {
                                // Find feature ID from vertex name (e.g. f_0_v0 -> f_0)
                                const fId = v.id.split('_v')[0];
                                this.selectionManager.select(fId, true);
                            }
                        }
                    }
                }
                
                this.canvasRenderer.geometryLayerDirty = true; 
                this.canvasRenderer.drawFeedback(null, 'none', {x: 0n, y: 0n});
                (this as any)._selectStartScreen = null;
                return;
            }
            
            if (!this.currentStart) return;

            // Drawing logic - Unified Atomic Path
            let endPtUnits = pt.logicalUnits;
            
            if (event.modifiers.shift) endPtUnits = this.applyShiftConstraint(this.currentStart, endPtUnits);
            
            const fId = `f_${this.featureIdCounter++}`;
            if (this.activeTool === 'Line') {
                this.featureTree.addFeature(new LineFeature(fId, this.currentStart.x, this.currentStart.y, endPtUnits.x, endPtUnits.y));
            } else if (this.activeTool === 'Rect') {
                this.featureTree.addFeature(new RectFeature(fId, this.currentStart.x, this.currentStart.y, endPtUnits.x, endPtUnits.y));
            }

            const graph = this.featureTree.rebuild();
            this.canvasRenderer.updateGraph(graph);
            this.canvasRenderer.drawFeedback(null, 'none', {x: 0n, y: 0n});
            
            this.currentStart = null;
            this.hudManager.deactivateInput();
            this.hudManager.clear();
        };
    }

    private distToSegmentMm(p: {x:number, y:number}, v: {x:number, y:number}, w: {x:number, y:number}) {
        const l2 = Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2);
        if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
        let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
    }

    private handleGhosting(pt: InteractionPoint) {
        if (this.currentStart) {
            let endUnits = pt.logicalUnits;
            // Shift constraint on discrete units
            if (this.tool.event && (this.tool.event as any).modifiers.shift) {
                endUnits = this.applyShiftConstraint(this.currentStart, endUnits);
            }
            
            const startMm = { 
                x: ToleranceManager.unitsToMm(this.currentStart.x), 
                y: ToleranceManager.unitsToMm(this.currentStart.y) 
            };
            const endMm = {
                x: ToleranceManager.unitsToMm(endUnits.x),
                y: ToleranceManager.unitsToMm(endUnits.y)
            };

            let ghost: paper.Path;
            if (this.activeTool === 'Line') {
                ghost = new paper.Path.Line(new paper.Point(startMm.x, startMm.y), new paper.Point(endMm.x, endMm.y));
            } else {
                ghost = new paper.Path.Rectangle(new paper.Point(startMm.x, startMm.y), new paper.Point(endMm.x, endMm.y));
            }
            ghost.strokeColor = new paper.Color('#00aa88');
            ghost.strokeWidth = 1;
            ghost.dashArray = [4, 4];
            ghost.strokeScaling = false;

            // Feedback marker on normalized units
            this.canvasRenderer.drawFeedback(ghost, pt.snapType, endUnits);

            // Update HUD with atomic dimensions
            const dims: any = {};
            if (this.activeTool === 'Line') {
                dims.l = Math.hypot(endMm.x - startMm.x, endMm.y - startMm.y);
            } else if (this.activeTool === 'Rect') {
                dims.w = Math.abs(endMm.x - startMm.x);
                dims.h = Math.abs(endMm.y - startMm.y);
            }
            this.hudManager.draw(this.lastMouseScreen, dims);
        } else {
            this.canvasRenderer.drawFeedback(null, pt.snapType, pt.logicalUnits);
            this.hudManager.clear();
        }
    }

    private applyShiftConstraint(start: {x:ModelUnits, y:ModelUnits}, end: {x:ModelUnits, y:ModelUnits}): {x:ModelUnits, y:ModelUnits} {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        
        const absX = dx < 0n ? -dx : dx;
        const absY = dy < 0n ? -dy : dy;

        if (this.activeTool === 'Line') {
            if (absX > absY) {
                return { x: end.x, y: start.y };
            } else {
                return { x: start.x, y: end.y };
            }
        } else if (this.activeTool === 'Rect') {
            const signX = dx < 0n ? -1n : 1n;
            const signY = dy < 0n ? -1n : 1n;
            const minAbs = absX < absY ? absX : absY;
            return { x: start.x + minAbs * signX, y: start.y + minAbs * signY };
        }
        return end;
    }

    private applyNumericalConstraint() {
        if (!this.currentStart) return;
        const valMm = this.hudManager.getInputValue();
        if (valMm === null) return;
        const valUnits = ToleranceManager.mmToUnits(valMm);

        const dx = this.lastMouseModel.x - this.currentStart.x;
        const dy = this.lastMouseModel.y - this.currentStart.y;
        
        // Final endpoint based on value
        let finalEndUnits = { x: this.lastMouseModel.x, y: this.lastMouseModel.y };
        if (this.activeTool === 'Line') {
            const distSq = dx * dx + dy * dy;
            const dist = Math.sqrt(Number(distSq));
            const dirX = dist > 1e-6 ? Number(dx) / dist : 1; 
            const dirY = dist > 1e-6 ? Number(dy) / dist : 0;
            
            finalEndUnits = {
                x: this.currentStart.x + BigInt(Math.round(dirX * Number(valUnits))),
                y: this.currentStart.y + BigInt(Math.round(dirY * Number(valUnits)))
            };
        } else if (this.activeTool === 'Rect') {
            const sx = dx < 0n ? -1n : 1n;
            const sy = dy < 0n ? -1n : 1n;
            finalEndUnits = {
                x: this.currentStart.x + valUnits * sx,
                y: this.currentStart.y + valUnits * sy
            };
        }

        const fId = `f_${this.featureIdCounter++}`;
        if (this.activeTool === 'Line') {
            this.featureTree.addFeature(new LineFeature(fId, this.currentStart.x, this.currentStart.y, finalEndUnits.x, finalEndUnits.y));
        } else if (this.activeTool === 'Rect') {
            this.featureTree.addFeature(new RectFeature(fId, this.currentStart.x, this.currentStart.y, finalEndUnits.x, finalEndUnits.y));
        }

        const graph = this.featureTree.rebuild();
        this.canvasRenderer.updateGraph(graph);
        this.canvasRenderer.drawFeedback(null, 'none', {x: 0n, y: 0n});
        
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
    }

    private resetZoom() {
        // Zoom to Fit logic
        const graph = this.featureTree.rebuild();
        const rect = paper.view.element.getBoundingClientRect();
        const viewW = rect.width;
        const viewH = rect.height;

        if (graph.vertices.size === 0) {
            // Default reset if empty
            this.canvasRenderer.viewState.offsetX = viewW / 2;
            this.canvasRenderer.viewState.offsetY = viewH / 2;
            this.canvasRenderer.viewState.zoom = 10;
        } else {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const v of graph.vertices.values()) {
                if (v.x == null || v.y == null) continue;
                minX = Math.min(minX, v.x);
                minY = Math.min(minY, v.y);
                maxX = Math.max(maxX, v.x);
                maxY = Math.max(maxY, v.y);
            }
            
            const modelW = maxX - minX || 1;
            const modelH = maxY - minY || 1;
            
            const padding = 120; // Margin around the content
            const fitW = viewW - padding;
            const fitH = viewH - padding;
            
            const zoom = Math.min(fitW / modelW, fitH / modelH);
            this.canvasRenderer.viewState.zoom = Math.min(zoom, 1000); // Caps initial zoom to 1000x
            
            const centerX_model = (minX + maxX) / 2;
            const centerY_model = (minY + maxY) / 2;
            
            // Re-calculate offset using the same Matrix-based logic as zoomAround
            // mouseScreen (center) = Offset + (ModelCenter scaled)
            // Offset = screenCenter - (modelCenter * zoomMatrix)
            const scaleM = new paper.Matrix().scale(this.canvasRenderer.viewState.zoom, -this.canvasRenderer.viewState.zoom);
            const scaledCenter = scaleM.transform(new paper.Point(centerX_model, centerY_model));
            
            this.canvasRenderer.viewState.offsetX = viewW / 2 - scaledCenter.x;
            this.canvasRenderer.viewState.offsetY = viewH / 2 - scaledCenter.y;
        }
        
        this.canvasRenderer.viewState.log();
    }
}
