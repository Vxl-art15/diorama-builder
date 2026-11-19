import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { hash2, mulberry32 } from "@diorama/engine";

/**
 * Procedural low-poly models for the village scenery. Every model is a handful
 * of primitives merged into ONE geometry with baked vertex colors, so each
 * plant type is a single InstancedMesh (one draw call) and keeps its own
 * painted look. Units: 1 = one world unit; models stand on y = 0.
 */

interface Part {
  geo: THREE.BufferGeometry;
  color: THREE.ColorRepresentation;
  at?: [number, number, number];
  scale?: [number, number, number];
  rot?: [number, number, number];
}

const _pos = new THREE.Vector3();
const _scl = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _mat = new THREE.Matrix4();

/** Merge parts into one flat-shaded geometry with a `color` vertex attribute. */
function bake(parts: Part[]): THREE.BufferGeometry {
  const prepared = parts.map((p) => {
    const g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
    _pos.set(...(p.at ?? [0, 0, 0]));
    _scl.set(...(p.scale ?? [1, 1, 1]));
    _euler.set(...(p.rot ?? [0, 0, 0]));
    _quat.setFromEuler(_euler);
    _mat.compose(_pos, _quat, _scl);
    g.applyMatrix4(_mat);
    const c = new THREE.Color(p.color);
    const n = g.getAttribute("position").count;
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return g;
  });
  const merged = mergeGeometries(prepared, false);
  prepared.forEach((g) => g.dispose());
  if (!merged) throw new Error("sceneryGeometry: failed to merge geometries");
  merged.computeVertexNormals();
  return merged;
}

const cyl = (rTop: number, rBottom: number, h: number, seg = 6) => new THREE.CylinderGeometry(rTop, rBottom, h, seg);
const cone = (r: number, h: number, seg = 7) => new THREE.ConeGeometry(r, h, seg);
const blob = (r = 1, detail = 1) => new THREE.IcosahedronGeometry(r, detail);

const TRUNK = "#7d5c49";
const TRUNK_DARK = "#6a4c3c";

/** Stacked-tier pine, ~4.3 tall. */
export function pineGeometry(): THREE.BufferGeometry {
  return bake([
    { geo: cyl(0.14, 0.24, 1.2), color: TRUNK, at: [0, 0.6, 0] },
    { geo: cone(1.4, 1.9), color: "#3a866a", at: [0, 1.95, 0], rot: [0, 0.3, 0] },
    { geo: cone(1.1, 1.7), color: "#459878", at: [0, 2.85, 0], rot: [0, 0.9, 0] },
    { geo: cone(0.75, 1.5), color: "#58ab88", at: [0, 3.6, 0], rot: [0, 0.1, 0] },
  ]);
}

/** Round, cloud-like canopy on a short trunk, ~4.2 tall. Crown color sets the species. */
export function roundTreeGeometry(crown: THREE.ColorRepresentation): THREE.BufferGeometry {
  const base = new THREE.Color(crown);
  const lighter = base.clone().offsetHSL(0, 0.02, 0.07);
  const darker = base.clone().offsetHSL(0, 0, -0.07);
  return bake([
    { geo: cyl(0.16, 0.28, 1.8), color: TRUNK, at: [0, 0.9, 0], rot: [0.05, 0, 0.04] },
    { geo: blob(1, 1), color: darker, at: [0.1, 2.55, 0], scale: [1.55, 1.15, 1.55] },
    { geo: blob(1, 1), color: base, at: [0.95, 2.35, 0.4], scale: [1.0, 0.9, 1.0] },
    { geo: blob(1, 1), color: base, at: [-0.9, 2.4, -0.5], scale: [1.05, 0.9, 1.05] },
    { geo: blob(1, 1), color: lighter, at: [0.05, 3.35, -0.1], scale: [1.05, 0.9, 1.05] },
  ]);
}

/**
 * Hero "umbrella" tree: a wide layered violet canopy on a leaning trunk with
 * hanging warm lanterns and root bulges, ~5.4 tall. The fantasy landmark.
 */
