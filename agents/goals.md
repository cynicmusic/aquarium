# Aquarium Project Goals

## Visual Target
Reference images in `/examples/` show the target aesthetic:
- **Side-profile fish** with clear silhouettes (not blobby 3D spheres)
- **Colorful patterns**: stripes, spots, gradients on fish bodies
- **Variety of fish shapes**: angelfish (tall/thin), clownfish (round), tang (oval), lionfish (spiny), etc.
- **Rich foliage**: fractal ferns, leafy plants with many polygons, natural sway
- **Vibrant coral**: colorful reef structures
- **Dark aquarium background** with gradient (deep blue to black) and volumetric light beams
- **Bubble columns** rising from bottom
- **Water caustic ripple** effects on surfaces

## Current Status (2026-03-26)
- Basic 3D scene with deformed spheres as fish — too blobby, no patterns
- Plants exist but need more polys and realistic leaf shapes
- Lighting system works with volumetric cones
- UI has sliders (being removed in favor of visual iteration)

## Immediate Priorities
1. **Fish overhaul**: Replace deformed spheres with proper side-profile fish geometry
   - Use 2D profile curves/splines to define fish silhouettes
   - Canvas-generated textures for stripes, spots, color bands
   - Each fish type needs a distinct recognizable shape
2. **Pattern/texture system**: Procedural stripe, spot, and gradient generation
3. **Debug labels**: Fish names floating above each fish, debug on by default
4. **Gradient background**: Deep ocean gradient behind the scene
5. **Plant improvements**: Fractal fern/frond generation with more polygons
6. **Auto-refresh**: Hot reload so changes appear in browser automatically

## Style Guide
- Pseudo-3D side-profile look (fish are flat-ish panels with detailed textures)
- Vibrant tropical colors — orange, blue, yellow, red, striped patterns
- Dark/nighttime aquarium aesthetic with light beams from above
- Camera can still orbit but default view is side-on
- Fish should be immediately recognizable by species from their silhouette alone

## Reference Repos to Study
- Search for Three.js aquarium / fish screensaver implementations
- Procedural fish texture generation
- Spline-based 2D fish silhouette generation
- Fractal plant/fern L-system algorithms
