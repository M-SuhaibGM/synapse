"use client";

import { useEffect, useRef } from "react";
import { useProgress } from "@react-three/drei";
import gsap from "gsap";
import { useIntroStore } from "@/lib/store";

// Full-screen 0-100% counter shown while the 3D assets load.
export default function Loader() {
  // useProgress reports how much of every three.js loader (font, models, textures)
  // has finished, as 0-100. It works outside <Canvas> too.
  const { progress } = useProgress();
  const shapesReady = useIntroStore((state) => state.shapesReady);
  const rootRef = useRef<HTMLDivElement>(null);
  const numberRef = useRef<HTMLSpanElement>(null);
  const counterRef = useRef({ value: 0 });
  const finishedRef = useRef(false);

  // Files can finish loading before the particle shapes are built from them, so hold
  // at 99% until the shapes are actually ready.
  const target = shapesReady ? 100 : Math.min(progress, 99);

  useEffect(() => {
    // Count smoothly toward the target instead of jumping (one file = 0 → 100 at once).
    const tween = gsap.to(counterRef.current, {
      value: target,
      duration: 0.8,
      ease: "power2.out",
      onUpdate: () => {
        if (numberRef.current) {
          numberRef.current.textContent = String(Math.round(counterRef.current.value));
        }
      },
      onComplete: () => {
        if (target < 100 || finishedRef.current) return;
        finishedRef.current = true;
        // autoAlpha fades opacity and then sets visibility: hidden, so the hidden
        // overlay stops blocking clicks.
        gsap.to(rootRef.current, { autoAlpha: 0, duration: 0.8, ease: "power2.inOut" });
        useIntroStore.setState({ started: true });
      },
    });
    return () => {
      tween.kill();
    };
  }, [target]);

  return (
    <div aria-label="Loading" className="loader" ref={rootRef} role="status">
      <span aria-hidden="true" className="loader__count">
        <span ref={numberRef}>0</span>%
      </span>
    </div>
  );
}
