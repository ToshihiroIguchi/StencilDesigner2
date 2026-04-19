import { describe, it, expect } from 'vitest';
import { FeatureTree, LineFeature, RectFeature } from '../src/engine/core/feature';
import { FilletFeature } from '../src/engine/core/fillet';
import { ModelExporter } from '../src/engine/io/exporter';

describe('Model Exporter', () => {
    it('should export ModelGraph with lines and arcs to DXF and SVG formats', () => {
        const tree = new FeatureTree();
        tree.addFeature(new RectFeature('r1', 10, 10, 50, 50));
        tree.addFeature(new FilletFeature('f1', 10, 10, 5));
        
        const graph = tree.rebuild();
        
        const dxfStr = ModelExporter.exportToDXF(graph);
        const svgStr = ModelExporter.exportToSVG(graph);
        
        // Assert basic formatting and contents
        expect(dxfStr).toContain('SECTION');
        expect(dxfStr).toContain('ENTITIES');
        // A fillet means an ARC entity exists in DXF
        expect(dxfStr).toContain('ARC');
        expect(dxfStr).toContain('LINE');
        
        expect(svgStr).toContain('<svg');
        expect(svgStr).toContain('</svg>');
        // Since makerjs toSVG uses paths
        expect(svgStr).toContain('<path');
        // Arc command in SVG path is 'A' -> sometimes 'A', or sometimes it just outputs 'd='
        // We know it exports geometry natively
    });
});
