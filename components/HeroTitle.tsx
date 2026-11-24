"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import { useIntroStore } from "@/lib/store";

gsap.registerPlugin(SplitText);

export default function HeroTitle() {
  const titleRef = useRef<HTMLHeadingElement>(null);
  // Wait for the loader to finish so the reveal isn't hidden behind it.
  const introStarted = useIntroStore((state) => state.started);

  useEffect(() => {
    const title = titleRef.current;
    if (!title || !introStarted) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // SplitText wraps every character in its own element so each can animate.
    // It also keeps the heading readable for screen readers (aria-label on the h1).
    // autoSplit re-splits when fonts load or the window resizes, since line breaks
    // and character positions change; returning the tween from onSplit lets GSAP
    // carry the animation over to the new characters.
    const split = SplitText.create(title, {
      type: "words, chars",
      autoSplit: true,
      onSplit: (self) => {
        fixGradientChars(title, self.chars as HTMLElement[]);
        return gsap.from(self.chars, {
          yPercent: 80,
          opacity: 0,
          filter: "blur(8px)",
          duration: 1.1,
          ease: "power4.out",
          stagger: 0.035,
          delay: 0.3,
        });
      },
    });

    return () => {
      split.revert();
    };
  }, [introStarted]);

  return (
    <h1 id="hero-title" ref={titleRef}>
      Ideas into
      <br />
      <span className="text-gradient">intelligence.</span>
    </h1>
  );
}

// .text-gradient paints one gradient clipped to the text. Once each character is its
// own animated element, that clip no longer reaches them (they'd turn invisible), so
// give each character its own copy of the gradient, sized to the whole word and
// shifted by the character's offset so together they still look like one gradient.
function fixGradientChars(title: HTMLElement, chars: HTMLElement[]) {
  const gradient = title.querySelector<HTMLElement>(".text-gradient");
  if (!gradient) return;

  const box = gradient.getBoundingClientRect();
  const image = getComputedStyle(gradient).backgroundImage;

  for (const char of chars) {
    if (!gradient.contains(char)) continue;
    const rect = char.getBoundingClientRect();
    char.style.backgroundImage = image;
    char.style.backgroundSize = `${box.width}px ${box.height}px`;
    char.style.backgroundPosition = `${box.left - rect.left}px ${box.top - rect.top}px`;
    char.style.setProperty("background-clip", "text");
    char.style.setProperty("-webkit-background-clip", "text");
  }
}
