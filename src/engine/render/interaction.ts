import paper from 'paper';
import { FeatureTree, LineFeature, RectFeature } from '../core/feature';
import { resolveSnapToVertex } from '../core/snap';
import { CanvasRenderer } from './canvas';
import { SelectionManager } from './selection';
import { TrimTool } from './trim_tool';
import { FilletTool } from './fillet_tool';
import { DimensionTool } from './dimension_tool';
import { HUDManager } from './hud';
import { screenToWorld, worldToScreen } from '../core/viewport';

export class InteractionController {
    public activeTool: 'Line' | 'Rect' | 'Select' | 'Trim' | 'Fillet' | 'Dim' = 'Select';
    private currentStartWorld: {x: bigint, y: bigint} | null = null;
    private featureIdCounter = 0;
    private lastMouseWorld: {x: bigint, y: bigint} = {x: 0n, y: 0n};
    private lastMouseScreen: paper.Point = new paper.Point(0, 0);

    private tool: paper.Tool;
    private hudManager: HUDManager;

    constructor(
        private canvasRenderer: CanvasRenderer,
        public featureTree: FeatureTree,
        private selectionManager: SelectionManager,
        private trimTool: TrimTool,
        private filletTool: FilletTool,
        private dimensionTool: DimensionTool
    ) {
        this.tool = new paper.Tool();
        this.tool.activate();
        this.hudManager = new HUDManager((this.canvasRenderer as any).uiLayer);

        this.tool.onKeyDown = (event: paper.KeyEvent) => {
            if (this.hudManager.handleKey(event.key)) { this.applyNumericalConstraint(); return; }
            if (event.key === '+' || event.key === ';') this.zoomAround(this.lastMouseScreen, 1.2);
            else if (event.key === '-') this.zoomAround(this.lastMouseScreen, 0.8333);
            else if (event.key === '0') this.resetZoom();
        };

        paper.view.element.addEventListener('wheel', (e: WheelEvent) => {
            e.preventDefault();
            const factor = Math.pow(1.05, -e.deltaY / 100);
            this.zoomAround(new paper.Point(e.offsetX, e.offsetY), factor);
        }, { passive: false });

        this.tool.onMouseDown = (event: paper.ToolEvent) => {
            if (this.activeTool === 'Trim' || this.activeTool === 'Fillet') return;
            const wPt = screenToWorld(event.point.x, event.point.y, this.canvasRenderer.viewTransform);
            const tol = BigInt(Math.round(15 / this.canvasRenderer.viewTransform.scale));
            const snapRes = resolveSnapToVertex(this.getGraph(), wPt.x, wPt.y, tol, 5000n);
            
            if (this.activeTool === 'Dim') { this.dimensionTool.onMouseDown(snapRes as any); return; }
            if (this.activeTool === 'Select') { this.currentStartWorld = { x: wPt.x, y: wPt.y }; return; }
            
            this.currentStartWorld = { x: snapRes.worldX, y: snapRes.worldY };
            if (this.activeTool === 'Line' || this.activeTool === 'Rect') this.hudManager.activateInput();
        };

        this.tool.onMouseDrag = (event: paper.ToolEvent) => {
            if (this.activeTool === 'Trim' || this.activeTool === 'Fillet' || this.activeTool === 'Dim') return;
            if (!this.currentStartWorld) return;
            if (this.activeTool === 'Select') {
                const sPt1 = worldToScreen(this.currentStartWorld.x, this.currentStartWorld.y, this.canvasRenderer.viewTransform);
                const rect = new paper.Path.Rectangle(new paper.Point(sPt1.sx, sPt1.sy), event.point);
                rect.strokeColor = new paper.Color('#00aaee'); rect.fillColor = new paper.Color(0, 0.66, 0.93, 0.2); 
                rect.strokeWidth = 1; rect.dashArray = [4, 4];
                this.canvasRenderer.drawFeedback(rect, 'none', {x: 0n, y: 0n});
                return;
            }
            this.handleGhosting(event.point, event.modifiers.shift);
        };

        this.tool.onMouseMove = (event: paper.ToolEvent) => {
            const wPt = screenToWorld(event.point.x, event.point.y, this.canvasRenderer.viewTransform);
            const tol = BigInt(Math.round(15 / this.canvasRenderer.viewTransform.scale));
            const snapRes = resolveSnapToVertex(this.getGraph(), wPt.x, wPt.y, tol, 5000n);
            if (this.activeTool === 'Trim') { this.trimTool.onMouseMove(event.point); return; }
            if (this.activeTool === 'Fillet') { this.filletTool.onMouseMove(event.point); return; }
            if (this.activeTool === 'Dim') { this.dimensionTool.onMouseMove(event.point, snapRes as any); return; }
            if (this.activeTool === 'Select') return;
            this.lastMouseWorld = { x: snapRes.worldX, y: snapRes.worldY };
            this.lastMouseScreen = event.point;
            this.handleGhosting(event.point, event.modifiers.shift); 
        };

        this.tool.onMouseUp = (event: paper.ToolEvent) => {
            if (this.activeTool === 'Trim') { this.trimTool.onMouseUp(event.point); return; }
            if (this.activeTool === 'Fillet') { this.filletTool.onMouseUp(event.point); return; }
            if (this.activeTool === 'Dim') {
                const wPt = screenToWorld(event.point.x, event.point.y, this.canvasRenderer.viewTransform);
                const snap = resolveSnapToVertex(this.getGraph(), wPt.x, wPt.y, BigInt(Math.round(15 / this.canvasRenderer.viewTransform.scale)), 5000n);
                this.dimensionTool.onMouseUp(snap as any); return;
            }
            if (!this.currentStartWorld) return;
            if (this.activeTool === 'Select') {
                const sPt = worldToScreen(this.currentStartWorld.x, this.currentStartWorld.y, this.canvasRenderer.viewTransform);
                const dist = Math.hypot(event.point.x - sPt.sx, event.point.y - sPt.sy);
                if (dist < 2) { 
                    const clickW = screenToWorld(event.point.x, event.point.y, this.canvasRenderer.viewTransform);
                    const hitId = this.selectionManager.hitTestSegment({x: Number(clickW.x)/1000, y: Number(clickW.y)/1000}, this.getGraph(), 10 / this.canvasRenderer.viewTransform.scale);
                    if (hitId) this.selectionManager.select(hitId, event.modifiers.shift);
                    else if (!event.modifiers.shift) this.selectionManager.clear();
                } else { 
                    const wp2 = screenToWorld(event.point.x, event.point.y, this.canvasRenderer.viewTransform);
                    const min = { x: Math.min(Number(this.currentStartWorld.x)/1000, Number(wp2.x)/1000), y: Math.min(Number(this.currentStartWorld.y)/1000, Number(wp2.y)/1000) };
                    const max = { x: Math.max(Number(this.currentStartWorld.x)/1000, Number(wp2.x)/1000), y: Math.max(Number(this.currentStartWorld.y)/1000, Number(wp2.y)/1000) };
                    const found = this.selectionManager.boxSelect(min, max, this.getGraph());
                    if (!event.modifiers.shift) this.selectionManager.clear();
                    found.forEach(id => this.selectionManager.select(id, true));
                }
                this.canvasRenderer.drawAll(); this.canvasRenderer.drawFeedback(null, 'none', {x: 0n, y: 0n});
                this.currentStartWorld = null; return;
            }
            const wPt = screenToWorld(event.point.x, event.point.y, this.canvasRenderer.viewTransform);
            const rawSnap = resolveSnapToVertex(this.getGraph(), wPt.x, wPt.y, BigInt(Math.round(15 / this.canvasRenderer.viewTransform.scale)), 5000n);
            let endPt = { x: rawSnap.worldX, y: rawSnap.worldY };
            if (event.modifiers.shift) endPt = this.applyShiftConstraint(this.currentStartWorld, endPt);
            const fId = `f_${this.featureIdCounter++}`;
            const sX = Number(this.currentStartWorld.x)/1000, sY = Number(this.currentStartWorld.y)/1000, eX = Number(endPt.x)/1000, eY = Number(endPt.y)/1000;
            if (this.activeTool === 'Line') this.featureTree.addFeature(new LineFeature(fId, sX, sY, eX, eY));
            else if (this.activeTool === 'Rect') this.featureTree.addFeature(new RectFeature(fId, sX, sY, eX, eY));
            this.canvasRenderer.updateGraph(this.featureTree.rebuild());
            this.canvasRenderer.drawFeedback(null, 'none', {x: 0n, y: 0n});
            this.currentStartWorld = null; this.hudManager.deactivateInput(); this.hudManager.clear();
        };
    }

