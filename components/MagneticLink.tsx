"use client";

import { useEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";

// How far outside the link (px) the pull starts, and how strongly it follows.
const REACH = 60;
const STRENGTH = 0.4; // link moves 40% of the cursor's offset from its center
const INNER_STRENGTH = 0.2; // the label moves a bit extra, for a layered feel

// Link that gets pulled toward the cursor when it comes close, then springs back.
export default function MagneticLink({
  className,
  href,
  children,
}: {
  className: string;
  href: string;
  children: ReactNode;
}) {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const link = linkRef.current;
    const inner = innerRef.current;
    if (!link || !inner) return;
    const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!canHover || reduceMotion) return;

    // quickTo = reusable tween retargeted on every move, so the pull glides.
    const pull = { duration: 0.5, ease: "power3.out" };
    const linkX = gsap.quickTo(link, "x", pull);
    const linkY = gsap.quickTo(link, "y", pull);
    const innerX = gsap.quickTo(inner, "x", pull);
    const innerY = gsap.quickTo(inner, "y", pull);
    let attracted = false;

    const onMove = (event: PointerEvent) => {
      // Measure without the current pull, otherwise the target would chase itself.
      const rect = link.getBoundingClientRect();
      const offsetX = Number(gsap.getProperty(link, "x"));
      const offsetY = Number(gsap.getProperty(link, "y"));
      const centerX = rect.left - offsetX + rect.width / 2;
      const centerY = rect.top - offsetY + rect.height / 2;
      const dx = event.clientX - centerX;
      const dy = event.clientY - centerY;

      const inRange =
        Math.abs(dx) < rect.width / 2 + REACH && Math.abs(dy) < rect.height / 2 + REACH;

      if (inRange) {
        attracted = true;
        linkX(dx * STRENGTH);
        linkY(dy * STRENGTH);
        innerX(dx * INNER_STRENGTH);
        innerY(dy * INNER_STRENGTH);
      } else if (attracted) {
        // Out of range: snap back with a little elastic wobble.
        attracted = false;
        gsap.to([link, inner], { x: 0, y: 0, duration: 0.9, ease: "elastic.out(1, 0.4)" });
      }
    };

    window.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("pointermove", onMove);
      gsap.killTweensOf([link, inner]);
      gsap.set([link, inner], { clearProps: "transform" });
    };
  }, []);

  return (
    <a className={className} href={href} ref={linkRef}>
      <span className="magnetic-inner" ref={innerRef}>
        {children}
      </span>
    </a>
  );
}
