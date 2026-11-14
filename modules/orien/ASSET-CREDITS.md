# Asset credits

Photography in `public/images/` is original NASA imagery, downloaded with
`scripts/fetch-assets.mjs` from `https://images-assets.nasa.gov`. NASA media is generally
available for educational and commercial use without permission; credit lines below are the
original catalogue titles. Re-run the script to refresh at full resolution.

| Local file | NASA ID | Original title / caption | Source |
| --- | --- | --- | --- |
| `earth-night-lights.jpg` | `iss045e013851` | Earth Observation from the International Space Station | images-assets.nasa.gov/image/iss045e013851 |
| `earth-limb-sunrise.jpg` | `iss071e439624` | An orbital sunrise colorfully illuminates the Earth's atmosphere | images-assets.nasa.gov/image/iss071e439624 |
| `artemis-pad.jpg` | `Artemis II at the pad sunsetting 01292026_13` | Sun sets on Full Artemis II Stack at Launch Pad 39B | images-assets.nasa.gov/image/Artemis%20II%20at%20the%20pad%20sunsetting%2001292026_13 |
| `sls-rollout.jpg` | `KSC-01172026-Artemis II_Rollout-5` | NASA's Artemis II SLS Rocket and Orion Spacecraft Rollout to Launch Pad 39B | images-assets.nasa.gov/image/KSC-01172026-Artemis%20II_Rollout-5 |
| `spacewalk.jpg` | `iss038e020263` | EVA 25 | images-assets.nasa.gov/image/iss038e020263 |
| `mars-jezero.jpg` | `PIA24921` | Detailed Panorama of Mars' Jezero Crater Delta | images-assets.nasa.gov/image/PIA24921 |
| `cosmic-cliffs.jpg` | `carina_nebula` | James Webb Space Telescope NIRCam Image of the "Cosmic Cliffs" (NGC 3324) | images-assets.nasa.gov/image/carina_nebula |
| `station.jpg` | `iss063e010583` | International Space Station exterior over Earth | images-assets.nasa.gov/image/iss063e010583 |
| `visor-reflection.jpg` | `iss072e518423` | Astronaut Don Pettit's reflection on the helmet visor during EVA | images-assets.nasa.gov/image/iss072e518423 |

Downloaded but not used in the final layout (kept available for edits):

| Local file | NASA ID | Title |
| --- | --- | --- |
| `portrait-hathaway.jpg` | `jsc2025e068207_alt` | Official portrait of NASA astronaut Jack Hathaway |
| `portrait-meir.jpg` | `jsc2025e078605_alt` | Official portrait of NASA astronaut Jessica Meir |
| `portrait-menon.jpg` | `jsc2026e000701_alt` | NASA astronaut Anil Menon, Expedition 75 flight engineer |
| `portrait-kutryk.jpg` | `jsc2025e081360_alt` | Astronaut Joshua Kutryk official portrait |
| `portrait-esa.jpg` | `jsc2025e058846_alt` | Official portrait of ESA astronaut |
| `portrait-cardman.jpg` | `jsc2024e022261_alt` | NASA astronaut Zena Cardman portrait |

These six real astronaut portraits are **deliberately not used** as testimonial avatars: putting a
named, identifiable astronaut's face beside invented quotes would misattribute words to a real
person. They remain in the folder for editorial use with their true captions.

## Generated portraits

`portrait-a.jpg` … `portrait-d.jpg` are AI-generated synthetic headshots created for this project
(ImageGen), then resized and compressed with `sharp`. They depict no real individual, which the
returned-crews section states on-page. They are the only avatars used in that section.

## ORION

The ORION panel renders no external imagery: its HUD, avatar and typing indicator are CSS and
inline SVG. Flight facts are written in `lib/orion-ai.ts`. Questions that are not in that file
are answered from a live English Wikipedia search (`en.wikipedia.org`, `origin=*`), spoken with
the browser's speech synthesis. Those articles are not copied into the repository. Wikipedia
text remains under its own licence — attribute Wikipedia when an answer cites it, which the
reply line already does.

## ORION's body — the Enderman

ORION's 3D body is the Minecraft Enderman voxel rig ported from the SUNDAY v2 character build
(`public/characters/enderman.sunday`). It is built from boxes and lights at runtime — there is no
texture, sprite or mesh file, so nothing external is loaded for the character itself.

| Local file | Source | Licence |
| --- | --- | --- |
| `public/vendor/three.min.js` | three.js r128 UMD build, vendored from the SUNDAY project | MIT |
| `public/characters/enderman.sunday` | SUNDAY v2 character profile for the Enderman | Same project, same author |

Minecraft is a trademark of Mojang Studios. This is a fan-made voxel rig used for a concept
project; it is not an official Minecraft asset or product.

## Fonts

Space Grotesk and IBM Plex Mono are loaded from Google Fonts under the SIL Open Font License.
