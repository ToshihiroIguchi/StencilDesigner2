import makerjs from 'makerjs';
import { ModelGraph } from '../core/graph';
import { ToleranceManager } from '../core/viewport';

export class ModelExporter {
    static exportToDXF(graph: ModelGraph): string {
        const model = this.buildMakerModel(graph);
        return makerjs.exporter.toDXF(model);
    }

    static exportToSVG(graph: ModelGraph): string {
        const model = this.buildMakerModel(graph);
        return makerjs.exporter.toSVG(model);
    }

    private static buildMakerModel(graph: ModelGraph): makerjs.IModel {
        const paths: { [id: string]: makerjs.IPath } = {};
        
        for (const edge of graph.edges.values()) {
            const v1 = graph.vertices.get(edge.u);
            const v2 = graph.vertices.get(edge.v);
            
            if (!v1 || !v2 || v1.x == null || v1.y == null || v2.x == null || v2.y == null) continue;
            
            const p1 = [ToleranceManager.canonicalize(v1.x), ToleranceManager.canonicalize(v1.y)];
            const p2 = [ToleranceManager.canonicalize(v2.x), ToleranceManager.canonicalize(v2.y)];

            if (edge.arcData) {
                // Ensure mathematical precision
                paths[edge.id] = new makerjs.paths.Arc(
                    edge.arcData.origin as [number, number],
                    ToleranceManager.canonicalize(edge.arcData.radius),
                    edge.arcData.startAngle,
                    edge.arcData.endAngle
                );
            } else {
                paths[edge.id] = new makerjs.paths.Line(p1, p2);
            }
        }
        
        return { paths };
    }
}
