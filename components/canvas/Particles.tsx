"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import gsap from "gsap";
import {
  AdditiveBlending,
  Color,
  MathUtils,
  Plane,
  Raycaster,
  Vector2,
  Vector3,
  type BufferAttribute,
  type BufferGeometry,
  type Points,
  type ShaderMaterial,
} from "three";
import { sphere, text } from "@/lib/shapes";
import { REDUCED_MOTION_QUERY, useMediaQuery } from "@/lib/media";
import { useIntroStore, useScrollStore } from "@/lib/store";

type ParticlesProps = {
  count: number;
  onError: (message: string | null) => void;
};

// One shape per section: Hero, Services, Work, Contact.
const SECTION_SHAPES: Array<(count: number) => Float32Array | Promise<Float32Array>> = [
  (count) => sphere(count),
  (count) => text("AI", count),
  (count) => text("WORK", count),
  (count) => text("?", count),
];
const LAST_FROM_INDEX = SECTION_SHAPES.length - 2;

// Building shapes (sampling the text surface) is slow, so do it once per particle
// count and keep the result for the whole session, across remounts and quality changes.
const shapeCache = new Map<number, Promise<Float32Array[]>>();
function loadSectionShapes(count: number): Promise<Float32Array[]> {
  let shapes = shapeCache.get(count);
  if (!shapes) {
    shapes = Promise.all(SECTION_SHAPES.map((make) => make(count)));
    // Don't cache failures, so a later attempt can retry.
    shapes.catch(() => shapeCache.delete(count));
    shapeCache.set(count, shapes);
  }
  return shapes;
}

// How far each section leans from cyan (0) toward violet (1): Hero, Services, Work, Contact.
// The value is blended smoothly between sections as you scroll.
const SECTION_COLOR_SHIFT = [0, 0.35, 0.7, 1];

// Mouse repel. A raycaster shoots an invisible ray from the camera through the mouse
// position into the 3D scene; we find where that ray hits a flat plane facing the
// camera at z = 0 (through the middle of the shapes). That hit point is the "mouse in 3D".
const MOUSE_PLANE = new Plane(new Vector3(0, 0, 1), 0);
const raycaster = new Raycaster();
const mouseHit = new Vector3();
const mouseNdc = new Vector2();
const groupWorldPosition = new Vector3();

