import { useSyncExternalStore } from "react";

// Media queries behind the device flags. CSS that gates on the same thing should use
// the same queries (see globals.css).
export const MOBILE_QUERY = "(max-width: 768px)";
export const TOUCH_QUERY = "(hover: none)";
// A mouse or trackpad: can hover and point precisely. Hover-only effects (custom
// cursor, tilt, magnetic links) are enabled only when this matches.
export const FINE_POINTER_QUERY = "(hover: hover) and (pointer: fine)";

export type Device = {
  // Small screen (max-width: 768px). Follows window resizes.
  isMobile: boolean;
  // Primary input can't hover (hover: none): phones, tablets.
  isTouch: boolean;
  // Little memory or few CPU cores (deviceMemory ≤ 4 GB or hardwareConcurrency ≤ 4).
  // Fixed for the session.
  lowPower: boolean;
  // (hover: hover) and (pointer: fine): a mouse or trackpad.
  finePointer: boolean;
};

// Server render (and the first client render, during hydration): assume a capable
// desktop. Components only use these flags after mount, inside effects or the
// client-only canvas, so the real values take over before anything is drawn.
const SERVER_DEVICE: Device = {
  isMobile: false,
  isTouch: false,
  lowPower: false,
  finePointer: false,
};

function detectLowPower() {
  // deviceMemory is Chromium-only (GB, rounded, capped at 8); elsewhere it's undefined
  // and only the core count decides.
  const { deviceMemory } = navigator as Navigator & { deviceMemory?: number };
  const cores = navigator.hardwareConcurrency;
  return (deviceMemory !== undefined && deviceMemory <= 4) || (cores > 0 && cores <= 4);
}

let current: Device | undefined;
const listeners = new Set<() => void>();
// Kept referenced so the change listeners stay attached for the whole session.
let queries: { mobile: MediaQueryList; touch: MediaQueryList; fine: MediaQueryList };

function read(lowPower: boolean): Device {
  return {
    isMobile: queries.mobile.matches,
    isTouch: queries.touch.matches,
    lowPower,
    finePointer: queries.fine.matches,
  };
}

// Current device flags. Outside React (e.g. the quality store) call this directly;
// inside components use useDevice() so they re-render on changes.
export function getDevice(): Device {
  if (typeof window === "undefined") return SERVER_DEVICE;
  if (!current) {
    queries = {
      mobile: window.matchMedia(MOBILE_QUERY),
      touch: window.matchMedia(TOUCH_QUERY),
      fine: window.matchMedia(FINE_POINTER_QUERY),
    };
    const lowPower = detectLowPower();
    current = read(lowPower);
    // A new object only on change, so useSyncExternalStore sees a stable snapshot.
    const onChange = () => {
      current = read(lowPower);
      listeners.forEach((listener) => listener());
    };
    Object.values(queries).forEach((query) => query.addEventListener("change", onChange));
  }
  return current;
}

export function subscribeDevice(listener: () => void) {
  getDevice(); // make sure the media listeners are attached
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Device capabilities, kept live (resizing past 768px, plugging in a mouse, ...).
export function useDevice(): Device {
  return useSyncExternalStore(subscribeDevice, getDevice, () => SERVER_DEVICE);
}
