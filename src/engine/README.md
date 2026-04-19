# StencilDesigner2 Engine Architecture

## Core Concept: The Rebuild Pipeline

StencilDesigner2 utilizes a non-destructive rebuid pipeline centered around the **FeatureTree**. This ensures "Topological Truth" and allows for robust Undo/Redo and future parametric constraints.

### Flow Diagram

```text
[ FeatureTree ]
      |
      | 1. Collect all features (Line, Rect, etc.)
      V
[ Base ModelGraph Generation ]
      |
      | 2. Canonicalize & Merge coincident vertices
      | 3. Intersection split (All segments inter-split)
      V
[ Topological Skeleton ]
      |
      | 4. Apply Modifiers in order:
      |    - TrimFeatures (Delete specific segments)
      |    - FilletFeatures (Replace corners with Arcs)
      V
[ Final ModelGraph ] ----> [ EXPORTERS (DXF/SVG) ]
      |
      | 5. Render Layer
      V
[ CanvasRenderer ] <---- [ Dynamic DIMENSIONS (Sticky lookup) ]
```

## Key Modules

- **`core/graph.ts`**: Pure adjacency list representation (`vertices`, `edges`).
- **`core/intersection.ts`**: The math hub for segment splitting.
- **`core/editing.ts`**: High-level atomic edit commands.
- **`render/canvas.ts`**: Paper.js-powered rendering engine. 
  - *Dynamic resolution*: It looks up vertex coordinates in real-time to support "Sticky Dimensions".

## Extension Points

1. **New Geometric Primitive**: Implement the `Feature` interface in `core/feature.ts`.
2. **New Modifier Tool**: Create a class in `render/` and register it in `InteractionController`.
3. **Advanced DRC**: Add a post-rebuild validator that traverses the `ModelGraph`.
