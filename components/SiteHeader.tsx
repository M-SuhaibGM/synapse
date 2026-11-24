"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useDevice } from "@/lib/useDevice";

const navigation = [
  { label: "Services", href: "#services" },
  { label: "Work", href: "#work" },
  { label: "Contact", href: "#contact" },
];

// Top bar. Below 768px the links collapse into a menu button that opens a
// full-screen overlay (rendered beside the header: the header's transform would
// otherwise become the overlay's containing block).
export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { isMobile } = useDevice();
  // Resizing past 768px while open just hides the menu (and releases the lock).
  const isOpen = open && isMobile;
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const close = (restoreFocus: boolean) => {
    setOpen(false);
    // Unlock now, so an anchor jump from a tapped link isn't blocked.
    document.documentElement.style.overflow = "";
    if (restoreFocus) menuButtonRef.current?.focus({ preventScroll: true });
  };

  useEffect(() => {
    if (!isOpen) return;
    const root = document.documentElement;
    root.style.overflow = "hidden";
    closeButtonRef.current?.focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        menuButtonRef.current?.focus({ preventScroll: true });
        return;
      }
      // Keep Tab cycling inside the overlay.
      if (event.key !== "Tab" || !overlayRef.current) return;
      const items = overlayRef.current.querySelectorAll<HTMLElement>("a, button");
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      root.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <>
      <header className="site-header">
        <a aria-label="Synapse home" className="wordmark" href="#hero">
          synapse<span>®</span>
        </a>
        <nav aria-label="Main navigation" className="main-nav">
          {navigation.map((item) => (
            <a href={item.href} key={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
        <a className="header-cta" href="#contact">
          Let&apos;s talk <span aria-hidden="true">↗</span>
        </a>
        <button
          aria-controls="mobile-menu"
          aria-expanded={isOpen}
          aria-label="Open menu"
          className="menu-button"
          onClick={() => setOpen(true)}
          ref={menuButtonRef}
          type="button"
        >
          <span aria-hidden="true" className="menu-button__icon" />
        </button>
      </header>

      {/* data-lenis-prevent: smooth scroll ignores wheel/touch over the overlay. */}
      <div
        aria-label="Menu"
        aria-modal="true"
        className={`mobile-menu${isOpen ? " is-open" : ""}`}
        data-lenis-prevent
        id="mobile-menu"
        inert={!isOpen}
        ref={overlayRef}
        role="dialog"
      >
        <div className="mobile-menu__top">
          <span className="wordmark">
            synapse<span>®</span>
          </span>
          <button
            aria-label="Close menu"
            className="menu-button menu-button--close"
            onClick={() => close(true)}
            ref={closeButtonRef}
            type="button"
          >
            <span aria-hidden="true" className="menu-button__icon" />
          </button>
        </div>
        <nav aria-label="Mobile navigation" className="mobile-menu__links">
          {navigation.map((item, index) => (
            <a
              className="mobile-menu__link"
              href={item.href}
              key={item.href}
              onClick={() => close(false)}
              style={{ "--i": index } as CSSProperties}
            >
              <span aria-hidden="true">0{index + 1}</span>
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </>
  );
}
