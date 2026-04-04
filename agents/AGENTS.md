# Aquarium Agent System

## Purpose
Bridge the gap between toy-quality procedural fish and professional screensaver quality through specialized agent roles, iterative development with visible progress tracking, and adversarial quality review.

## Architecture

### Agent Roles (see `roles/` for full prompts)

| Role | Responsibility | Reviews |
|------|---------------|---------|
| **Geometry Expert** | Fish body shapes, spline curves, fin articulation, silhouette quality | Shape accuracy vs real fish references |
| **Texture Expert** | Perlin noise params, scale patterns, color maps, layered detail | Pattern realism, parameter exploration |
| **Color Expert** | Color palettes, gradients, iridescence, species-accurate coloring | Natural color accuracy, harmony |
| **Critic** | Adversarial review of all outputs — rejects "good enough" | Compares to reference images, scores 1-10 |
| **Assembler** | Combines geometry + texture + color into final fish, renders sprites | Integration quality, consistency |

### Progress Tracking

All work products go into `output/` with sequential numbering:
```
output/
  sprites/
    geometry/    # Shape-only renders: geom_001_clownfish.png, geom_002_clownfish.png ...
    textures/    # Texture-only tiles: tex_001_scales_perlin.png, tex_002_spots_voronoi.png ...
    combined/    # Fish with texture applied: fish_001_clownfish_v1.png ...
  sheets/        # Contact sheets: sheet_001_geometry_compare.png ...
```

Numbering is sequential and never reused. Each image has a companion `.json` with the parameters used to generate it.

### Review Cycle
1. Expert generates N variants with different parameters
2. Critic scores each variant 1-10 with written feedback
3. Expert adjusts parameters based on feedback
4. Repeat until Critic scores >= 7 consistently
5. Assembler integrates approved components

### Tools (see `tools/`)
- `render_fish_sprite.js` — Renders a single fish to PNG at any stage
- `render_texture_tile.js` — Renders a texture pattern to PNG for inspection
- `render_contact_sheet.js` — Assembles multiple sprites into a numbered grid
- `score_log.json` — Running log of critic scores per output

## How to Continue a Session
1. Read `agents/sessions/` for the latest session log
2. Read `agents/PLAN.md` for current plan with checkboxes
3. Check `output/` numbering to see where we left off
4. Check `agents/progress/reviews/` for latest critic scores
5. Resume from the first unchecked item in PLAN.md
