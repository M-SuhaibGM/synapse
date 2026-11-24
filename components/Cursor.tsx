"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { useDevice } from "@/lib/useDevice";

// Elements that make the ring grow.
const INTERACTIVE = "a, button, [role='button'], input, textarea, select, label";

// Custom cursor: a dot that sits exactly on the pointer and a ring that trails it.
export default function Cursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  // Only with a mouse/trackpad: (hover: hover) and (pointer: fine). Touch screens
  // keep the native behavior. Live, so plugging in a mouse turns it on.
  const { finePointer } = useDevice();

  useEffect(() => {
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring || !finePointer) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const root = document.documentElement;
    root.classList.add("has-custom-cursor"); // hides the native cursor (globals.css)

    // Center both elements on the pointer position.
    gsap.set([dot, ring], { xPercent: -50, yPercent: -50 });
    // quickTo = reusable tween retargeted on every move. The dot is near-instant;
    // the ring's longer duration is what makes it lag behind.
    const ringDuration = reduceMotion ? 0 : 0.45;
    const dotX = gsap.quickTo(dot, "x", { duration: 0.08, ease: "power3.out" });
    const dotY = gsap.quickTo(dot, "y", { duration: 0.08, ease: "power3.out" });
    const ringX = gsap.quickTo(ring, "x", { duration: ringDuration, ease: "power3.out" });
    const ringY = gsap.quickTo(ring, "y", { duration: ringDuration, ease: "power3.out" });

    let visible = false;
    const onMove = (event: PointerEvent) => {
      if (!visible) {
        // First move: jump into place instead of flying in from the corner.
        visible = true;
        gsap.set([dot, ring], { x: event.clientX, y: event.clientY });
        gsap.to([dot, ring], { autoAlpha: 1, duration: 0.2 });
      }
      dotX(event.clientX);
      dotY(event.clientY);
      ringX(event.clientX);
      ringY(event.clientY);
    };

    // pointerover bubbles, so one listener catches entering any link on the page.
    const onOver = (event: PointerEvent) => {
      const overLink = (event.target as Element).closest?.(INTERACTIVE) != null;
      gsap.to(ring, {
        scale: overLink ? 2.2 : 1,
        backgroundColor: overLink ? "rgb(76 201 240 / 10%)" : "rgb(76 201 240 / 0%)",
        duration: reduceMotion ? 0 : 0.3,
        ease: "power3.out",
      });
      gsap.to(dot, { scale: overLink ? 0.5 : 1, duration: 0.2 });
    };

    // Hide when the pointer leaves the window.
    const onLeave = () => {
      visible = false;
      gsap.to([dot, ring], { autoAlpha: 0, duration: 0.2 });
    };

    window.addEventListener("pointermove", onMove);
    document.addEventListener("pointerover", onOver);
    root.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerover", onOver);
      root.removeEventListener("pointerleave", onLeave);
      root.classList.remove("has-custom-cursor");
      gsap.killTweensOf([dot, ring]);
      gsap.set([dot, ring], { autoAlpha: 0 });
    };
  }, [finePointer]);

  return (
    <>
      <div aria-hidden="true" className="cursor-ring" ref={ringRef} />
      <div aria-hidden="true" className="cursor-dot" ref={dotRef} />
    </>
  );
}
