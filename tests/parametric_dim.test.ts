import { describe, it, expect } from 'vitest';
import { FeatureTree, LineFeature, DimensionFeature } from '../src/engine/core/feature';
import { ModelGraph } from '../src/engine/core/graph';

describe('Sticky Dimension Resolution', () => {
    it('should resolve coordinates from vertices if IDs are present', () => {
        const tree = new FeatureTree();
        const line = new LineFeature('l1', 0, 0, 10, 0);
        tree.addFeature(line);
        
        // Vertices created by line are l1_v0 (0,0) and l1_v1 (10,0)
        const dim = new DimensionFeature('d1', 0, 0, 10, 0, '10mm', 'l1_v0', 'l1_v1');
        tree.addFeature(dim);
        
        const graph = tree.rebuild();
        
        // Verify vertices exist
        const v1 = graph.vertices.get('l1_v0');
        const v2 = graph.vertices.get('l1_v1');
        expect(v1).toBeDefined();
        expect(v2).toBeDefined();
        
        // Simulate checking live coordinates (this logic is in CanvasRenderer, but let's test the lookup here)
        const resolvedV1 = graph.vertices.get(dim.v1Id!);
        const resolvedV2 = graph.vertices.get(dim.v2Id!);
        expect(resolvedV1?.x).toBe(0);
        expect(resolvedV2?.x).toBe(10);
    });

    it('should detect detached state when vertices are missing', () => {
        const tree = new FeatureTree();
        const dim = new DimensionFeature('d1', 5, 5, 15, 5, '10mm', 'missing_v1', 'missing_v2');
        tree.addFeature(dim);
        
        const graph = tree.rebuild();
        const v1 = graph.vertices.get(dim.v1Id!);
        const v2 = graph.vertices.get(dim.v2Id!);
        
        expect(v1).toBeUndefined();
        expect(v2).toBeUndefined();
        // CanvasRenderer logic will then use dim.x1, dim.y1 fallback.
    });
});
