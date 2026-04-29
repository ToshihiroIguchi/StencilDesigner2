# StencilDesigner2 Development Guidelines

## 1. UI Policy
- **Language**: Use only simple, plain English (Simple English) and intuitive icons for the User Interface. Avoid complex terminology.
- **Goal**: Make the interface accessible to users who have stencil manufacturing knowledge but lack CAD experience.

## 2. Development & Agent Communication Policy
- **Language**: All development-related communication, including code comments, commit messages, and agent prompt responses, MUST be in Japanese.
- **Autonomy**: AI agents should autonomously complete tasks up to the point of destructive or dangerous operations. Sequential confirmations for every step are strongly discouraged unless necessary for safety.

## 3. Core Architecture
- **Phase 1-A Scope**: Focus strictly on the "Topological Truth" governed by a mathematical and geometric constraint kernel. UI and rendering are out of scope for this phase.
- **Mathematical rigor**: Constraints and topologies are built upon established academic models (e.g., Laman graphs, DLST base operations).
