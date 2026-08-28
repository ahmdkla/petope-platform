# Brand assets

`logo-source.png` is the artwork as supplied: a dark hexagonal "E" on a tan
plate, 518×519. Everything else here and in `app/` is derived from it, so this
is the file to replace if the mark ever changes.

| File | What it is |
|---|---|
| `logo-source.png` | The original, untouched. Tan background baked in. |
| `logo-mark.png` | The mark alone, 310×357, transparent. For light surfaces. |
| `logo-mark-light.png` | Same mark remapped to a light tone range. For dark surfaces. |

## How the tan was removed

Not by keying a colour range — that leaves a fringe wherever the mark is
anti-aliased against the background. The mark is neutral grey (every sampled
tone has `r == g == b`) and the tan is not, so for a pixel composited as
`O = a·M + (1-a)·B` the whole of `O`'s red-minus-blue difference has to be
background showing through:

```
O_r - O_b = (1 - a) · (B_r - B_b)      B = rgb(188, 170, 143), so B_r - B_b = 45
```

That solves coverage exactly, with no threshold to tune, and the mark's own
colour falls out of the compositing equation afterwards. Verified against
magenta, which shows any surviving tan immediately — there is none.

## Why there is a light variant

The mark's tones run #333–#666. On the dark theme's `--card` (#14141b) that is
1.5:1 to 3.3:1 — it disappears. `logo-mark-light.png` remaps the same gradient
into #188–#240, keeping the ordering so the light source does not flip.

`components/logo.tsx` sidesteps the problem for the in-app lockup by putting the
dark mark on the amber tile, which carries the contrast in both themes.

## Regenerating

The derivation scripts are not committed — they were one-shot. The steps are:
un-composite as above, trim to the mark's bounding box, then area-average
downscale with premultiplied alpha (straight averaging drags the colour of
transparent pixels into the result as a halo).
