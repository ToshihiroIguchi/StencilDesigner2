import makerjs from 'makerjs';
import type { Feature, FeatureId } from './feature';
import { ModelGraph } from './graph';
import type { VertexId } from './graph';
import { ToleranceManager } from './viewport';

export class FilletFeature implements Feature {
    constructor(
        public id: FeatureId,
        public targetX: number,
        public targetY: number,
        public radius: number
    ) {}

    type: 'Fillet' = 'Fillet' as any; // Type trick to bypass Feature interface union (will update Interface too)
    
    generateTopology(graph: ModelGraph): void {
        // Empty by design: Applied in post-processing like Trim
    }

    applyFillet(graph: ModelGraph): void {
        const threshold = 5.0; // Click tolerance to find the vertex
        
        // 1. Find the target vertex
        let bestDist = Infinity;
        let targetVid: VertexId | null = null;
        
        for (const [vid, v] of graph.vertices.entries()) {
            if (v.x == null || v.y == null) continue;
            const dist = Math.hypot(v.x - this.targetX, v.y - this.targetY);
            if (dist <= threshold && dist < bestDist) {
                bestDist = dist;
                targetVid = vid;
            }
        }
        
        if (!targetVid) return;

        // 2. Find edges incident to the vertex
        const incidentEdges = Array.from(graph.edges.values()).filter(e => e.u === targetVid || e.v === targetVid);
        
        // Academic & Engineering Grounding: 
        // Filleting typically requires exactly 2 incident edges forming an angle.
        // Complex manifolds (degree > 2) are outside the scope of simple 2D fillets.
        if (incidentEdges.length !== 2) {
            console.warn(`[FilletFeature] Topologic limitation: Vertex degree must be exactly 2. Found ${incidentEdges.length}.`);
            return;
        }

        const e1 = incidentEdges[0];
        const e2 = incidentEdges[1];

        const getOtherVertex = (edge: any, vId: string) => edge.u === vId ? graph.vertices.get(edge.v) : graph.vertices.get(edge.u);
        const vOther1 = getOtherVertex(e1, targetVid);
        const vOther2 = getOtherVertex(e2, targetVid);
        const vCorner = graph.vertices.get(targetVid);

        if (!vOther1 || !vOther2 || !vCorner || vOther1.x == null || vCorner.x == null || vOther2.x == null) return;

        // 3. Mathematical modeling using Maker.js API
        const line1 = new makerjs.paths.Line([vOther1.x, vOther1.y], [vCorner.x, vCorner.y]);
        const line2 = new makerjs.paths.Line([vCorner.x, vCorner.y], [vOther2.x, vOther2.y]);

        try {
            const arc = makerjs.path.fillet(line1, line2, this.radius) as any;
            if (!arc) return; // Lines might be collinear or radius too large

            // 4. Extract precision topological trim points
            const arcPoints = makerjs.point.fromArc(arc);
            if (!arcPoints || arcPoints.length < 2) return;

            const ptA = { x: ToleranceManager.canonicalize(arcPoints[0][0]), y: ToleranceManager.canonicalize(arcPoints[0][1]) };
            const ptB = { x: ToleranceManager.canonicalize(arcPoints[1][0]), y: ToleranceManager.canonicalize(arcPoints[1][1]) };

            // Determine which point belongs to which edge
            // A line from Other to Corner: ptA or ptB is closer to line1? 
            // Maker.js usually aligns ptA with line1 and ptB with line2 depending on initialization.
            // Let's explicitly check distance.
            const distToLine1 = (pt: {x:number, y:number}) => this.distToSegment(pt, vOther1 as any, vCorner as any);
            const distToLine2 = (pt: {x:number, y:number}) => this.distToSegment(pt, vOther2 as any, vCorner as any);

            let ptForE1 = ptA;
            let ptForE2 = ptB;
            
            if (distToLine1(ptB) < distToLine1(ptA)) {
                ptForE1 = ptB;
                ptForE2 = ptA;
            }

            // 5. Rebuild Graph Topology
            const vArc1Id = `${this.id}_arc_v0`;
            const vArc2Id = `${this.id}_arc_v1`;
            
            graph.addVertex(vArc1Id, ptForE1.x, ptForE1.y);
            graph.addVertex(vArc2Id, ptForE2.x, ptForE2.y);

            // Shave e1 back
            if (e1.u === targetVid) e1.u = vArc1Id; else e1.v = vArc1Id;
            // Shave e2 back
            if (e2.u === targetVid) e2.u = vArc2Id; else e2.v = vArc2Id;

            // Insert Arc edge
            const arcEdgeId = `${this.id}_arc_e`;
            graph.addEdge(arcEdgeId, vArc1Id, vArc2Id);
            
            // Assign mathematical arc data for Canvas usage
            const newArcEdge = graph.edges.get(arcEdgeId)!;
            newArcEdge.arcData = {
                origin: arc.origin,
                radius: arc.radius,
                startAngle: arc.startAngle,
                endAngle: arc.endAngle
            };
            
            // Clean up old corner vertex
            graph.vertices.delete(targetVid);
            
        } catch (err) {
            console.error('[FilletFeature] Geometric processing failed', err);
        }
    }

    private distToSegment(p: {x:number, y:number}, v: {x:number, y:number}, w: {x:number, y:number}) {
        const l2 = Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2);
        if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
        let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
    }
}
