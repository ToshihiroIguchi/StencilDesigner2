import paper from 'paper';
import { type ViewTransform, worldToScreen, screenToWorld, getGridIntervalUmForLOD } from '../core/viewport';
import { getTheme } from '../core/theme';
import { ModelGraph } from '../core/graph';
import { SelectionManager } from './selection';
import { RulerManager } from './ruler';

export class CanvasRenderer {
    public viewTransform: ViewTransform;
    public selectionManager?: SelectionManager;
    public canvasElement: HTMLCanvasElement;
    public currentGraph: ModelGraph | null = null;
    
    private snapLayer: paper.Layer;
    private geometryLayer: paper.Layer;
    private backgroundLayer: paper.Layer;
    private uiLayer: paper.Layer;
    private rulerManager: RulerManager;

    constructor(canvasId: string) {
        this.canvasElement = document.getElementById(canvasId) as HTMLCanvasElement;
        if (!this.canvasElement) {
            throw new Error(`Canvas with id ${canvasId} not found`);
        }

        paper.setup(this.canvasElement);
        paper.settings.applyMatrix = true;
        
        const rect = this.canvasElement.getBoundingClientRect();
        const centerX = rect.width / 2 || window.innerWidth / 2;
        const centerY = rect.height / 2 || window.innerHeight / 2;
        
        this.viewTransform = { offsetX: centerX, offsetY: centerY, scale: 0.1 };

        this.backgroundLayer = new paper.Layer();
        this.geometryLayer = new paper.Layer();
        this.uiLayer = new paper.Layer();
        this.snapLayer = new paper.Layer();

        this.rulerManager = new RulerManager(this.viewTransform, this.uiLayer);

        paper.view.onResize = () => {
            this.drawAll();
        };

        setTimeout(() => {
            this.drawAll();
        });
    }

    public updateGraph(graph: ModelGraph) {
        this.currentGraph = graph;
        this.drawGeometry();
    }

    public drawAll(): void {
        this.drawBackground();
        this.drawGeometry();
        this.rulerManager.draw();
        paper.view.update();
    }

    public drawBackground(): void {
        this.backgroundLayer.activate();
        this.backgroundLayer.removeChildren();

        const theme = getTheme();
        const bgRect = new paper.Path.Rectangle(paper.view.bounds);
        bgRect.fillColor = new paper.Color(theme.background);

        const bounds = paper.view.bounds;
        const pTL = screenToWorld(bounds.left, bounds.top, this.viewTransform);
        const pBR = screenToWorld(bounds.right, bounds.bottom, this.viewTransform);

        const minW_x = pTL.x < pBR.x ? pTL.x : pBR.x;
        const maxW_x = pTL.x > pBR.x ? pTL.x : pBR.x;
        const minW_y = pTL.y < pBR.y ? pTL.y : pBR.y;
        const maxW_y = pTL.y > pBR.y ? pTL.y : pBR.y;

        const gridUm = getGridIntervalUmForLOD(this.viewTransform.scale);
        
        const startX = (minW_x / gridUm) * gridUm - gridUm;
        const endX = (maxW_x / gridUm) * gridUm + gridUm;
        const startY = (minW_y / gridUm) * gridUm - gridUm;
        const endY = (maxW_y / gridUm) * gridUm + gridUm;

        for (let x = startX; x <= endX; x += gridUm) {
            const isMajor = (x % (gridUm * 5n) === 0n);
            const pt1 = worldToScreen(x, startY, this.viewTransform);
            const pt2 = worldToScreen(x, endY, this.viewTransform);
            const line = new paper.Path.Line(new paper.Point(pt1.sx, pt1.sy), new paper.Point(pt2.sx, pt2.sy));
            line.strokeColor = new paper.Color(isMajor ? theme.gridMajor : theme.gridMinor);
            line.strokeWidth = 1;
        }

        for (let y = startY; y <= endY; y += gridUm) {
            const isMajor = (y % (gridUm * 5n) === 0n);
            const pt1 = worldToScreen(startX, y, this.viewTransform);
            const pt2 = worldToScreen(endX, y, this.viewTransform);
            const line = new paper.Path.Line(new paper.Point(pt1.sx, pt1.sy), new paper.Point(pt2.sx, pt2.sy));
            line.strokeColor = new paper.Color(isMajor ? theme.gridMajor : theme.gridMinor);
            line.strokeWidth = 1;
        }

        const xAxisStart = worldToScreen(startX, 0n, this.viewTransform);
        const xAxisEnd = worldToScreen(endX, 0n, this.viewTransform);
        const yAxisStart = worldToScreen(0n, startY, this.viewTransform);
        const yAxisEnd = worldToScreen(0n, endY, this.viewTransform);

        const xAxis = new paper.Path.Line(new paper.Point(xAxisStart.sx, xAxisStart.sy), new paper.Point(xAxisEnd.sx, xAxisEnd.sy));
        xAxis.strokeColor = new paper.Color(theme.axis);
        xAxis.strokeWidth = 1.5;

        const yAxis = new paper.Path.Line(new paper.Point(yAxisStart.sx, yAxisStart.sy), new paper.Point(yAxisEnd.sx, yAxisEnd.sy));
        yAxis.strokeColor = new paper.Color(theme.axis);
        yAxis.strokeWidth = 1.5;
    }

