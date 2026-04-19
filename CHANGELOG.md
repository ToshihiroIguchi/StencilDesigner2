# Changelog

All notable changes to StencilDesigner2 will be documented in this file.

## [1.0.0] - 2026-04-19

### Added
- **Core Geometry Engine**: Established the Duality Layered Skeleton Topology (DLST) kernel for high-precision manufacturing data.
- **Parametric Editing**:
  - Non-destructive **Fillet** (Arc-based corner rounding).
  - Non-destructive **Trim** (Segment splitting and removal).
  - **Array Copy Engine**: Linear and rectangular pattern duplication.
- **Sticky Dimensions**: Added measurement tool with `VertexId` binding. Dimensions automatically update when geometry moves and provide a "detached" visual hint (dashed gray) if the parent geometry is deleted.
- **History Management**: Robust **Undo / Redo** stack (50 steps) with keyboard shortcuts (`Ctrl+Z`, `Ctrl+Y`).
- **Industrial I/O**:
  - **DXF Export**: Production-ready R12 format output.
  - **SVG Export**: High-fidelity vector visualization for web/documentation.
- **Professional UI**: Modern dark theme with grid snapping, viewport transformation (Zoom/Pan), and Guide/Status systems in Simple English.

### Fixed
- Improved intersection splitting logic for complex overlapping rectangles.
- Optimized graph rebuild performance using batch feature additions.
- Standardized coordinate canonicalization to 1μm resolution.
