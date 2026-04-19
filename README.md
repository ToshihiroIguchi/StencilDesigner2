# StencilDesigner2

**High-precision 2D CAD for Stencil Manufacturing.**

StencilDesigner2 is a specialized CAD tool designed for electronic component stencil design. It focuses on "Topological Truth" and manufacturing-ready outputs.

## Key Features

- **Topology-First Engine**: Built on a mathematical constraint kernel ensuring structural integrity.
- **Snap Engine**: High-precision snapping to Grid, Endpoints, and Midpoints for μm-level accuracy.
- **Smart Editing**: 
  - **Interactive Trim**: Split and remove segments at intersections effortlessly.
  - **Corner Fillet**: Precise mathematical rounding of corners using Maker.js.
  - **Array Copy**: Efficient matrix duplication for electrode patterns.
- **Sticky Dimensions**: Automatic measurement tools attached to vertices. If a vertex is removed, the dimension enters a "detached" state (visually grayed out with a hint) to maintain non-destructive information.
- **History Management**: Robust **Undo / Redo** stack (Ctrl+Z / Ctrl+Y) integrated into the core topology tree.
- **Industrial Export**: Direct export to **DXF** and **SVG** with 1μm coordinated precision.
- **Pro UI/UX**: Professional dark theme with grid snapping and localized status guidance (Simple English).

## Getting Started

### Prerequisites

- Node.js (v18 or later)
- npm

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/ToshihiroIguchi/StencilDesigner2.git
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

### Running the App

Start the development server:
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

## Tech Stack

- **Core**: TypeScript, Vite
- **Mathematics**: Maker.js
- **Rendering**: Paper.js
- **Testing**: Vitest, Playwright

## License

MIT
