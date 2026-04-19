import { describe, it, expect } from 'vitest';
import { FeatureTree, LineFeature } from '../src/engine/core/feature';
import { FeatureEditor } from '../src/engine/core/editing';

describe('Atomic Deletion in FeatureTree', () => {
    it('should completely remove feature and completely rebuild ModelGraph without its elements', () => {
        const tree = new FeatureTree();
        tree.addFeature(new LineFeature('f1', 0, 0, 10, 10));
        tree.addFeature(new LineFeature('f2', 10, 10, 20, 20));
        
        let graph = tree.rebuild();
        expect(graph.vertices.size).toBe(4);
        expect(graph.edges.size).toBe(2);
        
        const editor = new FeatureEditor(tree);
        editor.deleteFeatures(new Set(['f1']));
        
        graph = tree.rebuild();
        
        // f1 is gone. Only f2 remains.
        expect(graph.vertices.size).toBe(2);
        expect(graph.edges.size).toBe(1);
        
        expect(graph.edges.has('f1_e0')).toBe(false);
        expect(graph.vertices.has('f1_v0')).toBe(false);
        expect(graph.edges.has('f2_e0')).toBe(true);
    });
});
