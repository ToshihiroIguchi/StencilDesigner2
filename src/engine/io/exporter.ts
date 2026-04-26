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
            const v1 = graph.vertices.get(edge.v1);
            const v2 = graph.vertices.get(edge.v2);
            
            if (!v1 || !v2 || v1.isDeleted || v2.isDeleted) continue;
            
            const p1 = [ToleranceManager.canonicalize(Number(v1.x) / 1000), ToleranceManager.canonicalize(Number(v1.y) / 1000)];
            const p2 = [ToleranceManager.canonicalize(Number(v2.x) / 1000), ToleranceManager.canonicalize(Number(v2.y) / 1000)];

            paths[edge.id] = new makerjs.paths.Line(p1, p2);
        }
        
        return { paths };
    }
}
