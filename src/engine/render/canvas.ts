import paper from 'paper';
import { ViewState, CoordinateTransformer, ToleranceManager } from '../core/viewport';
import type { ModelUnits } from '../core/viewport';
import { ModelGraph } from '../core/graph';
import type { Vertex } from '../core/graph';
import { SelectionManager } from './selection';
import { RulerManager } from './ruler';
import { GridRenderer } from './grid_renderer';

export class CanvasRenderer {
  public viewState: ViewState;
  public transformer: CoordinateTransformer;
  public selectionManager?: SelectionManager;
  public canvasElement: HTMLCanvasElement;
  private currentGraph: ModelGraph | null = null;
  private snapLayer: paper.Layer;
  private geometryLayer: paper.Layer;
  private uiLayer: paper.Layer;
  private rulerManager: RulerManager;
  private gridRenderer: GridRenderer;
  public geometryLayerDirty: boolean = true;
  public feedbackLayerDirty: boolean = false;
  private lastGhostPath: paper.Item | null = null;
  private lastSnapType: string = 'none';
  private lastSnapPt: {x:ModelUnits, y:ModelUnits} = {x:0n, y:0n};
  private isGeometryUpdateLocked: boolean = true;

  // Debug Stats
  private debugOverlay: HTMLElement;
  private totalFrameCount = 0;
  private totalRebuildCount = 0;
  private lastTime = performance.now();
  private fps = 0;
  private frameStartTimes: number[] = [];

  constructor(canvasId: string) {
    this.canvasElement = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!this.canvasElement) {
      throw new Error(`Canvas with id ${canvasId} not found`);
    }

    paper.setup(this.canvasElement);
    paper.settings.applyMatrix = false; // Essential for CAD: coordinates remain Truth
    
    const rect = this.canvasElement.getBoundingClientRect();
    const centerX = rect.width / 2 || window.innerWidth / 2;
    const centerY = rect.height / 2 || window.innerHeight / 2;
    this.viewState = new ViewState(centerX, centerY, 50); 
    this.transformer = new CoordinateTransformer(this.viewState);

    // Layer Management
    this.geometryLayer = new paper.Layer();
    this.uiLayer = new paper.Layer();
    this.snapLayer = new paper.Layer();

    const gridCanvas = document.getElementById('grid-canvas') as HTMLCanvasElement;
    this.gridRenderer = new GridRenderer(gridCanvas, this.viewState);
    this.gridRenderer.syncSize(rect.width, rect.height);

    this.setupArchitectureGuard();
    this.rulerManager = new RulerManager(this.viewState, this.transformer, this.uiLayer);

    this.debugOverlay = this.createDebugOverlay();

    paper.view.onResize = () => {
      const r = this.canvasElement.getBoundingClientRect();
      this.gridRenderer.syncSize(r.width, r.height);
      this.drawAll();
    };

