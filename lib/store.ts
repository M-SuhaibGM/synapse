import { create } from "zustand";
import { getDevice, subscribeDevice } from "./useDevice";

type ScrollState = {
  // 0 at the Hero, 1 at Services, 2 at Work, 3 at Contact; fractions in between.
  progress: number;
  setProgress: (progress: number) => void;
};

export const useScrollStore = create<ScrollState>()((set) => ({
  progress: 0,
  setProgress: (progress) => set({ progress }),
}));

type SceneState = {
  // An opaque sticky section (Disciplines, Showreel, Testimonials) fills the screen,
  // so the 3D scene behind it can't be seen and can stop rendering.
  covered: boolean;
};

export const useSceneStore = create<SceneState>()(() => ({
  covered: false,
}));

type IntroState = {
  // All section shapes are built (or failed), so the loader can reach 100%.
  shapesReady: boolean;
  // The loader has finished and faded out; particles should assemble.
  started: boolean;
};

export const useIntroStore = create<IntroState>()(() => ({
  shapesReady: false,
  started: false,
}));

export type Quality = "high" | "low";

type QualityState = {
  // "low" = fewer particles, dpr 1, no bloom. Low on mobile, touch or low-power
  // devices (see lib/useDevice.ts), or once the frame rate has proven too slow.
  quality: Quality;
  // PerformanceMonitor saw fps stay below 50. Set once, never reset, so quality
  // doesn't flip back and forth.
  slowDevice: boolean;
};

const deriveQuality = (slowDevice: boolean): Quality => {
  const { isMobile, isTouch, lowPower } = getDevice();
  return isMobile || isTouch || lowPower || slowDevice ? "low" : "high";
};

export const useQualityStore = create<QualityState>()((set, get) => {
  // On the client, read the device up front (so the first 3D frame already uses the
  // right quality) and follow later changes. On the server this stays "high"; the
  // value is only read by the client-only canvas, so there's no hydration mismatch.
  if (typeof window !== "undefined") {
    subscribeDevice(() => set({ quality: deriveQuality(get().slowDevice) }));
  }
  return { slowDevice: false, quality: deriveQuality(false) };
});

// Called by the PerformanceMonitor when the frame rate stays too low.
export function markSlowDevice() {
  useQualityStore.setState({ slowDevice: true, quality: "low" });
}
