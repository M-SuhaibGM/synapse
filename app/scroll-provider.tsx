"use client";

import { useEffect, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { useScrollStore } from "@/lib/store";

gsap.registerPlugin(ScrollTrigger);

// Each of these sections adds 0 → 1 to the overall progress as it scrolls in from the
// bottom of the screen until its top reaches the top of the screen, giving 0-3 in total.
const PROGRESS_SECTIONS = ["services", "work", "contact"];

export default function ScrollProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const { setProgress } = useScrollStore.getState();
    const amounts = PROGRESS_SECTIONS.map(() => 0);
    const publish = () => setProgress(amounts.reduce((sum, value) => sum + value, 0));

    const triggers = PROGRESS_SECTIONS.flatMap((id, index) => {
      const section = document.getElementById(id);
      if (!section) return [];

      const trigger = ScrollTrigger.create({
        trigger: section,
        start: "top bottom",
        // clamp(): Contact is the last screen, so its top may never quite reach the
        // top of the viewport; clamping to the max scroll guarantees we hit 3.
        end: "clamp(top top)",
        onUpdate: (self) => {
          amounts[index] = self.progress;
          publish();
        },
      });
      amounts[index] = trigger.progress;
      return [trigger];
    });
    publish();

    return () => {
      triggers.forEach((trigger) => trigger.kill());
    };
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const lenis = new Lenis({ autoRaf: false, anchors: true });
    const updateScrollTrigger = () => ScrollTrigger.update();
    const updateLenis = (time: number) => lenis.raf(time * 1000);

    lenis.on("scroll", updateScrollTrigger);
    gsap.ticker.add(updateLenis);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(updateLenis);
      lenis.off("scroll", updateScrollTrigger);
      lenis.destroy();
    };
  }, []);

  return children;
}
