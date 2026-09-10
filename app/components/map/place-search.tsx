import { useEffect, useId, useRef, useState } from "react";
import { search, type SearchHit } from "./search";
import { cx } from "~/components/ui";

/** A text field with the matching places under it; Enter takes the first. */
export function PlaceSearch({ index, placeholder, onPick, autoFocus, className }: { index: SearchHit[]; placeholder: string; onPick: (hit: SearchHit) => void; autoFocus?: boolean; className?: string }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const box = useRef<HTMLDivElement>(null);
  const hits = search(index, q);

  useEffect(() => {
    const away = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, []);

  const pick = (h: SearchHit) => {
    onPick(h);
    setQ("");
    setOpen(false);
  };

  return (
    <div ref={box} className={cx("relative", className)}>
      <input
        type="search"
        value={q}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        role="combobox"
        aria-expanded={open && hits.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, hits.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && hits[active]) {
            e.preventDefault();
            pick(hits[active]!);
          } else if (e.key === "Escape") setOpen(false);
        }}
        className="w-full rounded-field bg-white/10 px-[14px] py-[11px] text-[15px] text-ink shadow-[inset_0_0_0_1px_rgba(255,255,255,.13)] placeholder:text-ink-mute focus:outline-2 focus:outline-brand-bright"
      />
      {open && hits.length > 0 && (
        <ul id={listId} role="listbox" className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-field bg-[#1b2631] shadow-[0_12px_32px_rgba(0,0,0,.4)]">
          {hits.map((h, i) => (
            <li key={h.id} role="option" aria-selected={i === active}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(h)} onMouseEnter={() => setActive(i)} className={cx("flex w-full items-baseline justify-between gap-3 px-[14px] py-[9px] text-left text-[14.5px]", i === active ? "bg-brand/25" : "hover:bg-white/6")}>
                <span className="font-semibold">{h.label}</span>
                <span className="shrink-0 text-[12.5px] text-ink-mute">{h.sub}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
