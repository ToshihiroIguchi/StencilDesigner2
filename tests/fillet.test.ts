import { describe, it, expect } from 'vitest';
import { FeatureTree, LineFeature } from '../src/engine/core/feature';
import { FilletFeature } from '../src/engine/core/fillet';
import { ToleranceManager } from '../src/engine/core/viewport';

describe('Fillet Engine', () => {
    it('should insert an arc and replace the corner vertex', () => {
        const tree = new FeatureTree();
        // L-shape meeting at 0,0
        tree.addFeature(new LineFeature('f1', 10, 0, 0, 0)); 
        tree.addFeature(new LineFeature('f2', 0, 0, 0, 10)); 
        
        let graph = tree.rebuild();
        expect(graph.vertices.size).toBe(3); // (10,0), (0,0), (0,10)
        
        // Add fillet at origin with radius 2
        tree.addFeature(new FilletFeature('fillet1', 0, 0, 2));
        
        graph = tree.rebuild();
        
        // Corner was deleted (-1), two arc tangent points added (+2) -> total 4 vertices
        expect(graph.vertices.size).toBe(4);
        
        // Ensure the origin (0,0) is gone
        let hasOrigin = false;
        for (const v of graph.vertices.values()) {
            if (ToleranceManager.arePointsEqual(v.x!, v.y!, 0, 0)) {
                hasOrigin = true;
            }
        }
        expect(hasOrigin).toBe(false);
        
        // There should be 3 edges now: shortened f1, shortened f2, and 1 arc
        expect(graph.edges.size).toBe(3);
        
        const edges = Array.from(graph.edges.values());
        const arcs = edges.filter(e => e.arcData != null);
        expect(arcs.length).toBe(1);
        
        const arc = arcs[0];
        // The arc origin for an L-shape at (0,0) along +X and +Y with radius 2 should be (2, 2)
        expect(ToleranceManager.canonicalize(arc.arcData!.origin[0])).toBe(2);
        expect(ToleranceManager.canonicalize(arc.arcData!.origin[1])).toBe(2);
    });
});
