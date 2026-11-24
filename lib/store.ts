import { create } from "zustand";
import { MOBILE_QUERY } from "./media";

type ScrollState = {
  // 0 at the Hero, 1 at Services, 2 at Work, 3 at Contact; fractions in between.
  progress: number;
  setProgress: (progress: number) => void;
};

export const useScrollStore = create<ScrollState>()((set) => ({
  progress: 0,
  setProgress: (progress) => set({ progress }),
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
  // "low" = fewer particles, dpr 1, no bloom. Derived from the two inputs below.
  quality: Quality;
  // Small screen or touch-first device (MOBILE_QUERY). Kept live via matchMedia.
  isMobile: boolean;
  // PerformanceMonitor saw fps stay below 50. Set once, never reset, so quality
  // doesn't flip back and forth.
  slowDevice: boolean;
};

const deriveQuality = ({ isMobile, slowDevice }: Omit<QualityState, "quality">): Quality =>
  isMobile || slowDevice ? "low" : "high";

export const useQualityStore = create<QualityState>()((set, get) => {
  // On the client, read the media query up front (so the first 3D frame already uses
  // the right quality) and follow later changes. On the server this stays "high"; the
  // value is only read by the client-only canvas, so there's no hydration mismatch.
  let isMobile = false;
  if (typeof window !== "undefined") {
    const media = window.matchMedia(MOBILE_QUERY);
    isMobile = media.matches;
    media.addEventListener("change", (event) => {
      const next = { slowDevice: get().slowDevice, isMobile: event.matches };
      set({ ...next, quality: deriveQuality(next) });
    });
  }
  const initial = { isMobile, slowDevice: false };
  return { ...initial, quality: deriveQuality(initial) };
});

// Called by the PerformanceMonitor when the frame rate stays too low.
export function markSlowDevice() {
  const next = { isMobile: useQualityStore.getState().isMobile, slowDevice: true };
  useQualityStore.setState({ ...next, quality: deriveQuality(next) });
}
