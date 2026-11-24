"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useIntroStore } from "@/lib/store";

// iOS Safari only sends motion events after the user grants access, and the request
// must come from a tap. Elsewhere requestPermission doesn't exist and events just flow.
type IOSOrientationEvent = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

// requestPermission exists only on iOS Safari. A fixed fact, so nothing to subscribe to.
const noSubscribe = () => () => {};
const isIOSMotion = () =>
  typeof (window.DeviceOrientationEvent as IOSOrientationEvent | undefined)?.requestPermission ===
  "function";

// Small "Enable motion" pill on iOS, so the 3D scene can follow the phone's tilt
// (lib/useTilt.ts). Hidden once motion data arrives or the user answers the prompt.
export default function MotionButton() {
  // false on the server and during hydration, then the real value.
  const supported = useSyncExternalStore(noSubscribe, isIOSMotion, () => false);
  const [done, setDone] = useState(false);
  // Wait for the loader to finish so the pill doesn't sit on top of it.
  const started = useIntroStore((state) => state.started);

  // Already granted earlier in this session: events arrive on their own, hide the pill.
  useEffect(() => {
    if (!supported) return;
    const onOrientation = (event: DeviceOrientationEvent) => {
      if (event.beta !== null) setDone(true);
    };
    window.addEventListener("deviceorientation", onOrientation);
    return () => window.removeEventListener("deviceorientation", onOrientation);
  }, [supported]);

  if (!supported || done || !started) return null;

  const enable = async () => {
    const Orientation = window.DeviceOrientationEvent as IOSOrientationEvent;
    try {
      await Orientation.requestPermission?.();
    } catch {
      // Denied or not allowed here: the scene keeps following touch instead.
    }
    setDone(true);
  };

  return (
    <button className="motion-button" onClick={enable} type="button">
      Enable motion <span aria-hidden="true">✦</span>
    </button>
  );
}
