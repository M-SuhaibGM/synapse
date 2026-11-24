"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import SectionLabel from "./SectionLabel";
import { MOBILE_QUERY } from "@/lib/useDevice";

gsap.registerPlugin(ScrollTrigger);

const services = [
  {
    name: "AI experiences",
    description: "Intelligent products that feel intuitive, useful, and unmistakably human.",
    tags: "PRODUCT STRATEGY · AI UX",
  },
  {
    name: "Digital products",
    description: "From first sketch to final pixel, we turn ambitious ideas into useful tools.",
    tags: "DESIGN · DEVELOPMENT",
  },
  {
    name: "Creative technology",
    description: "New ways to tell stories, connect systems, and make the complex feel simple.",
    tags: "PROTOTYPING · R&D",
  },
  {
    name: "AI agents",
    description: "Assistants that research, decide and act inside the tools your team already uses.",
    tags: "AGENTS · AUTOMATION",
  },
  {
    name: "Knowledge & search",
    description: "Retrieval systems that ground every answer in your own documents and data.",
    tags: "RAG · SEARCH",
  },
  {
    name: "Immersive web",
    description: "Real-time 3D and motion that make a product impossible to scroll past.",
    tags: "WEBGL · MOTION",
  },
];

const pad = (n: number) => String(n).padStart(2, "0");
const TOTAL = pad(services.length);

// Desktop: pinned horizontal scroll. The section is tall (see .services in
// globals.css), its inner box sticks to the screen, and scrolling down slides the
// card track left.
// Mobile (MOBILE_QUERY): no pinning. The viewport is a native, swipeable carousel
// (overflow-x + scroll-snap in CSS) with dot indicators under it.
export default function Services() {
  const sectionRef = useRef<HTMLElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const section = sectionRef.current;
    const sticky = stickyRef.current;
    const track = trackRef.current;
    const bar = barRef.current;
    const counter = counterRef.current;
    if (!section || !sticky || !track || !bar || !counter) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // matchMedia builds the pin only on desktop and reverts it (clearing the track's
    // transform) when the window shrinks to mobile width.
    const media = gsap.matchMedia(section);
    media.add(`not all and ${MOBILE_QUERY}`, () => {
      // How far to slide: until the last card is centered on screen.
      const distance = () => {
        const last = track.lastElementChild as HTMLElement;
        return last.offsetLeft + last.offsetWidth / 2 - sticky.clientWidth / 2;
      };

      gsap.to(track, {
        x: () => -distance(),
        ease: "none", // linear: card movement matches the scrollbar 1:1
        scrollTrigger: {
          trigger: section,
          // The stretch where the inner box is stuck to the screen.
          start: "top top",
          end: "bottom bottom",
          // scrub ties the tween to the scroll position; 1 = a 1s smoothing lag.
          scrub: reduceMotion ? true : 1,
          // Re-measure the distance after resizes (card widths are in vw).
          invalidateOnRefresh: true,
        },
        onUpdate() {
          // this.progress(): 0 = first card centered, 1 = last card centered.
          const progress = this.progress();
          bar.style.transform = `scaleX(${progress})`;
          // Card i is centered at progress i / 5, so rounding gives the current card.
          counter.textContent = pad(Math.round(progress * (services.length - 1)) + 1);
        },
      });
    });

    return () => media.revert();
  }, []);

  // Mobile carousel: the active dot is the card whose center is nearest the
  // viewport's center.
  const onCarouselScroll = useCallback(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) return;
    const center = viewport.scrollLeft + viewport.clientWidth / 2;
    let nearest = 0;
    let best = Infinity;
    Array.from(track.children).forEach((child, index) => {
      const card = child as HTMLElement;
      const distance = Math.abs(card.offsetLeft + card.offsetWidth / 2 - center);
      if (distance < best) {
        best = distance;
        nearest = index;
      }
    });
    setActive(nearest);
  }, []);

  const goTo = (index: number) => {
    const viewport = viewportRef.current;
    const card = trackRef.current?.children[index] as HTMLElement | undefined;
    if (!viewport || !card) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    viewport.scrollTo({
      left: card.offsetLeft - (viewport.clientWidth - card.offsetWidth) / 2,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  };

  return (
    <section aria-labelledby="services-title" className="services" id="services" ref={sectionRef}>
      <div className="services__sticky" ref={stickyRef}>
        <div className="services__heading">
          <SectionLabel>01 / What we do</SectionLabel>
          <h2 id="services-title">
            Useful by design. <span className="muted">Unexpected by nature.</span>
          </h2>
        </div>

        <div
          aria-label="Services"
          className="services__viewport"
          onScroll={onCarouselScroll}
          ref={viewportRef}
          role="region"
        >
          <div className="services__track" ref={trackRef}>
            {services.map((service, index) => (
              <article
                aria-label={`${index + 1} of ${services.length}`}
                aria-roledescription="slide"
                className="service-card"
                key={service.name}
              >
                <div className="service-card__top">
                  <span className="service-card__number">{pad(index + 1)}</span>
                  <span className="service-card__tags">{service.tags}</span>
                </div>
                <span aria-hidden="true" className="service-card__ghost">
                  {pad(index + 1)}
                </span>
                <div className="service-card__body">
                  <h3>{service.name}</h3>
                  <p>{service.description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="services__dots">
          {services.map((service, index) => (
            <button
              aria-current={index === active ? "true" : undefined}
              aria-label={`Show ${service.name}`}
              className="services__dot"
              key={service.name}
              onClick={() => goTo(index)}
              type="button"
            />
          ))}
        </div>

        <div aria-hidden="true" className="services__progress">
          <span className="services__counter">
            <span ref={counterRef}>01</span> / {TOTAL}
          </span>
          <span className="services__bar">
            <span className="services__bar-fill" ref={barRef} />
          </span>
        </div>
      </div>
    </section>
  );
}
