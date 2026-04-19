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
      line.strokeColor = new paper.Color('#f0f0f0');
      line.strokeWidth = 1;
      line.strokeScaling = false;
    }

    for (let y = startY; y < bounds.bottom + pixelInterval; y += pixelInterval) {
      const line = new paper.Path.Line(
        new paper.Point(bounds.left, y),
        new paper.Point(bounds.right, y)
      );
      line.strokeColor = new paper.Color('#f0f0f0');
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
          
          const line = new paper.Path.Line(
              new paper.Point(pt1.x, pt1.y),
              new paper.Point(pt2.x, pt2.y)
          );
          
          let selected = false;
          if (this.selectionManager) {
              const fId = this.selectionManager.extractFeatureIdFromElementId(edge.id);
              if (fId && this.selectionManager.isSelected(fId)) {
                  selected = true;
              }
          }

          if (selected) {
              line.strokeColor = new paper.Color('#00aaff');
              line.strokeWidth = 3;
              
              // Draw Vertex Handles
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
              line.strokeColor = new paper.Color('#000000');
              line.strokeWidth = 2;
          }
          line.strokeScaling = false;
      }
      
      paper.view.draw();
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
