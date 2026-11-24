"use client";

import { useEffect, useRef } from "react";
import { REDUCED_MOTION_QUERY, useMediaQuery } from "@/lib/media";
import { useDevice } from "@/lib/useDevice";

const LINE_COUNT = 60;
const POINT_SPACING = 14; // px between points along each line
const RADIUS = 150; // cursor influence radius, px
const CURSOR_FORCE = 4200; // push strength at the cursor (px/s²)
const HOLD_MS = 600; // press this long to blast
const BLAST_SPEED = 1400; // initial outward speed at the blast center (px/s)
const BLAST_FALLOFF = 260; // px; the blast weakens with distance at this scale
const ALPHA = 0.15;
const MAX_DPR = 1.5;

// Spring physics: every point is tied to its resting spot by a spring. Each frame,
// acceleration = -STIFFNESS × offset (pull back) - DAMPING × velocity (friction) + pushes.
// Stiffer = snappier, more damping = less wobble before it settles.
const STIFFNESS = 120;
const DAMPING = 11;

const CYAN = [76, 201, 240];
const VIOLET = [123, 47, 247];

// Same deterministic 0-1 hash as the particles, for stable per-line variety.
const hash = (n: number) => {
  const value = Math.sin(n * 12.9898) * 43758.5453;
  return value - Math.floor(value);
};

type Line = {
  y: number; // resting height, px
  amplitude: number;
  frequency: number;
  phase: number;
  speed: number;
  color: string;
  // Per point: offset from the wave (x, y) and velocity, stored flat for speed.
  ox: Float32Array;
  oy: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
};

