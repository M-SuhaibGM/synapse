"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { type Points } from "three";

const RADIUS = 2.6;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export default function Particles() {
  const pointsRef = useRef<Points>(null);
  const width = useThree((state) => state.size.width);
  const count = width < 768 ? 8000 : 20000;

  const positions = useMemo(() => {
    const result = new Float32Array(count * 3);

    // The golden angle spaces points evenly across the sphere, avoiding clusters at the poles.
    // This keeps the particle field balanced as it rotates.
    for (let index = 0; index < count; index += 1) {
      const y = 1 - (index / (count - 1)) * 2;
      const ringRadius = Math.sqrt(1 - y * y);
      const angle = GOLDEN_ANGLE * index;

      result[index * 3] = Math.cos(angle) * ringRadius * RADIUS;
      result[index * 3 + 1] = y * RADIUS;
      result[index * 3 + 2] = Math.sin(angle) * ringRadius * RADIUS;
    }

    return result;
  }, [count]);

  useFrame((_state, delta) => {
    if (!pointsRef.current) return;

    pointsRef.current.rotation.y += delta * 0.025;
    pointsRef.current.rotation.x += delta * 0.006;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#4cc9f0"
        size={0.02}
        sizeAttenuation
        transparent
        opacity={0.72}
        depthWrite={false}
      />
    </points>
  );
}
