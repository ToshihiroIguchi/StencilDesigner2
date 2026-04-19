import paper from 'paper';
import { ViewState, CoordinateTransformer, ToleranceManager } from '../core/viewport';
import { ModelGraph } from '../core/graph';
import { SelectionManager } from './selection';

export class CanvasRenderer {
  public viewState: ViewState;
  public transformer: CoordinateTransformer;
  public selectionManager?: SelectionManager;
  private canvasElement: HTMLCanvasElement;
  private currentGraph: ModelGraph | null = null;
  private snapLayer: paper.Layer;
  private geometryLayer: paper.Layer;
  private backgroundLayer: paper.Layer;

  constructor(canvasId: string) {
    this.canvasElement = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!this.canvasElement) {
      throw new Error(`Canvas with id ${canvasId} not found`);
    }

    paper.setup(this.canvasElement);
    
    const rect = this.canvasElement.getBoundingClientRect();
    const centerX = rect.width / 2 || window.innerWidth / 2;
    const centerY = rect.height / 2 || window.innerHeight / 2;
    this.viewState = new ViewState(centerX, centerY, 50); 
    this.transformer = new CoordinateTransformer(this.viewState);

    // Layer Management
    this.backgroundLayer = new paper.Layer();
    this.geometryLayer = new paper.Layer();
    this.snapLayer = new paper.Layer();

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
  }

  public drawBackground(): void {
    this.backgroundLayer.activate();
    this.backgroundLayer.removeChildren();

    const bounds = paper.view.bounds;
    const gridMm = ToleranceManager.getGridInterval(this.viewState.zoom);
    const pixelInterval = gridMm * this.viewState.zoom;

    const startX = bounds.left - (bounds.left % pixelInterval) - pixelInterval;
    const startY = bounds.top - (bounds.top % pixelInterval) - pixelInterval;

    for (let x = startX; x < bounds.right + pixelInterval; x += pixelInterval) {
      const line = new paper.Path.Line(
        new paper.Point(x, bounds.top),
        new paper.Point(x, bounds.bottom)
      );
      line.strokeColor = new paper.Color('#2a2a2a'); // Subtle dark grid
      line.strokeWidth = 1;
      line.strokeScaling = false;
    }

    for (let y = startY; y < bounds.bottom + pixelInterval; y += pixelInterval) {
      const line = new paper.Path.Line(
        new paper.Point(bounds.left, y),
        new paper.Point(bounds.right, y)
      );
      line.strokeColor = new paper.Color('#2a2a2a');
      line.strokeWidth = 1;
      line.strokeScaling = false; 
    }

    const origin = this.transformer.modelToScreen(0, 0);
    const xAxis = new paper.Path.Line(
      new paper.Point(bounds.left, origin.y),
      new paper.Point(bounds.right, origin.y)
    );
    xAxis.strokeColor = new paper.Color('#ff5555');
    xAxis.strokeWidth = 2;
    xAxis.strokeScaling = false;

    const yAxis = new paper.Path.Line(
      new paper.Point(origin.x, bounds.top),
      new paper.Point(origin.x, bounds.bottom)
    );
    yAxis.strokeColor = new paper.Color('#55ff55');
    yAxis.strokeWidth = 2;
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
          
          const pt1 = this.transformer.modelToScreen(v1.x, v1.y);
          const pt2 = this.transformer.modelToScreen(v2.x, v2.y);
          
          let path: paper.Path;
          if (edge.arcData) {
              // Convert Maker.js Arc definition to Paper.js points
              // Note: makerjs arc startAngle/endAngle are in degrees, counter-clockwise from 3 o'clock.
              // Paper.js Arc takes start, through, end points.
              const startAngleRad = edge.arcData.startAngle * Math.PI / 180;
              const endAngleRad = edge.arcData.endAngle * Math.PI / 180;
              let midAngleRad = startAngleRad + (endAngleRad - startAngleRad) / 2;
              
              // Handle angle wrapping (makerjs arcs are CCW by default)
              if (endAngleRad < startAngleRad) {
                  midAngleRad = startAngleRad + (endAngleRad + 2 * Math.PI - startAngleRad) / 2;
              }

              const mx = edge.arcData.origin[0] + edge.arcData.radius * Math.cos(midAngleRad);
              const my = edge.arcData.origin[1] + edge.arcData.radius * Math.sin(midAngleRad);
              
              // Project mid point to screen
              const ptMid = this.transformer.modelToScreen(mx, my);

              path = new paper.Path.Arc(
                  new paper.Point(pt1.x, pt1.y),
                  new paper.Point(ptMid.x, ptMid.y),
                  new paper.Point(pt2.x, pt2.y)
              );
          } else {
              path = new paper.Path.Line(
                  new paper.Point(pt1.x, pt1.y),
                  new paper.Point(pt2.x, pt2.y)
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
              path.strokeWidth = 3;
              
              const handle1 = new paper.Path.Circle(new paper.Point(pt1.x, pt1.y), 4);
              handle1.fillColor = new paper.Color('#ffffff');
              handle1.strokeColor = new paper.Color('#00aaff');
              handle1.strokeWidth = 1.5;
              handle1.strokeScaling = false;
              
              const handle2 = new paper.Path.Circle(new paper.Point(pt2.x, pt2.y), 4);
              handle2.fillColor = new paper.Color('#ffffff');
              handle2.strokeColor = new paper.Color('#00aaff');
              handle2.strokeWidth = 1.5;
              handle2.strokeScaling = false;
          } else {
              path.strokeColor = new paper.Color('#ffffff'); // White on dark
              path.strokeWidth = 1.5;
          }
          path.strokeScaling = false;
      }
      
      // Draw Dimensions
      this.drawDimensions();

      paper.view.draw();
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

              const pt1 = this.transformer.modelToScreen(liveX1, liveY1);
              const pt2 = this.transformer.modelToScreen(liveX2, liveY2);
              
              const group = new paper.Group();
              const color = detached ? new paper.Color('#bbbbbb') : new paper.Color('#777777');
              
              const line = new paper.Path.Line(new paper.Point(pt1.x, pt1.y), new paper.Point(pt2.x, pt2.y));
              line.strokeColor = color;
              line.strokeWidth = 1;
              if (detached) line.dashArray = [4, 4];
              group.addChild(line);

              // Small ticks
              const angle = Math.atan2(pt2.y - pt1.y, pt2.x - pt1.x);
              const tickLength = 5;
              const tick1 = new paper.Path.Line(
                  new paper.Point(pt1.x - Math.sin(angle)*tickLength, pt1.y + Math.cos(angle)*tickLength),
                  new paper.Point(pt1.x + Math.sin(angle)*tickLength, pt1.y - Math.cos(angle)*tickLength)
              );
              tick1.strokeColor = color;
              group.addChild(tick1);

              const tick2 = new paper.Path.Line(
                  new paper.Point(pt2.x - Math.sin(angle)*tickLength, pt2.y + Math.cos(angle)*tickLength),
                  new paper.Point(pt2.x + Math.sin(angle)*tickLength, pt2.y - Math.cos(angle)*tickLength)
              );
              tick2.strokeColor = color;
              group.addChild(tick2);

              // Label (Update if sticky and not detached)
              let labelText = dim.label;
              if (!detached && (dim.v1Id || dim.v2Id)) {
                  const liveDist = Math.hypot(liveX2 - liveX1, liveY2 - liveY1);
                  labelText = `${liveDist.toFixed(2)} mm`;
              }

              const text = new paper.PointText(new paper.Point((pt1.x + pt2.x) / 2, (pt1.y + pt2.y) / 2 - 5));
              text.content = labelText;
              text.fillColor = color;
              text.fontSize = 11;
              text.justification = 'center';
              if (detached) text.content += " (detached)";
              group.addChild(text);

              this.geometryLayer.addChild(group);
          }
      }
  }

  /**
   * Draws temporary interaction feedback (Ghosting & Snap Indicators)
   */
  public drawFeedback(ghostPath: paper.Path | null, snapType: string, snapScreenPt: {x: number, y: number}): void {
      this.snapLayer.activate();
      this.snapLayer.removeChildren();

      if (ghostPath) {
          this.snapLayer.addChild(ghostPath);
      }

      if (snapType !== 'none') {
          // Visual Feedback for Snap
          let indicator: paper.Path;
          const pt = new paper.Point(snapScreenPt.x, snapScreenPt.y);
          
          if (snapType === 'endpoint') {
              indicator = paper.Path.Rectangle(new paper.Rectangle(pt.subtract(4), new paper.Size(8, 8)));
          } else if (snapType === 'midpoint') {
              indicator = new paper.Path.RegularPolygon(pt, 3, 5); // Triangle
          } else { // Grid
              indicator = paper.Path.Circle(pt, 3);
          }
          
          indicator.strokeColor = new paper.Color('#00aa88');
          indicator.fillColor = new paper.Color('#00aa88');
          indicator.opacity = 0.8;
          indicator.strokeScaling = false;
          this.snapLayer.addChild(indicator);
      }

      paper.view.draw();
  }
}
