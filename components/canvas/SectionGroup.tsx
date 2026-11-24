"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import gsap from "gsap";
import { type Group } from "three";
import { useScrollStore } from "@/lib/store";
import { REDUCED_MOTION_QUERY, useMediaQuery } from "@/lib/media";

// A <group> is an invisible container: moving it moves everything inside it, so the
// particles can keep their own rotation while the group handles where they sit.
export default function SectionGroup({ children }: { children: ReactNode }) {
  const groupRef = useRef<Group>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  // viewport = size of the visible area in world units (at z = 0), so the side offsets
  // scale with the screen: big on desktop, small on narrow phones.
  const viewportWidth = useThree((state) => state.viewport.width);
  const reduceMotion = useMediaQuery(REDUCED_MOTION_QUERY);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    const side = viewportWidth * 0.22;
    // A paused timeline 3 seconds long: second N = section N. We never "play" it;
    // instead, every frame we jump it to the current scroll progress (0-3), so GSAP
    // only does the easing between the per-section positions.
    const timeline = gsap.timeline({
      paused: true,
      defaults: { duration: 1, ease: "power2.inOut" },
    });
    timeline
      // Hero (0) centered → Services (1) right
      .fromTo(group.position, { x: 0, z: 0 }, { x: side, z: 0 }, 0)
      // Services (1) right → Work (2) left
      .fromTo(group.position, { x: side, z: 0 }, { x: -side, z: 0 }, 1)
      // Work (2) left → Contact (3) centered and closer to the camera (+z)
      .fromTo(group.position, { x: -side, z: 0 }, { x: 0, z: 1.5 }, 2);

    timelineRef.current = timeline;
    return () => {
      timeline.kill();
      timelineRef.current = null;
    };
  }, [viewportWidth]);

  useFrame(() => {
    const progress = Math.min(Math.max(useScrollStore.getState().progress, 0), 3);
    // Reduced motion: jump to the nearest section's position instead of gliding.
    timelineRef.current?.time(reduceMotion ? Math.round(progress) : progress);
  });

  return <group ref={groupRef}>{children}</group>;
}
