import { describe, it, expect } from 'vitest';
import { FeatureTree, LineFeature, FilletFeature } from '../src/engine/core/feature';

describe('Fillet Engine', () => {
    it('should insert an arc approximation and replace the corner vertex', () => {
        const tree = new FeatureTree();
        // L-shape meeting at 0,0
        tree.addFeature(new LineFeature('f1', 10, 0, 0, 0)); 
        tree.addFeature(new LineFeature('f2', 0, 0, 0, 10)); 
        
        let graph = tree.rebuild();
        expect(graph.vertices.size).toBe(3); // (10,0), (0,0), (0,10)
        
        // Add fillet at origin with radius 2mm
        tree.addFeature(new FilletFeature('fillet1', 0, 0, 2));
        
        graph = tree.rebuild();
        
        // Corner (0,0) was deleted, two arc tangent points added -> total 4 vertices
        expect(graph.vertices.size).toBe(4);
        
        // Ensure the origin (0,0) is gone
        for (const v of graph.vertices.values()) {
            expect(v.x === 0n && v.y === 0n).toBe(false);
        }
        
        // There should be 3 edges now: shortened f1, shortened f2, and 1 approximating segment
        expect(graph.edges.size).toBe(3);
        
        const coords = Array.from(graph.vertices.values()).map(v => ({ x: v.x, y: v.y }));
        expect(coords).toContainEqual({ x: 10000n, y: 0n });
        expect(coords).toContainEqual({ x: 2000n, y: 0n });
        expect(coords).toContainEqual({ x: 0n, y: 2000n });
        expect(coords).toContainEqual({ x: 0n, y: 10000n });
    });
});
