"use client";

import { useEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// Mono section label (e.g. "01 / What we do") that slides in when scrolled into view.
export default function SectionLabel({ children }: { children: ReactNode }) {
  const labelRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const label = labelRef.current;
    if (!label) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // gsap.context records everything created inside it, so revert() can undo the
    // animation and its inline styles cleanly (important with React's double effects
    // in development, which would otherwise leave the label stuck invisible).
    const context = gsap.context(() => {
      gsap.from(label, {
        x: -32,
        opacity: 0,
        // Wipe in from the left edge while sliding.
        clipPath: "inset(0 100% 0 0)",
        duration: 0.9,
        ease: "power3.out",
        scrollTrigger: {
          trigger: label,
          start: "top 85%",
          // play when scrolled into view, reverse when scrolled back above it
          toggleActions: "play none none reverse",
        },
      });
    });

    return () => context.revert();
  }, []);

  return (
    <p className="eyebrow" ref={labelRef}>
      {children}
    </p>
  );
}
