import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { MathUtils } from "three";
import { REDUCED_MOTION_QUERY, useMediaQuery } from "./media";

// Device tilt (degrees) that maps to the full -1..1 range; tilting further is clamped.
const MAX_TILT = 20;
// How quickly the smoothed value follows the raw one (damp rate, higher = snappier).
const SMOOTHING = 4;

type Tilt = { x: number; y: number };

// Phone tilt as -1..1 on each axis, in the same convention as a mouse position:
// x +1 = tilted right, y +1 = tilted "up" (top edge away from you). Without motion
// events (desktops, or iOS before permission) it follows the pointer instead.
// Returns a ref read inside useFrame. Call it before the component's own useFrame,
// so the value is already updated for that frame. Canvas components only.
export function useTilt() {
  const targetRef = useRef<Tilt>({ x: 0, y: 0 });
  const tiltRef = useRef<Tilt>({ x: 0, y: 0 });
  const reduceMotion = useMediaQuery(REDUCED_MOTION_QUERY);

  useEffect(() => {
    const target = targetRef.current;
    // Once real orientation data arrives, the pointer (touch drags) is ignored.
    let hasMotion = false;
    // The angle the phone was held at on the first reading = "level". People hold
    // phones at ~40-70° front-back, so tilt is measured from there, not from flat.
    let rest: Tilt | null = null;

    const onOrientation = (event: DeviceOrientationEvent) => {
      const { beta, gamma } = event;
      // Desktop browsers may fire one event with nulls: no sensor.
      if (beta === null || gamma === null) return;
      hasMotion = true;
      // beta = front-back tilt, gamma = left-right tilt, both relative to the device
      // in portrait. In landscape the device is turned, so swap them into screen axes.
      const angle = screen.orientation?.angle ?? 0;
      let x = gamma;
      let y = beta;
      if (angle === 90) [x, y] = [beta, -gamma];
      else if (angle === 270 || angle === -90) [x, y] = [-beta, gamma];
      else if (angle === 180) [x, y] = [-gamma, -beta];
      rest ??= { x, y };
      target.x = MathUtils.clamp(x - rest.x, -MAX_TILT, MAX_TILT) / MAX_TILT;
      target.y = -MathUtils.clamp(y - rest.y, -MAX_TILT, MAX_TILT) / MAX_TILT;
    };
    // Rotating the screen changes how the phone is held: take a new rest angle.
    const onRotate = () => {
      rest = null;
    };
    // The canvas ignores pointer events (DOM sections sit on top), so listen on window.
    const onPointer = (event: PointerEvent) => {
      if (hasMotion) return;
      target.x = (event.clientX / window.innerWidth) * 2 - 1;
      target.y = -(event.clientY / window.innerHeight) * 2 + 1;
    };

    window.addEventListener("deviceorientation", onOrientation);
    window.addEventListener("pointermove", onPointer);
    screen.orientation?.addEventListener("change", onRotate);
    return () => {
      window.removeEventListener("deviceorientation", onOrientation);
      window.removeEventListener("pointermove", onPointer);
      screen.orientation?.removeEventListener("change", onRotate);
    };
  }, []);

  // Sensor readings are jittery; damp() eases toward them a bit every frame
  // (frame-rate independent). Reduced motion: settle at 0 and stay there.
  useFrame((_, delta) => {
    const tilt = tiltRef.current;
    const { x, y } = reduceMotion ? { x: 0, y: 0 } : targetRef.current;
    tilt.x = MathUtils.damp(tilt.x, x, SMOOTHING, delta);
    tilt.y = MathUtils.damp(tilt.y, y, SMOOTHING, delta);
  });

  return tiltRef;
}
