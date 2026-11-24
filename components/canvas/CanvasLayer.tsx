"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useNearViewport } from "@/lib/useNearViewport";
import Loader from "../Loader";

// ssr: false: WebGL only exists in the browser, so skip server rendering and fetch
// the scene's JS chunk on the client the first time it's actually mounted.
const Scene = dynamic(() => import("./Scene"), { ssr: false });

// The particle scene is a fixed full-screen backdrop for all sections inside <main>,
// so <main> is the element we watch. Mounted while it's within 200px of the viewport,
// unmounted (WebGL context and GPU memory freed) when it's further away.
const SCENE_SECTION = "main";

export default function CanvasLayer() {
  const [shapeError, setShapeError] = useState<string | null>(null);
  const near = useNearViewport(SCENE_SECTION, "200px");

  return (
    <>
      <div aria-hidden="true" className="canvas-layer">
        {near && <Scene onError={setShapeError} />}
      </div>
      {/* Outside the lazy chunk so the loader overlay is server-rendered and shows
          from the very first paint. */}
      <Loader />
      {shapeError && (
        <div className="shape-error" role="alert">
          {shapeError}
        </div>
      )}
    </>
  );
}
