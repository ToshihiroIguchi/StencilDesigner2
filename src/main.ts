import './style.css';
import { CanvasRenderer } from './engine/render/canvas';
import { FeatureTree } from './engine/core/feature';
import { SnapEngine } from './engine/core/snap';
import { InteractionController } from './engine/render/interaction';

import { SelectionManager } from './engine/render/selection';
import { FeatureEditor } from './engine/core/editing';

import { FilletTool } from './engine/render/fillet_tool';
import { ArrayCopyEngine } from './engine/core/array';
import { TrimTool } from './engine/render/trim_tool';

window.onload = () => {
    const canvasRenderer = new CanvasRenderer('main-canvas');
    const featureTree = new FeatureTree();
    const selectionManager = new SelectionManager();
    const featureEditor = new FeatureEditor(featureTree);
    const trimTool = new TrimTool(canvasRenderer, featureTree, selectionManager);
    const filletTool = new FilletTool(canvasRenderer, featureTree);
    
    // Inject dependencies into Renderer
    (canvasRenderer as any).selectionManager = selectionManager;

    const graphProvider = {
        graph: featureTree.rebuild()
    };
    canvasRenderer.updateGraph(graphProvider.graph);

    const snapEngine = new SnapEngine(
        graphProvider.graph, 
        canvasRenderer.transformer, 
        canvasRenderer.viewState
    );

    const interaction = new InteractionController(canvasRenderer, featureTree, snapEngine, selectionManager, trimTool, filletTool);
    
    const originalRebuild = featureTree.rebuild.bind(featureTree);
    featureTree.rebuild = () => {
        const newGraph = originalRebuild();
        graphProvider.graph = newGraph;
        (snapEngine as any).graph = newGraph; 
        return newGraph;
    };

    // Keyboard Hook for Delete Command
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Delete' || e.key === 'Backspace' || e.key === 'Del') {
            if (selectionManager.selectedFeatureIds.size > 0) {
                featureEditor.deleteFeatures(selectionManager.selectedFeatureIds);
                selectionManager.clear();
                
                const graph = featureTree.rebuild();
                canvasRenderer.updateGraph(graph);
                console.log('[App] Deleted selection and rebuilt graph.');
            }
        }
    });

    // Binding Fillet Radius update
    const radiusInput = document.getElementById('fillet-radius') as HTMLInputElement;
    radiusInput.addEventListener('change', () => {
        filletTool.activeRadius = parseFloat(radiusInput.value) || 2.0;
    });

    // Binding Array Exec
    document.getElementById('btn-array-exec')?.addEventListener('click', () => {
        if (selectionManager.selectedFeatureIds.size === 0) return;
        const rows = parseInt((document.getElementById('array-rows') as HTMLInputElement).value) || 1;
        const cols = parseInt((document.getElementById('array-cols') as HTMLInputElement).value) || 1;
        const pitchX = parseFloat((document.getElementById('array-px') as HTMLInputElement).value) || 0;
        const pitchY = parseFloat((document.getElementById('array-py') as HTMLInputElement).value) || 0;
        
        ArrayCopyEngine.generateFlatCopies(featureTree, selectionManager.selectedFeatureIds, rows, cols, pitchX, pitchY);
        
        // Rebuild Model
        const graph = featureTree.rebuild();
        canvasRenderer.updateGraph(graph);
        console.log(`[Array] Copied ${selectionManager.selectedFeatureIds.size} items to ${rows}x${cols}`);
        selectionManager.clear();
        canvasRenderer.drawAll();
    });

    // Exporters
    import('./engine/io/exporter').then(({ ModelExporter }) => {
        function downloadFile(content: string, filename: string, type: string) {
            const blob = new Blob([content], { type });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        document.getElementById('btn-export-dxf')?.addEventListener('click', () => {
            const dxf = ModelExporter.exportToDXF(graphProvider.graph);
            downloadFile(dxf, 'stencil_design.dxf', 'text/plain');
            console.log('[App] Exported DXF');
        });

        document.getElementById('btn-export-svg')?.addEventListener('click', () => {
            const svg = ModelExporter.exportToSVG(graphProvider.graph);
            downloadFile(svg, 'stencil_design.svg', 'image/svg+xml');
            console.log('[App] Exported SVG');
        });
    });

    // UI Wireup
    document.getElementById('btn-select')?.addEventListener('click', () => { interaction.activeTool = 'Select'; updateUI('Select'); });
    document.getElementById('btn-line')?.addEventListener('click', () => { interaction.activeTool = 'Line'; updateUI('Line'); });
    document.getElementById('btn-rect')?.addEventListener('click', () => { interaction.activeTool = 'Rect'; updateUI('Rect'); });
    document.getElementById('btn-trim')?.addEventListener('click', () => { interaction.activeTool = 'Trim'; updateUI('Trim'); });
    document.getElementById('btn-fillet')?.addEventListener('click', () => { interaction.activeTool = 'Fillet'; updateUI('Fillet'); });

    function updateUI(active: string) {
        let msg = "Ready";
        if (active === 'Trim') msg = 'Drawing mode: Trim - Click to trim segment';
        else if (active === 'Fillet') msg = 'Drawing mode: Fillet - Select a corner for Fillet';
        else if (active === 'Line') msg = 'Drawing Line - Click and drag to draw';
        else if (active === 'Rect') msg = 'Drawing Rectangle - Click and drag to draw';
        else if (active === 'Select') msg = 'Select Tool - Click or drag to select items';
        
        document.getElementById('status-text')!.innerText = msg;
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        document.getElementById(`btn-${active.toLowerCase()}`)?.classList.add('active');
    }
    updateUI('Select');
    
    (window as any).interaction = interaction;
    (window as any).canvasRenderer = canvasRenderer;
    (window as any).featureTree = featureTree;
    (window as any).selectionManager = selectionManager;
    
    (window as any).testDrawRect = () => {
        import('./engine/core/feature').then(({ RectFeature }) => {
            featureTree.addFeature(new RectFeature('test_rect', 0, 0, 50, -50));
            canvasRenderer.updateGraph(featureTree.rebuild());
            console.log('[Debug] Programmatic rect drawn.');
        });
    };

    (window as any).testArrayCopy = () => {
        import('./engine/core/feature').then(({ RectFeature }) => {
            featureTree.addFeature(new RectFeature('test_rect_array', 10, -10, 20, -20));
            ArrayCopyEngine.generateFlatCopies(featureTree, new Set(['test_rect_array']), 3, 3, 15, -15);
            canvasRenderer.updateGraph(featureTree.rebuild());
            console.log('[Debug] Programmatic array copy done.');
        });
    };

    (window as any).testFillet = () => {
        import('./engine/core/feature').then(({ RectFeature }) => {
            featureTree.addFeature(new RectFeature('test_rect_fillet', 60, -60, 100, -100));
            import('./engine/core/fillet').then(({ FilletFeature }) => {
                featureTree.addFeature(new FilletFeature('fillet_debug', 60, -60, 5)); // Radius 5mm
                canvasRenderer.updateGraph(featureTree.rebuild());
                console.log('[Debug] Programmatic fillet done.');
            });
        });
    };
};
