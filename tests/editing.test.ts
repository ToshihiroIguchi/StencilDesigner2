import { describe, it, expect } from 'vitest';
import { FeatureTree, LineFeature } from '../src/engine/core/feature';
import { FeatureEditor } from '../src/engine/core/editing';

describe('Atomic Deletion in FeatureTree', () => {
    it('should completely remove feature and completely rebuild ModelGraph without its elements', () => {
        const tree = new FeatureTree();
        tree.addFeature(new LineFeature('f1', 0, 0, 10, 10));
        tree.addFeature(new LineFeature('f2', 10, 10, 20, 20));
        
        let graph = tree.rebuild();
        // 3 unique vertices: (0,0), (10,10), (20,20)
        expect(graph.vertices.size).toBe(3);
        expect(graph.edges.size).toBe(2);
        
        const editor = new FeatureEditor(tree);
        editor.deleteFeatures(new Set(['f1']));
        
        graph = tree.rebuild();
        
        // f1 is gone. Only f2 remains.
        // Vertices at (10,10) and (20,20) should remain.
        expect(graph.vertices.size).toBe(2);
        expect(graph.edges.size).toBe(1);
        
        // Verify coordinates of remaining vertices
        const coords = Array.from(graph.vertices.values()).map(v => ({ x: v.x, y: v.y }));
        expect(coords).toContainEqual({ x: 10000n, y: 10000n });
        expect(coords).toContainEqual({ x: 20000n, y: 20000n });
        expect(coords).not.toContainEqual({ x: 0n, y: 0n });
    });
});
