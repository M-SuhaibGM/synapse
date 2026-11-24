"use client";

import { useEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";

// Max tilt in degrees at the card's edges.
const MAX_TILT = 10;

// Work card that tilts toward the cursor on hover. The glow border is CSS (:hover).
export default function TiltCard({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  const cardRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    // Only for real mouse/trackpad hover, and not when the user prefers less motion.
    const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!canHover || reduceMotion) return;

    // transformPerspective gives the rotation depth (closer edge looks bigger).
    gsap.set(card, { transformPerspective: 900 });
    // quickTo = a reusable tween we can retarget every mousemove; the duration/ease
    // make the card glide toward the new angle instead of snapping.
    const rotateX = gsap.quickTo(card, "rotationX", { duration: 0.6, ease: "power3.out" });
    const rotateY = gsap.quickTo(card, "rotationY", { duration: 0.6, ease: "power3.out" });

    const onMove = (event: PointerEvent) => {
      const rect = card.getBoundingClientRect();
      // Cursor position inside the card as -0.5..0.5 from the center.
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      rotateY(x * MAX_TILT * 2);
      rotateX(-y * MAX_TILT * 2);
    };
    const onLeave = () => {
      rotateX(0);
      rotateY(0);
    };

    card.addEventListener("pointermove", onMove);
    card.addEventListener("pointerleave", onLeave);
    return () => {
      card.removeEventListener("pointermove", onMove);
      card.removeEventListener("pointerleave", onLeave);
      gsap.killTweensOf(card);
      gsap.set(card, { clearProps: "transform" });
    };
  }, []);

  return (
    <article className={className} ref={cardRef}>
      {children}
    </article>
  );
}
