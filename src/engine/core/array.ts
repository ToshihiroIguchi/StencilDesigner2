import { FeatureTree, LineFeature, RectFeature } from './feature';

export class ArrayCopyEngine {
    static generateFlatCopies(
        tree: FeatureTree,
        sourceIds: Set<string>,
        rows: number,
        cols: number,
        pitchX: number,
        pitchY: number
    ): void {
        const sources = tree.features.filter(f => sourceIds.has(f.id));
        if (sources.length === 0) return;

        let cloneCounter = Date.now();

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (r === 0 && c === 0) continue; // Skip original
                
                const dx = c * pitchX;
                const dy = r * pitchY;

                for (const src of sources) {
                    const newId = `clone_${++cloneCounter}`;
                    
                    if (src.type === 'Line') {
                        const l = src as LineFeature;
                        tree.addFeature(new LineFeature(newId, l.x1 + dx, l.y1 + dy, l.x2 + dx, l.y2 + dy));
                    } else if (src.type === 'Rect') {
                        const rect = src as RectFeature;
                        tree.addFeature(new RectFeature(newId, rect.x1 + dx, rect.y1 + dy, rect.x2 + dx, rect.y2 + dy));
                    }
                    // Extensible to Circles and other basic features
                }
            }
        }
    }
}
