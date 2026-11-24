# Synapse — AI studio landing site
Stack: Next.js App Router, TS, Tailwind, three, R3F, drei, postprocessing, gsap, lenis, zustand.
I'm new to 3D/shaders: add a 2-3 line comment explaining any new 3D concept.
Rules:
- One task at a time. Don't edit unrelated files. Minimal code, no new deps without asking.
- Canvas is fixed full-screen (z-0) behind DOM sections (z-10).
- Particle count: 20000 desktop, 8000 mobile. dpr max 1.5.
- Shared state (scroll progress, active section) lives in lib/store.ts (zustand).
Colors: bg #05060a, cyan #4cc9f0, violet #7b2ff7, accent #f72585.