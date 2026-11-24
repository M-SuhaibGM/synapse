"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { Float, MeshTransmissionMaterial } from "@react-three/drei";
import {
  IcosahedronGeometry,
  MathUtils,
  Quaternion,
  Vector3,
  type BufferAttribute,
  type Group,
  type Material,
  type Mesh,
  type PerspectiveCamera,
} from "three";
import { REDUCED_MOTION_QUERY, useMediaQuery } from "@/lib/media";
import { useQualityStore, useScrollStore } from "@/lib/store";
import { useDevice } from "@/lib/useDevice";
import { useTilt } from "@/lib/useTilt";

const GLASS_RADIUS = 2.2;
// The particle brain sits inside the glass at this scale, growing back to 1 as the
// glass shatters on the way to Services.
const BRAIN_SCALE = 0.7;
// How far the whole group leans toward the mouse / with the phone tilt (radians at the screen edges).
const TILT_X = 0.22;
const TILT_Y = 0.32;
// Mobile Hero: the crystal shrinks and sits centered in the top 45% of the screen,
// leaving the bottom for the text. 0.55 = that band's middle (22.5% from the top) as
// -1..1 screen height (+1 = top edge).
const MOBILE_SCALE = 0.6;
const MOBILE_SCREEN_Y = 0.55;
// Mobile glass isn't see-through glass (no transmission), so it's made partly
// transparent to keep the particle brain inside visible.
const MOBILE_GLASS_OPACITY = 0.35;

type ChromeShape = "octahedron" | "tetrahedron" | "torus" | "icosahedron";
const CHROME: Array<{ shape: ChromeShape; position: [number, number, number]; scale: number }> = [
  { shape: "octahedron", position: [-3.6, 1.6, -0.5], scale: 0.42 },
  { shape: "torus", position: [3.5, 1.9, -1], scale: 0.38 },
  { shape: "tetrahedron", position: [-3.1, -1.9, 0.6], scale: 0.45 },
  { shape: "icosahedron", position: [3.3, -1.5, 0.8], scale: 0.36 },
  { shape: "torus", position: [-1.6, 2.9, -1.4], scale: 0.3 },
  { shape: "octahedron", position: [2, -2.9, -0.8], scale: 0.32 },
  { shape: "icosahedron", position: [-2.4, -0.2, 2.2], scale: 0.25 },
  { shape: "tetrahedron", position: [1.6, 2.6, 1.6], scale: 0.28 },
];

// Deterministic 0-1 "random" per index (same hash as the particles), so render stays pure.
const hash = (n: number) => {
  const value = Math.sin(n * 12.9898) * 43758.5453;
  return value - Math.floor(value);
};

// Scratch objects reused every frame (no allocations in the render loop).
const vertex = new Vector3();
const normal = new Vector3();
const shardCenter = new Vector3();
const spin = new Quaternion();

function ChromeGeometry({ shape }: { shape: ChromeShape }) {
  if (shape === "torus") return <torusGeometry args={[0.8, 0.28, 24, 64]} />;
  if (shape === "octahedron") return <octahedronGeometry args={[1, 0]} />;
  if (shape === "tetrahedron") return <tetrahedronGeometry args={[1, 0]} />;
  return <icosahedronGeometry args={[1, 0]} />;
}

