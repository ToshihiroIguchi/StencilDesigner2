import { describe, it, expect } from 'vitest';
import { ModelGraph, LinearSpatialIndex } from '../src/engine/core/graph';
import { computeDLST, extractFundamentalCircuits, analyzeDOF, validateLamanGraph } from '../src/engine/core/planner';

// ヘルパー関数: 決定的なIDを持つモックデータを挿入
function addMockVertex(graph: ModelGraph, spatial: LinearSpatialIndex, id: string) {
    graph.vertices.set(id, { id, x: 0n, y: 0n, orderedEdges: [], isDeleted: false });
    spatial.insertVertex(id);
}
function addMockEdge(graph: ModelGraph, spatial: LinearSpatialIndex, id: string, v1: string, v2: string) {
    graph.edges.set(id, { id, v1, v2 });
    spatial.insertEdge(id);
}

describe('StencilDesigner2 Logic Core', () => {
    
    describe('ModelGraph', () => {
        it('should create vertices and edges', () => {
            const graph = new ModelGraph();
            const spatial = new LinearSpatialIndex(graph);
            addMockVertex(graph, spatial, 'v1');
            addMockVertex(graph, spatial, 'v2');
            addMockEdge(graph, spatial, 'e1', 'v1', 'v2');
            
            expect(graph.vertices.size).toBe(2);
            expect(graph.edges.size).toBe(1);
        });
    });

    describe('DLST Strategy', () => {
        it('should generate deterministic spanning tree for same input', () => {
            const createTestGraph = () => {
                const graph = new ModelGraph();
                const spatial = new LinearSpatialIndex(graph);
                addMockVertex(graph, spatial, 'v3');
                addMockVertex(graph, spatial, 'v1');
                addMockVertex(graph, spatial, 'v2');
                addMockEdge(graph, spatial, 'e2', 'v2', 'v3');
                addMockEdge(graph, spatial, 'e1', 'v1', 'v2');
                addMockEdge(graph, spatial, 'e3', 'v1', 'v3');
                return graph;
            };

            const g1 = createTestGraph();
            const dlst1 = computeDLST(g1);
            
            const g2 = createTestGraph();
            const dlst2 = computeDLST(g2);
            
            expect(dlst1).toEqual(dlst2);
            expect(Array.from(dlst1).sort()).toEqual(['e1', 'e2']);
        });
    });

    describe('Fundamental Circuit Extraction', () => {
        it('should extract circuits precisely', () => {
            const graph = new ModelGraph();
            const spatial = new LinearSpatialIndex(graph);
            addMockVertex(graph, spatial, 'A');
            addMockVertex(graph, spatial, 'B');
            addMockVertex(graph, spatial, 'C');
            addMockEdge(graph, spatial, 'e1', 'A', 'B');
            addMockEdge(graph, spatial, 'e2', 'B', 'C');
            addMockEdge(graph, spatial, 'e3', 'C', 'A');

            const treeEdges = new Set(['e1', 'e2']);
            const circuits = extractFundamentalCircuits(graph, treeEdges);
            
            expect(circuits).toHaveLength(1);
            // findPathInTree returns vertex IDs: ['C', 'B', 'A'] or similar
            expect(circuits[0]).toContain('A');
            expect(circuits[0]).toContain('B');
            expect(circuits[0]).toContain('C');
        });
    });

    describe('DOF Analyzer & Laman Graph Validation', () => {
        it('should correctly evaluate standard triangle rigid body', () => {
            const graph = new ModelGraph();
            const spatial = new LinearSpatialIndex(graph);
            addMockVertex(graph, spatial, 'A');
            addMockVertex(graph, spatial, 'B');
            addMockVertex(graph, spatial, 'C');
            addMockEdge(graph, spatial, 'e1', 'A', 'B');
            addMockEdge(graph, spatial, 'e2', 'B', 'C');
            addMockEdge(graph, spatial, 'e3', 'C', 'A');
            
            const analysis = analyzeDOF(graph);
            expect(analysis.dof).toBe(3);
            expect(analysis.isWellConstrained).toBe(true);
            expect(validateLamanGraph(graph)).toBe(true);
        });

        it('should identify underconstrained graph', () => {
            const graph = new ModelGraph();
            const spatial = new LinearSpatialIndex(graph);
            addMockVertex(graph, spatial, 'A');
            addMockVertex(graph, spatial, 'B');
            addMockVertex(graph, spatial, 'C');
            addMockEdge(graph, spatial, 'e1', 'A', 'B');
            
            const analysis = analyzeDOF(graph);
            expect(analysis.isUnderConstrained).toBe(true);
            expect(validateLamanGraph(graph)).toBe(false);
        });

        it('should identify overconstrained graph', () => {
            const graph = new ModelGraph();
            const spatial = new LinearSpatialIndex(graph);
            addMockVertex(graph, spatial, 'A');
            addMockVertex(graph, spatial, 'B');
            addMockVertex(graph, spatial, 'C');
            addMockEdge(graph, spatial, 'e1', 'A', 'B');
            addMockEdge(graph, spatial, 'e2', 'B', 'C');
            addMockEdge(graph, spatial, 'e3', 'C', 'A');
            addMockEdge(graph, spatial, 'e4', 'A', 'B');
            
            const analysis = analyzeDOF(graph);
            expect(analysis.isOverConstrained).toBe(true);
            expect(validateLamanGraph(graph)).toBe(false);
        });

        it('should identify overconstrained subgraph within a larger structure', () => {
            const graph = new ModelGraph();
            const spatial = new LinearSpatialIndex(graph);
            addMockVertex(graph, spatial, 'A');
            addMockVertex(graph, spatial, 'B');
            addMockVertex(graph, spatial, 'C');
            addMockVertex(graph, spatial, 'D');
            addMockEdge(graph, spatial, 'e1', 'A', 'B');
            addMockEdge(graph, spatial, 'e2', 'B', 'C');
            addMockEdge(graph, spatial, 'e3', 'C', 'A');
            addMockEdge(graph, spatial, 'e4', 'A', 'B');
            
            const analysis = analyzeDOF(graph);
            expect(analysis.isOverConstrained).toBe(true);
            expect(validateLamanGraph(graph)).toBe(false);
        });
    });
});
