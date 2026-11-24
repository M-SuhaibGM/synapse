"use client";

import { Canvas } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { Bloom, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";
import { Perf } from "r3f-perf";
import { MOBILE_PARTICLE_COUNT, PARTICLE_COUNT } from "@/lib/shapes";
import { markSlowDevice, useIntroStore, useQualityStore } from "@/lib/store";
import CameraRig from "./CameraRig";
import Particles from "./Particles";
import SectionGroup from "./SectionGroup";

// The whole WebGL scene. Loaded lazily (client only) by CanvasLayer, so three.js,
// R3F and postprocessing stay out of the initial JS bundle.
export default function Scene({ onError }: { onError: (message: string | null) => void }) {
  const lowQuality = useQualityStore((state) => state.quality === "low");
  // Start measuring only after the loader: building the shapes briefly blocks the main
  // thread, which would otherwise look like a slow device.
  const introStarted = useIntroStore((state) => state.started);

  return (
    <Canvas
      // dpr = device pixel ratio: how many real pixels per CSS pixel to render.
      // 1.5 is sharper on retina screens but ~2.25x the pixels to fill.
      dpr={lowQuality ? 1 : [1, 1.5]}
      gl={{ alpha: true, antialias: true }}
    >
      {/* PerformanceMonitor averages the frame rate over a few seconds and calls
          onDecline if it stays below the lower bound (50 fps). The upper bound is
          Infinity, so it never asks to raise quality again. */}
      {introStarted && !lowQuality && (
        <PerformanceMonitor bounds={() => [50, Infinity]} onDecline={markSlowDevice} />
      )}
      {/* Solid scene background (site bg color). Post-processing effects work on
          opaque images; on a transparent canvas the bloom glow and grain would
          mostly vanish wherever there are no particles. */}
      <color attach="background" args={["#05060a"]} />
      <CameraRig />
      <SectionGroup>
        <Particles
          count={lowQuality ? MOBILE_PARTICLE_COUNT : PARTICLE_COUNT}
          onError={onError}
        />
      </SectionGroup>
      {/* Post-processing: the scene is first drawn to an off-screen image, then each
          effect below runs over that whole image like a photo filter before it
          reaches the screen. Order matters: they apply top to bottom. */}
      <EffectComposer>
        {/* Bloom: anything brighter than the threshold (0.2 = fairly dim) bleeds a
            soft glow into its surroundings, like light in a camera lens.
            mipmapBlur gives a wider, smoother glow for little extra cost. */}
        {/* Skipped on mobile / slow devices: bloom is the most expensive effect. */}
        {!lowQuality && <Bloom luminanceThreshold={0.2} mipmapBlur />}
        {/* Noise: faint random film grain over the image; hides color banding. */}
        <Noise opacity={0.03} />
        {/* Vignette: gently darkens the edges to pull focus toward the center. */}
        <Vignette />
      </EffectComposer>
      {process.env.NODE_ENV === "development" && (
        <Perf className="perf-panel" position="top-left" />
      )}
    </Canvas>
  );
}
