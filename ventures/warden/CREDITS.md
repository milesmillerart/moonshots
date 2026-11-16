# Credits and licenses

Everything here is free to use. Nothing is paid, and no CDN is used: every file is served from our own server.

## Code (runtime)
- **three.js r187** (MIT), © 2010-2026 three.js authors. Vendored as `game/vendor/three-warden.r187-09.min.js`, a minified esbuild bundle of `three` plus these addons from `three/examples/jsm`: EffectComposer, RenderPass, ShaderPass, UnrealBloomPass, OutputPass, GTAOPass, SMAAPass, GLTFLoader, DRACOLoader, HDRLoader, SkeletonUtils, and the meshopt decoder. The license text is in `game/vendor/LICENSE-three.txt`. The bundle is rebuilt with `tools/three-bundle` (`npm run bundle`).
- **Draco 3D decoder** (Apache-2.0), © Google. `game/vendor/draco/` is copied from `three/examples/jsm/libs/draco/gltf/`.
- **meshoptimizer decoder** (MIT), © Arseny Kapoulkine. Included in the bundle through `three/examples/jsm/libs/meshopt_decoder.module.js`.

## Tools (build time only, not shipped)
- **glTF Transform** CLI and core (MIT), © Don McCurdy. Used by `tools/import_models.py`.
- **sharp** (Apache-2.0) and **libvips** (LGPL-2.1, used as a dynamic library). These handle WebP texture compression inside glTF Transform.
- **esbuild** (MIT) bundles three.js.
- **Pillow** (MIT-CMU) resizes and re-encodes the PBR textures.

## Textures and lighting: Poly Haven, all CC0 (public domain)
Source: https://polyhaven.com. Each texture was downloaded at 1k and re-encoded to 1k and 512 px JPEG as diffuse, normal (GL) and ARM (AO, roughness, metal) maps. They live in `game/assets/tex/<id>/`.

| Asset | Used for | Author(s) | License |
|---|---|---|---|
| [cobblestone_floor_08](https://polyhaven.com/a/cobblestone_floor_08) | Lantern Street and plaza cobbles | Rob Tuytel | CC0 |
| [castle_wall_slates](https://polyhaven.com/a/castle_wall_slates) | dark stone: walls, plinths, kerbs, some facades | Rob Tuytel | CC0 |
| [dark_brick_wall](https://polyhaven.com/a/dark_brick_wall) | building facades | Dario Barresi, Dimitrios Savva | CC0 |
| [rusty_metal_02](https://polyhaven.com/a/rusty_metal_02) | rusted iron: lamp posts, railings, gates | Rob Tuytel | CC0 |
| [brown_leather](https://polyhaven.com/a/brown_leather) | worn leather: Warden straps, belt, boots | Rob Tuytel | CC0 |
| [metal_plate](https://polyhaven.com/a/metal_plate) | dull plate armour and dark metal | Rob Tuytel | CC0 |
| [Cobblestone Street Night HDRI](https://polyhaven.com/a/cobblestone_street_night) | environment lighting and reflections (1k file, plus a 512 px downsample for phones) | Greg Zaal, Jenelle van Heerden | CC0 |

## Test fixture (not shown to players)
- **RobotExpressive** (CC0) by Tomás Laulhé (Quaternius), modified by Don McCurdy. It comes from the three.js examples. `tools/fixtures/RobotExpressive.glb` and the optimized copies in `game/assets/test/models/` exist only so `tools/assets_test.py` can exercise the skinned-model pipeline. The live game never loads them.

## Original work
Everything else is original and made in code for Warden: the procedural models (Warden, Synthblade, abominations, city), the canvas textures (windows, neon signs, the puddle mask), the shaders (rain, height fog, lamp shafts, wet-street streaks, colour grade, grain, vignette) and all sound (WebAudio synthesis, no audio files). Fonts are the player's system sans-serif.

3D models that Don makes in Meshy and rigs in Mixamo will go in `game/assets/models/`. The asset manifest records where each one came from.
