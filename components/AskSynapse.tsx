"use client";

import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { useEffect, useRef, useState, type PointerEvent } from "react";

const SUGGESTIONS = [
  "What does Synapse do?",
  "Can you build an AI agent for my team?",
  "How do we start a project together?",
];

// A reply "mentions contact" when it points the visitor to the team.
const CONTACT_PATTERN = /\b(contact|book a call|get in touch|reach out|hello@synapse)/i;

const CLOSE_DISTANCE = 120; // px dragged down that closes the sheet
const CLOSE_VELOCITY = 0.6; // px/ms: a quick flick down also closes it

const textOf = (message: UIMessage) =>
  message.parts.map((part) => (part.type === "text" ? part.text : "")).join("");

// Floating "Ask Synapse" pill that opens a chat in a draggable bottom sheet.
export default function AskSynapse() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, error, stop, regenerate } = useChat();
  const busy = status === "submitted" || status === "streaming";

  const sheetRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pillRef = useRef<HTMLButtonElement>(null);
  const drag = useRef({ startY: 0, startTime: 0, dy: 0, active: false });

  // Focus the input on open; hand focus back to the pill on close. Escape closes.
  useEffect(() => {
    if (!open) return;
    const pill = pillRef.current;
    inputRef.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      pill?.focus({ preventScroll: true });
    };
  }, [open]);

  // Keep the newest message in view while a reply streams in.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, status]);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    sendMessage({ text: trimmed });
    setInput("");
  };

  // Drag the handle: the sheet follows the pointer downward only, then either
  // closes (far or fast enough) or springs back.
  const onDragStart = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startY: event.clientY, startTime: event.timeStamp, dy: 0, active: true };
    sheetRef.current?.classList.add("ask-sheet--dragging");
  };
  const onDragMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current.active || !sheetRef.current) return;
    drag.current.dy = Math.max(0, event.clientY - drag.current.startY);
    sheetRef.current.style.transform = `translate(-50%, ${drag.current.dy}px)`;
  };
  const onDragEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current.active || !sheetRef.current) return;
    const { dy, startTime } = drag.current;
    drag.current.active = false;
    const velocity = dy / Math.max(1, event.timeStamp - startTime);
    sheetRef.current.classList.remove("ask-sheet--dragging");
    sheetRef.current.style.transform = "";
    if (dy > CLOSE_DISTANCE || velocity > CLOSE_VELOCITY) setOpen(false);
  };

  return (
    <>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        className="ask-pill"
        data-hidden={open || undefined}
        onClick={() => setOpen(true)}
        ref={pillRef}
        type="button"
      >
        <span className="status-dot" /> Ask Synapse
      </button>

      <div
        aria-hidden="true"
        className="ask-backdrop"
        data-open={open || undefined}
        onClick={() => setOpen(false)}
      />

      <div
        aria-labelledby="ask-title"
        aria-modal="true"
        className="ask-sheet"
        data-open={open || undefined}
        inert={!open}
        ref={sheetRef}
        role="dialog"
      >
        <div
          className="ask-sheet__header"
          onPointerCancel={onDragEnd}
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
        >
          <span aria-hidden="true" className="ask-sheet__handle" />
          <h2 id="ask-title">Ask Synapse</h2>
          <button
            aria-label="Close chat"
            className="ask-sheet__close"
            onClick={() => setOpen(false)}
            type="button"
          >
            ×
          </button>
        </div>

        {/* data-lenis-prevent: let this list scroll natively instead of the page. */}
        <div aria-live="polite" className="ask-sheet__messages" data-lenis-prevent ref={listRef}>
          {messages.length === 0 && (
            <div className="ask-intro">
              <p>Questions about our work, services or how we collaborate? Ask away.</p>
              <div className="ask-suggestions">
                {SUGGESTIONS.map((question) => (
                  <button key={question} onClick={() => send(question)} type="button">
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message, index) => {
            const text = textOf(message);
            const streaming = busy && index === messages.length - 1;
            return (
              <div className={`ask-message ask-message--${message.role}`} key={message.id}>
                <p>{text}</p>
                {message.role === "assistant" && !streaming && CONTACT_PATTERN.test(text) && (
                  <a className="ask-book" href="#contact" onClick={() => setOpen(false)}>
                    Book a call <span aria-hidden="true">↗</span>
                  </a>
                )}
              </div>
            );
          })}

          {status === "submitted" && (
            <div className="ask-message ask-message--assistant">
              <p className="ask-typing" aria-label="Synapse is typing">
                <span /> <span /> <span />
              </p>
            </div>
          )}

          {error && (
            <div className="ask-error" role="alert">
              <p>{error.message.length < 160 ? error.message : "Something went wrong."}</p>
              <button onClick={() => regenerate()} type="button">
                Try again
              </button>
            </div>
          )}
        </div>

        <form
          className="ask-sheet__form"
          onSubmit={(event) => {
            event.preventDefault();
            send(input);
          }}
        >
          <input
            aria-label="Your question"
            maxLength={1000}
            onChange={(event) => setInput(event.currentTarget.value)}
            placeholder="Ask about our services…"
            ref={inputRef}
            value={input}
          />
          {busy ? (
            <button onClick={() => stop()} type="button">
              Stop
            </button>
          ) : (
            <button disabled={!input.trim()} type="submit">
              Send
            </button>
          )}
        </form>
      </div>
    </>
  );
}
