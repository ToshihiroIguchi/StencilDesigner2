import './style.css';
import { CanvasRenderer } from './engine/render/canvas';
import { FeatureTree, RectFeature } from './engine/core/feature';
import { SnapEngine } from './engine/core/snap';
import { InteractionController } from './engine/render/interaction';

import { SelectionManager } from './engine/render/selection';
import { FeatureEditor } from './engine/core/editing';

import { FilletTool } from './engine/render/fillet_tool';
import { ArrayCopyEngine } from './engine/core/array';
import { TrimTool } from './engine/render/trim_tool';
import { DimensionTool } from './engine/render/dimension_tool';
import { ToleranceManager } from './engine/core/viewport';

window.onload = () => {
    console.log("[Main] Application Loading...");
    
    // Global Event Debugging
    window.addEventListener('mousedown', (e) => {
        console.debug(`[Global] MouseDown at (${e.clientX}, ${e.clientY}), Target:`, e.target);
    }, true);

    const canvasRenderer = new CanvasRenderer('main-canvas');
    const featureTree = new FeatureTree();
    const selectionManager = new SelectionManager();
    const featureEditor = new FeatureEditor(featureTree);
    const trimTool = new TrimTool(canvasRenderer, featureTree, selectionManager);
    const filletTool = new FilletTool(canvasRenderer, featureTree);
    const dimensionTool = new DimensionTool(canvasRenderer, featureTree);
    
    // Inject dependencies into Renderer
    (canvasRenderer as any).selectionManager = selectionManager;
    selectionManager.onSelectionChange = () => updateInspector();

    const graphProvider = {
        graph: featureTree.rebuild()
    };
    canvasRenderer.updateGraph(graphProvider.graph);

    const snapEngine = new SnapEngine(
        graphProvider.graph, 
        canvasRenderer.transformer, 
        canvasRenderer.viewState
    );

    const interaction = new InteractionController(canvasRenderer, featureTree, snapEngine, selectionManager, trimTool, filletTool, dimensionTool);
    
    const originalRebuild = featureTree.rebuild.bind(featureTree);
    featureTree.rebuild = () => {
        const newGraph = originalRebuild();
        graphProvider.graph = newGraph;
        (snapEngine as any).graph = newGraph; 
        return newGraph;
    };

    const handleRebuild = () => {
        const graph = featureTree.rebuild();
        canvasRenderer.updateGraph(graph);
    };

    // Keyboard Listeners
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            e.preventDefault();
            if (featureTree.undo()) handleRebuild();
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
            e.preventDefault();
            if (featureTree.redo()) handleRebuild();
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
            if (selectionManager.selectedFeatureIds.size > 0) {
                featureEditor.deleteFeatures(selectionManager.selectedFeatureIds);
                selectionManager.clear();
                handleRebuild();
                updateInspector();
            }
        }
    });

    function updateInspector() {
        const infoContent = document.getElementById('info-content');
        if (!infoContent) return;

        if (selectionManager.selectedFeatureIds.size === 0) {
            infoContent.innerHTML = '<p>Select an item to see properties</p>';
            return;
        }

        const selectedIds = Array.from(selectionManager.selectedFeatureIds);
        const fId = selectedIds[0];
        const feature = featureTree.features.find(f => f.id === fId);
        
        if (!feature) {
            infoContent.innerHTML = '';
            return;
        }

        let html = `<h4>${feature.type} Properties</h4>`;
        html += `<p>ID: ${feature.id}</p>`;

        if (feature.type === 'Line') {
            const f = feature as any;
            const dx = ToleranceManager.unitsToMm(f.x2 - f.x1);
            const dy = ToleranceManager.unitsToMm(f.y2 - f.y1);
            const len = Math.hypot(dx, dy);
            html += `<label>Length (mm): <input type="number" step="0.001" value="${len.toFixed(3)}" data-param="length"></label>`;
        } else if (feature.type === 'Rect') {
            const f = feature as any;
            const w = Math.abs(ToleranceManager.unitsToMm(f.x2 - f.x1));
            const h = Math.abs(ToleranceManager.unitsToMm(f.y2 - f.y1));
            html += `<label>Width (mm): <input type="number" step="0.001" value="${w.toFixed(3)}" data-param="width"></label>`;
            html += `<label>Height (mm): <input type="number" step="0.001" value="${h.toFixed(3)}" data-param="height"></label>`;
        } else if (feature.type === 'Fillet') {
            const f = feature as any;
            html += `<label>Radius (mm): <input type="number" step="0.001" value="${f.radius.toFixed(3)}" data-param="radius"></label>`;
        }

        infoContent.innerHTML = html;

        // Bind inputs
        infoContent.querySelectorAll('input').forEach(input => {
            // Stop propagation to prevent global hotkeys (like Backspace/Delete)
            input.addEventListener('keydown', (e) => e.stopPropagation());

            // Real-time update (no history)
            input.addEventListener('input', (e) => {
                const param = (e.target as HTMLInputElement).dataset.param!;
                const val = parseFloat((e.target as HTMLInputElement).value);
                if (!isNaN(val)) {
                    featureEditor.updateFeatureParameter(fId, param, val, false);
                    handleRebuild();
                }
            });

            // Commit on change (save history)
            input.addEventListener('change', (e) => {
                const param = (e.target as HTMLInputElement).dataset.param!;
                const val = parseFloat((e.target as HTMLInputElement).value);
                if (!isNaN(val)) {
                    featureEditor.updateFeatureParameter(fId, param, val, true);
                    handleRebuild();
                    updateInspector(); // Refresh to canonicalize shown value if needed
                }
            });
        });
    }

    // History Buttons
    document.getElementById('btn-undo')?.addEventListener('click', () => {
        if (featureTree.undo()) handleRebuild();
    });
    document.getElementById('btn-redo')?.addEventListener('click', () => {
        if (featureTree.redo()) handleRebuild();
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
        handleRebuild();
        selectionManager.clear();
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
        });

        document.getElementById('btn-export-svg')?.addEventListener('click', () => {
            const svg = ModelExporter.exportToSVG(graphProvider.graph);
            downloadFile(svg, 'stencil_design.svg', 'image/svg+xml');
        });
    });

    // UI Tool Selection
    const tools = ['select', 'line', 'rect', 'trim', 'fillet', 'dim'];
    tools.forEach(tool => {
        document.getElementById(`btn-${tool}`)?.addEventListener('click', () => {
            const toolName = tool.charAt(0).toUpperCase() + tool.slice(1);
            interaction.activeTool = toolName as any;
            updateUI(toolName);
            if (toolName === 'Select') updateInspector();
        });
    });

    function updateUI(active: string) {
        let msg = "Ready";
        if (active === 'Trim') msg = 'Trim Mode - Click lines to remove';
        else if (active === 'Fillet') msg = 'Fillet Mode - Select a corner to round';
        else if (active === 'Line') msg = 'Draw Line - Drag to create';
        else if (active === 'Rect') msg = 'Draw Rectangle - Drag to create';
        else if (active === 'Select') msg = 'Select Tool - Click or drag to select';
        else if (active === 'Dim') msg = 'Dimension Tool - Drag between two points';
        
        const statusText = document.getElementById('status-text');
        if (statusText) statusText.innerText = msg;

        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        document.getElementById(`btn-${active.toLowerCase()}`)?.classList.add('active');
    }
    updateUI('Select');
    updateInspector();
    
    (window as any).interaction = interaction;
    (window as any).canvasRenderer = canvasRenderer;
    (window as any).featureTree = featureTree;
    (window as any).selectionManager = selectionManager;

    (window as any).addTestRect = () => {
        const id = `test_${Date.now()}`;
        featureTree.addFeature(new RectFeature(
            id, 
            ToleranceManager.mmToUnits(-20), ToleranceManager.mmToUnits(-20), 
            ToleranceManager.mmToUnits(20), ToleranceManager.mmToUnits(20)
        ));
        handleRebuild();
        console.log("Test rectangle added at (-20,-20) to (20,20)");
    };

    // Main Animation Loop
    function tick() {
        canvasRenderer.render();
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    // Initial Sync
    handleRebuild();
};