    private getGraph() { return this.canvasRenderer.currentGraph || (this.canvasRenderer as any)._dummyGraph || new (require('../core/graph').ModelGraph)(); }

    private handleGhosting(screenPt: paper.Point, shiftPressed: boolean) {
        const wPt = screenToWorld(screenPt.x, screenPt.y, this.canvasRenderer.viewTransform);
        const snapRes = resolveSnapToVertex(this.getGraph(), wPt.x, wPt.y, BigInt(Math.round(15 / this.canvasRenderer.viewTransform.scale)), 5000n);
        let endModel = { x: snapRes.worldX, y: snapRes.worldY };
        if (this.currentStartWorld) {
            if (shiftPressed) endModel = this.applyShiftConstraint(this.currentStartWorld, endModel);
            const sPt1 = worldToScreen(this.currentStartWorld.x, this.currentStartWorld.y, this.canvasRenderer.viewTransform);
            const sPt2 = worldToScreen(endModel.x, endModel.y, this.canvasRenderer.viewTransform);
            let ghost: paper.Path;
            if (this.activeTool === 'Line') ghost = new paper.Path.Line(new paper.Point(sPt1.sx, sPt1.sy), new paper.Point(sPt2.sx, sPt2.sy));
            else ghost = new paper.Path.Rectangle(new paper.Point(sPt1.sx, sPt1.sy), new paper.Point(sPt2.sx, sPt2.sy));
            ghost.strokeColor = new paper.Color('#00aa88'); ghost.strokeWidth = 1.5; ghost.dashArray = [4, 4];
            this.canvasRenderer.drawFeedback(ghost, snapRes.type, endModel);
            const dims: any = {};
            const dx = Number(endModel.x - this.currentStartWorld.x)/1000, dy = Number(endModel.y - this.currentStartWorld.y)/1000;
            if (this.activeTool === 'Line') dims.l = Math.hypot(dx, dy);
            else { dims.w = Math.abs(dx); dims.h = Math.abs(dy); }
            this.hudManager.draw(this.lastMouseScreen, dims);
        } else {
            this.canvasRenderer.drawFeedback(null, snapRes.type, { x: snapRes.worldX, y: snapRes.worldY });
            this.hudManager.clear();
        }
    }