    private drawGeometry(): void {
        this.geometryLayer.activate();
        this.geometryLayer.removeChildren();
        if (!this.currentGraph) return;

        const theme = getTheme();

        for (const edge of this.currentGraph.edges.values()) {
            const v1 = this.currentGraph.vertices.get(edge.v1);
            const v2 = this.currentGraph.vertices.get(edge.v2);
            if (!v1 || !v2 || v1.isDeleted || v2.isDeleted) continue;
            
            const p1 = worldToScreen(v1.x, v1.y, this.viewTransform);
            const p2 = worldToScreen(v2.x, v2.y, this.viewTransform);
            const path = new paper.Path.Line(new paper.Point(p1.sx, p1.sy), new paper.Point(p2.sx, p2.sy));
            
            let selected = false;
            if (this.selectionManager) {
                const fId = this.selectionManager.extractFeatureIdFromElementId(edge.id);
                if (fId && this.selectionManager.isSelected(fId)) selected = true;
            }

            if (selected) {
                path.strokeColor = new paper.Color(theme.highlight);
                path.strokeWidth = 3;
                const h1 = new paper.Path.Circle(new paper.Point(p1.sx, p1.sy), 4);
                h1.fillColor = new paper.Color(theme.background);
                h1.strokeColor = new paper.Color(theme.highlight);
                h1.strokeWidth = 1.5;
                const h2 = new paper.Path.Circle(new paper.Point(p2.sx, p2.sy), 4);
                h2.fillColor = new paper.Color(theme.background);
                h2.strokeColor = new paper.Color(theme.highlight);
                h2.strokeWidth = 1.5;
            } else {
                path.strokeColor = new paper.Color(theme.edge);
                path.strokeWidth = 1.5;
            }
        }
        
        this.drawDimensions();
        (paper.view as any).draw();
    }

