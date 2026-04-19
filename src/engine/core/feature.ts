import { ModelGraph } from './graph';
import type { VertexId, EdgeId } from './graph';

/**
 * Feature-driven Topology Engine
 * 
 * 履歴ベース（History-based）CADの概念に基づき、設計意図（Design Intent）を Feature で表現し、
 * それを元にトポロジーである ModelGraph を再構築（Rebuild）します。
 */

export type FeatureId = string;

export interface Feature {
    id: FeatureId;
    type: 'Line' | 'Rect' | 'Circle';
    // Topological Naming Foundation: Provides deterministic IDs for elements based on this feature
    generateTopology(graph: ModelGraph): void;
}

export class LineFeature implements Feature {
    constructor(
        public id: FeatureId,
        public x1: number,
        public y1: number,
        public x2: number,
        public y2: number
    ) {}

    type: 'Line' = 'Line';

    generateTopology(graph: ModelGraph): void {
        const v1Id = `${this.id}_v0`;
        const v2Id = `${this.id}_v1`;
        const eId = `${this.id}_e0`;
        
        try { graph.addVertex(v1Id, this.x1, this.y1); } catch(e){}
        try { graph.addVertex(v2Id, this.x2, this.y2); } catch(e){}
        try { graph.addEdge(eId, v1Id, v2Id); } catch(e){}
    }
}

export class RectFeature implements Feature {
    constructor(
        public id: FeatureId,
        public x1: number,
        public y1: number,
        public x2: number,
        public y2: number
    ) {}

    type: 'Rect' = 'Rect';

    generateTopology(graph: ModelGraph): void {
        const vId = (n: number) => `${this.id}_v${n}`;
        const eId = (n: number) => `${this.id}_e${n}`;

        try { graph.addVertex(vId(0), this.x1, this.y1); } catch(e){}
        try { graph.addVertex(vId(1), this.x2, this.y1); } catch(e){}
        try { graph.addVertex(vId(2), this.x2, this.y2); } catch(e){}
        try { graph.addVertex(vId(3), this.x1, this.y2); } catch(e){}

        try { graph.addEdge(eId(0), vId(0), vId(1)); } catch(e){}
        try { graph.addEdge(eId(1), vId(1), vId(2)); } catch(e){}
        try { graph.addEdge(eId(2), vId(2), vId(3)); } catch(e){}
        try { graph.addEdge(eId(3), vId(3), vId(0)); } catch(e){}
    }
}

export class CircleFeature implements Feature {
    constructor(
        public id: FeatureId,
        public cx: number,
        public cy: number,
        public r: number
    ) {}

    type: 'Circle' = 'Circle';
    
    generateTopology(graph: ModelGraph): void {
        // Topological skeleton for a circle (center node and radius constraint node conceptualized)
        // Since we are pure lines right now, we can represent circle with its center point and a single edge or mark.
        // For phase 1 we just register center.
        const centerId = `${this.id}_center`;
        try { graph.addVertex(centerId, this.cx, this.cy); } catch(e){}
        // Further geometric mapping requires Non-linear elements.
    }
}

export class FeatureTree {
    features: Feature[] = [];

    addFeature(feature: Feature) {
        this.features.push(feature);
    }

    rebuild(): ModelGraph {
        const graph = new ModelGraph();
        for (const feature of this.features) {
            feature.generateTopology(graph);
        }
        return graph;
    }
}
