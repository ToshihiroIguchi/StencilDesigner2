import { describe, it, expect } from 'vitest';
import { FeatureTree, LineFeature, RectFeature } from '../src/engine/core/feature';

describe('FeatureTree History', () => {
    it('should undo and redo feature additions', () => {
        const tree = new FeatureTree();
        
        // Initial state: empty
        expect(tree.features.length).toBe(0);
        
        tree.addFeature(new LineFeature('f1', 0, 0, 10, 10));
        expect(tree.features.length).toBe(1);
        
        tree.addFeature(new RectFeature('f2', 10, 10, 20, 20));
        expect(tree.features.length).toBe(2);
        
        // Undo f2
        tree.undo();
        expect(tree.features.length).toBe(1);
        expect(tree.features[0].id).toBe('f1');
        
        // Undo f1
        tree.undo();
        expect(tree.features.length).toBe(0);
        
        // Redo f1
        tree.redo();
        expect(tree.features.length).toBe(1);
        expect(tree.features[0].id).toBe('f1');
        
        // Redo f2
        tree.redo();
        expect(tree.features.length).toBe(2);
        expect(tree.features[1].id).toBe('f2');
    });

    it('should truncate redo stack on new action after undo', () => {
        const tree = new FeatureTree();
        tree.addFeature(new LineFeature('f1', 0, 0, 10, 10));
        tree.addFeature(new LineFeature('f2', 0, 0, 20, 20));
        
        tree.undo(); // back to f1
        tree.addFeature(new LineFeature('f3', 0, 0, 30, 30));
        
        // Redo should be impossible
        const canRedo = tree.redo();
        expect(canRedo).toBe(false);
        expect(tree.features.length).toBe(2);
        expect(tree.features[1].id).toBe('f3');
    });
});
