"use client";

import { useEffect, useState } from "react";

// True while the element matching `selector` is within `rootMargin` of the viewport.
// rootMargin grows the viewport box on every side, so "200px" turns true a little
// before the element scrolls into view and false once it's more than 200px away.
// Starts false; the observer reports the real state right after it attaches.
export function useNearViewport(selector: string, rootMargin = "200px"): boolean {
  const [near, setNear] = useState(false);

  useEffect(() => {
    const target = document.querySelector(selector);
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => setNear(entry.isIntersecting),
      { rootMargin },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [selector, rootMargin]);

  return near;
}