// Shaders are small programs that run on the GPU. The vertex shader runs once per
// particle and decides WHERE it goes on screen; the fragment shader runs once per
// pixel of each particle and decides what COLOR that pixel is.
const vertexShader = /* glsl */ `
  // "attribute" = a value that is different for every particle (read from a buffer).
  attribute vec3 aFrom;    // where this particle starts (current section's shape)
  attribute vec3 aTo;      // where this particle ends (next section's shape)
  attribute float aRandom; // a fixed random number 0-1, unique to this particle

  // "uniform" = one value shared by every particle, set from JavaScript.
  uniform float uProgress; // 0 = all at aFrom, 1 = all at aTo (scroll between sections)
  uniform float uSize;     // particle size in world units
  uniform float uScale;    // half the canvas height in pixels, for perspective sizing
  uniform float uTime;     // seconds since start, makes the noise field slowly evolve
  uniform vec2 uMouse;     // mouse position on the z = 0 plane, in world units
  uniform float uMouseStrength; // 0 = mouse away / off-screen, 1 = fully active (eased in JS)
  uniform vec3 uColorA;      // cyan
  uniform vec3 uColorB;      // violet
  uniform float uColorShift; // per-section lean toward violet, 0-1 (blended while scrolling)
  uniform float uAssemble;   // intro: 0 = scattered randomly, 1 = assembled into the shape
  uniform float uMotion;     // 1 = normal, 0 = prefers-reduced-motion (no drift)

  // A "varying" is passed from the vertex shader to the fragment shader. Here: this
  // particle's color, worked out once per particle instead of once per pixel.
  varying vec3 vColor;

  // ---- 3D simplex noise (standard public implementation by Ashima Arts / Stefan
  // Gustavson, MIT). snoise(p) returns a smooth pseudo-random value in about -1..1:
  // nearby points get similar values, so it looks organic rather than jittery.
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    i = mod289(i);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 105.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }
  // ---- end simplex noise

  // Three independent noise values = a random-but-smooth 3D vector at every point.
  // The odd offsets just sample far-apart regions so x, y and z don't match.
  vec3 noiseVec3(vec3 p) {
    return vec3(
      snoise(p),
      snoise(vec3(p.y - 19.1, p.z + 33.4, p.x + 47.2)),
      snoise(vec3(p.z + 74.2, p.x - 124.5, p.y + 99.4))
    );
  }

  // Curl noise: the "curl" measures how a vector field swirls around each point.
  // Taking the curl of a noise field gives a flow with no sources or sinks, like
  // smoke or water, so particles swirl past each other instead of clumping together.
  vec3 curlNoise(vec3 p) {
    // Sample the field a tiny step (e) either side of p on each axis to estimate
    // how fast it changes there (a "finite difference" derivative).
    const float e = 0.1;
    vec3 dx = vec3(e, 0.0, 0.0);
    vec3 dy = vec3(0.0, e, 0.0);
    vec3 dz = vec3(0.0, 0.0, e);

    vec3 px0 = noiseVec3(p - dx);
    vec3 px1 = noiseVec3(p + dx);
    vec3 py0 = noiseVec3(p - dy);
    vec3 py1 = noiseVec3(p + dy);
    vec3 pz0 = noiseVec3(p - dz);
    vec3 pz1 = noiseVec3(p + dz);

    // The curl formula: each axis = change of one component along another axis,
    // minus the reverse. Dividing by 2e turns the differences into rates of change.
    float x = (py1.z - py0.z) - (pz1.y - pz0.y);
    float y = (pz1.x - pz0.x) - (px1.z - px0.z);
    float z = (px1.y - px0.y) - (py1.x - py0.x);
    return vec3(x, y, z) / (2.0 * e);
  }

  void main() {
    // Each particle waits a little before it starts moving (0 to 0.3 of the way)...
    float delay = aRandom * 0.3;
    // ...then travels over the next 0.7. smoothstep turns uProgress into a 0-1 value
    // that eases in and out, so motion starts and stops gently instead of snapping.
    // The latest particle finishes at 0.3 + 0.7 = 1.0, so everyone arrives at uProgress = 1.
    float t = smoothstep(delay, delay + 0.7, uProgress);

    // mix(a, b, t) blends between two values: t = 0 gives a, t = 1 gives b.
    vec3 transformed = mix(aFrom, aTo, t);

    // Intro assemble. First, a random "scattered" start point for this particle:
    // sin() of a big number is chaotic, and fract() keeps just the 0-1 decimal part,
    // so each particle gets its own pseudo-random x, y, z. "- 0.5" centers it on 0 and
    // "* 14.0" spreads the cloud about 14 units wide, well beyond the screen edges.
    vec3 scattered = (fract(sin(aRandom * vec3(12.9898, 78.233, 37.719)) * 43758.5453) - 0.5) * 14.0;
    // Same staggered easing as the morph: each particle starts at a slightly different
    // moment (up to 0.4 in) and takes 0.6 to arrive, so they stream in, not all at once.
    float assembleT = smoothstep(aRandom * 0.4, aRandom * 0.4 + 0.6, uAssemble);
    transformed = mix(scattered, transformed, assembleT);

    // Drift: look up the swirl at this particle's position (scaled by 0.6 so the swirls
    // are fairly large) while slowly sliding through the field over time (uTime * 0.08).
    // The result is an offset, not a velocity, so particles float around their spot in
    // the shape and never wander off. 0.04 keeps the movement subtle.
    vec3 drift = curlNoise(transformed * 0.6 + uTime * 0.08);
    // uMotion = 0 (reduced motion) switches the drift off entirely.
    transformed += drift * 0.04 * uMotion;

    // Color. Measure where the particle sits along a diagonal (bottom-left to top-right)
    // of the shape: x + y runs about -2.8..2.8 for our radius-2 shapes; smoothstep turns
    // that into 0 (bottom-left) .. 1 (top-right) with soft ends.
    float gradient = smoothstep(-2.5, 2.5, transformed.x + transformed.y);
    // Each section picks which half of the cyan→violet range the gradient covers:
    // shift 0 → cyan..halfway, shift 1 → halfway..violet. So there's always a gradient
    // across the shape, and the overall hue slides toward violet as you scroll down.
    float colorMix = mix(gradient * 0.5, 0.5 + gradient * 0.5, uColorShift);
    vColor = mix(uColorA, uColorB, colorMix);

    // modelMatrix moves the point from the shape's own space into world space (applies
    // the slow rotation). We need world space because that's where uMouse lives.
    vec4 worldPosition = modelMatrix * vec4(transformed, 1.0);

    // Mouse repel. Compare only x and y (ignoring depth), so the push looks like it
    // follows the cursor on screen for particles at the front and back alike.
    vec2 away = worldPosition.xy - uMouse;  // arrow from the mouse to this particle
    float dist = length(away);
    // Falloff: 1 right under the mouse, easing smoothly to 0 at the 0.8 radius, so
    // there's no hard edge where particles suddenly stop reacting.
    float falloff = 1.0 - smoothstep(0.0, 0.8, dist);
    // Normalize the arrow to length 1 (guarding against dividing by zero right at the
    // mouse), then push along it: up to 0.35 units, scaled by falloff and strength.
    vec2 direction = dist > 0.0001 ? away / dist : vec2(0.0);
    worldPosition.xy += direction * falloff * 0.35 * uMouseStrength;

    // viewMatrix moves the point from world space into camera space (relative to the
    // camera). The result's z is the distance in front of the camera.
    vec4 mvPosition = viewMatrix * worldPosition;

    // projectionMatrix flattens camera space onto the 2D screen (adds perspective).
    gl_Position = projectionMatrix * mvPosition;

    // Point size in pixels. Dividing by distance (-z) makes far particles smaller,
    // the same formula three.js PointsMaterial uses with sizeAttenuation.
    gl_PointSize = uSize * (uScale / -mvPosition.z);

    // Explosion feel: sin() over 0..PI rises from 0 to 1 and back to 0, so particles
    // are normal size at rest (uProgress 0 or 1) and largest halfway through a morph.
    // 1.0 + 1.5 * ... means up to 2.5x the normal size at the peak.
    const float PI = 3.141592653589793;
    gl_PointSize *= 1.0 + 1.5 * sin(uProgress * PI);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uOpacity; // overall brightness of each particle
  varying vec3 vColor;    // this particle's color, from the vertex shader

  void main() {
    // gl_PointCoord is this pixel's position inside the particle's square, 0-1 on each axis.
    // Subtracting 0.5 puts (0, 0) at the center; length() gives the distance from it.
    float d = length(gl_PointCoord - 0.5);

    // Points are drawn as squares. Throw away pixels outside the circle (radius 0.5)
    // so we get a round dot instead.
    if (d > 0.5) discard;

    // Glow: 1 at the center, fading to 0 at the edge. Squaring makes the fade steeper,
    // giving a bright core with a soft halo.
    float glow = 1.0 - smoothstep(0.0, 0.5, d);
    glow *= glow;

    // Output the final pixel color: RGB plus alpha (transparency).
    gl_FragColor = vec4(vColor, glow * uOpacity);
  }
`;