export function umbrellaTreeGeometry(): THREE.BufferGeometry {
  const lanterns: Part[] = [];
  const lanternSpots: Array<[number, number, number]> = [
    [1.4, 3.0, 0.6],
    [-1.3, 3.05, 0.9],
    [0.4, 2.9, -1.5],
    [-0.9, 3.1, -1.1],
    [1.9, 3.1, -0.6],
  ];
  for (const at of lanternSpots) lanterns.push({ geo: blob(0.16, 1), color: "#ffe6a0", at });
  return bake([
    { geo: cyl(0.2, 0.38, 2.0), color: TRUNK, at: [0, 1.0, 0], rot: [0, 0, 0.08] },
    { geo: cyl(0.16, 0.22, 1.5), color: TRUNK_DARK, at: [0.15, 2.5, 0], rot: [0, 0, -0.12] },
    { geo: blob(0.38, 0), color: TRUNK, at: [0.55, 0.15, 0.2], scale: [1.2, 0.7, 1] },
    { geo: blob(0.34, 0), color: TRUNK, at: [-0.5, 0.12, 0.35], scale: [1.2, 0.7, 1] },
    { geo: blob(0.3, 0), color: TRUNK, at: [0.05, 0.1, -0.55], scale: [1.2, 0.7, 1] },
    { geo: blob(1, 2), color: "#8a70cf", at: [0.15, 3.55, 0], scale: [2.9, 0.8, 2.9] },
    { geo: blob(1, 1), color: "#a98be6", at: [1.0, 4.05, 0.5], scale: [2.0, 0.65, 2.0] },
    { geo: blob(1, 1), color: "#9a7fdc", at: [-1.1, 3.95, -0.8], scale: [1.7, 0.6, 1.7] },
    { geo: blob(1, 1), color: "#c4adf2", at: [0.1, 4.45, -0.1], scale: [1.7, 0.6, 1.7] },
    ...lanterns,
  ]);
}

/** Low, lumpy bush, ~0.9 tall. */
export function bushGeometry(): THREE.BufferGeometry {
  return bake([
    { geo: blob(1, 1), color: "#6aae80", at: [0, 0.5, 0], scale: [0.85, 0.7, 0.85] },
    { geo: blob(1, 1), color: "#76bb8b", at: [0.55, 0.42, 0.25], scale: [0.55, 0.5, 0.55] },
    { geo: blob(1, 1), color: "#62a578", at: [-0.5, 0.4, -0.2], scale: [0.6, 0.5, 0.6] },
    { geo: blob(1, 1), color: "#86c99a", at: [0.05, 0.85, 0.05], scale: [0.45, 0.35, 0.45] },
  ]);
}

/** Flower stem (constant green). */
export function flowerStemGeometry(): THREE.BufferGeometry {
  return bake([{ geo: cyl(0.03, 0.04, 0.5, 4), color: "#6aa86a", at: [0, 0.25, 0] }]);
}

/** Flower head, painted white so the per-instance color gives the final tint. */
export function flowerHeadGeometry(): THREE.BufferGeometry {
  return bake([
    { geo: blob(0.2, 0), color: "#ffffff", at: [0, 0.52, 0], scale: [1, 0.7, 1] },
    { geo: blob(0.09, 0), color: "#ffe9a0", at: [0, 0.58, 0] },
  ]);
}

/** Mushroom stem (constant cream). */
export function mushroomStemGeometry(): THREE.BufferGeometry {
  return bake([{ geo: cyl(0.07, 0.1, 0.34, 6), color: "#fff1dc", at: [0, 0.17, 0] }]);
}

/** Mushroom cap, painted white so the per-instance color picks the species. */
export function mushroomCapGeometry(): THREE.BufferGeometry {
  return bake([
    { geo: new THREE.SphereGeometry(0.26, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), color: "#ffffff", at: [0, 0.32, 0], scale: [1, 0.85, 1] },
  ]);
}

/** Faceted rock with deterministic vertex jitter, ~0.8 tall. */
export function rockGeometry(): THREE.BufferGeometry {
  const g = blob(0.8, 1).toNonIndexed();
  const p = g.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const k = 0.82 + hash2(Math.round(p.getX(i) * 100), Math.round(p.getY(i) * 100) + Math.round(p.getZ(i) * 37), 9) * 0.36;
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.75, p.getZ(i) * k);
  }
  g.computeVertexNormals();
  return bake([{ geo: g, color: "#a79fba", at: [0, 0.3, 0] }]);
}