    setTimeout(() => {
        this.drawAll();
    });
  }

  public updateGraph(graph: ModelGraph) {
      this.currentGraph = graph;
      this.geometryLayerDirty = true;
      this.totalRebuildCount++;
  }

  /**
   * Main Render Entry Point - Driven by rAF in main.ts
   */
  public render(): void {
    const startTime = performance.now();
    
    const viewStateChanged = this.viewState.needsUpdate;
    const geometryDirty = this.geometryLayerDirty;
    const feedbackDirty = this.feedbackLayerDirty;
    
    if (!viewStateChanged && !geometryDirty && !feedbackDirty) return;

    this.totalFrameCount++;
    const now = performance.now();
    this.updateFPS(now);

    // TEST 1: drawBackground無効化 (トグルとして利用可能)
    const skipBackground = (window as any).TEST_SKIP_BACKGROUND === true;
    // TEST 2: view.update無効化
    const skipUpdate = (window as any).TEST_SKIP_UPDATE === true;

    if (viewStateChanged) {
        this.updateMatrices();
        this.gridRenderer.render();
        this.rulerManager.draw();
    }

    if (geometryDirty) {
        this.drawGeometry();
        this.geometryLayerDirty = false;
    }

    if (feedbackDirty) {
        this.drawFeedbackInternal(this.lastGhostPath, this.lastSnapType, this.lastSnapPt);
        this.feedbackLayerDirty = false;
    }

    if (!skipUpdate) {
        paper.view.update();
    }
    
    this.viewState.needsUpdate = false;

    const endTime = performance.now();
    const duration = endTime - startTime;
    if (this.totalFrameCount % 30 === 0) {
        console.log(`[Benchmark] Frame Duration: ${duration.toFixed(2)}ms, FPS: ${this.fps}`);
    }

    this.updateDebugUI(viewStateChanged ? "Viewport" : "Geometry");
  }

  private updateFPS(now: number) {
    this.frameStartTimes.push(now);
    while (this.frameStartTimes.length > 0 && this.frameStartTimes[0] <= now - 1000) {
        this.frameStartTimes.shift();
    }
    this.fps = this.frameStartTimes.length;
  }

  private createDebugOverlay(): HTMLElement {
    const div = document.createElement('div');
    div.id = 'perf-overlay';
    div.style.position = 'fixed';
    div.style.top = '60px';
    div.style.left = '20px';
    div.style.background = 'rgba(0,0,0,0.7)';
    div.style.color = '#00ff00';
    div.style.padding = '10px';
    div.style.fontFamily = 'monospace';
    div.style.fontSize = '12px';
    div.style.borderRadius = '4px';
    div.style.pointerEvents = 'none';
    div.style.zIndex = '1000';
    div.style.border = '1px solid #00aa00';
    document.body.appendChild(div);
    return div;
  }

  private updateDebugUI(reason: string) {
    this.debugOverlay.innerHTML = `
      <div style="color:#fff; font-weight:bold; margin-bottom:4px;">PERFORMANCE MONITOR</div>
      <div>Reason: <span style="color:#ffcc00">${reason}</span></div>
      <div>FPS: <span style="color:${this.fps > 55 ? '#00ff00' : '#ff3300'}">${this.fps}</span></div>
      <div>Frames: ${this.totalFrameCount}</div>
      <div>Rebuilds: ${this.totalRebuildCount}</div>
      <div style="margin-top:4px; font-size:10px; color:#aaa;">O(N) Rebuild: ${this.geometryLayerDirty ? 'BUSY' : 'IDLE'}</div>
    `;
    if (this.totalFrameCount % 60 === 0) {
        console.debug(`[Perf] FPS: ${this.fps}, Reason: ${reason}, TotalFrames: ${this.totalFrameCount}`);
    }
  }

  // Backwards compatibility or explicit full force draw
  public drawAll(): void {
    this.geometryLayerDirty = true;
    this.viewState.needsUpdate = true;
    this.render();
  }

  private updateMatrices(): void {
    const m = this.transformer.getMatrix();
    this.geometryLayer.matrix = m;
    this.snapLayer.matrix = m;
    // uiLayer stays identity (1:1 screen pixels)
  }

  public drawBackground(): void {
    // Legacy method removed. Grid is now handled by GridRenderer on a separate canvas.
  }

  private setupArchitectureGuard(): void {
    const layer = this.geometryLayer;
    const self = this;

    const guard = (name: string, originalFn: any) => {
      return function(this: any, ...args: any[]) {
        if (self.isGeometryUpdateLocked) {
          console.error(`[PerfGuard] ILLEGAL UPDATE: Attempted to call ${name} while geometry is locked (Zoom/Pan frame).`);
          throw new Error(`GEOMETRY_LOCK_VIOLATION: ${name} called outside drawGeometry loop.`);
        }
        return originalFn.apply(this, args);
      };
    };

    layer.addChild = guard('addChild', layer.addChild);
    layer.removeChildren = guard('removeChildren', layer.removeChildren);
    (layer as any).insertChild = guard('insertChild', (layer as any).insertChild);
  }

  private drawGeometry(): void {
      this.isGeometryUpdateLocked = false;
      console.debug("[PerfGuard] Geometry Layer UNLOCKED for rebuild.");

      try {
          this.geometryLayer.activate();
          this.geometryLayer.removeChildren();
          
          if (!this.currentGraph) return;

          for (const edge of this.currentGraph.edges.values()) {
              const v1 = this.currentGraph.vertices.get(edge.u);
              const v2 = this.currentGraph.vertices.get(edge.v);
              if (!v1 || !v2 || v1.x === undefined || v1.y === undefined || v2.x === undefined || v2.y === undefined) continue;
              
              const m1 = new paper.Point(ToleranceManager.unitsToMm(v1.x), ToleranceManager.unitsToMm(v1.y));
              const m2 = new paper.Point(ToleranceManager.unitsToMm(v2.x), ToleranceManager.unitsToMm(v2.y));
              
              let path: paper.Path;
              if (edge.arcData) {
                  const mmOrigin = new paper.Point(
                      ToleranceManager.unitsToMm(edge.arcData.origin[0]), 
                      ToleranceManager.unitsToMm(edge.arcData.origin[1])
                  );
                  const mmRadius = ToleranceManager.unitsToMm(edge.arcData.radius);
                  
                  const startAngleRad = edge.arcData.startAngle * Math.PI / 180;
                  const endAngleRad = edge.arcData.endAngle * Math.PI / 180;
                  let midAngleRad = startAngleRad + (endAngleRad - startAngleRad) / 2;
                  
                  if (endAngleRad < startAngleRad) {
                      midAngleRad = startAngleRad + (endAngleRad + 2 * Math.PI - startAngleRad) / 2;
                  }

                  const mx = mmOrigin.x + mmRadius * Math.cos(midAngleRad);
                  const my = mmOrigin.y + mmRadius * Math.sin(midAngleRad);
                  
                  path = new paper.Path.Arc(
                      m1,
                      new paper.Point(mx, my),
                      m2
                  );
              } else {
                  path = new paper.Path.Line(m1, m2);
              }
              
              let selected = false;
              if (this.selectionManager) {
                  const fId = this.selectionManager.extractFeatureIdFromElementId(edge.id);
                  if (fId && this.selectionManager.isSelected(fId)) {
                      selected = true;
                  }
              }

              if (selected) {
                  path.strokeColor = new paper.Color('#00aaff');
                  path.strokeWidth = 2.5;
                  
                  const h1 = new paper.Path.Circle(m1, 4);
                  h1.fillColor = new paper.Color('#ffffff');
                  h1.strokeColor = new paper.Color('#00aaff');
                  h1.strokeWidth = 1;
                  h1.strokeScaling = false;
                  
                  const h2 = new paper.Path.Circle(m2, 4);
                  h2.fillColor = new paper.Color('#ffffff');
                  h2.strokeColor = new paper.Color('#00aaff');
                  h2.strokeWidth = 1;
                  h2.strokeScaling = false;
              } else {
                  path.strokeColor = new paper.Color('#ffffff');
                  path.strokeWidth = 1;
              }
              path.strokeScaling = false;
          }
          
          this.drawDimensions();
      } finally {
          this.isGeometryUpdateLocked = true;
          console.debug("[PerfGuard] Geometry Layer RELOCKED.");
      }
  }

  private drawDimensions(): void {
      const interaction = (window as any).interaction;
      if (!interaction || !interaction.featureTree || !this.currentGraph) return;
      
      const features = interaction.featureTree.features;
      const graph = this.currentGraph;

      for (const f of features) {
          if (f.type === 'Dim') {
              const dim = f as any;
              
              // Resolution Logic for Sticky Dimensions
              let liveX1 = dim.x1;
              let liveY1 = dim.y1;
              let liveX2 = dim.x2;
              let liveY2 = dim.y2;
              let detached = false;

              if (dim.v1Id) {
                  const v1 = graph.vertices.get(dim.v1Id);
                  if (v1 && v1.x != null && v1.y != null) {
                      liveX1 = v1.x; liveY1 = v1.y;
                  } else {
                      detached = true;
                  }
              }
              if (dim.v2Id) {
                  const v2 = graph.vertices.get(dim.v2Id);
                  if (v2 && v2.x != null && v2.y != null) {
                      liveX2 = v2.x; liveY2 = v2.y;
                  } else {
                      detached = true;
                  }
              }

              const group = new paper.Group();
              const color = detached ? new paper.Color('#bbbbbb') : new paper.Color('#777777');
              
              const m1P = new paper.Point(ToleranceManager.unitsToMm(liveX1), ToleranceManager.unitsToMm(liveY1));
              const m2P = new paper.Point(ToleranceManager.unitsToMm(liveX2), ToleranceManager.unitsToMm(liveY2));

              const line = new paper.Path.Line(m1P, m2P);
              line.strokeColor = color;
              line.strokeWidth = 1;
              line.strokeScaling = false;
              if (detached) line.dashArray = [4, 4];
              group.addChild(line);

              // Small ticks
              const dx = ToleranceManager.unitsToMm(liveX2 - liveX1);
              const dy = ToleranceManager.unitsToMm(liveY2 - liveY1);
              const angle = Math.atan2(dy, dx);
              const tickLengthModel = 5 / this.viewState.zoom; // Keep 5px visual length
              
              const tick1 = new paper.Path.Line(
                  new paper.Point(m1P.x - Math.sin(angle)*tickLengthModel, m1P.y + Math.cos(angle)*tickLengthModel),
                  new paper.Point(m1P.x + Math.sin(angle)*tickLengthModel, m1P.y - Math.cos(angle)*tickLengthModel)
              );
              tick1.strokeColor = color;
              tick1.strokeWidth = 1;
              tick1.strokeScaling = false;
              group.addChild(tick1);

              const tick2 = new paper.Path.Line(
                  new paper.Point(m2P.x - Math.sin(angle)*tickLengthModel, m2P.y + Math.cos(angle)*tickLengthModel),
                  new paper.Point(m2P.x + Math.sin(angle)*tickLengthModel, m2P.y - Math.cos(angle)*tickLengthModel)
              );
              tick2.strokeColor = color;
              tick2.strokeWidth = 1;
              tick2.strokeScaling = false;
              group.addChild(tick2);

              // Label (Update if sticky and not detached)
              let labelText = dim.label;
              if (!detached && (dim.v1Id || dim.v2Id)) {
                  const liveDist = Math.hypot(dx, dy);
                  labelText = `${liveDist.toFixed(2)} mm`;
              }

              const text = new paper.PointText(new paper.Point((m1P.x + m2P.x) / 2, (m1P.y + m2P.y) / 2));
              text.content = labelText;
              text.fillColor = color;
              text.fontSize = 11 / this.viewState.zoom; 
              text.justification = 'center';
              text.strokeScaling = false;
              if (detached) text.content += " (detached)";
              group.addChild(text);

              this.geometryLayer.addChild(group);
          }
      }
  }

  /**
   * Schedules a feedback draw (Snap/Ghost) without immediate execution
   */
  public drawFeedback(ghostPath: paper.Item | null, snapType: string, snapModelPt: {x: ModelUnits, y: ModelUnits}): void {
      this.lastGhostPath = ghostPath;
      this.lastSnapType = snapType;
      this.lastSnapPt = snapModelPt;
      this.feedbackLayerDirty = true;
  }

  private drawFeedbackInternal(ghostPath: paper.Item | null, snapType: string, snapModelPt: {x: ModelUnits, y: ModelUnits}): void {
      this.snapLayer.activate();
      this.snapLayer.removeChildren();

      if (ghostPath) {
          this.snapLayer.addChild(ghostPath);
      }

      if (snapType !== 'none') {
          let indicator: paper.Path;
          const pt = new paper.Point(ToleranceManager.unitsToMm(snapModelPt.x), ToleranceManager.unitsToMm(snapModelPt.y));
          const size = 5 / this.viewState.zoom;
          
          if (snapType === 'endpoint') {
              indicator = new paper.Path.Rectangle(new paper.Rectangle(pt.subtract(size), new paper.Size(size*2, size*2)));
          } else if (snapType === 'midpoint') {
              indicator = new paper.Path.RegularPolygon(pt, 3, size * 1.2); 
          } else {
              indicator = new paper.Path.Circle(pt, size);
          }
          
          indicator.strokeColor = new paper.Color('#00aa88');
          indicator.fillColor = new paper.Color('#00aa88');
          indicator.opacity = 0.8;
          indicator.strokeScaling = false;
          this.snapLayer.addChild(indicator);
      }
  }
}
