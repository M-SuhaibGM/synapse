import { create } from "zustand";

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