    private applyShiftConstraint(start: {x:bigint, y:bigint}, end: {x:bigint, y:bigint}): {x:bigint, y:bigint} {
        const dx = end.x - start.x; const dy = end.y - start.y;
        const absX = dx < 0n ? -dx : dx; const absY = dy < 0n ? -dy : dy;
        if (this.activeTool === 'Line') return absX > absY ? { x: end.x, y: start.y } : { x: start.x, y: end.y };
        const min = absX < absY ? absX : absY;
        return { x: start.x + min * (dx < 0n ? -1n : 1n), y: start.y + min * (dy < 0n ? -1n : 1n) };
    }

    private applyNumericalConstraint() {
        if (!this.currentStartWorld) return;
        const valMm = this.hudManager.getInputValue(); if (valMm === null) return;
        const valUm = BigInt(Math.round(valMm * 1000));
        const dx = Number(this.lastMouseWorld.x - this.currentStartWorld.x), dy = Number(this.lastMouseWorld.y - this.currentStartWorld.y);
        let fEX = this.lastMouseWorld.x, fEY = this.lastMouseWorld.y;
        if (this.activeTool === 'Line') {
            const dist = Math.hypot(dx, dy);
            const dX = dist > 1e-9 ? dx / dist : 1, dY = dist > 1e-9 ? dy / dist : 0;
            fEX = this.currentStartWorld.x + BigInt(Math.round(dX * Number(valUm)));
            fEY = this.currentStartWorld.y + BigInt(Math.round(dY * Number(valUm)));
        } else {
            fEX = this.currentStartWorld.x + valUm * (dx < 0 ? -1n : 1n);
            fEY = this.currentStartWorld.y + valUm * (dy < 0 ? -1n : 1n);
        }
        const fId = `f_${this.featureIdCounter++}`;
        const sX = Number(this.currentStartWorld.x)/1000, sY = Number(this.currentStartWorld.y)/1000, eX = Number(fEX)/1000, eY = Number(fEY)/1000;
        if (this.activeTool === 'Line') this.featureTree.addFeature(new LineFeature(fId, sX, sY, eX, eY));
        else this.featureTree.addFeature(new RectFeature(fId, sX, sY, eX, eY));
        this.canvasRenderer.updateGraph(this.featureTree.rebuild());
        this.canvasRenderer.drawFeedback(null, 'none', {x: 0n, y: 0n});
        this.currentStartWorld = null; this.hudManager.deactivateInput(); this.hudManager.clear();
        if (this.selectionManager) this.selectionManager.select(fId);
    }

    private zoomAround(mS: paper.Point, factor: number) {
        const v = this.canvasRenderer.viewTransform;
        const mW = screenToWorld(mS.x, mS.y, v);
        v.scale *= factor;
        if (v.scale < 0.0001) v.scale = 0.0001; if (v.scale > 20.0) v.scale = 20.0;
        v.offsetX = mS.x - Number(mW.x) * v.scale;
        v.offsetY = mS.y + Number(mW.y) * v.scale;
        this.canvasRenderer.drawAll();
    }

    private resetZoom() {
        const v = this.canvasRenderer.viewTransform;
        const graph = this.getGraph();
        if (graph.vertices.size === 0) { v.offsetX = paper.view.element.width / 2; v.offsetY = paper.view.element.height / 2; v.scale = 0.1; }
        else {
            let miX = Infinity, miY = Infinity, maX = -Infinity, maY = -Infinity;
            for (const vt of graph.vertices.values()) { if (vt.isDeleted) continue; miX = Math.min(miX, Number(vt.x)); miY = Math.min(miY, Number(vt.y)); maX = Math.max(maX, Number(vt.x)); maY = Math.max(maY, Number(vt.y)); }
            const mW = Math.abs(maX - miX) || 10000, mH = Math.abs(maY - miY) || 10000;
            v.scale = Math.min((paper.view.element.width - 120) / mW, (paper.view.element.height - 120) / mH);
            if (v.scale > 0.5) v.scale = 0.5;
            v.offsetX = paper.view.element.width / 2 - (miX + maX) / 2 * v.scale;
            v.offsetY = paper.view.element.height / 2 + (miY + maY) / 2 * v.scale;
        }
        this.canvasRenderer.drawAll();
    }
}
