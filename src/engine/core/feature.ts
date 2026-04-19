import { ModelGraph } from './graph';
import type { VertexId, EdgeId } from './graph';

export type FeatureId = string;

export interface Feature {
    id: FeatureId;
    type: 'Line' | 'Rect' | 'Circle' | 'Trim' | 'Fillet' | 'Array' | 'Dim';
    generateTopology(graph: ModelGraph): void;
}

export class DimensionFeature implements Feature {
    constructor(
        public id: FeatureId,
        public x1: number,
        public y1: number,
        public x2: number,
        public y2: number,
        public label: string,
        public v1Id?: string, // Sticky Start Vertex
        public v2Id?: string  // Sticky End Vertex
    ) {}

    type: 'Dim' = 'Dim';

    generateTopology(graph: ModelGraph): void {
        // Dimensions only exist in the Render layer.
    }
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

export class TrimFeature implements Feature {
    constructor(
        public id: FeatureId,
        public targetX: number,
        public targetY: number
    ) {}

    type: 'Trim' = 'Trim';
    
    generateTopology(graph: ModelGraph): void {
        // Handled during the post-intersection step in FeatureTree rebuild
    }

    applyTrim(graph: ModelGraph, toleranceRadius: number): void {
        // Find closest edge to targetX, targetY and remove it
        let bestDist = Infinity;
        let bestEdgeId: string | null = null;
        
        for (const edge of graph.edges.values()) {
            const v1 = graph.vertices.get(edge.u);
            const v2 = graph.vertices.get(edge.v);
            if (!v1 || !v2 || v1.x == null || v1.y == null || v2.x == null || v2.y == null) continue;
            
            const dist = this.distToSegment({x: this.targetX, y: this.targetY}, {x: v1.x, y: v1.y}, {x: v2.x, y: v2.y});
            if (dist <= toleranceRadius && dist < bestDist) {
                bestDist = dist;
                bestEdgeId = edge.id;
            }
        }
        
        if (bestEdgeId) {
            graph.edges.delete(bestEdgeId);
            // Optionally clean up orphan vertices:
            // This can be done by counting degrees or just leaving them. For now, just delete edge.
        }
    }

    private distToSegment(p: {x:number, y:number}, v: {x:number, y:number}, w: {x:number, y:number}) {
        const l2 = Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2);
        if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
        let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
    }
}

import { IntersectionEngine } from './intersection';

export class FeatureTree {
    features: Feature[] = [];
    private history: string[] = []; // JSON serialized states
    private historyIndex: number = -1;
    private maxHistory = 50;

    constructor() {
        this.saveHistory();
    }

    addFeature(feature: Feature) {
        this.features.push(feature);
        this.saveHistory();
    }

    addFeatures(newFeatures: Feature[]) {
        this.features.push(...newFeatures);
        this.saveHistory();
    }

    // This replaces clear/assign to ensure history is captured
    setFeatures(newFeatures: Feature[]) {
        this.features = [...newFeatures];
        this.saveHistory();
    }

    deleteFeatures(featureIds: Set<string>): void {
        this.features = this.features.filter(f => !featureIds.has(f.id));
        this.saveHistory();
    }

    saveHistory() {
        const state = JSON.stringify(this.features);
        // If we were in the middle of undo, truncate the redo part
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        
        this.history.push(state);
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }
        this.historyIndex = this.history.length - 1;
    }

    undo(): boolean {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.restoreState(this.history[this.historyIndex]);
            return true;
        }
        return false;
    }

    redo(): boolean {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.restoreState(this.history[this.historyIndex]);
            return true;
        }
        return false;
    }

    private restoreState(json: string) {
        const raw = JSON.parse(json);
        // Re-hydrate objects based on type
        this.features = raw.map((f: any) => {
            if (f.type === 'Line') return new LineFeature(f.id, f.x1, f.y1, f.x2, f.y2);
            if (f.type === 'Rect') return new RectFeature(f.id, f.x1, f.y1, f.x2, f.y2);
            if (f.type === 'Circle') return new CircleFeature(f.id, f.cx, f.cy, f.r);
            if (f.type === 'Trim') return new TrimFeature(f.id, f.targetX, f.targetY);
            if (f.type === 'Dim') return new DimensionFeature(f.id, f.x1, f.y1, f.x2, f.y2, f.label, f.v1Id, f.v2Id);
            // Fillet/Array are usually modifiers or intermediate.
            // Note: FilletFeature is imported/defined in fillet.ts, but let's check.
            return f; // Fallback for simple objects
        });
    }

    rebuild(): ModelGraph {
        const graph = new ModelGraph();
        
        // 1. Base Geometry
        for (const feature of this.features) {
            if (feature.type !== 'Trim' && feature.type !== 'Fillet' && feature.type !== 'Dim') {
                feature.generateTopology(graph);
            }
        }

        // 1.5 Merge Coincident Vertices
        this.mergeCoincidentVertices(graph);

        // 2. Intersection Evaluation & Segment Splitting
        IntersectionEngine.splitAllIntersections(graph);

        // 3. Apply Modifiers (Trims & Fillets)
        for (const feature of this.features) {
            if (feature.type === 'Trim') {
                (feature as TrimFeature).applyTrim(graph, 1.0); // 1.0mm strict model tolerance for replay
            } else if (feature.type === 'Fillet') {
                (feature as any).applyFillet(graph);
            }
        }

        return graph;
    }

    private mergeCoincidentVertices(graph: ModelGraph): void {
        const canonicalMap = new Map<string, string>(); // maps duplicate vid to canonical vid
        const vertices = Array.from(graph.vertices.values());
        
        for (let i = 0; i < vertices.length; i++) {
            const v1 = vertices[i];
            if (!graph.vertices.has(v1.id)) continue; // Already merged
            
            for (let j = i + 1; j < vertices.length; j++) {
                const v2 = vertices[j];
                if (!graph.vertices.has(v2.id)) continue;
                
                if (v1.x != null && v1.y != null && v2.x != null && v2.y != null) {
                    // We need ToleranceManager.arePointsEqual but we cannot easily import it if not present,
                    // Actually, ToleranceManager is not imported in feature.ts! Wait! 
                    // Let's just do a math check.
                    if (Math.hypot(v1.x - v2.x, v1.y - v2.y) < 1e-5) {
                        canonicalMap.set(v2.id, v1.id);
                        graph.vertices.delete(v2.id);
                    }
                }
            }
        }

        // Remap edges
        for (const edge of graph.edges.values()) {
            if (canonicalMap.has(edge.u)) edge.u = canonicalMap.get(edge.u)!;
            if (canonicalMap.has(edge.v)) edge.v = canonicalMap.get(edge.v)!;
        }
    }
}
