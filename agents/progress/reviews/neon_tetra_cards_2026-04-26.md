# Neon Holo Tetra Cards — 2026-04-26

Goal: generate 32 neon tetra descendants, adversarially choose 16, then ship them
as a smaller nimble squad with an exclusive rolling holo stripe shader.

## Selection Notes

- Round 1 (`neon_tetra_cards_v001`) exposed a card renderer issue: silhouettes
  read too much like outlines and not enough like fish.
- Round 2 improved the body fill and red rear half, but the neon band still felt
  too shy at small size.
- Round 3 pushed the shimmer and cyan/green split, but some candidates drifted
  away from the canonical neon tetra read.
- Round 4 got close, but the rear body color family was too samey.
- Round 5 fixed the warm color family but still read too copy-pasted in the
  selected sheet.
- Round 6 widened the body/stripe/red-block parameters and added a selected-only
  sheet, but some warm blocks still hid under the belly.
- Round 7 is the selected set. The adversary accepted it for strong side-profile
  readability, visible cyan/green/turquoise stripe variance, a warmer
  red/orange/amber rear-body spread, and enough shape variation to read as a
  squad instead of clones.

## Shipped Set

- Source card sheet: `examples/internal/neon_tetra_cards_v007.png`
- Selected sheet: `examples/internal/neon_tetra_cards_v007_selected.png`
- Scores: `examples/internal/neon_tetra_cards_v007.json`
- Exported species: `public/fish/neonHoloTetra01.json` through
  `public/fish/neonHoloTetra16.json`
- Pattern type: `neon_tetra_holo`

## Shader Direction

The shipped shader is intentionally a hack, not a full biological simulation:
dark dorsal-to-belly body gradient, simplified red lower rear mask, and a
rolling blue/green lateral band driven by time, noise, and the existing
iridophore layer. The effect is exclusive to this neon holo tetra series.

## Watch Items

- Keep an eye on mobile FPS because the squad adds 16 more fish objects.
- The stripe should stay simple; avoid fragmenting it into zebra/card confetti.
- Shape variance should remain subtle because real neon tetra silhouettes are
  close cousins rather than a broad reef-fish sampler.