/** Small grass tuft: five thin blades fanning out, so it reads as grass up close. */
export function tuftGeometry(): THREE.BufferGeometry {
  const blades: Part[] = [
    { geo: cone(0.045, 0.62, 3), color: "#8fcf7a", at: [0, 0.31, 0], rot: [0.12, 0, 0.1] },
    { geo: cone(0.04, 0.5, 3), color: "#7fc272", at: [0.07, 0.24, 0.03], rot: [-0.3, 1.1, -0.18] },
    { geo: cone(0.04, 0.55, 3), color: "#9bd884", at: [-0.06, 0.27, -0.04], rot: [0.28, 2.2, 0.22] },
    { geo: cone(0.04, 0.42, 3), color: "#86c874", at: [0.03, 0.21, -0.07], rot: [0.34, 3.4, -0.2] },
    { geo: cone(0.04, 0.46, 3), color: "#a3dc8c", at: [-0.07, 0.23, 0.05], rot: [-0.26, 4.5, 0.18] },
  ];
  return bake(blades);
}

export interface HillRingOptions {
  /** Distance of the ring from the village center */
  radius: number;
  count: number;
  seed: number;
  /** Hill half-width range and height range, in world units */
  width: [number, number];
  height: [number, number];
  bottomColor: THREE.ColorRepresentation;
  topColor: THREE.ColorRepresentation;
}

/**
 * A ring of rolling hills around the village (one merged geometry). Colors
 * blend from `bottomColor` at the base to `topColor` at the crest so distant
 * hills read as soft, atmospheric silhouettes once the fog tints them.
 */
export function hillRingGeometry(o: HillRingOptions): THREE.BufferGeometry {
  const rand = mulberry32(o.seed);
  const parts: Part[] = [];
  for (let i = 0; i < o.count; i++) {
    const a = ((i + rand() * 0.6) / o.count) * Math.PI * 2;
    const r = o.radius * (0.94 + rand() * 0.12);
    const w = o.width[0] + rand() * (o.width[1] - o.width[0]);
    const h = o.height[0] + rand() * (o.height[1] - o.height[0]);
    parts.push({
      geo: blob(1, 1),
      color: "#ffffff",
      at: [Math.cos(a) * r, -h * 0.25, Math.sin(a) * r],
      scale: [w, h, w * (0.7 + rand() * 0.5)],
      rot: [0, rand() * Math.PI, 0],
    });
  }
  const g = bake(parts);
  const pos = g.getAttribute("position");
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    minY = Math.min(minY, pos.getY(i));
    maxY = Math.max(maxY, pos.getY(i));
  }
  const bottom = new THREE.Color(o.bottomColor);
  const top = new THREE.Color(o.topColor);
  const c = new THREE.Color();
  const colors = g.getAttribute("color");
  for (let i = 0; i < pos.count; i++) {
    c.copy(bottom).lerp(top, (pos.getY(i) - minY) / (maxY - minY || 1));
    colors.setXYZ(i, c.r, c.g, c.b);
  }
  colors.needsUpdate = true;
  return g;
}

/** A soft cloud: flattened white blobs with lilac undersides. */
export function cloudGeometry(): THREE.BufferGeometry {
  return bake([
    { geo: blob(1, 1), color: "#fff6f2", at: [0, 0.4, 0], scale: [1.6, 0.8, 1.0] },
    { geo: blob(1, 1), color: "#fffaf7", at: [1.3, 0.2, 0.1], scale: [1.1, 0.7, 0.9] },
    { geo: blob(1, 1), color: "#fff2ee", at: [-1.3, 0.15, -0.1], scale: [1.2, 0.65, 0.9] },
    { geo: blob(1, 1), color: "#ffffff", at: [0.4, 0.95, 0], scale: [0.9, 0.6, 0.8] },
    { geo: blob(1, 1), color: "#d9c8f0", at: [0, -0.1, 0], scale: [1.9, 0.4, 1.0] },
  ]);
}
