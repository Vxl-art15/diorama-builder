"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { SceneryPoint } from "@diorama/engine";

/** Where trees touch the ground (matches Terrain3D's ground height + a little sink). */
const GROUND_Y = -0.1;

const TRUNK_COLOR = new THREE.Color("#8a6a52");
const PINE_COLORS = [new THREE.Color("#4f9d78"), new THREE.Color("#3f8f86")];
const CROWN_COLORS = [
  new THREE.Color("#8ad1a0"),
  new THREE.Color("#f2a7c7"), // blossom
  new THREE.Color("#a58be0"), // violet, VIOLET's signature tree
];
const BUSH_COLOR = new THREE.Color("#79bf8d");

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

function place(mesh: THREE.InstancedMesh, i: number, x: number, y: number, z: number, sx: number, sy: number, sz: number, color: THREE.Color) {
  _p.set(x, y, z);
  _s.set(sx, sy, sz);
  _m.compose(_p, _q, _s);
  mesh.setMatrixAt(i, _m);
  mesh.setColorAt(i, color);
}

interface Scenery3DProps {
  points: SceneryPoint[];
}

/**
 * Trees and bushes as three InstancedMeshes (trunks, pine cones, round
 * crowns/bushes), so even a few hundred plants cost three draw calls.
 */
export function Scenery3D({ points }: Scenery3DProps) {
  const trunks = useRef<THREE.InstancedMesh>(null);
  const cones = useRef<THREE.InstancedMesh>(null);
  const blobs = useRef<THREE.InstancedMesh>(null);

  const counts = useMemo(() => {
    let pine = 0;
    let round = 0;
    let bush = 0;
    for (const p of points) {
      if (p.kind === 0) pine++;
      else if (p.kind === 1) round++;
      else bush++;
    }
    return { trunks: pine + round, cones: pine, blobs: round + bush };
  }, [points]);

  useLayoutEffect(() => {
    const t = trunks.current;
    const c = cones.current;
    const b = blobs.current;
    if (!t || !c || !b) return;
    let ti = 0;
    let ci = 0;
    let bi = 0;
    const tmp = new THREE.Color();
    for (const p of points) {
      const s = p.scale;
      if (p.kind === 0) {
        const trunkH = 1.2 * s;
        place(t, ti++, p.x, GROUND_Y + trunkH / 2, p.z, 0.2 * s, trunkH, 0.2 * s, TRUNK_COLOR);
        const coneH = 3 * s;
        tmp.copy(PINE_COLORS[p.tint < 0.5 ? 0 : 1]).offsetHSL(0, 0, (p.tint - 0.5) * 0.08);
        place(c, ci++, p.x, GROUND_Y + trunkH * 0.8 + coneH / 2, p.z, 0.95 * s, coneH, 0.95 * s, tmp);
      } else if (p.kind === 1) {
        const trunkH = 1.4 * s;
        place(t, ti++, p.x, GROUND_Y + trunkH / 2, p.z, 0.22 * s, trunkH, 0.22 * s, TRUNK_COLOR);
        const crown = CROWN_COLORS[Math.min(2, Math.floor(p.tint * 3))];
        place(b, bi++, p.x, GROUND_Y + trunkH + 0.5 * s, p.z, 1.4 * s, 1.2 * s, 1.4 * s, crown);
      } else {
        place(b, bi++, p.x, GROUND_Y + 0.5 * s, p.z, 0.9 * s, 0.6 * s, 0.9 * s, BUSH_COLOR);
      }
    }
    t.count = ti;
    c.count = ci;
    b.count = bi;
    for (const m of [t, c, b]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }, [points]);

  return (
    <group>
      <instancedMesh ref={trunks} args={[undefined, undefined, Math.max(1, counts.trunks)]} frustumCulled={false}>
        <cylinderGeometry args={[1, 1, 1, 6]} />
        <meshStandardMaterial flatShading roughness={1} />
      </instancedMesh>
      <instancedMesh ref={cones} args={[undefined, undefined, Math.max(1, counts.cones)]} frustumCulled={false}>
        <coneGeometry args={[1, 1, 7]} />
        <meshStandardMaterial flatShading roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={blobs} args={[undefined, undefined, Math.max(1, counts.blobs)]} frustumCulled={false}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial flatShading roughness={0.9} />
      </instancedMesh>
    </group>
  );
}