// Background for the Hero: horizontal sine waves that bend away from the pointer
// and can be blasted outward with a long press.
export default function HeroLines() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduceMotion = useMediaQuery(REDUCED_MOTION_QUERY);
  const { isMobile, isTouch, lowPower } = useDevice();
  // Phones, tablets and low-power devices draw at 1x: a quarter of the pixels at 2x.
  const lite = isMobile || isTouch || lowPower;

  useEffect(() => {
    const canvas = canvasRef.current;
    const section = canvas?.parentElement;
    const context = canvas?.getContext("2d");
    if (!canvas || !section || !context) return;

    let width = 0;
    let height = 0;
    let points = 0;
    let lines: Line[] = [];
    const pointer = { x: 0, y: 0, active: false };
    let holdTimer = 0;
    let raf = 0;
    let visible = false;
    let last = 0;
    let time = 0;

    const build = () => {
      const dpr = lite ? 1 : Math.min(window.devicePixelRatio, MAX_DPR);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      // Draw in CSS pixels; the transform scales everything up to the real buffer.
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      points = Math.ceil(width / POINT_SPACING) + 1;
      lines = Array.from({ length: LINE_COUNT }, (_, index) => {
        const t = index / (LINE_COUNT - 1);
        const rgb = CYAN.map((c, k) => Math.round(c + (VIOLET[k] - c) * t));
        return {
          y: ((index + 0.5) / LINE_COUNT) * height,
          amplitude: 4 + hash(index) * 7,
          frequency: 0.003 + hash(index + 50) * 0.004,
          phase: hash(index + 100) * Math.PI * 2,
          speed: 0.35 + hash(index + 150) * 0.4,
          color: `rgb(${rgb.join(",")})`,
          ox: new Float32Array(points),
          oy: new Float32Array(points),
          vx: new Float32Array(points),
          vy: new Float32Array(points),
        };
      });
    };

    // The sine wave: where a point would sit with no cursor and no blast.
    const waveY = (line: Line, x: number) =>
      line.y + Math.sin(x * line.frequency + time * line.speed + line.phase) * line.amplitude;

    const step = (dt: number) => {
      for (const line of lines) {
        for (let i = 0; i < points; i += 1) {
          let ax = -STIFFNESS * line.ox[i] - DAMPING * line.vx[i];
          let ay = -STIFFNESS * line.oy[i] - DAMPING * line.vy[i];
          if (pointer.active) {
            // Push away from the cursor, strongest right under it and fading to 0
            // at RADIUS (squared falloff for a soft edge). Measured from the resting
            // spot, so a pushed point doesn't escape the push and flicker.
            const x = i * POINT_SPACING;
            const dx = x - pointer.x;
            const dy = waveY(line, x) - pointer.y;
            const distance = Math.hypot(dx, dy);
            if (distance < RADIUS) {
              const falloff = (1 - distance / RADIUS) ** 2;
              const inv = distance > 0.001 ? 1 / distance : 0;
              ax += dx * inv * falloff * CURSOR_FORCE * 0.35; // mostly bend vertically
              ay += (distance > 0.001 ? dy * inv : 1) * falloff * CURSOR_FORCE;
            }
          }
          // Semi-implicit Euler: update velocity first, then position with the new
          // velocity. Simple and stable for springs at these time steps.
          line.vx[i] += ax * dt;
          line.vy[i] += ay * dt;
          line.ox[i] += line.vx[i] * dt;
          line.oy[i] += line.vy[i] * dt;
        }
      }
    };

    const draw = () => {
      context.clearRect(0, 0, width, height);
      context.globalAlpha = ALPHA;
      context.lineWidth = 1;
      for (const line of lines) {
        context.beginPath();
        for (let i = 0; i < points; i += 1) {
          const x = i * POINT_SPACING;
          const px = x + line.ox[i];
          const py = waveY(line, x) + line.oy[i];
          if (i === 0) context.moveTo(px, py);
          else context.lineTo(px, py);
        }
        context.strokeStyle = line.color;
        context.stroke();
      }
    };

    // Radial impulse: kick every point's velocity straight away from the press,
    // weaker with distance. The springs then pull everything back into place.
    const blast = (cx: number, cy: number) => {
      for (const line of lines) {
        for (let i = 0; i < points; i += 1) {
          const x = i * POINT_SPACING;
          const dx = x - cx;
          const dy = waveY(line, x) - cy;
          const distance = Math.hypot(dx, dy) || 1;
          const strength = BLAST_SPEED * Math.exp(-distance / BLAST_FALLOFF);
          line.vx[i] += (dx / distance) * strength;
          line.vy[i] += (dy / distance) * strength;
        }
      }
    };

    const frame = (now: number) => {
      raf = 0;
      // Clamp the time step so a stalled tab doesn't make the springs explode;
      // two sub-steps per frame keep the stiff springs stable.
      const dt = Math.min((now - (last || now)) / 1000, 1 / 30);
      last = now;
      time += dt;
      step(dt / 2);
      step(dt / 2);
      draw();
      if (visible) raf = requestAnimationFrame(frame);
    };

    build();
    draw();

    const resizeObserver = new ResizeObserver(() => {
      build();
      draw();
    });
    resizeObserver.observe(canvas);

    // Reduced motion: a still drawing, no animation or interaction.
    if (reduceMotion) return () => resizeObserver.disconnect();

    // Only animate while the Hero is on screen.
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !raf) {
        last = 0;
        raf = requestAnimationFrame(frame);
      }
    });
    visibilityObserver.observe(section);

    // Pointer listeners go on the section: the canvas itself has pointer-events: none
    // so the Hero's text and links stay usable on top of it.
    const toLocal = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
    };
    const cancelHold = () => window.clearTimeout(holdTimer);
    const onMove = (event: PointerEvent) => {
      toLocal(event);
      pointer.active = true;
    };
    const onLeave = () => {
      pointer.active = false;
      cancelHold();
    };
    const onDown = (event: PointerEvent) => {
      if (event.button !== 0 || (event.target as Element).closest("a, button")) return;
      toLocal(event);
      pointer.active = true;
      cancelHold();
      holdTimer = window.setTimeout(() => blast(pointer.x, pointer.y), HOLD_MS);
    };

    section.addEventListener("pointermove", onMove);
    section.addEventListener("pointerleave", onLeave);
    section.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", cancelHold);
    window.addEventListener("pointercancel", onLeave);

    return () => {
      cancelAnimationFrame(raf);
      cancelHold();
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      section.removeEventListener("pointermove", onMove);
      section.removeEventListener("pointerleave", onLeave);
      section.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", cancelHold);
      window.removeEventListener("pointercancel", onLeave);
    };
  }, [reduceMotion, lite]);

  return <canvas aria-hidden="true" className="hero-lines" ref={canvasRef} />;
}
