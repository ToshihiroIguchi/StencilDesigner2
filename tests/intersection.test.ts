import { describe, it, expect } from 'vitest';
import { FeatureTree, LineFeature, TrimFeature } from '../src/engine/core/feature';
import { ToleranceManager } from '../src/engine/core/viewport';

describe('Intersection and Trim Engine', () => {
    it('should split crossing lines into 4 segments and 1 intersection point', () => {
        const tree = new FeatureTree();
        // Cross (+) centered at 0,0
        tree.addFeature(new LineFeature('f1', -10, 0, 10, 0)); // Horizontal
        tree.addFeature(new LineFeature('f2', 0, -10, 0, 10)); // Vertical
        
        const graph = tree.rebuild();
        
        // 4 endpoints + 1 intersection point = 5 vertices
        expect(graph.vertices.size).toBe(5);
        // 2 lines split into 2 each = 4 edges
        expect(graph.edges.size).toBe(4);
        
        // Check if intersection vertex (0, 0) exists
        let hasCenter = false;
        for (const v of graph.vertices.values()) {
            if (ToleranceManager.arePointsEqual(v.x!, v.y!, 0, 0)) {
                hasCenter = true;
                break;
            }
        }
        expect(hasCenter).toBe(true);
    });

    it('should remove targeted segment upon Trim', () => {
        const tree = new FeatureTree();
        tree.addFeature(new LineFeature('f1', -10, 0, 10, 0));
        tree.addFeature(new LineFeature('f2', 0, -10, 0, 10));
        
        // Trim right leg of the horizontal line (around x=5, y=0)
        tree.addFeature(new TrimFeature('t1', 5, 0));
        
        const graph = tree.rebuild();
        
        // After trim, 1 segment is removed -> 3 edges remain. (Makes a T-shape)
        expect(graph.edges.size).toBe(3);
        
        // Check endpoints to guarantee the right leg is missing.
        // The rightmost x should now be 0, not 10.
        let maxX = -Infinity;
        for (const edge of graph.edges.values()) {
            const v1 = graph.vertices.get(edge.u)!;
            const v2 = graph.vertices.get(edge.v)!;
            if (v1.x! > maxX) maxX = v1.x!;
            if (v2.x! > maxX) maxX = v2.x!;
        }
        expect(ToleranceManager.canonicalize(maxX)).toBe(0);
    });
});
