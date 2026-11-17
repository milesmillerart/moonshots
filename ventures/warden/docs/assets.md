# Warden 3D assets: how to make, name and deliver models

This is for Don. You make the models in Meshy and Mixamo, drop them in Drive, and the pipeline does the rest. Until a model arrives, the game keeps using its procedural (code-built) version, so nothing ever breaks while we swap things in.

## Art targets
- **Hallowmere mood target:** Don's `ref_mood_hallowmere_street_1.png`. The repo copy is `research/refs/ref_mood_hallowmere_street_1.jpg`. It shows:
  - a narrow wet cobbled street with puddle reflections
  - dark stone buildings with timber upper floors
  - crenellated stone arch bridges receding into the fog
  - big rusted copper/iron pipes with valves
  - dangling cables
  - hot-pink and teal neon tubes
  - rain, heavy fog, a cool desaturated blue-grey base
  - hooded, cloaked figures

  Buildings, props and NPCs should fit this. `tools/art_check.py` compares the `hallowmere-street` view against it every night.
- **Character target:** `warden-cover-with-blade.jpg` (the Warden, his armour and the Synthblade), plus `synthblade-concept-on/off.jpg` for the blade.

## 1. Where files go
- In the Warden lore folder in Drive, create a subfolder named exactly **`models`**.
- Put each **GLB** in it, plus one short doc per model with the same base name (a Google Doc or .txt). For example, `char_warden_base_v1.glb` and `char_warden_base_v1` (doc).
- The doc should say what the model is, which concept image it follows, anything to watch for ("blade is a separate mesh", "cape has its own bones") and the attribution line if it came from Meshy's free plan (see section 6).
- The nightly routine downloads new or changed GLBs and runs `tools/import_models.py`. That script optimizes each model, makes a phone version, checks the budgets, updates `game/assets/manifest.json`, and then the game is rebuilt and deployed.

## 2. Naming convention
`type_name_variant_v#.glb`, all lowercase, letters and numbers only inside each part, separated by underscores.

| type | what | examples |
|---|---|---|
| `char` | people: the Warden, NPCs | `char_warden_base_v1.glb`, `char_ferrymaster_v1.glb`, `char_guard_hood_v2.glb` |
| `enemy` | abominations | `enemy_husk_v1.glb`, `enemy_skitter_v1.glb`, `enemy_brute_v1.glb` |
| `weapon` | blades and other weapons | `weapon_synthblade_v1.glb` |
| `prop` | lamps, crates, carts, signs | `prop_lamppost_v1.glb`, `prop_cart_broken_v1.glb` |
| `bldg` | buildings and big set pieces | `bldg_rowhouse_a_v1.glb`, `bldg_bridge_v1.glb` |

- The **variant** part is optional. `base` or `default` (or no variant) map to the plain id: `char_warden_base_v1` → `char_warden`. Any other variant becomes its own id: `char_guard_hood` and `bldg_rowhouse_a`.
- **Bump the version** (`_v2`, `_v3`) when you replace a model. The highest version wins, and old ones can stay in the folder.
- Ids the game already knows and swaps in automatically:
  - `char_warden`
  - `enemy_husk`, `enemy_skitter`, `enemy_brute` (and the other enemy types in `game/data`)
  - `weapon_synthblade`
- Any other `prop_`/`bldg_` id shows up once it has `placements` in the manifest. Tell me where you want it, or I place it.

## 3. Workflow: Meshy → Mixamo → Blender → GLB (all free)
1. **Meshy**
   - Generate from your design image. Front-facing T-pose or A-pose, arms away from the body, one solid connected mesh, no base or floor.
   - Download **GLB** for props and buildings (they are finished at this point). Download **FBX** (or OBJ) for characters that need rigging.
2. **Mixamo** (characters and enemies with two arms and two legs only)
   - Mixamo is Adobe's free auto-rigger and animation library. Your existing Adobe account works: go to mixamo.com and sign in. No Creative Cloud subscription and no cost.
   - What it does: you upload the FBX or OBJ, place a few markers (chin, wrists, elbows, knees, groin), and it builds a skeleton and skins the mesh. Then you pick animations from a library of thousands, and they play on your character.
   - Licence: royalty-free for commercial games, and credit is not required. The only rule is not to redistribute the raw Mixamo files on their own (an asset pack, for example). Shipping them inside the game is fine.
   - Animations to grab (search terms in brackets):
     - **idle** ("Sword And Shield Idle" or "Idle")
     - **walk** ("Sword And Shield Walk")
     - **run** ("Sword And Shield Run")
     - **attack** ("Sword And Shield Slash")
     - optional **attack2 / attack3** (two more slashes for the 3-hit combo)
     - optional **heavy** ("Great Sword Slash" or "Sword And Shield Power Up")
     - **dodge** ("Dodge Roll" or "Stand To Roll")
     - **hit** ("Sword And Shield Impact" or "Hit Reaction")
     - **death** ("Sword And Shield Death" or "Dying")
   - Tick **In Place** for walk, run and dodge wherever Mixamo offers it. The game moves the character itself.
   - Download settings:
     - First animation: FBX Binary, **With Skin**, 30 fps.
     - The rest: **Without Skin** (smaller files).
