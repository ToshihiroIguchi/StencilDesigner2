import { FeatureTree, LineFeature, RectFeature } from './feature';
import { ToleranceManager } from './viewport';

export class ArrayCopyEngine {
    static generateFlatCopies(
        tree: FeatureTree,
        sourceIds: Set<string>,
        rows: number,
        cols: number,
        pitchX_mm: number,
        pitchY_mm: number
    ): void {
        const sources = tree.features.filter(f => sourceIds.has(f.id));
        if (sources.length === 0) return;

        const pitchX = ToleranceManager.mmToUnits(pitchX_mm);
        const pitchY = ToleranceManager.mmToUnits(pitchY_mm);

        let cloneCounter = Date.now();

        const clones: any[] = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (r === 0 && c === 0) continue; // Skip original
                
                const dx = BigInt(c) * pitchX;
                const dy = BigInt(r) * pitchY;

                for (const src of sources) {
                    const newId = `clone_${++cloneCounter}`;
                    
                    if (src.type === 'Line') {
                        const l = src as LineFeature;
                        clones.push(new LineFeature(newId, l.x1 + dx, l.y1 + dy, l.x2 + dx, l.y2 + dy));
                    } else if (src.type === 'Rect') {
                        const rect = src as RectFeature;
                        clones.push(new RectFeature(newId, rect.x1 + dx, rect.y1 + dy, rect.x2 + dx, rect.y2 + dy));
                    }
                }
            }
        }
        tree.addFeatures(clones);
    }
}
