"use client";

import { useEffect, useRef, useState } from "react";

export default function InfoTooltip({ label, children }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const handleClick = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const handleKey = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <span className="info-tooltip" ref={rootRef}>
      <button
        type="button"
        className="info-tooltip-btn"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        i
      </button>
      {open ? (
        <span className="info-tooltip-popup" role="tooltip">
          {children}
        </span>
      ) : null}
    </span>
  );
}

