import { describe, it, expect } from 'vitest';
import { computeSegmentIntersectionT, getPointPenetrationT } from '../src/engine/core/graph';

describe('BigInt Segment Intersection & Point Penetration', () => {
    it('should correctly compute intersection T values for crossing lines', () => {
        // Line A: (0, 0) to (10000, 10000)
        // Line B: (0, 10000) to (10000, 0)
        const res = computeSegmentIntersectionT(
            0n, 0n, 10000n, 10000n,
            0n, 10000n, 10000n, 0n
        );
        
        expect(res).not.toBeNull();
        if (res) {
            // Validate that t1 is exactly 0.5 (represented as num * 2 === den)
            expect(res.t1.num * 2n).toBe(res.t1.den);
            // Validate that t2 is exactly 0.5
            expect(res.t2.num * 2n).toBe(res.t2.den);
        }
    });

    it('should correctly compute point penetration T on a segment', () => {
        // Segment: (0, 0) to (10000, 10000)
        // Point: (5000, 5000)
        const t = getPointPenetrationT(
            0n, 0n, 10000n, 10000n,
            5000n, 5000n
        );

        expect(t).not.toBeNull();
        if (t) {
            // Validate that t is exactly 0.5
            expect(t.num * 2n).toBe(t.den);
        }
    });
});
