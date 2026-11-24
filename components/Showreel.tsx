"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { MOBILE_QUERY, useMediaQuery } from "@/lib/media";
import SectionLabel from "./SectionLabel";

gsap.registerPlugin(ScrollTrigger);

const FRAME_COUNT = 130; // f_001 … f_130
const COARSE_STEP = 8; // load every 8th frame first, then fill the gaps
const CONCURRENCY = 6; // parallel image requests
const MAX_DPR = 1.5;

const REEL_FPS = 20; // the frames were extracted at 20 fps

// Where the subject is, as a fraction of the frame width, at a given reel time (s).
// The reel holds on the centered Hero for 1.2s, then over 3.8s the subject eases
// right to ~73% of the width (the Services position). Matching the crop to it keeps
// the subject on screen when a portrait phone crops away most of the 16:9 frame.
function subjectX(seconds: number) {
  const t = Math.min(Math.max((seconds - 1.2) / 3.8, 0), 1);
  const eased = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
  return 0.5 + 0.23 * eased;
}

const frameUrl = (frame: number) => `/reel/f_${String(frame).padStart(3, "0")}.jpg`;

// Decoded frames, kept for the session (across remounts and mobile/desktop switches).
const frameCache = new Map<number, HTMLImageElement>();

// Load order as indexes into the frame list: 0, 8, 16, … first, so the whole reel
// can be scrubbed (coarsely) early on, then everything in between.
function loadOrder(count: number) {
  const order: number[] = [];
  for (let index = 0; index < count; index += COARSE_STEP) order.push(index);
  for (let index = 0; index < count; index += 1) {
    if (index % COARSE_STEP !== 0) order.push(index);
  }
  return order;
}

// A 400vh-tall section whose canvas sticks to the screen while you scroll through it;
// scroll progress picks which frame of the reel is drawn (an image-sequence "scrub").
export default function Showreel() {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isMobile = useMediaQuery(MOBILE_QUERY);

  useEffect(() => {
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!section || !canvas || !context) return;

    // Mobile: every 2nd frame (f_001, f_003, …), half the download.
    const frames = Array.from({ length: FRAME_COUNT }, (_, index) => index + 1).filter(
      (frame) => !isMobile || frame % 2 === 1,
    );
    const images = frames.map((frame) => frameCache.get(frame) ?? null);
    let target = 0; // frame index the scroll position asks for
    let drawn = -1; // frame index currently on the canvas
    let raf = 0;
    let cancelled = false;

    // The wanted frame may not have loaded yet: use the closest one that has.
    const nearestLoaded = (index: number) => {
      for (let distance = 0; distance < images.length; distance += 1) {
        if (images[index - distance]) return index - distance;
        if (images[index + distance]) return index + distance;
      }
      return -1;
    };

    const draw = () => {
      raf = 0;
      const index = nearestLoaded(target);
      const image = images[index];
      if (!image || index === drawn) return;
      // object-fit: cover — scale so the image fills the canvas on both axes;
      // whatever overflows is cropped. Vertically it's centered. Horizontally it's
      // centered on the subject, clamped so the image never leaves a gap at a side.
      const scale = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
      const width = image.naturalWidth * scale;
      const height = image.naturalHeight * scale;
      const focus = subjectX((frames[index] - 1) / REEL_FPS);
      const x = Math.min(Math.max(canvas.width / 2 - focus * width, canvas.width - width), 0);
      context.drawImage(image, x, (canvas.height - height) / 2, width, height);
      drawn = index;
    };
    // At most one draw per animation frame, however many scroll/load events arrive.
    const requestDraw = () => {
      if (!raf) raf = requestAnimationFrame(draw);
    };

    // Match the canvas's pixel buffer to its on-screen size (resizing clears it).
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, MAX_DPR);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      context.imageSmoothingQuality = "high";
      drawn = -1;
      requestDraw();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);

    // 0 when the section's top reaches the top of the screen, 1 when its bottom
    // reaches the bottom: exactly the stretch where the canvas is stuck in place.
    const trigger = ScrollTrigger.create({
      trigger: section,
      start: "top top",
      end: "bottom bottom",
      onUpdate: (self) => {
        target = Math.round(self.progress * (frames.length - 1));
        requestDraw();
      },
    });
    target = Math.round(trigger.progress * (frames.length - 1));

    const load = () => {
      const queue = loadOrder(frames.length).filter((index) => !images[index]);
      let next = 0;
      const worker = async () => {
        while (!cancelled && next < queue.length) {
          const index = queue[next++];
          const image = new Image();
          image.src = frameUrl(frames[index]);
          try {
            await image.decode(); // fully decoded, so drawing it later never stalls
          } catch {
            continue; // skip a missing/broken frame; neighbours stand in for it
          }
          frameCache.set(frames[index], image);
          if (cancelled) return;
          images[index] = image;
          requestDraw(); // may be closer to the wanted frame than what's shown
        }
      };
      for (let lane = 0; lane < CONCURRENCY; lane += 1) void worker();
    };

    // Start downloading once the section is within two screens, so the ~20 MB of
    // frames doesn't compete with the first page load.
    const nearObserver = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        nearObserver.disconnect();
        load();
      },
      { rootMargin: "200% 0px" },
    );
    nearObserver.observe(section);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      trigger.kill();
      resizeObserver.disconnect();
      nearObserver.disconnect();
    };
  }, [isMobile]);

  return (
    <section aria-label="Showreel" className="showreel" id="showreel" ref={sectionRef}>
      <div className="showreel__sticky">
        <canvas
          aria-label="Showreel: a glass crystal shatters as a particle sphere bursts into the letters AI"
          className="showreel__canvas"
          ref={canvasRef}
          role="img"
        />
        <div className="showreel__label">
          <SectionLabel>Showreel</SectionLabel>
        </div>
      </div>
    </section>
  );
}
