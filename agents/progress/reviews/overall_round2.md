# Cuttle Round 2 Review — v018 vs v017 vs master

## Fix scorecard

### 1. Zebra frequency + softer edges + sepia (9→26, longitudinal warp)
**Landed: partial (6/10).** Density clearly higher on mantle top — denser brown banding visible across the dorsal surface. Edges are softer than v017's hard black bars. However, stripes still read as discrete bands rather than the master's continuous wavy micro-lines, and hue is still brown/umber, not quite the warm sepia-amber of reference. Stripes also don't follow the mantle curvature convincingly — they look stamped on rather than wrapping.

### 2. Head reticulation amber hue + 2-3x amplitude
**Landed: weak (4/10).** Head region shows slightly more warm tone vs v017's cooler grey-mauve, but the reticulation pattern is barely intensified. Master has bold copper/amber veining forming a dense labyrinth across the entire face and arm base; v018 still reads as a diffuse wash. Amplitude increase did not visibly register.

### 3. Arch apex forward + taller (y=0.19→0.24, x forward)
**Landed: yes (8/10).** Clearest win. Silhouette now has a proper humped dorsal arch with apex pushed forward over the eye — matches master's profile much better. Previous flat-loaf shape is gone. Mantle reads as cuttle-shaped now.

## New overall: 6.8/10 (+0.7)
Silhouette fix was substantive; skin fixes were under-delivered. Not shippable.

## ONE tweak to reach 8+

**Replace the zebra band shader with a domain-warped noise ridge pattern.** Current implementation is clearly a sinusoidal stripe modulation — it can't produce the master's organic micro-reticulation no matter how you tune frequency. Swap to fbm-warped isolines (warp amp ~0.3, 2 octaves) at the high frequency, then multiply by the amber hue. This collapses fixes 1 and 2 into one correct pattern and should jump skin realism from ~5 to ~8.
