# Aquarium Improvement Plan
**Last updated:** 2026-03-26

## Current Goals
Match the reference images: vivid colorful fish in side profile, lush coral reef, proper lighting.

## Phase 1: Core Fixes (In Progress)

### 1. Lighting System
- **Problem:** Fish are barely visible. Ambient/hemisphere lights are too dim and dark-tinted.
- **Fix:** Increase ambient intensity, use brighter/warmer hemisphere colors, add a key directional light from above-front, increase spotlight intensity, widen beam angles.
- **Target:** Fish should be vivid and well-lit like reference images (bright blues, oranges, yellows visible).

### 2. Fish Movement & Orientation
- **Problem:** Fish cluster together, face camera, don't pace back and forth, all swim at same depth.
- **Fixes:**
  - Increase tank spread (use full tankWidth for targets, not 0.3)
  - Force side-profile orientation: fish should primarily swim left-right (along X axis)
  - Assign individual buoyancy lanes per fish (not just per category) so they spread vertically
  - Reduce schooling cohesion to prevent clustering
  - Increase separation distance
  - Make pacing more deliberate: swim to one side, then the other

### 3. Fish Text Labels
- **Problem:** Font too bold, pill too opaque/large
- **Fix:** Use lighter font weight (300/normal instead of bold), reduce pill opacity to 0.3, measure text width and size pill to fit + padding

### 4. Camera
- **Problem:** Default angle focuses on ground, too zoomed in
- **Fix:** Move camera back (z=28), raise lookAt point to (0, 5, 0), slightly higher camera position

### 5. Plants
- **Problem:** No lime green tall plants, ferns not fractal enough
- **Fix:** Add lime green plant presets (tall vallisneria-like), implement proper fractal fern algorithm (L-system or IFS-based Barnsley fern)

### 6. Coral
- **Problem:** Not enough variety, not fractal-like
- **Fix:** More coral spawns (20+), implement fractal branching for staghorn, add more color diversity matching references (pinks, oranges, purples, yellows)

### 7. UI: Fullscreen + Collapsible Panels
- **Problem:** Debug panels always visible, not fullscreen
- **Fix:** Hide #ui-root and #debug-overlay by default, add disclosure triangle buttons to bring them back

### 8. Preset Bar
- **Problem:** No way to switch between light/dark/themed modes
- **Fix:** Add a thin preset bar at the top with buttons: "Reef Day", "Deep Night", "Warm Sunset", "Cool Abyss"
- Each preset adjusts: background gradient, lighting hues/intensity, fog color/density

## Phase 2: Polish & Iteration
- Take Playwright screenshots after each change
- Compare against reference images
- Tune colors, fish patterns, coral shapes
- Add more presets and refine each one

## Reference Image Analysis
- **reference.png:** Bright blue water, vivid orange/yellow/striped fish, pink/orange coral, bright green plants
- **ref1.png:** Bright blue bg, diverse fish species, colorful coral clusters at bottom
- **nice colors.png:** Dark background, vivid neon-colored fish, orange coral clusters
- **foliage and bubbles.png:** Lush GREEN plants dominating, fish in side profile swimming left-right
- **color and variety.png:** Bright blue water, large clownfish, diverse coral
- **coral colors.png:** Rich coral colors - oranges, purples, greens
