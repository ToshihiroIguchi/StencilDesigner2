import makerjs from 'makerjs';
import { ModelGraph } from './graph';
import { ToleranceManager } from './viewport';

/**
 * Maker.js based Intersection Engine
 * Enforces topological integrity by evaluating all path intersections,
 * and splitting edges into segments connected by precise vertices.
 */
export class IntersectionEngine {
    
    /**
     * Splits all intersecting edges in the graph.
     * Original edges are removed and replaced with split segments using the original ID suffix.
     * Runs in O(E^2) time complexity. Can be optimized by spatial hashing later if needed.
     */
    static splitAllIntersections(graph: ModelGraph): void {
        const edges = Array.from(graph.edges.values());
        
        // Maps edge ID to a set of split points (using canonical string keys to avoid duplicates)
        const splitsByEdge = new Map<string, Array<{x: number, y: number}>>();

        // Find intersections
        for (let i = 0; i < edges.length; i++) {
            for (let j = i + 1; j < edges.length; j++) {
                const e1 = edges[i];
                const e2 = edges[j];
                
                const p1 = graph.vertices.get(e1.u)!;
                const p2 = graph.vertices.get(e1.v)!;
                const p3 = graph.vertices.get(e2.u)!;
                const p4 = graph.vertices.get(e2.v)!;
                
                if (p1.x == null || p1.y == null || p2.x == null || p2.y == null || 
                    p3.x == null || p3.y == null || p4.x == null || p4.y == null) continue;

                const path1 = new makerjs.paths.Line([p1.x, p1.y], [p2.x, p2.y]);
                const path2 = new makerjs.paths.Line([p3.x, p3.y], [p4.x, p4.y]);

                const intersection = makerjs.path.intersection(path1, path2);
                if (intersection && intersection.intersectionPoints) {
                    for (const pt of intersection.intersectionPoints) {
                        const cx = ToleranceManager.canonicalize(pt[0]);
                        const cy = ToleranceManager.canonicalize(pt[1]);
                        
                        this.addSplit(splitsByEdge, e1.id, {x: cx, y: cy});
                        this.addSplit(splitsByEdge, e2.id, {x: cx, y: cy});
                    }
                }
            }
        }

        // Apply splits
        for (const [edgeId, splits] of splitsByEdge.entries()) {
            const edge = graph.edges.get(edgeId);
            if (!edge) continue;

            const u = graph.vertices.get(edge.u)!;
            const v = graph.vertices.get(edge.v)!;
            
            // Sort splits by distance from start vertex 'u'
            splits.sort((a, b) => {
                const da = Math.hypot(a.x - u.x!, a.y - u.y!);
                const db = Math.hypot(b.x - u.x!, b.y - u.y!);
                return da - db;
            });

            // Filter out splits that are virtually identical to endpoints or each other
            const validSplits: Array<{x: number, y: number}> = [];
            for (const s of splits) {
                const isNearStart = ToleranceManager.arePointsEqual(s.x, s.y, u.x!, u.y!);
                const isNearEnd = ToleranceManager.arePointsEqual(s.x, s.y, v.x!, v.y!);
                
                if (!isNearStart && !isNearEnd) {
                    // Check against last valid split
                    if (validSplits.length > 0) {
                        const last = validSplits[validSplits.length - 1];
                        if (ToleranceManager.arePointsEqual(s.x, s.y, last.x, last.y)) continue;
                    }
                    validSplits.push(s);
                }
            }

            if (validSplits.length === 0) continue;

            // Remove original edge
            graph.edges.delete(edgeId);

            // Rebuild as segments
            let currentVertexId = edge.u;
            for (let i = 0; i < validSplits.length; i++) {
                const s = validSplits[i];
                const newVertexId = `${edgeId}_split_${i}`;
                
                // We must use ToleranceManager for actual vertex ID if overlap exists
                // Look up if vertex exists at this coord
                let actualVid = newVertexId;
                for (const [vid, vData] of graph.vertices.entries()) {
                    if (vData.x != null && vData.y != null && ToleranceManager.arePointsEqual(vData.x, vData.y, s.x, s.y)) {
                        actualVid = vid;
                        break;
                    }
                }
                if (actualVid === newVertexId) {
                    graph.addVertex(actualVid, s.x, s.y);
                }

                graph.addEdge(`${edgeId}_s${i}`, currentVertexId, actualVid);
                currentVertexId = actualVid;
            }
            // Final segment
            graph.addEdge(`${edgeId}_s${validSplits.length}`, currentVertexId, edge.v);
        }
    }

    private static addSplit(map: Map<string, Array<{x:number, y:number}>>, edgeId: string, pt: {x:number, y:number}) {
        if (!map.has(edgeId)) map.set(edgeId, []);
        map.get(edgeId)!.push(pt);
    }
}
