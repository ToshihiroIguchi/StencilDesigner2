import { describe, it, expect } from 'vitest';
import { FeatureTree, LineFeature, RectFeature } from '../src/engine/core/feature';

describe('Feature Tree to Model Graph Generation', () => {
    it('should populate exact topological vertices', () => {
        const tree = new FeatureTree();
        tree.addFeature(new RectFeature('f1', 0, 0, 10, 10));
        
        const graph = tree.rebuild();
        
        expect(graph.vertices.size).toBe(4);
        expect(graph.edges.size).toBe(4);
        
        // Ensure topological naming rules are met
        expect(graph.vertices.has('f1_v0')).toBe(true);
        expect(graph.edges.has('f1_e0')).toBe(true);
    });
});
