import { describe, it, expect } from 'vitest';
import { FeatureTree, LineFeature, RectFeature } from '../src/engine/core/feature';
import { FeatureEditor } from '../src/engine/core/editing';
import { ToleranceManager } from '../src/engine/core/viewport';

describe('Phase 4: Numerical Constraint & Precision', () => {
    it('should update Rect size and rebuild graph', () => {
        const tree = new FeatureTree();
        const editor = new FeatureEditor(tree);
        const fId = 'test_rect';
        
        // Start with 10x10 rect
        tree.addFeature(new RectFeature(fId, 0n, 0n, 10000n, 10000n));
        let graph = tree.rebuild();
        
        expect(graph.vertices.size).toBe(4);
        
        // Update width to 25.123
        const newWidth = 25.123;
        editor.updateFeatureParameter(fId, 'width', newWidth);
        graph = tree.rebuild();
        
        // Truth check
        const rect = tree.features[0] as any;
        const widthMm = ToleranceManager.unitsToMm(rect.x2 - rect.x1);
        expect(Math.abs(widthMm)).toBeCloseTo(newWidth, 6);
    });

    it('should update Line length maintaining its angle', () => {
        const tree = new FeatureTree();
        const editor = new FeatureEditor(tree);
        const fId = 'test_line';
        
        // 45 degree line
        tree.addFeature(new LineFeature(fId, 0n, 0n, 10000n, 10000n));
        
        editor.updateFeatureParameter(fId, 'length', 20.0);
        
        const line = tree.features[0] as any;
        const lengthMm = Math.hypot(
            ToleranceManager.unitsToMm(line.x2 - line.x1),
            ToleranceManager.unitsToMm(line.y2 - line.y1)
        );
        expect(lengthMm).toBeCloseTo(20.0, 3); // 1µm grid causes ~0.0002mm variance on diagonals
        
        const angle = Math.atan2(Number(line.y2 - line.y1), Number(line.x2 - line.x1));
        expect(angle).toBeCloseTo(Math.PI / 4, 6);
    });

    it('should restore previous state when undoing a numerical update', () => {
        const tree = new FeatureTree();
        const editor = new FeatureEditor(tree);
        const fId = 'f_test';
        
        tree.addFeature(new RectFeature(fId, 0n, 0n, 10000n, 10000n));
        
        editor.updateFeatureParameter(fId, 'width', 50.0, true);
        const rectUpdated = tree.features[0] as any;
        expect(ToleranceManager.unitsToMm(rectUpdated.x2 - rectUpdated.x1)).toBe(50.0);
        
        tree.undo();
        const rectRestored = tree.features[0] as any;
        expect(ToleranceManager.unitsToMm(rectRestored.x2 - rectRestored.x1)).toBe(10.0);
    });
});

