# Road Roulette Vehicle Icon Guide

This folder is the standalone vehicle art pipeline. It is intentionally separate from gameplay wiring so vehicle icons can be researched, generated, reviewed, and replaced without changing game logic.

## Source Of Truth

- `vehicle-art-manifest.json` lists every unique vehicle currently referenced by the 46 Grand Tour episode stages.
- `vehicle-art-batches.json` splits the work into 14 production batches.
- `unique/side/` is for garage, shop, mission, and comparison cards.
- `unique/top/` is for top-down minigames such as slalom, river/boat, chase, or map-style sequences.

## Required Asset Pair

Each vehicle gets two transparent PNG icons:

- Side icon: `unique/side/<vehicle-id>.png`
- Top-down icon: `unique/top/<vehicle-id>.png`

No two vehicles should share the same finished icon, even when the same base vehicle appears across multiple episodes.

## Side Icon Spec

- Canvas: 1024 x 384 PNG with transparent background.
- Orientation: front of the vehicle points right.
- Crop: full vehicle visible, no clipped bumpers, spoilers, wheels, roofs, or boats.
- Padding: about 8-12% around the vehicle.
- Style: realistic illustrated game icon, crisp edges, readable at card size.
- Lighting: soft studio lighting with gentle painted highlights.
- Avoid: logos, license plates with real text, watermarks, photo cutouts, copied official images, generic silhouette swaps.

## Top-Down Icon Spec

- Canvas: 512 x 768 PNG with transparent background.
- Orientation: front of the vehicle points toward the top of the canvas.
- Crop: full vehicle visible, centered, enough padding for rotation in canvas games.
- Style: same realism level as side icons, but simplified enough to read during motion.
- Vehicle-specific details should remain visible from above: roof shape, bonnet/hood length, bed/cabin layout, wing, boat hull, or special build cues.

## Research Rules

- Use references only to understand model shape, proportions, body style, color tendencies, and distinctive details.
- Do not trace, crop, or copy copyrighted photos, official press images, screenshots, or episode footage.
- For vague show-specific entries such as `Custom beach buggy`, `Car body shells`, or `Self-constructed vehicle named John`, design an original in-universe icon that matches the episode idea rather than pretending it is a production car.

## Production Prompt Template

Side icon:

```text
Create an original realistic illustrated game vehicle icon of a [YEAR/MAKE/MODEL], exact side profile, front facing right, transparent-background-ready, full vehicle visible, no cropped wheels or bumpers, no text, no logo, no watermark, crisp studio lighting, detailed but readable at small UI size, 1024x384 composition.
```

Top-down icon:

```text
Create an original realistic illustrated top-down game vehicle sprite of a [YEAR/MAKE/MODEL], front facing upward, transparent-background-ready, full vehicle visible, centered, no text, no logo, no watermark, crisp readable details for a minigame, 512x768 composition.
```

## QA Checklist

- Vehicle is recognizable as the specific model or episode build.
- No two finished icons share the same silhouette or recolored base art.
- Transparent background is clean at the edges.
- Nothing is clipped.
- Side icon sits visually on the same baseline as other side icons.
- Top-down icon is vertical and usable in portrait minigames.
- Asset still reads clearly at 96 px wide.
- Manifest status is updated only after visual review.