    private drawDimensions(): void {
        const interaction = (window as any).interaction;
        if (!interaction || !interaction.featureTree || !this.currentGraph) return;
        
        const features = interaction.featureTree.features;
        const graph = this.currentGraph;

        for (const f of features) {
            if (f.type === 'Dim') {
                const dim = f as any;
                
                let liveX1 = BigInt(Math.round(dim.x1 * 1000));
                let liveY1 = BigInt(Math.round(dim.y1 * 1000));
                let liveX2 = BigInt(Math.round(dim.x2 * 1000));
                let liveY2 = BigInt(Math.round(dim.y2 * 1000));
                let detached = false;

                if (dim.v1Id) {
                    const v1 = graph.vertices.get(dim.v1Id);
                    if (v1 && !v1.isDeleted) {
                        liveX1 = v1.x; liveY1 = v1.y;
                    } else detached = true;
                }
                if (dim.v2Id) {
                    const v2 = graph.vertices.get(dim.v2Id);
                    if (v2 && !v2.isDeleted) {
                        liveX2 = v2.x; liveY2 = v2.y;
                    } else detached = true;
                }
                if (liveX1 == null || liveY1 == null || liveX2 == null || liveY2 == null) continue;

                const pt1 = worldToScreen(liveX1, liveY1, this.viewTransform);
                const pt2 = worldToScreen(liveX2, liveY2, this.viewTransform);
                const group = new paper.Group();
                const color = detached ? new paper.Color('#bbbbbb') : new paper.Color('#777777');
                
                const line = new paper.Path.Line(new paper.Point(pt1.sx, pt1.sy), new paper.Point(pt2.sx, pt2.sy));
                line.strokeColor = color; line.strokeWidth = 1;
                if (detached) line.dashArray = [4, 4];
                group.addChild(line);

                const screenAngle = Math.atan2(pt2.sy - pt1.sy, pt2.sx - pt1.sx);
                const tickLenPx = 6;
                const sinA = Math.sin(screenAngle); const cosA = Math.cos(screenAngle);
                const tick1 = new paper.Path.Line(
                    new paper.Point(pt1.sx - sinA * tickLenPx, pt1.sy + cosA * tickLenPx),
                    new paper.Point(pt1.sx + sinA * tickLenPx, pt1.sy - cosA * tickLenPx)
                );
                tick1.strokeColor = color; tick1.strokeWidth = 1; group.addChild(tick1);
                const tick2 = new paper.Path.Line(
                    new paper.Point(pt2.sx - sinA * tickLenPx, pt2.sy + cosA * tickLenPx),
                    new paper.Point(pt2.sx + sinA * tickLenPx, pt2.sy - cosA * tickLenPx)
                );
                tick2.strokeColor = color; tick2.strokeWidth = 1; group.addChild(tick2);

                let labelText = dim.label;
                if (!detached && (dim.v1Id || dim.v2Id)) {
                    const dx = Number(liveX2 - liveX1); const dy = Number(liveY2 - liveY1);
                    const distMm = Math.hypot(dx, dy) / 1000;
                    labelText = `${distMm.toFixed(2)} mm`;
                }
                const text = new paper.PointText(new paper.Point((pt1.sx + pt2.sx) / 2, (pt1.sy + pt2.sy) / 2));
                text.content = labelText; text.fillColor = color; text.fontSize = 12; 
                text.justification = 'center';
                if (detached) text.content += " (detached)";
                group.addChild(text);
                this.geometryLayer.addChild(group);
            }
        }
    }

    public drawFeedback(ghostPath: paper.Item | null, snapType: string, snapWorldPt: {x: bigint, y: bigint}): void {
        this.snapLayer.activate();
        this.snapLayer.removeChildren();
        const theme = getTheme();
        if (ghostPath) this.snapLayer.addChild(ghostPath);

        if (snapType !== 'none') {
            const sPt = worldToScreen(snapWorldPt.x, snapWorldPt.y, this.viewTransform);
            let indicator: paper.Path;
            const pt = new paper.Point(sPt.sx, sPt.sy);
            const size = 6;
            if (snapType === 'endpoint') indicator = new paper.Path.Rectangle(new paper.Rectangle(pt.subtract(size), new paper.Size(size*2, size*2)));
            else if (snapType === 'midpoint') indicator = new paper.Path.RegularPolygon(pt, 3, size * 1.2); 
            else indicator = new paper.Path.Circle(pt, size);
            indicator.strokeColor = new paper.Color(theme.highlight);
            indicator.fillColor = new paper.Color(theme.background);
            indicator.strokeWidth = 2;
            this.snapLayer.addChild(indicator);
        }
        (paper.view as any).draw();
    }
}
