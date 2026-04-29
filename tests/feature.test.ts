import { describe, it, expect } from 'vitest';
import { FeatureTree, LineFeature, RectFeature } from '../src/engine/core/feature';

describe('Feature Tree to Model Graph Generation', () => {
    it('should populate exact topological vertices', () => {
        const tree = new FeatureTree();
        tree.addFeature(new RectFeature('f1', 0, 0, 10, 10));
        
        const graph = tree.rebuild();
        
        expect(graph.vertices.size).toBe(4);
        expect(graph.edges.size).toBe(4);
        
        // Check for vertices by coordinates (in um)
        const coords = Array.from(graph.vertices.values()).map(v => ({ x: v.x, y: v.y }));
        expect(coords).toContainEqual({ x: 0n, y: 0n });
        expect(coords).toContainEqual({ x: 10000n, y: 0n });
        expect(coords).toContainEqual({ x: 10000n, y: 10000n });
        expect(coords).toContainEqual({ x: 0n, y: 10000n });
    });
});
