import { describe, it, expect } from 'vitest';
import { FeatureTree, LineFeature, DimensionFeature } from '../src/engine/core/feature';
import { ModelGraph } from '../src/engine/core/graph';

describe('Sticky Dimension Resolution', () => {
    it('should resolve coordinates from vertices if IDs are present', () => {
        const tree = new FeatureTree();
        const line = new LineFeature('l1', 0, 0, 10, 0);
        tree.addFeature(line);
        
        const graph = tree.rebuild();
        
        // Find vertex IDs by coordinates
        const v0Id = Array.from(graph.vertices.values()).find(v => v.x === 0n && v.y === 0n)?.id;
        const v1Id = Array.from(graph.vertices.values()).find(v => v.x === 10000n && v.y === 0n)?.id;
        
        expect(v0Id).toBeDefined();
        expect(v1Id).toBeDefined();
        
        const dim = new DimensionFeature('d1', 0, 0, 10, 0, '10mm', v0Id, v1Id);
        tree.addFeature(dim);
        
        // Simulate checking live coordinates
        const resolvedV1 = graph.vertices.get(dim.v1Id!);
        const resolvedV2 = graph.vertices.get(dim.v2Id!);
        expect(resolvedV1?.x).toBe(0n);
        expect(resolvedV2?.x).toBe(10000n);
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
    });
});
