import paper from 'paper';
import { ViewState, CoordinateTransformer, ToleranceManager } from '../core/viewport';
import { ModelGraph } from '../core/graph';
import { SelectionManager } from './selection';
import { RulerManager } from './ruler';

export class CanvasRenderer {
  public viewState: ViewState;
  public transformer: CoordinateTransformer;
  public selectionManager?: SelectionManager;
  public canvasElement: HTMLCanvasElement;
  private currentGraph: ModelGraph | null = null;
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
    paper.settings.applyMatrix = false; // Essential for CAD: coordinates remain Truth
    
    const rect = this.canvasElement.getBoundingClientRect();
    const centerX = rect.width / 2 || window.innerWidth / 2;
    const centerY = rect.height / 2 || window.innerHeight / 2;
    this.viewState = new ViewState(centerX, centerY, 50); 
    this.transformer = new CoordinateTransformer(this.viewState);

    // Layer Management
    this.backgroundLayer = new paper.Layer();
    this.geometryLayer = new paper.Layer();
    this.uiLayer = new paper.Layer();
    this.snapLayer = new paper.Layer();

    this.rulerManager = new RulerManager(this.viewState, this.transformer, this.uiLayer);

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
    this.updateMatrices();
    this.drawBackground();
    this.drawGeometry();
    this.rulerManager.draw();
    paper.view.update();
  }

  private updateMatrices(): void {
    const m = this.transformer.getMatrix();
    this.geometryLayer.matrix = m;
    this.backgroundLayer.matrix = m;
    this.snapLayer.matrix = m;
    // uiLayer stays identity (1:1 screen pixels)
  }

  public drawBackground(): void {
    this.backgroundLayer.activate();
    this.backgroundLayer.removeChildren();

    const gridMm = ToleranceManager.getGridInterval(this.viewState.zoom);
    const bounds = paper.view.bounds;
    
    // Bounds in model space
    const p1 = this.transformer.screenToModel(bounds.left, bounds.top);
    const p2 = this.transformer.screenToModel(bounds.right, bounds.bottom);
    
    const startX = Math.floor(Math.min(p1.x, p2.x) / gridMm) * gridMm;
    const endX = Math.ceil(Math.max(p1.x, p2.x) / gridMm) * gridMm;
    const startY = Math.floor(Math.min(p1.y, p2.y) / gridMm) * gridMm;
    const endY = Math.ceil(Math.max(p1.y, p2.y) / gridMm) * gridMm;

    for (let x = startX; x <= endX; x += gridMm) {
      const line = new paper.Path.Line(
        new paper.Point(x, startY - 100),
        new paper.Point(x, endY + 100)
      );
      line.strokeColor = new paper.Color('#2a2a2a');
      line.strokeWidth = 1;
      line.strokeScaling = false;
    }

    for (let y = startY; y <= endY; y += gridMm) {
      const line = new paper.Path.Line(
        new paper.Point(startX - 100, y),
        new paper.Point(endX + 100, y)
      );
      line.strokeColor = new paper.Color('#2a2a2a');
      line.strokeWidth = 1;
      line.strokeScaling = false; 
    }

    // Origin Axes
    const xAxis = new paper.Path.Line(
      new paper.Point(startX - 1000, 0),
      new paper.Point(endX + 1000, 0)
    );
    xAxis.strokeColor = new paper.Color('#ff5555');
    xAxis.strokeWidth = 1.5;
    xAxis.strokeScaling = false;

    const yAxis = new paper.Path.Line(
      new paper.Point(0, startY - 1000),
      new paper.Point(0, endY + 1000)
    );
    yAxis.strokeColor = new paper.Color('#55ff55');
    yAxis.strokeWidth = 1.5;
    yAxis.strokeScaling = false;
  }

  private drawGeometry(): void {
      this.geometryLayer.activate();
      this.geometryLayer.removeChildren();
      
      if (!this.currentGraph) return;

      for (const edge of this.currentGraph.edges.values()) {
          const v1 = this.currentGraph.vertices.get(edge.u);
          const v2 = this.currentGraph.vertices.get(edge.v);
          if (!v1 || !v2 || v1.x == null || v1.y == null || v2.x == null || v2.y == null) continue;
          
          let path: paper.Path;
          if (edge.arcData) {
              const startAngleRad = edge.arcData.startAngle * Math.PI / 180;
              const endAngleRad = edge.arcData.endAngle * Math.PI / 180;
              let midAngleRad = startAngleRad + (endAngleRad - startAngleRad) / 2;
              
              if (endAngleRad < startAngleRad) {
                  midAngleRad = startAngleRad + (endAngleRad + 2 * Math.PI - startAngleRad) / 2;
              }

              const mx = edge.arcData.origin[0] + edge.arcData.radius * Math.cos(midAngleRad);
              const my = edge.arcData.origin[1] + edge.arcData.radius * Math.sin(midAngleRad);
              
              path = new paper.Path.Arc(
                  new paper.Point(v1.x, v1.y),
                  new paper.Point(mx, my),
                  new paper.Point(v2.x, v2.y)
              );
          } else {
              path = new paper.Path.Line(
                  new paper.Point(v1.x, v1.y),
                  new paper.Point(v2.x, v2.y)
              );
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
              
              const h1 = new paper.Path.Circle(new paper.Point(v1.x, v1.y), 4);
              h1.fillColor = new paper.Color('#ffffff');
              h1.strokeColor = new paper.Color('#00aaff');
              h1.strokeWidth = 1;
              h1.strokeScaling = false;
              
              const h2 = new paper.Path.Circle(new paper.Point(v2.x, v2.y), 4);
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
      
      // Draw Dimensions
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
              
              const line = new paper.Path.Line(new paper.Point(liveX1, liveY1), new paper.Point(liveX2, liveY2));
              line.strokeColor = color;
              line.strokeWidth = 1;
              line.strokeScaling = false;
              if (detached) line.dashArray = [4, 4];
              group.addChild(line);

              // Small ticks
              const angle = Math.atan2(liveY2 - liveY1, liveX2 - liveX1);
              const tickLengthModel = 5 / this.viewState.zoom; // Keep 5px visual length
              
              const tick1 = new paper.Path.Line(
                  new paper.Point(liveX1 - Math.sin(angle)*tickLengthModel, liveY1 + Math.cos(angle)*tickLengthModel),
                  new paper.Point(liveX1 + Math.sin(angle)*tickLengthModel, liveY1 - Math.cos(angle)*tickLengthModel)
              );
              tick1.strokeColor = color;
              tick1.strokeWidth = 1;
              tick1.strokeScaling = false;
              group.addChild(tick1);

              const tick2 = new paper.Path.Line(
                  new paper.Point(liveX2 - Math.sin(angle)*tickLengthModel, liveY2 + Math.cos(angle)*tickLengthModel),
                  new paper.Point(liveX2 + Math.sin(angle)*tickLengthModel, liveY2 - Math.cos(angle)*tickLengthModel)
              );
              tick2.strokeColor = color;
              tick2.strokeWidth = 1;
              tick2.strokeScaling = false;
              group.addChild(tick2);

              // Label (Update if sticky and not detached)
              let labelText = dim.label;
              if (!detached && (dim.v1Id || dim.v2Id)) {
                  const liveDist = Math.hypot(liveX2 - liveX1, liveY2 - liveY1);
                  labelText = `${liveDist.toFixed(2)} mm`;
              }

              const text = new paper.PointText(new paper.Point((liveX1 + liveX2) / 2, (liveY1 + liveY2) / 2));
              text.content = labelText;
              text.fillColor = color;
              text.fontSize = 11 / this.viewState.zoom; // Hack to keep visual size same in scaled layer
              text.justification = 'center';
              text.strokeScaling = false;
              if (detached) text.content += " (detached)";
              group.addChild(text);

              this.geometryLayer.addChild(group);
          }
      }
  }

  /**
   * Draws temporary interaction feedback (Ghosting & Snap Indicators)
   */
  public drawFeedback(ghostPath: paper.Item | null, snapType: string, snapModelPt: {x: number, y: number}): void {
      this.snapLayer.activate();
      this.snapLayer.removeChildren();

      if (ghostPath) {
          this.snapLayer.addChild(ghostPath);
      }

      if (snapType !== 'none') {
          // Visual Feedback for Snap
          let indicator: paper.Path;
          const pt = new paper.Point(snapModelPt.x, snapModelPt.y);
          const size = 5 / this.viewState.zoom; // Always 5px visual size
          
          if (snapType === 'endpoint') {
              indicator = new paper.Path.Rectangle(new paper.Rectangle(pt.subtract(size), new paper.Size(size*2, size*2)));
          } else if (snapType === 'midpoint') {
              indicator = new paper.Path.RegularPolygon(pt, 3, size * 1.2); 
          } else { // Grid
              indicator = new paper.Path.Circle(pt, size);
          }
          
          indicator.strokeColor = new paper.Color('#00aa88');
          indicator.fillColor = new paper.Color('#00aa88');
          indicator.opacity = 0.8;
          indicator.strokeScaling = false;
          this.snapLayer.addChild(indicator);
      }

      (paper.view as any).draw();
  }
}
