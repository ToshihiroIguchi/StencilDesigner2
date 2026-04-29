import { describe, it, expect } from 'vitest';
import { ViewTransform, worldToScreen, screenToWorld } from '../src/engine/core/viewport';

describe('Coordinate Transformation', () => {
    it('should accurately invert from Model to Screen and back to Model', () => {
        const view: ViewTransform = { offsetX: 500, offsetY: 300, scale: 0.1 };

        const originalModelX = 12345n; // μm
        const originalModelY = -9876n; // μm

        const screenPt = worldToScreen(originalModelX, originalModelY, view);
        const resultModel = screenToWorld(screenPt.sx, screenPt.sy, view);

        expect(resultModel.x).toBe(originalModelX);
        expect(resultModel.y).toBe(originalModelY);
    });
    
    it('should correctly map Y-up to Y-down', () => {
        const view: ViewTransform = { offsetX: 0, offsetY: 0, scale: 0.1 };
        
        // 1000μm = 1mm. At scale 0.1 (px per μm), it should be 100px.
        const screenPt = worldToScreen(1000n, 1000n, view);
        expect(screenPt.sx).toBe(100);
        // y is inverted in screen space: offsetY - (y * scale) -> 0 - 100 = -100
        expect(screenPt.sy).toBe(-100); 
    });
});
