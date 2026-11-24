"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { MathUtils } from "three";
import { REDUCED_MOTION_QUERY, useMediaQuery } from "@/lib/media";

// How far (world units) the camera slides at the screen edges.
const PARALLAX_X = 0.4;
const PARALLAX_Y = 0.25;

// Parallax: the camera slides a little with the mouse but keeps looking at the
// center. Near things then shift more than far things, which reads as depth.
export default function CameraRig() {
  // Mouse as -1..1 across the screen (+1 at top). The canvas ignores pointer events
  // (DOM sections sit on top), so listen on window.
  const pointerRef = useRef({ x: 0, y: 0 });
  const reduceMotion = useMediaQuery(REDUCED_MOTION_QUERY);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      pointerRef.current = {
        x: (event.clientX / window.innerWidth) * 2 - 1,
        y: -(event.clientY / window.innerHeight) * 2 + 1,
      };
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useFrame(({ camera }, delta) => {
    // Reduced motion: no parallax, ease back to (and stay) centered.
    const { x, y } = reduceMotion ? { x: 0, y: 0 } : pointerRef.current;
    // damp() = frame-rate independent lerp; the low rate (2) makes a slow, lazy drift.
    camera.position.x = MathUtils.damp(camera.position.x, x * PARALLAX_X, 2, delta);
    camera.position.y = MathUtils.damp(camera.position.y, y * PARALLAX_Y, 2, delta);
    camera.lookAt(0, 0, 0);
  });

  return null;
}
