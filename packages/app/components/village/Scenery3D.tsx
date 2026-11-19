"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { SceneryPlan, TreeType } from "@diorama/engine";
import {
  bushGeometry,
  flowerHeadGeometry,
  flowerStemGeometry,
  mushroomCapGeometry,
  mushroomStemGeometry,
  pineGeometry,
  roundTreeGeometry,
  rockGeometry,
  tuftGeometry,
  umbrellaTreeGeometry,
} from "./sceneryGeometry";

/** Sink plants a touch so they never float on slopes. */
const SINK = 0.05;

const FLOWER_COLORS = ["#ffd166", "#f78fb3", "#fff7ee", "#c4a8ff"].map((c) => new THREE.Color(c));
const CAP_COLORS = ["#ff8fa3", "#ffbf6b", "#c9a6ff"].map((c) => new THREE.Color(c));

const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _m = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0);

interface Item {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  ry: number;
  color?: THREE.Color;
}

const grey = (tint: number, lo = 0.88, span = 0.22) => {
  const g = lo + tint * span;
  return new THREE.Color(g, g, g);
};

interface InstancedProps {
  geometry: THREE.BufferGeometry;
  items: Item[];
  castShadow?: boolean;
}

/** One InstancedMesh: a single draw call for every copy of a plant. */
function Instanced({ geometry, items, castShadow = false }: InstancedProps) {
  const ref = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    items.forEach((it, i) => {
      _p.set(it.x, it.y, it.z);
      _q.setFromAxisAngle(UP, it.ry);
      _s.set(it.sx, it.sy, it.sz);
      _m.compose(_p, _q, _s);
      mesh.setMatrixAt(i, _m);
      if (it.color) mesh.setColorAt(i, it.color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [items]);

  if (items.length === 0) return null;
  return (
    // `as never`: two copies of three's types are in play (same workaround as Room3D)
    <instancedMesh ref={ref} args={[geometry as never, undefined, items.length]} castShadow={castShadow} frustumCulled={false}>
      <meshStandardMaterial vertexColors flatShading roughness={0.88} />
    </instancedMesh>
  );
}

interface Scenery3DProps {
  plan: SceneryPlan;
  /** Ground height at a world position, so every plant sits on the terrain */
  heightAt: (x: number, z: number) => number;
}

/**
 * Draws a SceneryPlan: five tree species, bushes, flowers, mushrooms, rocks
 * and grass tufts. Each kind is one InstancedMesh with a baked-color model,
 * so the whole forest costs about a dozen draw calls.
 */
export function Scenery3D({ plan, heightAt }: Scenery3DProps) {
  const models = useMemo(
    () => ({
      pine: pineGeometry(),
      round: roundTreeGeometry("#86d094"),
      blossom: roundTreeGeometry("#f7b3d1"),
      violet: roundTreeGeometry("#b79cf0"),
      umbrella: umbrellaTreeGeometry(),
      bush: bushGeometry(),
      stem: flowerStemGeometry(),
      head: flowerHeadGeometry(),
      mStem: mushroomStemGeometry(),
      mCap: mushroomCapGeometry(),
      rock: rockGeometry(),
      tuft: tuftGeometry(),
    }),
    [],
  );
  useEffect(
    () => () => {
      Object.values(models).forEach((g) => g.dispose());
    },
    [models],
  );

  const items = useMemo(() => {
    const trees = {} as Record<TreeType, Item[]>;
    for (const t of ["pine", "round", "blossom", "violet", "umbrella"] as TreeType[]) trees[t] = [];
    for (const t of plan.trees) {
      trees[t.type].push({ x: t.x, y: heightAt(t.x, t.z) - SINK, z: t.z, sx: t.scale, sy: t.scale, sz: t.scale, ry: t.rot, color: grey(t.tint) });
    }
    const bushes = plan.bushes.map((b) => ({ x: b.x, y: heightAt(b.x, b.z) - SINK, z: b.z, sx: b.scale, sy: b.scale, sz: b.scale, ry: b.rot, color: grey(b.tint) }));
    // Small plants are scaled up so they read as intentional patches from the
    // default camera distance instead of as specks.
    const FLOWER = 2.0;
    const MUSHROOM = 1.7;
    const stems = plan.flowers.map((f) => ({ x: f.x, y: heightAt(f.x, f.z) - SINK, z: f.z, sx: 1.5, sy: f.scale * FLOWER, sz: 1.5, ry: 0 }));
    const heads = plan.flowers.map((f) => ({ x: f.x, y: heightAt(f.x, f.z) - SINK, z: f.z, sx: f.scale * FLOWER, sy: f.scale * FLOWER, sz: f.scale * FLOWER, ry: 0, color: FLOWER_COLORS[f.color] }));
    const mStems = plan.mushrooms.map((m) => ({ x: m.x, y: heightAt(m.x, m.z) - SINK, z: m.z, sx: m.scale * MUSHROOM, sy: m.scale * MUSHROOM, sz: m.scale * MUSHROOM, ry: 0 }));
    const mCaps = plan.mushrooms.map((m) => ({ x: m.x, y: heightAt(m.x, m.z) - SINK, z: m.z, sx: m.scale * MUSHROOM, sy: m.scale * MUSHROOM, sz: m.scale * MUSHROOM, ry: 0, color: CAP_COLORS[m.cap] }));
    const rocks = plan.rocks.map((r) => ({ x: r.x, y: heightAt(r.x, r.z) - 0.1, z: r.z, sx: r.scale, sy: r.scale * 0.9, sz: r.scale * 1.1, ry: r.rot, color: grey(0.5) }));
    const tufts = plan.tufts.map((t) => ({ x: t.x, y: heightAt(t.x, t.z) - SINK, z: t.z, sx: t.scale * 1.4, sy: t.scale * 1.4, sz: t.scale * 1.4, ry: t.rot, color: grey(t.tint, 0.9, 0.2) }));
    return { trees, bushes, stems, heads, mStems, mCaps, rocks, tufts };
  }, [plan, heightAt]);

  return (
    <group>
      <Instanced geometry={models.pine} items={items.trees.pine} castShadow />
      <Instanced geometry={models.round} items={items.trees.round} castShadow />
      <Instanced geometry={models.blossom} items={items.trees.blossom} castShadow />
      <Instanced geometry={models.violet} items={items.trees.violet} castShadow />
      <Instanced geometry={models.umbrella} items={items.trees.umbrella} castShadow />
      {/* Only trees cast shadows: bushes and rocks are small, and every caster is drawn twice. */}
      <Instanced geometry={models.bush} items={items.bushes} />
      <Instanced geometry={models.stem} items={items.stems} />
      <Instanced geometry={models.head} items={items.heads} />
      <Instanced geometry={models.mStem} items={items.mStems} />
      <Instanced geometry={models.mCap} items={items.mCaps} />
      <Instanced geometry={models.rock} items={items.rocks} />
      <Instanced geometry={models.tuft} items={items.tufts} />
    </group>
  );
}
