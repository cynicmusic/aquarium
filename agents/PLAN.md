# Master Plan: Professional Fish Quality

## Current Status: Phase 1 - Geometry Overhaul (in progress)
Last updated: 2026-03-26

---

## Phase 0: Infrastructure & Tooling
- [x] Set up agent roles and directory structure
- [x] Clean up loose PNGs from root
- [x] Build `render_fish_sprite.js` — headless fish-to-PNG with Catmull-Rom splines
- [x] Build `render_texture_tile.js` — texture parameter explorer with sweep mode
- [x] Build `render_contact_sheet.js` — grid assembler for comparison
- [x] Critic review system (markdown reviews in `progress/reviews/`)
- [x] Verify tools work end-to-end — all 8 species + 7 texture sweeps generated

## Phase 1: Geometry Overhaul — Cubic Spline Bodies
**Goal:** Fish silhouettes that look like real fish, not angular polygons
**Critic Score: 5.0/10 — needs to reach 7.0**

- [x] Implement Catmull-Rom spline interpolation in sprite renderer
- [x] Increase control points per species to 16 (from 7-9)
- [x] Separate fin structures (dorsal, caudal, anal, pectoral) as independent shapes
- [x] Caudal fin fork shape (not smoothed away by spline)
- [x] Thicker caudal peduncle (y=±0.04-0.07 instead of ±0.01-0.02)
- [x] Species-distinctive fins (betta flowing, lionfish spiny, moorish idol pennant)
- [x] v2 profiles with improved body shapes
- [x] Critic review #001: scored 5.0/10 average
- [ ] **FIX: Spoon/lollipop shape** — bodies need to maintain width further back, narrow sharply at peduncle only
- [ ] **FIX: Nose/snout definition** — add jaw/snout detail at x=0 to x=0.08
- [ ] **FIX: Gill cover (operculum)** — add visual line
- [ ] **FIX: Fin ray rendering** — clean up or make optional
- [ ] **ADD: --debug flag** to toggle control point display
- [ ] **ADD: More control points at high-curvature areas** (nose, peduncle)
- [ ] v3 profiles addressing all critic issues
- [ ] Critic review until all species >= 7/10
- [ ] Port approved profiles back into main `FishGeometry.js`

## Phase 2: Texture Pipeline — Deep Parameter Exploration
**Goal:** Textures that look like real fish skin, not procedural noise slapped on

- [ ] Build texture parameter space explorer (scales, spots, stripes as separate layers)
- [ ] Generate 50+ scale texture variants exploring perlin params (octaves, lacunarity, gain, scale)
- [ ] Generate 50+ spot pattern variants (voronoi, worley noise, radius distribution)
- [ ] Generate 50+ stripe pattern variants (frequency, wobble, fade, thickness curves)
- [ ] Critic review each batch, select top 10 per category
- [ ] Build layered texture compositor (scales + spots + stripes + color gradient)
- [ ] Generate 50+ composite textures combining layers
- [ ] Critic review composites, iterate on top candidates
- [ ] Map best textures to specific species

## Phase 3: Color Science
**Goal:** Species-accurate, natural-looking coloration

- [ ] Research real color palettes per species (from reference images)
- [ ] Implement HSL-based color harmony system
- [ ] Add iridescence/shimmer effect (view-angle dependent)
- [ ] Generate color variant grids per species (20 variants each)
- [ ] Critic review for natural appearance
- [ ] Implement subsurface scattering approximation for fin translucency

## Phase 4: Assembly & Animation
**Goal:** Combined high-quality fish with articulated movement

- [ ] Bone/joint system for fish body flex (not just tail wag)
- [ ] Separate fin meshes with independent animation
- [ ] Mouth open/close subtle animation
- [ ] Gill movement
- [ ] Render final assembled sprites per species
- [ ] Critic review of assembled fish
- [ ] Full scene integration and testing

## Phase 5: Scene Polish
**Goal:** Everything else that makes it professional

- [ ] Improved volumetric lighting (more dynamic, vignette)
- [ ] Background ripple shader improvements
- [ ] Plant detail overhaul
- [ ] Foreground element quality pass
- [ ] Final scene composition review

---

## Progress Log
- 2026-03-26 (session 08): Infrastructure setup. Agent roles, tools, plan created. Identified critical bug: splineCurve() exists in FishGeometry.js but body shape uses lineTo() at line 568-570 — splines are NOT actually being used despite being "implemented".
- 2026-03-26 (session 08): Built rendering tools (render_fish_sprite.js, render_texture_tile.js, render_contact_sheet.js). Generated v1 silhouettes — discovered white-on-transparent visibility issue, thin spike tails, all fish same egg shape.
- 2026-03-26 (session 08): v2 profiles — thicker peduncle, species-distinctive fins, dark backgrounds, forked tails. Critic scored 5.0/10. Key remaining: spoon/lollipop body shape, no snout detail, messy fin rays.
- 2026-03-26 (session 08): Generated 7 texture parameter sweeps (scales, spots, stripes). Critic scored 5.0/10. Scales look like cracked earth not fish scales — need dedicated semicircle-based scale generator. Stripes most promising.
- 2026-03-26 (session 08): Output count: geom_001-008 (silhouettes), sweep_001-007 (textures), sheet_001 (contact sheet). Next output numbering: geom_009+, sweep_008+, sheet_002+.
