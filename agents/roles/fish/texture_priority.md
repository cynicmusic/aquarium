# Fish Agent — Texture Priority Pass (Session 08 continued)

## Context
Fish shapes are now good enough. The focus shifts ENTIRELY to textures, patterns, and color accuracy. Do NOT change body shapes except to fix obvious spline errors (see below).

## Specific Bugs to Fix
1. **naca_013_triggerfish and naca_019_clownTrigger** have a weird pointed tip/bump on top of the head — the dorsal spline overshoots. Fix the dorsal fin attachment or first control point.
2. Any other fish where the spline creates unnatural bumps — smooth them out.

## Main Task: Perlin Noise Patterns
The current pattern system uses simple geometric shapes (straight lines, circles). Real fish patterns are ORGANIC — they look like perlin noise contours. Study these examples:

### Emperor Angelfish
- The horizontal blue/yellow stripes are NOT straight lines — they're wavy, organic, following body contours
- They look EXACTLY like perlin noise isolines/contours
- Implementation: generate perlin noise field across the body, then draw contour lines at regular thresholds
- Colors: deep blue body, bright yellow wavy stripes, dark blue face mask, yellow tail

### Clownfish
- White bands are NOT perfectly straight either — they have slight organic waviness
- Each band has a thin black border
- The orange varies in saturation across the body

### Banggai Cardinal
- Silver/white body with BOLD black vertical bars
- Scattered white spots/dots within the black bars
- Long spiny dorsal fin rays

### General Principle
- Use perlin noise to MODULATE all patterns — no perfectly straight lines
- Stripe boundaries should wobble organically
- Spots should have slightly irregular edges
- Color should vary subtly across the body (not uniform fills)
- Add a subtle perlin-based mottling/texture to ALL fish bodies even if they don't have obvious patterns

## Pattern Types Needed (implement via perlin noise modulation)
1. **Wavy horizontal stripes** (emperor angel, regal tang) — perlin noise contour lines
2. **Vertical bands with wobble** (clownfish, moorish idol, banggai) — sine + perlin offset
3. **Scattered organic spots** (pufferfish, hawkfish) — perlin threshold + voronoi
4. **Psychedelic swirls** (mandarinfish) — domain-warped perlin
5. **Gradient zones** (neon tetra iridescent stripe) — smooth color transitions
6. **Mottled/dappled** (goby, blenny) — multi-octave perlin overlay
7. **Clean two-tone** (tang, damselfish) — perlin-wobbled boundary line

## Critic Focus
- RELAX shape feedback — shapes are mostly good now
- CONCENTRATE on: pattern accuracy, color accuracy, organic texture quality
- Score patterns on how closely they match real fish photos
- Each of the 32 fish should have a UNIQUE pattern — no two should look the same
