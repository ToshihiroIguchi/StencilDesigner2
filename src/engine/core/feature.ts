import { ModelGraph, insertLine, LinearSpatialIndex, type SpatialIndex } from './graph';

export type FeatureId = string;

export interface Feature {
    id: FeatureId;
    type: 'Line' | 'Rect' | 'Circle' | 'Trim' | 'Fillet' | 'Array' | 'Dim';
    generateTopology(graph: ModelGraph, spatial: SpatialIndex): void;
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

    generateTopology(_graph: ModelGraph, _spatial: SpatialIndex): void {
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

    generateTopology(graph: ModelGraph, spatial: SpatialIndex): void {
        const ax = BigInt(Math.round(this.x1 * 1000));
        const ay = BigInt(Math.round(this.y1 * 1000));
        const bx = BigInt(Math.round(this.x2 * 1000));
        const by = BigInt(Math.round(this.y2 * 1000));
        insertLine(graph, spatial, ax, ay, bx, by);
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

    generateTopology(graph: ModelGraph, spatial: SpatialIndex): void {
        const x1 = BigInt(Math.round(this.x1 * 1000));
        const y1 = BigInt(Math.round(this.y1 * 1000));
        const x2 = BigInt(Math.round(this.x2 * 1000));
        const y2 = BigInt(Math.round(this.y2 * 1000));

        insertLine(graph, spatial, x1, y1, x2, y1);
        insertLine(graph, spatial, x2, y1, x2, y2);
        insertLine(graph, spatial, x2, y2, x1, y2);
        insertLine(graph, spatial, x1, y2, x1, y1);
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
    
    generateTopology(_graph: ModelGraph, _spatial: SpatialIndex): void {
        // Topological skeleton for a circle center
        // const cx = BigInt(Math.round(this.cx * 1000));
        // const cy = BigInt(Math.round(this.cy * 1000));
    }
}

export class TrimFeature implements Feature {
    constructor(
        public id: FeatureId,
        public targetX: number,
        public targetY: number
    ) {}

    type: 'Trim' = 'Trim';
    
    generateTopology(_graph: ModelGraph, _spatial: SpatialIndex): void {
        // Handled during the post-intersection step in FeatureTree rebuild
    }

    applyTrim(graph: ModelGraph, toleranceRadius: number): void {
        // Find closest edge to targetX, targetY and remove it
        let bestDist = Infinity;
        let bestEdgeId: string | null = null;
        
        for (const edge of graph.edges.values()) {
            const v1 = graph.vertices.get(edge.v1);
            const v2 = graph.vertices.get(edge.v2);
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

    private distToSegment(p: {x:number, y:number}, v: {x:bigint, y:bigint}, w: {x:bigint, y:bigint}) {
        const vx = Number(v.x)/1000, vy = Number(v.y)/1000;
        const wx = Number(w.x)/1000, wy = Number(w.y)/1000;
        const l2 = Math.pow(vx - wx, 2) + Math.pow(vy - wy, 2);
        if (l2 === 0) return Math.hypot(p.x - vx, p.y - vy);
        let t = ((p.x - vx) * (wx - vx) + (p.y - vy) * (wy - vy)) / l2;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(p.x - (vx + t * (wx - vx)), p.y - (vy + t * (wy - vy)));
    }
}



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
        const spatial = new LinearSpatialIndex(graph);
        
        // 1. Base Geometry
        for (const feature of this.features) {
            if (feature.type !== 'Trim' && feature.type !== 'Fillet' && feature.type !== 'Dim') {
                feature.generateTopology(graph, spatial);
            }
        }

        // 1.5 Merge Coincident Vertices
        // Deprecated: this is handled in geometry grid merge directly.
        // this.mergeCoincidentVertices(graph);

        // 2. Intersection Evaluation & Segment Splitting
        // Deprecated: IntersectionEngine.splitAllIntersections(graph);

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
}
