import { describe, it, expect } from 'vitest';
import { ModelGraph, createRawVertex, createRawEdge, LinearSpatialIndex } from '../src/engine/core/graph';
import { resolveSnapToVertex } from '../src/engine/core/snap';

describe('Snap Engine Tolerance & Logic', () => {
    it('should perfectly snap to Endpoint within tolerance', () => {
        const graph = new ModelGraph();
        const spatial = new LinearSpatialIndex(graph);
        
        // 10mm coordinates
        createRawVertex(graph, spatial, 10000n, 10000n);
        
        // Search near the vertex
        const res = resolveSnapToVertex(graph, 9900n, 9900n, 500n, 5000n);
        
        expect(res.type).toBe('endpoint');
        expect(res.worldX).toBe(10000n);
        expect(res.worldY).toBe(10000n);
    });

    it('should snap to Midpoint if Endpoint is too far', () => {
        const graph = new ModelGraph();
        const spatial = new LinearSpatialIndex(graph);
        
        const v1 = createRawVertex(graph, spatial, 0n, 0n);
        const v2 = createRawVertex(graph, spatial, 10000n, 0n);
        createRawEdge(graph, spatial, v1, v2);
        
        // Search near the midpoint (5000n, 0n)
        const res = resolveSnapToVertex(graph, 4900n, 100n, 500n, 5000n);
        
        expect(res.type).toBe('midpoint');
        expect(res.worldX).toBe(5000n);
        expect(res.worldY).toBe(0n);
    });
});
