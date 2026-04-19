import { describe, it, expect } from 'vitest';
import { ModelGraph } from '../src/engine/core/graph';
import { SnapEngine } from '../src/engine/core/snap';
import { CoordinateTransformer, ViewState } from '../src/engine/core/viewport';

describe('Snap Engine Tolerance & Logic', () => {
    it('should perfectly snap to Endpoint within tolerance', () => {
        const graph = new ModelGraph();
        graph.addVertex('v1', 10.0, 10.0);
        
        const viewState = new ViewState(0, 0, 10); // 10px = 1mm
        const transformer = new CoordinateTransformer(viewState);
        const engine = new SnapEngine(graph, transformer, viewState);

        // Near endpoint. Model pt roughly 9.5, 9.8.
        // Screen radius is default 10px -> 1mm model radius
        const screenPt = transformer.modelToScreen(9.9, 9.9);
        const res = engine.snap(screenPt.x, screenPt.y, 10);
        
        expect(res.type).toBe('endpoint');
        expect(res.modelPt.x).toBe(10.0);
        expect(res.modelPt.y).toBe(10.0);
        
        expect(Math.abs(res.modelPt.x - 10.0)).toBeLessThan(1e-5);
    });

    it('should snap to Midpoint if Endpoint is too far', () => {
        const graph = new ModelGraph();
        graph.addVertex('v1', 0, 0);
        graph.addVertex('v2', 10, 0);
        graph.addEdge('e1', 'v1', 'v2');
        
        const viewState = new ViewState(0, 0, 10);
        const transformer = new CoordinateTransformer(viewState);
        const engine = new SnapEngine(graph, transformer, viewState);

        const screenPt = transformer.modelToScreen(4.8, 0.1);
        const res = engine.snap(screenPt.x, screenPt.y, 10);
        
        expect(res.type).toBe('midpoint');
        expect(res.modelPt.x).toBe(5.0);
        expect(res.modelPt.y).toBe(0.0);
    });
});
