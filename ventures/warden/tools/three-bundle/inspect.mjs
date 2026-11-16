// Print a JSON summary of a GLB for tools/import_models.py: triangles, textures, animations, skin/bones, bounds.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import draco3d from 'draco3dgltf';
import { getBounds } from '@gltf-transform/core';
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'draco3d.decoder': await draco3d.createDecoderModule() });
const doc = await io.read(process.argv[2]);
const root = doc.getRoot();
let tris = 0, prims = 0;
for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) {
  prims++;
  const idx = p.getIndices(), pos = p.getAttribute('POSITION');
  const n = idx ? idx.getCount() : pos ? pos.getCount() : 0;
  if (p.getMode() === 4) tris += n / 3;
}
const textures = root.listTextures().map((t) => { const s = t.getSize(); return { name: t.getName(), mime: t.getMimeType(), w: s?.[0] || 0, h: s?.[1] || 0, bytes: t.getImage()?.byteLength || 0 }; });
const scene = root.getDefaultScene() || root.listScenes()[0];
const b = scene ? getBounds(scene) : { min: [0, 0, 0], max: [0, 0, 0] };
const bones = root.listSkins().flatMap((s) => s.listJoints().map((j) => j.getName()));
console.log(JSON.stringify({
  triangles: Math.round(tris), primitives: prims, meshes: root.listMeshes().length, materials: root.listMaterials().length,
  textures, animations: root.listAnimations().map((a) => a.getName()), skins: root.listSkins().length, bones: bones.length, boneNames: bones.slice(0, 200),
  bbox: { min: b.min, max: b.max, size: b.max.map((v, i) => +(v - b.min[i]).toFixed(4)) },
}));