// Hero centerpiece: the particle brain (children) inside a glass icosahedron, ringed
// by floating chrome shapes. Everything leans toward the mouse; scrolling out of the
// Hero shatters the glass and scatters the chrome while the particles carry on.
export default function HeroCrystal({ children }: { children: ReactNode }) {
  const layoutRef = useRef<Group>(null);
  const tiltRef = useRef<Group>(null);
  const brainRef = useRef<Group>(null);
  const glassRef = useRef<Mesh>(null);
  const chromeRefs = useRef<Array<Group | null>>([]);
  const lastShatterRef = useRef(-1);
  // Phone tilt, or the mouse on desktop (-1..1, already smoothed).
  const tiltInput = useTilt();
  const reduceMotion = useMediaQuery(REDUCED_MOTION_QUERY);
  const lowQuality = useQualityStore((state) => state.quality === "low");
  const { isMobile } = useDevice();

  // The glass mesh. Icosahedron geometry is "non-indexed": every triangle has its own
  // 3 vertices, so each face can fly off on its own like a shard. computeVertexNormals
  // then gives each face one flat normal, for crisp crystal facets instead of a smooth ball.
  const geometry = useMemo(() => {
    const result = new IcosahedronGeometry(GLASS_RADIUS, 1);
    result.computeVertexNormals();
    return result;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  // Per shard (= face): its resting center, outward direction, how far it flies and
  // how it tumbles. Original vertex positions/normals are kept to rebuild from.
  const shards = useMemo(() => {
    const positions = geometry.getAttribute("position") as BufferAttribute;
    const base = Float32Array.from(positions.array);
    const baseNormals = Float32Array.from(geometry.getAttribute("normal").array);
    const faces = [];
    for (let face = 0; face < positions.count / 3; face += 1) {
      const center = new Vector3();
      for (let k = 0; k < 3; k += 1) center.add(vertex.fromArray(base, (face * 3 + k) * 3));
      center.divideScalar(3);
      faces.push({
        center,
        direction: center.clone().normalize(),
        distance: 1.4 + hash(face) * 2.6,
        axis: new Vector3(hash(face + 101) - 0.5, hash(face + 202) - 0.5, hash(face + 303) - 0.5).normalize(),
        angle: (hash(face + 404) - 0.5) * Math.PI * 2,
      });
    }
    return { base, baseNormals, faces };
  }, [geometry]);

  // The glass material swaps when crossing 768px: redo the shatter pass once so the
  // new material gets the right opacity.
  useEffect(() => {
    lastShatterRef.current = -1;
  }, [isMobile]);

  useFrame(({ camera }) => {
    const layout = layoutRef.current;
    const tilt = tiltRef.current;
    const glass = glassRef.current;
    if (!layout || !tilt || !glass) return;

    // Tilt: rotating +y turns the front toward +x (right), rotating +x turns it down,
    // so these signs make the group face the cursor / follow the phone's tilt.
    // useTilt already smooths (and zeroes it under reduced motion).
    const { x, y } = tiltInput.current;
    tilt.rotation.y = x * TILT_Y;
    tilt.rotation.x = -y * TILT_X;

    // Shatter amount: 0 while in the Hero, 1 most of the way to Services.
    const progress = useScrollStore.getState().progress;
    const shatter = reduceMotion
      ? Number(progress > 0.5)
      : MathUtils.smoothstep(progress, 0.05, 0.75);

    // Mobile layout, easing back to full size and centered as the glass shatters, so
    // the particles take their normal place in the later sections. World height
    // visible at the crystal's depth = 2 × tan(half the vertical field of view) × distance.
    if (isMobile) {
      const { fov, position } = camera as PerspectiveCamera;
      const halfHeight = Math.tan(MathUtils.degToRad(fov / 2)) * position.z;
      layout.position.y = MathUtils.lerp(MOBILE_SCREEN_Y * halfHeight, 0, shatter);
      layout.scale.setScalar(MathUtils.lerp(MOBILE_SCALE, 1, shatter));
    } else {
      layout.position.y = 0;
      layout.scale.setScalar(1);
    }

    if (shatter === lastShatterRef.current) return; // nothing changed this frame
    lastShatterRef.current = shatter;

    brainRef.current?.scale.setScalar(MathUtils.lerp(BRAIN_SCALE, 1, shatter));

    // Shards: shrink each face around its center, tumble it, and push it outward.
    const positions = geometry.getAttribute("position") as BufferAttribute;
    const normals = geometry.getAttribute("normal") as BufferAttribute;
    const { base, baseNormals, faces } = shards;
    const shrink = 1 - shatter * 0.6;
    faces.forEach((face, index) => {
      spin.setFromAxisAngle(face.axis, face.angle * shatter);
      shardCenter.copy(face.center).addScaledVector(face.direction, face.distance * shatter);
      for (let k = 0; k < 3; k += 1) {
        const offset = (index * 3 + k) * 3;
        vertex.fromArray(base, offset).sub(face.center).multiplyScalar(shrink).applyQuaternion(spin).add(shardCenter);
        vertex.toArray(positions.array, offset);
        normal.fromArray(baseNormals, offset).applyQuaternion(spin).toArray(normals.array, offset);
      }
    });
    positions.needsUpdate = true;
    normals.needsUpdate = true;

    const material = glass.material as Material;
    material.opacity = (isMobile ? MOBILE_GLASS_OPACITY : 1) * (1 - shatter);
    // An invisible transmission material also skips its extra scene render (big saving).
    material.visible = shatter < 0.999;

    // Chrome: fly outward from the center and shrink away.
    chromeRefs.current.forEach((group, index) => {
      if (!group) return;
      const [px, py, pz] = CHROME[index].position;
      const push = 1 + shatter * 1.8;
      group.position.set(px * push, py * push, pz * push);
      group.scale.setScalar(CHROME[index].scale * (1 - shatter));
      group.visible = shatter < 0.999;
    });
  });

  return (
    <group ref={layoutRef}>
      <group ref={tiltRef}>
        <group ref={brainRef} scale={BRAIN_SCALE}>
          {children}
        </group>

        {/* renderOrder 1: drawn after the particles (transparent objects sort by this
            first), so the glass covers them and they're seen refracted through it.
            frustumCulled off: the shards move outside the original bounds. */}
        <mesh ref={glassRef} geometry={geometry} renderOrder={1} frustumCulled={false}>
          {/* Transmission = light passing through, like glass. drei renders the scene
              behind the mesh into a texture and bends (refracts) it by ior/thickness;
              iridescence adds the soap-bubble rainbow sheen, clearcoat a glossy top layer.
              Mobile skips that extra render: a plain physical (PBR) material, shiny and
              partly transparent, with the same rainbow sheen from iridescence. */}
          {isMobile ? (
            <meshPhysicalMaterial
              roughness={0.1}
              metalness={0.2}
              iridescence={1}
              transparent
              opacity={MOBILE_GLASS_OPACITY}
            />
          ) : (
            <MeshTransmissionMaterial
              transmission={1}
              thickness={1.5}
              roughness={0.12}
              ior={1.42}
              iridescence={1}
              clearcoat={0.6}
              chromaticAberration={0.05}
              samples={lowQuality ? 4 : 8}
              resolution={lowQuality ? 256 : 512}
              transparent
            />
          )}
        </mesh>

        {CHROME.map((item, index) => (
          <group
            key={index}
            ref={(group) => {
              chromeRefs.current[index] = group;
            }}
            position={item.position}
            scale={item.scale}
          >
            {/* Float gently bobs and rotates its children on its own. */}
            <Float
              speed={reduceMotion ? 0 : 1.4}
              rotationIntensity={1.2}
              floatIntensity={1.1}
              floatingRange={[-0.25, 0.25]}
            >
              {/* High metalness + low roughness = mirror-like chrome; it reflects the
                  Environment lightformers, which is where all its shine comes from. */}
              <mesh>
                <ChromeGeometry shape={item.shape} />
                <meshStandardMaterial color="#e8ecf4" metalness={0.92} roughness={0.14} />
              </mesh>
            </Float>
          </group>
        ))}
      </group>
    </group>
  );
}
