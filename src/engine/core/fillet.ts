import makerjs from 'makerjs';
import type { Feature, FeatureId } from './feature';
import { ModelGraph } from './graph';
import type { VertexId } from './graph';
import { ToleranceManager } from './viewport';
import type { ModelUnits } from './viewport';

export class FilletFeature implements Feature {
    constructor(
        public id: FeatureId,
        public targetX: ModelUnits,
        public targetY: ModelUnits,
        public radius: number
    ) {}

    type: 'Fillet' = 'Fillet' as any;
    
    generateTopology(_graph: ModelGraph): void {
    }

    applyFillet(graph: ModelGraph): void {
        const threshold = ToleranceManager.mmToUnits(5.0); // 5mm click tolerance
        const thresholdSq = threshold * threshold;
        
        let bestDistSq = thresholdSq;
        let targetVid: VertexId | null = null;
        
        for (const [vid, v] of graph.vertices.entries()) {
            if (v.x === undefined || v.y === undefined) continue;
            const dx = v.x - this.targetX;
            const dy = v.y - this.targetY;
            const dSq = dx * dx + dy * dy;
            if (dSq <= bestDistSq) {
                bestDistSq = dSq;
                targetVid = vid;
            }
        }
        
        if (!targetVid) return;

        const incidentEdges = Array.from(graph.edges.values()).filter(e => e.u === targetVid || e.v === targetVid);
        
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

        if (!vOther1 || !vOther2 || !vCorner || vOther1.x === undefined || vCorner.x === undefined || vOther2.x === undefined) return;

        // Maker.js uses standard number (mm)
        const line1 = new makerjs.paths.Line(
            [ToleranceManager.unitsToMm(vOther1.x), ToleranceManager.unitsToMm(vOther1.y)], 
            [ToleranceManager.unitsToMm(vCorner.x), ToleranceManager.unitsToMm(vCorner.y)]
        );
        const line2 = new makerjs.paths.Line(
            [ToleranceManager.unitsToMm(vCorner.x), ToleranceManager.unitsToMm(vCorner.y)], 
            [ToleranceManager.unitsToMm(vOther2.x), ToleranceManager.unitsToMm(vOther2.y)]
        );

        try {
            const arc = makerjs.path.fillet(line1, line2, this.radius) as any;
            if (!arc) return; 

            const arcPoints = makerjs.point.fromArc(arc);
            if (!arcPoints || arcPoints.length < 2) return;

            const ptA = { 
                x: ToleranceManager.mmToUnits(arcPoints[0][0]), 
                y: ToleranceManager.mmToUnits(arcPoints[0][1]) 
            };
            const ptB = { 
                x: ToleranceManager.mmToUnits(arcPoints[1][0]), 
                y: ToleranceManager.mmToUnits(arcPoints[1][1]) 
            };

            const distSqToLine1 = (p: {x:ModelUnits, y:ModelUnits}) => 
                this.distToSegmentUnitsSq(p, 
                    {x: vOther1.x!, y: vOther1.y!}, 
                    {x: vCorner.x!, y: vCorner.y!}
                );

            let ptForE1 = ptA;
            let ptForE2 = ptB;
            
            if (distSqToLine1(ptB) < distSqToLine1(ptA)) {
                ptForE1 = ptB;
                ptForE2 = ptA;
            }

            const vArc1Id = `${this.id}_arc_v0`;
            const vArc2Id = `${this.id}_arc_v1`;
            
            graph.addVertex(vArc1Id, ptForE1.x, ptForE1.y);
            graph.addVertex(vArc2Id, ptForE2.x, ptForE2.y);

            if (e1.u === targetVid) e1.u = vArc1Id; else e1.v = vArc1Id;
            if (e2.u === targetVid) e2.u = vArc2Id; else e2.v = vArc2Id;

            const arcEdgeId = `${this.id}_arc_e`;
            graph.addEdge(arcEdgeId, vArc1Id, vArc2Id);
            
            const newArcEdge = graph.edges.get(arcEdgeId)!;
            newArcEdge.arcData = {
                origin: [
                    ToleranceManager.mmToUnits(arc.origin[0]), 
                    ToleranceManager.mmToUnits(arc.origin[1])
                ],
                radius: ToleranceManager.mmToUnits(arc.radius),
                startAngle: arc.startAngle,
                endAngle: arc.endAngle
            };
            
            graph.vertices.delete(targetVid);
            
        } catch (err) {
            console.error('[FilletFeature] Geometric processing failed', err);
        }
    }

    private distToSegmentUnitsSq(p: {x:ModelUnits, y:ModelUnits}, v: {x:ModelUnits, y:ModelUnits}, w: {x:ModelUnits, y:ModelUnits}): bigint {
        const l2 = (v.x - w.x) * (v.x - w.x) + (v.y - w.y) * (v.y - w.y);
        if (l2 === 0n) return (p.x - v.x) * (p.x - v.x) + (p.y - v.y) * (p.y - v.y);
        const dot = (p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y);
        if (dot <= 0n) return (p.x - v.x) * (p.x - v.x) + (p.y - v.y) * (p.y - v.y);
        if (dot >= l2) return (p.x - w.x) * (p.x - w.x) + (p.y - w.y) * (p.y - w.y);
        const distSqV = (p.x - v.x) * (p.x - v.x) + (p.y - v.y) * (p.y - v.y);
        return distSqV - (dot * dot) / l2;
    }
}
