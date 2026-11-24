"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useDevice } from "@/lib/useDevice";
import SectionLabel from "./SectionLabel";

gsap.registerPlugin(ScrollTrigger);

const FRAME_COUNT = 130; // f_001 … f_130 (1600px JPG, 20 fps)
// Phones: /reel/m/ holds the reel re-extracted at 10 fps (every 2nd frame) and 720px
// wide WebP — f_001 … f_065, about 0.6 MB in total.
const MOBILE_FRAME_COUNT = 65;
const MOBILE_FPS = 10;
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

const pad3 = (value: number) => String(value).padStart(3, "0");

type Frame = { url: string; seconds: number };

// The frames to scrub through, in order, with each one's time in the reel.
function reelFrames(mobile: boolean, lite: boolean): Frame[] {
  if (mobile) {
    return Array.from({ length: MOBILE_FRAME_COUNT }, (_, index) => ({
      url: `/reel/m/f_${pad3(index + 1)}.webp`,
      seconds: index / MOBILE_FPS,
    }));
  }
  // Lite (tablets, low-power): every 2nd frame (f_001, f_003, …), half the download.
  return Array.from({ length: FRAME_COUNT }, (_, index) => index + 1)
    .filter((frame) => !lite || frame % 2 === 1)
    .map((frame) => ({ url: `/reel/f_${pad3(frame)}.jpg`, seconds: (frame - 1) / REEL_FPS }));
}

// Mobile captions, each fading in at its quarter of the scroll (0, 25, 50, 75%).
const CAPTIONS = [
  "Light, held in glass.",
  "The crystal gives way.",
  "A thousand points of signal.",
  "Resolving into intelligence.",
];

// Decoded frames by URL, kept for the session (across remounts and mode switches).
const frameCache = new Map<string, HTMLImageElement>();

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
  const counterRef = useRef<HTMLSpanElement>(null);
  const { isMobile, isTouch, lowPower } = useDevice();
  // Phones, tablets and low-power devices: half the frames, 1x resolution. Phones
  // additionally get the small WebP frames, captions and a frame counter.
  const lite = isMobile || isTouch || lowPower;

  useEffect(() => {
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!section || !canvas || !context) return;

    const frames = reelFrames(isMobile, lite);
    const images = frames.map((frame) => frameCache.get(frame.url) ?? null);
    const counter = counterRef.current;
    const captions = Array.from(section.querySelectorAll<HTMLElement>(".showreel__caption"));
    let caption = -1; // caption currently shown
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
      const focus = subjectX(frames[index].seconds);
      const x = Math.min(Math.max(canvas.width / 2 - focus * width, canvas.width - width), 0);
      context.drawImage(image, x, (canvas.height - height) / 2, width, height);
      drawn = index;
      if (counter) counter.textContent = `${pad3(index + 1)} / ${pad3(frames.length)}`;
    };
    // At most one draw per animation frame, however many scroll/load events arrive.
    const requestDraw = () => {
      if (!raf) raf = requestAnimationFrame(draw);
    };

    // Match the canvas's pixel buffer to its on-screen size (resizing clears it).
    const resize = () => {
      const dpr = lite ? 1 : Math.min(window.devicePixelRatio, MAX_DPR);
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
      onUpdate: (self) => update(self.progress),
    });
    function update(progress: number) {
      target = Math.round(progress * (frames.length - 1));
      requestDraw();
      // 0–25% → caption 0, 25–50% → 1, 50–75% → 2, 75–100% → 3.
      const next = Math.min(Math.floor(progress * captions.length), captions.length - 1);
      if (next !== caption) {
        captions[caption]?.classList.remove("is-active");
        captions[next]?.classList.add("is-active");
        caption = next;
      }
    }
    update(trigger.progress);

    const load = () => {
      const queue = loadOrder(frames.length).filter((index) => !images[index]);
      let next = 0;
      const worker = async () => {
        while (!cancelled && next < queue.length) {
          const index = queue[next++];
          const image = new Image();
          image.src = frames[index].url;
          try {
            await image.decode(); // fully decoded, so drawing it later never stalls
          } catch {
            continue; // skip a missing/broken frame; neighbours stand in for it
          }
          frameCache.set(frames[index].url, image);
          if (cancelled) return;
          images[index] = image;
          requestDraw(); // may be closer to the wanted frame than what's shown
        }
      };
      for (let lane = 0; lane < CONCURRENCY; lane += 1) void worker();
    };

    // Start downloading once the section is within two screens (one on phones), so
    // the frames don't compete with the first page load.
    const nearObserver = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        nearObserver.disconnect();
        load();
      },
      { rootMargin: isMobile ? "100% 0px" : "200% 0px" },
    );
    nearObserver.observe(section);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      trigger.kill();
      resizeObserver.disconnect();
      nearObserver.disconnect();
    };
  }, [lite, isMobile]);

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
        {isMobile && (
          <>
            <span aria-hidden="true" className="showreel__counter" ref={counterRef}>
              {`001 / ${pad3(MOBILE_FRAME_COUNT)}`}
            </span>
            <div className="showreel__captions">
              {CAPTIONS.map((text) => (
                <p className="showreel__caption" key={text}>
                  {text}
                </p>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