export default function Particles({ count, onError }: ParticlesProps) {
  const pointsRef = useRef<Points>(null);
  const geometryRef = useRef<BufferGeometry>(null);
  const materialRef = useRef<ShaderMaterial>(null);
  // What is currently in aFrom/aTo: which section pair, from which loaded shapes, in
  // which geometry. If any of these change, the buffers need refilling.
  const swappedRef = useRef<{
    index: number;
    shapes: Float32Array[] | null;
    geometry: BufferGeometry | null;
  }>({ index: -1, shapes: null, geometry: null });
  const height = useThree((state) => state.size.height);
  const dpr = useThree((state) => state.viewport.dpr);
  const reduceMotion = useMediaQuery(REDUCED_MOTION_QUERY);

  // GPU buffers for aFrom/aTo. They start as the sphere and get overwritten in place
  // when the section changes, so nothing is reallocated while scrolling.
  const buffers = useMemo(() => ({ from: sphere(count), to: sphere(count) }), [count]);
  const [loaded, setLoaded] = useState<Float32Array[] | null>(null);
  // Ignore shapes built for a previous particle count (e.g. right after a resize).
  const shapes = loaded?.[0].length === count * 3 ? loaded : null;

  // One stable random number per particle (a cheap deterministic hash, so it's pure).
  const randoms = useMemo(() => {
    const result = new Float32Array(count);
    for (let index = 0; index < count; index += 1) {
      const value = Math.sin(index * 12.9898) * 43758.5453;
      result[index] = value - Math.floor(value);
    }
    return result;
  }, [count]);

  // Created once; values are updated in useFrame instead of re-creating the object.
  const uniforms = useMemo(
    () => ({
      uProgress: { value: 0 },
      uAssemble: { value: 0 },
      uMotion: { value: 1 },
      uSize: { value: 0.035 }, // a bit larger than 0.02 because the soft edge fades out
      uScale: { value: 1 },
      uTime: { value: 0 },
      uMouse: { value: new Vector2() },
      uMouseStrength: { value: 0 },
      uColorA: { value: new Color("#4cc9f0") },
      uColorB: { value: new Color("#7b2ff7") },
      uColorShift: { value: SECTION_COLOR_SHIFT[0] },
      uOpacity: { value: 0.72 },
    }),
    [],
  );

  useEffect(() => {
    let cancelled = false;

    loadSectionShapes(count)
      .then((nextShapes) => {
        if (cancelled) return;
        setLoaded(nextShapes);
        useIntroStore.setState({ shapesReady: true });
        onError(null);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message =
          error instanceof Error ? error.message : "Unable to generate the shapes.";
        onError(message);
        // Don't leave the loader stuck: assemble into the fallback sphere instead.
        useIntroStore.setState({ shapesReady: true });
      });

    return () => {
      cancelled = true;
    };
  }, [count, onError]);

  // Once the loader has faded out, animate uAssemble 0 → 1: particles fly in from
  // their scattered positions and settle into the Hero shape.
  const introStarted = useIntroStore((state) => state.started);
  useEffect(() => {
    const material = materialRef.current;
    if (!introStarted || !material) return;

    const tween = gsap.to(material.uniforms.uAssemble, {
      value: 1,
      duration: reduceMotion ? 0 : 2.8,
      ease: "power3.inOut",
    });
    return () => {
      tween.kill();
    };
  }, [introStarted, reduceMotion]);

  // Mouse in "normalized device coordinates": -1..1 across the screen, +1 at the top.
  // The canvas ignores pointer events (DOM sections sit on top), so listen on window.
  const pointerRef = useRef({ x: 0, y: 0, active: false });
  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      pointerRef.current = {
        x: (event.clientX / window.innerWidth) * 2 - 1,
        y: -(event.clientY / window.innerHeight) * 2 + 1,
        active: true,
      };
    };
    const onLeave = () => {
      pointerRef.current = { ...pointerRef.current, active: false };
    };
    const root = document.documentElement;

    window.addEventListener("pointermove", onMove);
    root.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  useFrame((state, delta) => {
    const geometry = geometryRef.current;
    const material = materialRef.current;
    if (!geometry || !material || !pointsRef.current) return;

    // 0-3 overall; floor picks the section pair, the remainder is the morph amount.
    const progress = Math.min(Math.max(useScrollStore.getState().progress, 0), 3);
    // At exactly 3 we stay on the last pair (Work → Contact) with morph = 1.
    const index = Math.min(Math.floor(progress), LAST_FROM_INDEX);

    const swapped = swappedRef.current;
    if (
      shapes &&
      (swapped.index !== index ||
        swapped.shapes !== shapes ||
        swapped.geometry !== geometry)
    ) {
      // Copy the new shapes into the existing buffers and tell three.js to re-upload them.
      const from = geometry.getAttribute("aFrom") as BufferAttribute;
      const to = geometry.getAttribute("aTo") as BufferAttribute;
      from.set(shapes[index]);
      to.set(shapes[index + 1]);
      from.needsUpdate = true;
      to.needsUpdate = true;
      swappedRef.current = { index, shapes, geometry };
    }

    // Reduced motion: no in-between morph. Snap to whichever section's shape is
    // nearer (0 or 1), so shapes simply swap instead of flying across the screen.
    const rawMorph = progress - index;
    const morph = reduceMotion ? Math.round(rawMorph) : rawMorph;
    material.uniforms.uProgress.value = morph;
    material.uniforms.uMotion.value = reduceMotion ? 0 : 1;
    // Blend this section's color shift toward the next one's as you scroll between them.
    material.uniforms.uColorShift.value = MathUtils.lerp(
      SECTION_COLOR_SHIFT[index],
      SECTION_COLOR_SHIFT[index + 1],
      morph,
    );
    material.uniforms.uTime.value = state.clock.elapsedTime;

    // Mouse: raycast to the z = 0 plane, then ease toward the hit point.
    const pointer = pointerRef.current;
    const mouse = material.uniforms.uMouse.value as Vector2;
    const strength = material.uniforms.uMouseStrength;
    // The section group can move the shape toward the camera (Contact), so put the
    // mouse plane at the shape's current depth instead of always at z = 0.
    MOUSE_PLANE.constant = -pointsRef.current.getWorldPosition(groupWorldPosition).z;
    raycaster.setFromCamera(mouseNdc.set(pointer.x, pointer.y), state.camera);
    // Reduced motion: no mouse repel.
    const hit =
      !reduceMotion &&
      pointer.active &&
      raycaster.ray.intersectPlane(MOUSE_PLANE, mouseHit);
    if (hit) {
      if (strength.value < 0.01) {
        // Effect was off: jump straight to the cursor so it doesn't sweep across.
        mouse.set(hit.x, hit.y);
      } else {
        // damp() moves a fraction of the remaining distance each frame (frame-rate
        // independent), so the push trails the cursor smoothly instead of snapping.
        mouse.x = MathUtils.damp(mouse.x, hit.x, 10, delta);
        mouse.y = MathUtils.damp(mouse.y, hit.y, 10, delta);
      }
    }
    // Fade the whole effect in when the mouse arrives and out when it leaves.
    strength.value = MathUtils.damp(strength.value, hit ? 1 : 0, 4, delta);

    // Canvas pixels = CSS pixels * device pixel ratio.
    material.uniforms.uScale.value = (height * dpr) / 2;

    if (reduceMotion) return; // static: no idle rotation
    pointsRef.current.rotation.y += delta * 0.025;
    pointsRef.current.rotation.x += delta * 0.006;
  });

  return (
    // frustumCulled={false}: three.js skips objects it thinks are off-screen using the
    // "position" bounds, which doesn't know the shader moves points toward aTo.
    <points ref={pointsRef} frustumCulled={false}>
      {/* key: GPU buffers can't change size, so rebuild the geometry when the count changes. */}
      <bufferGeometry key={count} ref={geometryRef}>
        {/* three.js reads "position" to know how many points to draw. */}
        <bufferAttribute attach="attributes-position" args={[buffers.from, 3]} />
        <bufferAttribute attach="attributes-aFrom" args={[buffers.from, 3]} />
        <bufferAttribute attach="attributes-aTo" args={[buffers.to, 3]} />
        <bufferAttribute attach="attributes-aRandom" args={[randoms, 1]} />
      </bufferGeometry>
      {/* Additive blending adds each particle's color to what's behind it, so
          overlapping dots get brighter, like light. depthWrite off stops particles
          from hiding each other. */}
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  );
}
