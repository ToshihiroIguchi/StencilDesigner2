import { describe, it, expect } from 'vitest';
import { ViewState, CoordinateTransformer } from '../src/engine/core/viewport';

describe('Coordinate Transformation', () => {
    it('should accurately invert from Model to Screen and back to Model', () => {
        const viewState = new ViewState(500, 300, 25.5);
        const transformer = new CoordinateTransformer(viewState);

        const originalModelX = 12.345678;
        const originalModelY = -9.876543;

        const screenStr = transformer.modelToScreen(originalModelX, originalModelY);
        
        const resultModel = transformer.screenToModel(screenStr.x, screenStr.y);

        expect(Math.abs(resultModel.x - originalModelX)).toBeLessThan(1e-5);
        expect(Math.abs(resultModel.y - originalModelY)).toBeLessThan(1e-5);
    });
    
    it('should correctly map Y-up to Y-down', () => {
        const viewState = new ViewState(0, 0, 10);
        const transformer = new CoordinateTransformer(viewState);
        
        const screenStr = transformer.modelToScreen(10, 10);
        expect(screenStr.x).toBe(100);
        expect(screenStr.y).toBe(-100); 
    });
});
