/**
 * The one floating surface over the map: a card at the side on a wide
 * screen, a sheet from the bottom on a phone. Legend and feature details
 * both live in it, never at the same time.
 */
import { useEffect, useRef, type ReactNode } from "react";
import { cx } from "~/components/ui";

export function Sheet({ open, side, title, onClose, children, className }: { open: boolean; side: "left" | "right"; title: ReactNode; onClose: () => void; children: ReactNode; className?: string }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = `sheet-${side}-title`;

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <section
      role="dialog"
      aria-labelledby={titleId}
      className={cx(
        "absolute z-20 flex flex-col overflow-hidden bg-card/95 text-ink shadow-[0_12px_40px_rgba(0,0,0,.35)] backdrop-blur",
        // phone: a sheet along the bottom
        "inset-x-0 bottom-0 max-h-[62dvh] rounded-t-card",
        // wide: a card at one side, as tall as its content
        "lg:inset-x-auto lg:bottom-auto lg:top-4 lg:max-h-[calc(100%-2rem)] lg:w-[360px] lg:rounded-card",
        side === "left" ? "lg:left-4" : "lg:right-4",
        className,
      )}
    >
      <div className="flex items-center gap-3 px-5 pb-2 pt-3">
        <span aria-hidden className="absolute left-1/2 top-[6px] h-1 w-9 -translate-x-1/2 rounded-full bg-white/20 lg:hidden" />
        <h2 id={titleId} className="mt-1 flex-1 font-display text-[19px] font-bold tracking-[-.015em]">
          {title}
        </h2>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="flex size-9 items-center justify-center rounded-full bg-white/9 hover:bg-white/14">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-1">{children}</div>
    </section>
  );
}
