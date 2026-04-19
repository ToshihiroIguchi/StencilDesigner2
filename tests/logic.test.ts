import { describe, it, expect } from 'vitest';
import { ModelGraph } from '../src/engine/core/graph';
import { computeDLST, extractFundamentalCircuits, analyzeDOF, validateLamanGraph } from '../src/engine/core/planner';

describe('StencilDesigner2 Logic Core', () => {
    
    describe('ModelGraph', () => {
        it('should create vertices and edges', () => {
            const graph = new ModelGraph();
            graph.addVertex('v1');
            graph.addVertex('v2');
            graph.addEdge('e1', 'v1', 'v2');
            
            expect(graph.vertices.size).toBe(2);
            expect(graph.edges.size).toBe(1);
            expect(graph.getAdjacentVertices('v1')).toEqual(['v2']);
        });
    });

    describe('DLST Strategy', () => {
        it('should generate deterministic spanning tree for same input', () => {
            const createTestGraph = () => {
                const graph = new ModelGraph();
                graph.addVertex('v3');
                graph.addVertex('v1');
                graph.addVertex('v2');
                graph.addEdge('e2', 'v2', 'v3');
                graph.addEdge('e1', 'v1', 'v2');
                graph.addEdge('e3', 'v1', 'v3');
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
            graph.addVertex('A');
            graph.addVertex('B');
            graph.addVertex('C');
            graph.addEdge('e1', 'A', 'B');
            graph.addEdge('e2', 'B', 'C');
            graph.addEdge('e3', 'C', 'A');

            const treeEdges = new Set(['e1', 'e2']);
            const circuits = extractFundamentalCircuits(graph, treeEdges);
            
            expect(circuits).toHaveLength(1);
            expect(circuits[0]).toEqual(['C', 'B', 'A']);
        });
    });

    describe('DOF Analyzer & Laman Graph Validation', () => {
        it('should correctly evaluate standard triangle rigid body', () => {
            const graph = new ModelGraph();
            graph.addVertex('A');
            graph.addVertex('B');
            graph.addVertex('C');
            graph.addEdge('e1', 'A', 'B');
            graph.addEdge('e2', 'B', 'C');
            graph.addEdge('e3', 'C', 'A');
            
            const analysis = analyzeDOF(graph);
            expect(analysis.dof).toBe(3);
            expect(analysis.isWellConstrained).toBe(true);
            expect(validateLamanGraph(graph)).toBe(true);
        });

        it('should identify underconstrained graph', () => {
            const graph = new ModelGraph();
            graph.addVertex('A');
            graph.addVertex('B');
            graph.addVertex('C');
            graph.addEdge('e1', 'A', 'B');
            
            const analysis = analyzeDOF(graph);
            expect(analysis.isUnderConstrained).toBe(true);
            expect(validateLamanGraph(graph)).toBe(false);
        });

        it('should identify overconstrained graph', () => {
            const graph = new ModelGraph();
            graph.addVertex('A');
            graph.addVertex('B');
            graph.addVertex('C');
            graph.addEdge('e1', 'A', 'B');
            graph.addEdge('e2', 'B', 'C');
            graph.addEdge('e3', 'C', 'A');
            graph.addEdge('e4', 'A', 'B');
            
            const analysis = analyzeDOF(graph);
            expect(analysis.isOverConstrained).toBe(true);
            expect(validateLamanGraph(graph)).toBe(false);
        });

        it('should identify overconstrained subgraph within a larger structure', () => {
            const graph = new ModelGraph();
            graph.addVertex('A');
            graph.addVertex('B');
            graph.addVertex('C');
            graph.addVertex('D');
            // Overconstrained triangle A-B-C (4 edges)
            graph.addEdge('e1', 'A', 'B');
            graph.addEdge('e2', 'B', 'C');
            graph.addEdge('e3', 'C', 'A');
            graph.addEdge('e4', 'A', 'B'); // duplicate
            // D is floating but total edges for 4 vertices: 2(4)-3 = 5 edges. We have 4.
            // Underconstrained globally, but overconstrained locally.
            const analysis = analyzeDOF(graph);
            expect(analysis.isOverConstrained).toBe(true);
            expect(validateLamanGraph(graph)).toBe(false);
        });
    });
});
