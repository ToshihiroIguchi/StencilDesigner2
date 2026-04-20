import { ModelGraph } from './graph';
import { ToleranceManager } from './viewport';
import type { ModelUnits } from './viewport';

export type FeatureId = string;

export interface Feature {
    id: FeatureId;
    type: 'Line' | 'Rect' | 'Circle' | 'Trim' | 'Fillet' | 'Array' | 'Dim';
    generateTopology(graph: ModelGraph): void;
}

export class DimensionFeature implements Feature {
    constructor(
        public id: FeatureId,
        public x1: ModelUnits,
        public y1: ModelUnits,
        public x2: ModelUnits,
        public y2: ModelUnits,
        public label: string,
        public v1Id?: string, // Sticky Start Vertex
        public v2Id?: string  // Sticky End Vertex
    ) {}

    type: 'Dim' = 'Dim';

    generateTopology(_graph: ModelGraph): void {
        // Dimensions only exist in the Render layer.
    }
}

export class LineFeature implements Feature {
    constructor(
        public id: FeatureId,
        public x1: ModelUnits,
        public y1: ModelUnits,
        public x2: ModelUnits,
        public y2: ModelUnits
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
        public x1: ModelUnits,
        public y1: ModelUnits,
        public x2: ModelUnits,
        public y2: ModelUnits
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
        public cx: ModelUnits,
        public cy: ModelUnits,
        public r: ModelUnits
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
        public targetX: ModelUnits,
        public targetY: ModelUnits
    ) {}

    type: 'Trim' = 'Trim';
    
    generateTopology(_graph: ModelGraph): void {
        // Handled during the post-intersection step in FeatureTree rebuild
    }

    applyTrim(graph: ModelGraph, toleranceRadiusUnits: ModelUnits): void {
        let bestDistUnits = -1n; // Use -1 as sentinel or use squared distance
        let bestEdgeId: string | null = null;
        
        for (const edge of graph.edges.values()) {
            const v1 = graph.vertices.get(edge.u);
            const v2 = graph.vertices.get(edge.v);
            if (!v1 || !v2 || v1.x === undefined || v1.y === undefined || v2.x === undefined || v2.y === undefined) continue;
            
            // Note: Distance check in BigInt requires careful handling (no sqrt)
            // But for simple comparison, squared distance is sufficient.
            const distSq = this.distToSegmentSq(
                {x: this.targetX, y: this.targetY}, 
                {x: v1.x, y: v1.y}, 
                {x: v2.x, y: v2.y}
            );
            
            const tolSq = toleranceRadiusUnits * toleranceRadiusUnits;
            if (distSq <= tolSq && (bestEdgeId === null || distSq < bestDistUnits)) {
                bestDistUnits = distSq;
                bestEdgeId = edge.id;
            }
        }
        
        if (bestEdgeId) {
            graph.edges.delete(bestEdgeId);
            // Optionally clean up orphan vertices:
            // This can be done by counting degrees or just leaving them. For now, just delete edge.
        }
    }

    private distToSegmentSq(p: {x:ModelUnits, y:ModelUnits}, v: {x:ModelUnits, y:ModelUnits}, w: {x:ModelUnits, y:ModelUnits}): bigint {
        const dx = w.x - v.x;
        const dy = w.y - v.y;
        const l2 = dx * dx + dy * dy;
        if (l2 === 0n) return (p.x - v.x) * (p.x - v.x) + (p.y - v.y) * (p.y - v.y);
        
        let t = ((p.x - v.x) * dx + (p.y - v.y) * dy);
        if (t < 0n) t = 0n;
        else if (t > l2) t = l2;
        
        // Projected point units calculation using fixed precision
        // To avoid floats, we work with squared distances directly
        const px = v.x * l2 + t * dx;
        const py = v.y * l2 + t * dy;
        const targetX_l2 = p.x * l2;
        const targetY_l2 = p.y * l2;
        
        const distSqScaled = (targetX_l2 - px) * (targetX_l2 - px) + (targetY_l2 - py) * (targetY_l2 - py);
        return distSqScaled / (l2 * l2);
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
        const state = JSON.stringify(this.features, (key, value) => 
            typeof value === 'bigint' ? value.toString() + 'n' : value
        );
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
            const b = (val: any) => {
                if (typeof val === 'string' && val.endsWith('n')) {
                    return BigInt(val.slice(0, -1));
                }
                return typeof val === 'number' ? BigInt(Math.round(val)) : 0n;
            };
            if (f.type === 'Line') return new LineFeature(f.id, b(f.x1), b(f.y1), b(f.x2), b(f.y2));
            if (f.type === 'Rect') return new RectFeature(f.id, b(f.x1), b(f.y1), b(f.x2), b(f.y2));
            if (f.type === 'Circle') return new CircleFeature(f.id, b(f.cx), b(f.cy), b(f.r));
            if (f.type === 'Trim') return new TrimFeature(f.id, b(f.targetX), b(f.targetY));
            if (f.type === 'Dim') return new DimensionFeature(f.id, b(f.x1), b(f.y1), b(f.x2), b(f.y2), f.label, f.v1Id, f.v2Id);
            return f;
        });
    }

    rebuild(): ModelGraph {
        const graph = new ModelGraph();
        
        for (const feature of this.features) {
            if (feature.type !== 'Trim' && feature.type !== 'Fillet' && feature.type !== 'Dim') {
                feature.generateTopology(graph);
            }
        }

        this.mergeCoincidentVertices(graph);

        // Splitting should handle BigInt as well (will require update to IntersectionEngine)
        // IntersectionEngine.splitAllIntersections(graph);

        for (const feature of this.features) {
            if (feature.type === 'Trim') {
                (feature as TrimFeature).applyTrim(graph, ToleranceManager.TOLERANCE_UNITS);
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
            if (!graph.vertices.has(v1.id)) continue; 
            
            for (let j = i + 1; j < vertices.length; j++) {
                const v2 = vertices[j];
                if (!graph.vertices.has(v2.id)) continue;
                
                if (v1.x !== undefined && v1.y !== undefined && v2.x !== undefined && v2.y !== undefined) {
                    const dx = v1.x - v2.x;
                    const dy = v1.y - v2.y;
                    const distSq = dx * dx + dy * dy;
                    if (distSq < ToleranceManager.TOLERANCE_UNITS * ToleranceManager.TOLERANCE_UNITS) {
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
