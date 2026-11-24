"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import SectionLabel from "./SectionLabel";

gsap.registerPlugin(ScrollTrigger);

// Placeholder quotes: replace with real, approved client testimonials before launch.
const testimonials = [
  {
    quote: "They took a vague idea about AI and turned it into the product our customers now ask for by name.",
    role: "Head of Product",
    company: "Fintech platform",
  },
  {
    quote: "Our support agent resolves most tickets on its own, and the answers actually cite our docs.",
    role: "VP Customer Experience",
    company: "B2B SaaS",
  },
  {
    quote: "The 3D launch site did more for our brand in a week than a year of ads.",
    role: "Marketing Director",
    company: "Consumer hardware",
  },
  {
    quote: "Fast, curious and honest about trade-offs. It felt like an extension of our own team.",
    role: "CTO",
    company: "Health-tech startup",
  },
];

// Where a card sits when it's `depth` places behind the top card: a bit lower and
// further away (translateZ, which the parent's perspective turns into "smaller"),
// darker the deeper it is, and hidden past the third card so the deck doesn't look
// endless. Darkening uses brightness, not opacity, so cards stay solid and the text
// of the cards behind never shows through.
const atDepth = (depth: number) => ({
  y: depth * 30,
  z: depth * -90,
  opacity: depth > 2 ? 0 : 1,
  filter: `brightness(${Math.max(1 - depth * 0.3, 0.4)})`,
});

// A sticky stack of cards. Each stretch of scrolling flips the top card up and away
// while the cards behind it move forward one place.
export default function Testimonials() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const context = gsap.context(() => {
      const cards = gsap.utils.toArray<HTMLElement>(".testimonial-card");
      // Stack them: card 0 on top, the rest behind it at increasing depth.
      cards.forEach((card, index) => {
        gsap.set(card, { ...atDepth(index), zIndex: cards.length - index });
      });

      const timeline = gsap.timeline({
        defaults: { duration: 1, ease: "power2.inOut" },
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: "bottom bottom",
          scrub: reduceMotion ? true : 1,
        },
      });
      // Step k (at time k on the timeline): card k rotates out, and every card
      // behind it moves one place forward. The last card stays.
      for (let step = 0; step < cards.length - 1; step += 1) {
        // rotationX -60: the card tips back around its bottom edge (transform-origin
        // in CSS) as it lifts by 120% of its own height (yPercent). It fades out in
        // the first half of the move, so it's gone before it reaches the heading.
        timeline.to(cards[step], { rotationX: -60, yPercent: -120 }, step);
        timeline.to(cards[step], { opacity: 0, duration: 0.5, ease: "power1.in" }, step);
        for (let behind = step + 1; behind < cards.length; behind += 1) {
          timeline.to(cards[behind], atDepth(behind - step - 1), step);
        }
      }
      // A short tail so the last card rests before the section scrolls away.
      timeline.to({}, { duration: 0.4 });
    }, section);

    return () => context.revert();
  }, []);

  return (
    <section aria-labelledby="testimonials-title" className="testimonials" id="testimonials" ref={sectionRef}>
      <div className="testimonials__sticky">
        <div className="testimonials__heading">
          <SectionLabel>Kind words</SectionLabel>
          <h2 id="testimonials-title">
            In their words. <span className="muted">Not ours.</span>
          </h2>
        </div>
        <div className="testimonials__deck">
          {testimonials.map((item, index) => (
            <figure className="testimonial-card" key={item.role}>
              <span aria-hidden="true" className="testimonial-card__mark">
                “
              </span>
              <blockquote>{item.quote}</blockquote>
              <figcaption>
                <span>{item.role}</span> · {item.company}
                <span aria-hidden="true" className="testimonial-card__index">
                  {String(index + 1).padStart(2, "0")} / {String(testimonials.length).padStart(2, "0")}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
