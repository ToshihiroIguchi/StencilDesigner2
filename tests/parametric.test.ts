import { describe, it, expect } from 'vitest';
import { FeatureTree, LineFeature, RectFeature } from '../src/engine/core/feature';
import { FeatureEditor } from '../src/engine/core/editing';

describe('Phase 4: Numerical Constraint & Precision', () => {
    it('should update Rect size with 1μm precision and rebuild graph', () => {
        const tree = new FeatureTree();
        const editor = new FeatureEditor(tree);
        const fId = 'test_rect';
        
        // Start with 10x10 rect
        tree.addFeature(new RectFeature(fId, 0, 0, 10, 10));
        let graph = tree.rebuild();
        
        expect(graph.vertices.size).toBe(4);
        
        // Update width to 25.123456789
        const newWidth = 25.123456789;
        editor.updateFeatureParameter(fId, 'width', newWidth);
        graph = tree.rebuild();
        
        // Find the vertex that should have moved (maxX)
        // 25.123456... mm should be 25123μm (BigInt)
        let maxX = -999999999n;
        for (const v of graph.vertices.values()) {
            if (v.x > maxX) maxX = v.x;
        }
        
        expect(maxX).toBe(25123n); 
    });

    it('should update Line length maintaining its angle', () => {
        const tree = new FeatureTree();
        const editor = new FeatureEditor(tree);
        const fId = 'test_line';
        
        // 45 degree line, length ~14.14
        tree.addFeature(new LineFeature(fId, 0, 0, 10, 10));
        
        editor.updateFeatureParameter(fId, 'length', 20);
        
        const line = tree.features[0] as any;
        const newLen = Math.hypot(line.x2 - line.x1, line.y2 - line.y1);
        expect(newLen).toBeCloseTo(20, 9);
        
        // Check angle preserved
        const angle = Math.atan2(line.y2 - line.y1, line.x2 - line.x1);
        expect(angle).toBeCloseTo(Math.PI / 4, 9);
    });

    it('should restore previous state when undoing a numerical update', () => {
        const tree = new FeatureTree();
        const editor = new FeatureEditor(tree);
        const fId = 'f_test';
        
        tree.addFeature(new RectFeature(fId, 0, 0, 10, 10)); // State 2 (State 1 is empty)
        
        // Update width
        editor.updateFeatureParameter(fId, 'width', 50, true); // State 3
        let rect = tree.features[0] as any;
        expect(Math.abs(rect.x2 - rect.x1)).toBe(50);
        
        // Undo
        const success = tree.undo();
        expect(success).toBe(true);
        
        rect = tree.features[0] as any;
        expect(Math.abs(rect.x2 - rect.x1)).toBe(10); // Should be back to 10
    });
});

