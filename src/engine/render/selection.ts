import { ModelGraph } from '../core/graph';

export class SelectionManager {
    public selectedFeatureIds: Set<string> = new Set();
    public onSelectionChange: () => void = () => {};

    select(featureId: string, additive: boolean = false) {
        if (!additive) {
            this.selectedFeatureIds.clear();
        }
        this.selectedFeatureIds.add(featureId);
        this.onSelectionChange();
    }

    deselect(featureId: string) {
        this.selectedFeatureIds.delete(featureId);
        this.onSelectionChange();
    }

    clear() {
        this.selectedFeatureIds.clear();
        this.onSelectionChange();
    }

    selectAll(allIds: string[]) {
        this.selectedFeatureIds.clear();
        allIds.forEach(id => this.selectedFeatureIds.add(id));
        this.onSelectionChange();
    }

    isSelected(featureId: string): boolean {
        return this.selectedFeatureIds.has(featureId);
    }

    extractFeatureIdFromElementId(elementId: string): string | null {
        // Topological Naming: f_0_v0 -> f_0, f_param_0_e0 -> f_param_0
        const match = elementId.match(/^(f[a-z0-9_]+)_/);
        return match ? match[1] : null;
    }

    hitTestSegment(pt: {x:number, y:number}, graph: ModelGraph, thresholdModelRadius: number): string | null {
        let bestDist = Infinity;
        let bestFeatureId: string | null = null;
        
        for (const edge of graph.edges.values()) {
            const v1 = graph.vertices.get(edge.u);
            const v2 = graph.vertices.get(edge.v);
            if (!v1 || !v2 || v1.x == null || v1.y == null || v2.x == null || v2.y == null) continue;
            
            const dist = this.distToSegment(pt, {x: v1.x, y: v1.y}, {x: v2.x, y: v2.y});
            if (dist <= thresholdModelRadius && dist < bestDist) {
                bestDist = dist;
                bestFeatureId = this.extractFeatureIdFromElementId(edge.id);
            }
        }
        return bestFeatureId;
    }

    boxSelect(min: {x:number, y:number}, max: {x:number, y:number}, graph: ModelGraph): string[] {
        const found = new Set<string>();
        // Simple approach: if any vertex of a feature is within the box, select the feature.
        for (const vertex of graph.vertices.values()) {
            if (vertex.x == null || vertex.y == null) continue;
            if (vertex.x >= min.x && vertex.y >= min.y && vertex.x <= max.x && vertex.y <= max.y) {
                const fId = this.extractFeatureIdFromElementId(vertex.id);
                if (fId) found.add(fId);
            }
        }
        return Array.from(found);
    }

    private distToSegment(p: {x:number, y:number}, v: {x:number, y:number}, w: {x:number, y:number}) {
        const l2 = Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2);
        if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
        let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
    }
}