3. **Blender** (free, blender.org)
   - Import the With-Skin FBX, then import each Without-Skin FBX.
   - In the Action Editor, rename each action to the clip name (`idle`, `walk`, `run`, `attack`, `dodge`, `hit`, `death`, ...) and give each one a fake user (shield icon) so it is kept.
   - Delete the extra armatures. Keep one armature and the mesh.
   - File → Export → **glTF 2.0 (.glb)** with these settings:
     - Format: glTF Binary (.glb)
     - Include: Limit to selected objects is off
     - Transform: **+Y Up** on
     - Data → Mesh: Apply Modifiers on, UVs on, Normals on
     - Materials: Export; Images: Automatic (textures are embedded in the GLB)
     - Animation: on, Group by NLA Track off, **Export all actions** on (Blender 4.x: Animation mode "Actions"), Sampling on
     - Skinning on. Shape keys are fine.
   - Name the file per section 2 and upload it to `models`.
   - Clip names don't have to be perfect. The game also recognises Mixamo's own names (`Sword And Shield Slash`, `mixamo.com|Running`, ...) and maps them. You can also tell me "attack is clip X" and I write it into the manifest.
   - If Blender feels like too much, send me the Mixamo FBX files in the `models` folder anyway. I can do the FBX → GLB step on the box with Blender (free) in a later pass.

## 4. Export rules (all models)
- **Scale:** real-world metres. The Warden is about 1.85 m tall, a husk about 1.8 m, a door about 2.2 m. The importer warns about and auto-fixes characters outside 1.5–2.3 m, but it's better to export at the right size.
- **Up axis:** Y-up, character facing **+Z** (Blender: facing −Y before export, which is Blender's "front" view). Feet on the origin (0, 0, 0).
- **Pose:** T-pose or A-pose as the bind pose (Mixamo handles this).
- **Textures:** embedded in the GLB, PBR metal/rough (base colour, normal, and optional metallic-roughness and emissive).
  - Don't worry about texture size. The importer resizes to the budget and converts to WebP.
- **Glow:** any mesh or material whose name contains `synth_channel` glows red and follows the Synthblade's dormant/awakened state. Use it for the blade's channel lines.
  - Other emissive parts keep their own emissive colour.
- **Weapons:** model the blade along **+Y** (grip at the origin, tip pointing up), real length (the Synthblade is about 1.1 m).
  - The game puts it in the character's right hand bone (`mixamorig:RightHand`). If the grip angle looks off, I tune `weaponGrip.rotation` and `offset` in the manifest. No re-export needed.
- **Separate parts:** keep the cape, hood and weapon as separate meshes when you can. They can be swapped or animated later.

## 5. Budgets (what the importer checks)
The importer writes two files per model: a desktop GLB and a phone `.lo.glb`, which is simplified and has half-size textures. Phones (the low tier) load the `.lo` file.

| type | desktop triangles | phone triangles | desktop textures | phone textures |
|---|---|---|---|---|
| char | ≤ 60k | ≤ 20k | 2048 px | 1024 px |
| enemy | ≤ 40k | ≤ 12k | 2048 px | 1024 px |
| weapon | ≤ 12k | ≤ 4k | 1024 px | 512 px |
| prop | ≤ 8k | ≤ 3k | 1024 px | 512 px |
| bldg | ≤ 80k | ≤ 25k | 2048 px | 1024 px |

- Meshy often outputs 100k–300k triangles. That's fine to upload. The phone version is simplified automatically, and the importer warns when the desktop one is over budget.
- If you can choose in Meshy, aim for about 30k for characters ("low poly" or "remesh" set to about 30k).
- Draw calls matter more than triangles on phones: **one or two materials per model** is ideal.

## 6. Licences and cost
- **Meshy free plan:**
  - Models are **CC BY 4.0**. Commercial use is allowed with credit: "Model created with Meshy – CC BY 4.0 License". The importer records the source, and we add the line to CREDITS.md.
  - The free plan only lets you download **untextured Meshy 6 Lite models (10 per month)**. Textured downloads need a paid plan, and that would need your explicit OK, since 0.9 is free-only.
  - Untextured models are fine: the importer gives them Warden's CC0 PBR surfaces automatically (`materials` in the manifest: plate metal for characters, leather for enemies, rusted iron for props, dark brick for buildings). I can assign different surfaces per part by mesh name.
  - Name the parts (`armor`, `cloak`, `skin`, `blade`) and I map each one to a material.
- **Mixamo:** free, royalty-free, credit optional. See section 3.
- **Blender:** free (GPL). Files you export from it are yours.

## 7. What happens on import (for reference)
- `tools/import_models.py --src <folder with GLBs> [--index drive-index.json] [--dry-run] [--force]`
- Each run:
  1. Checks the naming and keeps the highest version.
  2. Skips files whose contents haven't changed (sha1).
  3. Runs `gltf-transform optimize` (meshopt compression, WebP textures resized to budget). Rigs, bone names and part names are kept for char, enemy and weapon.
  4. Makes the phone `.lo.glb`.
  5. Checks the height, skin and clips.
  6. Writes `game/assets/models/<id>.glb` and the manifest entry.
- Manifest fields you or I may hand-edit (re-imports preserve them):
  - `scale`, `offset`, `rotationY`
  - `clips` (logical name → clip name)
  - `weaponGrip` (`bone`, `rotation` in degrees, `offset` in metres)
  - `materials`
  - `placements` (`[{x, z, y, ry, s}]` world positions for props and buildings)
- Tests: `tools/assets_test.py` uses a CC0 test robot to prove the whole path works on desktop and phone: load, rig, clips, blade in hand, enemy swap, fallback, placements, materials.
