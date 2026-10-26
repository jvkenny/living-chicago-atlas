# Living Chicago Atlas

Chicago-area stories, mapped on one shared base and added to every week.

**Live at https://jvkenny.github.io/living-chicago-atlas/** (once GitHub Pages is on for this repo).

One web map of the Chicago area that grows by a plate most weeks. Every plate is one story with one
takeaway, drawn on the same shared base, so plates can be read alone or laid over one another. Each
plate prints its sources, data date, method and caveats under the map.

| No. | Plate | Cause | Added | Status |
|---|---|---|---|---|
| 01 | [The grid under strain](https://jvkenny.github.io/living-chicago-atlas/#illinois-grid) | environment | 2026-10-26 | draft |

## Using a plate

- Link to a plate: `https://jvkenny.github.io/living-chicago-atlas/#<plate-id>`
- Embed the map only: `<iframe src="https://jvkenny.github.io/living-chicago-atlas/?embed#<plate-id>" width="100%" height="560" style="border:0"></iframe>`
- Each plate's data is plain GeoJSON under `layers/<plate-id>/data/`.

## How this repo is made

This repo is build output. The atlas source (plate manifests, prep scripts, the base map and the
build checks) lives in `news-maps/living-chicago-atlas/` in jvkenny/command-center, and raw data
lives in Drive. Each update here comes from `python3 tools/export_pages.py` there, as a pull request.
Merging the pull request updates the live site.

Map base: Natural Earth (public domain). Street detail from zoom 9: OpenFreeMap tiles,
© OpenStreetMap contributors. Renderer: MapLibre GL JS (BSD-3).

Built 2026-10-26.
