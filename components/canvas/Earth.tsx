"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import {
  AdditiveBlending,
  BackSide,
  Color,
  MathUtils,
  QuadraticBezierCurve3,
  Quaternion,
  SRGBColorSpace,
  TubeGeometry,
  Vector3,
  type Group,
  type Mesh,
  type ShaderMaterial,
  type Texture,
} from "three";
import { REDUCED_MOTION_QUERY, useMediaQuery } from "@/lib/media";
import { useScrollStore } from "@/lib/store";

const RADIUS = 1.3;
const CITIES = [
  { name: "Lahore", lat: 31.5204, lng: 74.3587 },
  { name: "Dubai", lat: 25.2048, lng: 55.2708 },
  { name: "Riyadh", lat: 24.7136, lng: 46.6753 },
];
const ROUTES: Array<[number, number]> = [
  [0, 1],
  [1, 2],
  [0, 2],
];
// Start with the middle of the region facing the camera (see the rotation maths below).
const FOCUS = { lat: 28, lng: 60 };
const AUTO_SPIN = 0.05; // radians per second, a full turn every ~2 minutes
const CLOUD_SPIN = 0.012; // extra spin of the clouds on top of the Earth's

// Latitude/longitude → a point on the sphere. Latitude tilts up from the equator,
// longitude goes around it. This matches how three.js wraps a flat world map onto
// SphereGeometry (the map's left edge, -180°, lands on the -x side).
function latLngToVector3(lat: number, lng: number, radius: number) {
  const phi = MathUtils.degToRad(90 - lat); // angle down from the north pole
  const theta = MathUtils.degToRad(lng + 180); // angle around the y axis
  return new Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

// Scratch vectors reused every frame (no allocations in the render loop).
const screenCenter = new Vector3();
const screenEdge = new Vector3();
const UP_Z = new Vector3(0, 0, 1);

// Fixed "sun" direction in camera space (upper left, slightly in front), so the lit
// side always faces the viewer whichever way the globe is turned.
const SUN = /* glsl */ `const vec3 SUN = normalize(vec3(-0.6, 0.45, 0.75));`;

// Shared vertex shader for the Earth and clouds: pass on the texture coordinate and
// the surface normal in camera space (normalMatrix turns the object's normals with it).
const surfaceVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Simple "Lambert" lighting: brightness = how directly the surface faces the sun
// (dot product of the two directions), plus a little ambient so the night side isn't black.
const earthFragment = /* glsl */ `
  uniform sampler2D uMap;
  varying vec2 vUv;
  varying vec3 vNormal;
  ${SUN}
  void main() {
    vec3 color = texture2D(uMap, vUv).rgb;
    float light = 0.18 + 0.82 * max(dot(normalize(vNormal), SUN), 0.0);
    gl_FragColor = vec4(color * light * 0.9, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

// Clouds are white on black: use the brightness as opacity, lit like the Earth.
const cloudFragment = /* glsl */ `
  uniform sampler2D uMap;
  varying vec2 vUv;
  varying vec3 vNormal;
  ${SUN}
  void main() {
    vec4 tex = texture2D(uMap, vUv);
    float alpha = dot(tex.rgb, vec3(0.333)) * tex.a;
    float light = 0.15 + 0.85 * max(dot(normalize(vNormal), SUN), 0.0);
    gl_FragColor = vec4(vec3(light), alpha * 0.85);
    #include <colorspace_fragment>
  }
`;

// Atmosphere. "Fresnel" = surfaces seen edge-on reflect/glow more than ones facing
// you. We draw only the BACK faces of a slightly bigger sphere: they show as a ring
// around the Earth, brightest right at the Earth's edge and fading outward.
const atmosphereVertex = /* glsl */ `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const atmosphereFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uStrength;
  varying vec3 vNormal;
  void main() {
    // The camera looks down -z, so dot(normal, (0,0,1)) says how much a face points
    // at us. Back faces point away (negative), most of all just outside the Earth's
    // edge; pow() sharpens the falloff into a thin halo.
    float intensity = pow(clamp(0.62 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0, 1.4), 4.0);
    gl_FragColor = vec4(uColor * intensity * uStrength, 1.0);
  }
`;

// Arcs. A tube's uv.x runs 0 → 1 along its length, so cutting it into stripes with
// fract() and sliding them with time gives a moving dashed line.
const arcVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const arcFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uStrength;
  varying vec2 vUv;
  void main() {
    float stripe = fract(vUv.x * 6.0 - uTime * 0.5);    // 6 dashes, moving start → end
    float dash = smoothstep(0.0, 0.1, stripe) * (1.0 - smoothstep(0.45, 0.55, stripe));
    float ends = smoothstep(0.0, 0.08, vUv.x) * (1.0 - smoothstep(0.92, 1.0, vUv.x));
    float glow = 0.25 + dash; // faint base line under the bright dashes
    gl_FragColor = vec4(uColor * glow * ends * uStrength * 1.6, 1.0);
  }
`;

export default function Earth() {
  // useTexture suspends (pauses rendering this component) until both images load.
  const [dayMap, cloudMap] = useTexture(
    ["/textures/earth_day_2048.jpg", "/textures/earth_clouds_1024.png"],
    (textures) => {
      // Photos are stored in sRGB; telling three.js lets the GPU convert them to the
      // linear colors lighting maths expects.
      const [day] = textures as Texture[];
      day.colorSpace = SRGBColorSpace;
      day.anisotropy = 4;
    },
  );

  const rootRef = useRef<Group>(null);
  const tiltRef = useRef<Group>(null);
  const spinRef = useRef<Group>(null);
  const cloudsRef = useRef<Mesh>(null);
  const pinRefs = useRef<Array<Mesh | null>>([]);
  const atmosphereRef = useRef<ShaderMaterial>(null);
  const arcRefs = useRef<Array<ShaderMaterial | null>>([]);
  const reduceMotion = useMediaQuery(REDUCED_MOTION_QUERY);

  // Drag state: target angles set by the pointer, eased toward in useFrame.
  const dragRef = useRef({ active: false, x: 0, y: 0, yaw: 0, pitch: 0 });
  const angleRef = useRef({ auto: 0, yaw: 0, pitch: 0 });

  const uniforms = useMemo(
    () => ({
      earth: { uMap: { value: dayMap } },
      clouds: { uMap: { value: cloudMap } },
      atmosphere: { uColor: { value: new Color("#4cc9f0") }, uStrength: { value: 0 } },
    }),
    [dayMap, cloudMap],
  );

  const pins = useMemo(
    () =>
      CITIES.map((city) => {
        const position = latLngToVector3(city.lat, city.lng, RADIUS);
        // A quaternion stores a rotation. This one turns the ring (which faces +z)
        // to face straight out from the globe, so it lies flat on the surface.
        const quaternion = new Quaternion().setFromUnitVectors(UP_Z, position.clone().normalize());
        return { position, quaternion };
      }),
    [],
  );

  // A quadratic Bézier curve bends from start to end toward one control point. Putting
  // that point above the midpoint (pushed out from the globe) makes the arc lift off
  // the surface; longer routes lift higher. TubeGeometry wraps a thin tube around it.
  const arcs = useMemo(
    () =>
      ROUTES.map(([a, b]) => {
        const start = latLngToVector3(CITIES[a].lat, CITIES[a].lng, RADIUS);
        const end = latLngToVector3(CITIES[b].lat, CITIES[b].lng, RADIUS);
        const lift = 1 + start.distanceTo(end) * 0.55;
        const control = start.clone().add(end).normalize().multiplyScalar(RADIUS * lift);
        return {
          geometry: new TubeGeometry(new QuadraticBezierCurve3(start, control, end), 48, 0.006, 6),
          uniforms: {
            uColor: { value: new Color("#4cc9f0") },
            uTime: { value: 0 },
            uStrength: { value: 0 },
          },
        };
      }),
    [],
  );
  useEffect(() => () => arcs.forEach((arc) => arc.geometry.dispose()), [arcs]);

  // Drag to rotate. The canvas ignores pointer events (DOM sections sit on top), so
  // listen on window and only start a drag when the press lands on the globe's disc.
  useEffect(() => {
    const drag = dragRef.current;
    const root = document.documentElement;
    const onDown = (event: PointerEvent) => {
      const globe = rootRef.current;
      if (!globe?.visible || event.button !== 0) return;
      if ((event.target as Element).closest("a, button, input, textarea")) return;
      const { centerX, centerY, radius } = globe.userData as Record<string, number>;
      if (Math.hypot(event.clientX - centerX, event.clientY - centerY) > radius) return;
      event.preventDefault(); // no text selection while dragging
      drag.active = true;
      drag.x = event.clientX;
      drag.y = event.clientY;
      root.style.cursor = "grabbing";
    };
    const onMove = (event: PointerEvent) => {
      if (!drag.active) return;
      drag.yaw += (event.clientX - drag.x) * 0.006;
      drag.pitch = MathUtils.clamp(drag.pitch + (event.clientY - drag.y) * 0.006, -0.8, 0.8);
      drag.x = event.clientX;
      drag.y = event.clientY;
    };
    const onUp = () => {
      if (!drag.active) return;
      drag.active = false;
      root.style.cursor = "";
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      root.style.cursor = "";
    };
  }, []);

  useFrame((state, delta) => {
    const root = rootRef.current;
    const tilt = tiltRef.current;
    const spin = spinRef.current;
    if (!root || !tilt || !spin) return;

    // Grow in over the last part of the scroll from Work to Contact, as the particles fade.
    const progress = useScrollStore.getState().progress;
    const appear = reduceMotion
      ? Number(progress > 2.5)
      : MathUtils.smootherstep(progress, 2.35, 2.95);
    root.visible = appear > 0.001;
    if (!root.visible) {
      dragRef.current.active = false;
      return;
    }
    root.scale.setScalar(MathUtils.lerp(0.4, 1, appear));
    if (atmosphereRef.current) atmosphereRef.current.uniforms.uStrength.value = appear;
    arcRefs.current.forEach((arc) => {
      if (!arc) return;
      arc.uniforms.uStrength.value = appear;
      if (!reduceMotion) arc.uniforms.uTime.value = state.clock.elapsedTime;
    });

    // Rotation: tilt (x) brings the region's latitude to the front; spin (y) turns
    // longitude FOCUS.lng to face the camera, then adds auto-rotation and dragging.
    const angle = angleRef.current;
    const drag = dragRef.current;
    if (!reduceMotion && !drag.active) angle.auto += delta * AUTO_SPIN;
    angle.yaw = MathUtils.damp(angle.yaw, drag.yaw, 8, delta);
    angle.pitch = MathUtils.damp(angle.pitch, drag.pitch, 8, delta);
    tilt.rotation.x = MathUtils.degToRad(FOCUS.lat) + angle.pitch;
    spin.rotation.y = -Math.PI / 2 - MathUtils.degToRad(FOCUS.lng) + angle.auto + angle.yaw;

    if (!reduceMotion) {
      if (cloudsRef.current) cloudsRef.current.rotation.y += delta * CLOUD_SPIN;
      // Pins pulse gently.
      const pulse = 1 + 0.25 * Math.sin(state.clock.elapsedTime * 3);
      pinRefs.current.forEach((pin) => pin?.scale.setScalar(pulse));
    }

    // Where the globe is on screen (for the drag hit test): project its center, and a
    // point one radius to the side, from 3D into pixels.
    const center = root.getWorldPosition(screenCenter);
    const edge = screenEdge.copy(center);
    edge.x += RADIUS * root.scale.x;
    center.project(state.camera);
    edge.project(state.camera);
    const { width, height } = state.size;
    root.userData.centerX = ((center.x + 1) / 2) * width;
    root.userData.centerY = ((1 - center.y) / 2) * height;
    root.userData.radius = Math.abs(edge.x - center.x) * (width / 2);
  });

  return (
    <group ref={rootRef} visible={false}>
      {/* Atmosphere sits outside the spinning group: it's a plain glow, rotation won't show. */}
      <mesh scale={1.15}>
        <sphereGeometry args={[RADIUS, 64, 64]} />
        <shaderMaterial
          ref={atmosphereRef}
          vertexShader={atmosphereVertex}
          fragmentShader={atmosphereFragment}
          uniforms={uniforms.atmosphere}
          side={BackSide}
          blending={AdditiveBlending}
          transparent
          depthWrite={false}
        />
      </mesh>

      <group ref={tiltRef}>
        <group ref={spinRef}>
          <mesh>
            <sphereGeometry args={[RADIUS, 96, 96]} />
            <shaderMaterial
              vertexShader={surfaceVertex}
              fragmentShader={earthFragment}
              uniforms={uniforms.earth}
            />
          </mesh>

          {/* Clouds: a slightly bigger see-through sphere that spins a bit faster. */}
          <mesh ref={cloudsRef} scale={1.012}>
            <sphereGeometry args={[RADIUS, 96, 96]} />
            <shaderMaterial
              vertexShader={surfaceVertex}
              fragmentShader={cloudFragment}
              uniforms={uniforms.clouds}
              transparent
              depthWrite={false}
            />
          </mesh>

          {pins.map((pin, index) => (
            <group key={CITIES[index].name} position={pin.position}>
              {/* toneMapped off keeps the color above 1 so bloom makes it glow. */}
              <mesh>
                <sphereGeometry args={[0.018, 16, 16]} />
                <meshBasicMaterial color={[2.4, 0.5, 1.3]} toneMapped={false} />
              </mesh>
              <mesh
                ref={(mesh) => {
                  pinRefs.current[index] = mesh;
                }}
                quaternion={pin.quaternion}
              >
                <ringGeometry args={[0.03, 0.04, 32]} />
                <meshBasicMaterial
                  color="#f72585"
                  transparent
                  opacity={0.8}
                  depthWrite={false}
                  toneMapped={false}
                />
              </mesh>
            </group>
          ))}

          {arcs.map((arc, index) => (
            <mesh key={index} geometry={arc.geometry}>
              <shaderMaterial
                ref={(material) => {
                  arcRefs.current[index] = material;
                }}
                vertexShader={arcVertex}
                fragmentShader={arcFragment}
                uniforms={arc.uniforms}
                blending={AdditiveBlending}
                transparent
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
}
