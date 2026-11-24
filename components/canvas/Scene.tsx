"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import {
  Environment,
  Lightformer,
  PerformanceMonitor,
  Sparkles,
  Stars,
} from "@react-three/drei";
import { Bloom, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";
import { Perf } from "r3f-perf";
import { MOBILE_PARTICLE_COUNT, PARTICLE_COUNT } from "@/lib/shapes";
import { markSlowDevice, useIntroStore, useQualityStore, useSceneStore } from "@/lib/store";
import { REDUCED_MOTION_QUERY, useMediaQuery } from "@/lib/media";
import CameraRig from "./CameraRig";
import Earth from "./Earth";
import HeroCrystal from "./HeroCrystal";
import Particles from "./Particles";
import SectionGroup from "./SectionGroup";

// The whole WebGL scene. Loaded lazily (client only) by CanvasLayer, so three.js,
// R3F and postprocessing stay out of the initial JS bundle.
export default function Scene({ onError }: { onError: (message: string | null) => void }) {
  const lowQuality = useQualityStore((state) => state.quality === "low");
  const isMobile = useQualityStore((state) => state.isMobile);
  const reduceMotion = useMediaQuery(REDUCED_MOTION_QUERY);
  // Start measuring only after the loader: building the shapes briefly blocks the main
  // thread, which would otherwise look like a slow device.
  const introStarted = useIntroStore((state) => state.started);
  // Hidden behind an opaque section: stop the render loop (saves GPU and battery).
  const covered = useSceneStore((state) => state.covered);

  return (
    <Canvas
      // dpr = device pixel ratio: how many real pixels per CSS pixel to render.
      // 1.5 is sharper on retina screens but ~2.25x the pixels to fill.
      dpr={lowQuality ? 1 : [1, 1.5]}
      gl={{ alpha: true, antialias: true }}
      // frameloop "never" = don't draw new frames; the last one stays on the canvas.
      frameloop={covered ? "never" : "always"}
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
      {/* Environment: renders the lightformers below into a 360° image once and uses it
          as the light/reflections for shiny materials (the glass and chrome). Lightformers
          are glowing panels/rings, like softboxes in a photo studio. Not shown as background. */}
      <Environment resolution={lowQuality ? 128 : 256}>
        <Lightformer form="rect" intensity={4} position={[0, 5, -6]} scale={[10, 3, 1]} />
        <Lightformer
          form="rect"
          intensity={2.5}
          color="#4cc9f0"
          position={[-6, 1, 2]}
          scale={[8, 2, 1]}
        />
        <Lightformer form="ring" intensity={3} color="#7b2ff7" position={[5, -1, 3]} scale={4} />
      </Environment>
      <Stars
        radius={60}
        depth={40}
        count={isMobile ? 1200 : 2400}
        factor={3}
        saturation={0}
        fade
        speed={reduceMotion ? 0 : 0.6}
      />
      {/* renderOrder 2: drawn after the glass, so sparkles in front of it aren't covered. */}
      <Sparkles
        count={130}
        color="#4cc9f0"
        scale={[9, 6, 4]}
        size={2}
        speed={reduceMotion ? 0 : 0.3}
        opacity={0.6}
        renderOrder={2}
      />
      <SectionGroup>
        <HeroCrystal>
          <Particles
            count={lowQuality ? MOBILE_PARTICLE_COUNT : PARTICLE_COUNT}
            onError={onError}
          />
        </HeroCrystal>
        {/* Suspense: show nothing for the Earth until its textures have loaded,
            instead of pausing the whole scene. */}
        <Suspense fallback={null}>
          <Earth />
        </Suspense>
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
