"use client";

import { Canvas } from "@react-three/fiber";
import { Perf } from "r3f-perf";
import Particles from "./Particles";

export default function CanvasLayer() {
  return (
    <div aria-hidden="true" className="canvas-layer">
      <Canvas dpr={[1, 1.5]} gl={{ alpha: true, antialias: true }}>
        <Particles />
        {process.env.NODE_ENV === "development" && (
          <Perf className="perf-panel" position="top-left" />
        )}
      </Canvas>
    </div>
  );
}
