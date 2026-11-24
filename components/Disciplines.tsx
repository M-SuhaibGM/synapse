"use client";

import { Fragment, useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import SectionLabel from "./SectionLabel";

gsap.registerPlugin(ScrollTrigger, SplitText);

const DISCIPLINES = ["AGENTS", "RAG", "FULL-STACK", "3D"];
const SPREAD = 600; // px: how far a letter can start from its place on each axis
const SPIN = 180; // degrees: how far it can start rotated on each axis

// A 200vh section whose content sticks for one screen of scrolling. Over that stretch
// the letters fly in from random 3D positions and rotations and lock into the words.
export default function Disciplines() {
  const sectionRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const title = titleRef.current;
    if (!section || !title) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const context = gsap.context(() => {
      // One element per letter. Splitting into words too keeps each word together
      // when the line wraps on narrow screens.
      const split = SplitText.create(title, { type: "words, chars" });

      const timeline = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          // The stretch where the content is stuck: the section's top at the top of
          // the screen until its bottom reaches the bottom.
          start: "top top",
          end: "bottom bottom",
          // scrub ties the animation to the scrollbar (scroll back = play backward);
          // 1 = it takes 1s to catch up, which smooths out jerky scrolling.
          scrub: 1,
        },
      });
      // gsap.from animates FROM these values TO each letter's normal place. Function
      // values run once per letter, so every letter gets its own random start.
      // x/y/z are a 3D translate; rotationX/Y/Z spin around each axis.
      const random = gsap.utils.random;
      timeline.from(split.chars, {
        x: () => random(-SPREAD, SPREAD),
        y: () => random(-SPREAD, SPREAD),
        z: () => random(-SPREAD, SPREAD),
        rotationX: () => random(-SPIN, SPIN),
        rotationY: () => random(-SPIN, SPIN),
        rotationZ: () => random(-SPIN, SPIN),
        opacity: 0,
        duration: 1,
        ease: "power3.out",
        // stagger: start each letter a little after the previous one, the whole
        // spread taking 0.8 of the timeline, so they arrive in a wave left to right.
        stagger: { amount: 0.8 },
      });
      // A short empty tail so the finished words rest for a moment before unsticking.
      timeline.to({}, { duration: 0.3 });
    }, section);

    // revert() undoes the split and every inline style (safe with React's double effects).
    return () => context.revert();
  }, []);

  return (
    <section
      aria-labelledby="disciplines-title"
      className="disciplines"
      id="disciplines"
      ref={sectionRef}
    >
      <div className="disciplines__sticky">
        <div aria-hidden="true" className="disciplines__rings" />
        <div className="disciplines__label">
          <SectionLabel>Disciplines</SectionLabel>
        </div>
        <h2 className="disciplines__title" id="disciplines-title" ref={titleRef}>
          {DISCIPLINES.map((word, index) => (
            <Fragment key={word}>
              {index > 0 && <span className="disciplines__dot"> · </span>}
              <span className="disciplines__word">{word}</span>
            </Fragment>
          ))}
        </h2>
      </div>
    </section>
  );
}
