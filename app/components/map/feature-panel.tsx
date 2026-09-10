/**
 * What the visitor picked, in words: a tunnel's text from the "Special
 * tunnels" panel, a callout, a place, a ferry, a loop, or one of our tours
 * with a way to book it.
 */
import { useEffect, useState } from "react";
import type { Feature, FeatureCollection, MultiLineString } from "geojson";
import { iconDataUrl, type IconId } from "./icons";
import { ProfileChart, useProfile } from "./profile-chart";
import { Sheet } from "./sheet";
import { MAP_DATA_URLS } from "./style";
import { download, toGpx } from "~/lib/map/gpx";
import type { Coord } from "~/lib/map/router";
import { Lbl, PillButton, PillLink, Price, Tag, cx } from "~/components/ui";
import { LOOPS, NOTES, POIS, TIMETABLES_URL, TUNNELS } from "~/data/map";
import type { MapSelection, MapTour, Poi, TunnelInfo } from "~/data/map/types";
import { fmtDuration } from "~/lib/format";

const POI_LABEL: Record<Poi["kind"], string> = {
  scenicVillage: "Scenic village",
  petrol: "Petrol station",
  campTent: "Campsite with tent pitches",
  campNoTent: "Campsite without tent pitches",
  webcam: "Live weather and road webcam",
  busStop: "Key bus stop",
  bus: "SSL bus service to by-pass tunnel",
  ferryPort: "Ferry",
  trailhead: "Trailhead of popular hike — no bikes allowed",
  noCycling: "No cycling connection",
  busyRoad: "Busy road",
  demanding: "Physically demanding route",
  steep: "Steep section",
};

export function FeaturePanel({ selection, tours, onSelect, onClose }: {
  selection: MapSelection | null;
  tours: MapTour[];
  onSelect: (s: MapSelection, fly?: boolean) => void;
  onClose: () => void;
}) {
  if (!selection) return null;
  const tourBySlug = (slug: string) => tours.find((t) => t.slug === slug);

  let title: React.ReactNode = "";
  let body: React.ReactNode = null;

  switch (selection.kind) {
    case "tunnel": {
      const info = selection.letter ? TUNNELS.find((t) => t.letter === selection.letter) : undefined;
      title = selection.name;
      body = <TunnelBody info={info} open={selection.open} lengthKm={selection.lengthKm} />;
      break;
    }
    case "note": {
      const n = NOTES.find((x) => x.id === selection.id);
      title = "On the map";
      body = n && (
        <div className="flex flex-col gap-4">
          <p className="text-[15.5px] leading-[1.5]">{n.text}</p>
          {n.refTunnel && <TunnelLink letter={n.refTunnel} onSelect={onSelect} />}
          {n.dated && <p className="text-[12.5px] text-ink-dim">As printed on the 2025 map — worth checking before you go.</p>}
        </div>
      );
      break;
    }
    case "poi": {
      const p = POIS.find((x) => x.id === selection.id);
      title = p?.name ?? "";
      body = p && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <img src={iconDataUrl(p.kind as IconId)} alt="" width={28} height={28} className="rounded-[6px] bg-[#e3e9d7] p-[2px]" />
            <span className="text-[14px] text-ink-soft">{POI_LABEL[p.kind]}</span>
          </div>
          {p.note && <p className="text-[15px] leading-[1.5]">{p.note}</p>}
          {p.url && (
            <a href={p.url} target="_blank" rel="noreferrer" className="text-[14.5px] font-semibold text-brand-bright hover:text-ink">
              Open {new URL(p.url).host} ↗
            </a>
          )}
          {(p.kind === "bus" || p.kind === "busStop" || p.kind === "ferryPort") && (
            <a href={TIMETABLES_URL} target="_blank" rel="noreferrer" className="text-[14.5px] font-semibold text-brand-bright hover:text-ink">
              Timetables at ssl.fo ↗
            </a>
          )}
          <TourCards slugs={p.tourSlugs ?? []} find={tourBySlug} />
        </div>
      );
      break;
    }
    case "ferry":
      title = selection.name;
      body = (
        <div className="flex flex-col gap-3">
          <Tag tone={selection.bikes ? "ok" : "ghost"} className={cx("self-start", !selection.bikes && "bg-danger/20 text-danger")}>
            {selection.bikes ? "Bikes accepted" : "Bikes not accepted"}
          </Tag>
          {selection.note && <p className="text-[15px] leading-[1.5]">{selection.note}</p>}
          <a href={TIMETABLES_URL} target="_blank" rel="noreferrer" className="text-[14.5px] font-semibold text-brand-bright hover:text-ink">
            Timetables at ssl.fo ↗
          </a>
        </div>
      );
      break;
    case "loop": {
      const l = LOOPS.find((x) => x.id === selection.id);
      title = l?.name ?? "";
      body = l && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-[6px]">
            {l.distanceKm && <span className="num rounded-full bg-white/6 px-[10px] py-1 text-[12px] text-ink-soft">{l.distanceKm} km</span>}
            {l.includesBus && <span className="rounded-full bg-white/6 px-[10px] py-1 text-[12px] text-ink-soft">Includes a bus transfer</span>}
          </div>
          <p className="text-[15px] leading-[1.5]">{l.description}</p>
          <RideFacts kind="loops" id={l.id} name={l.name} />
          <TourCards slugs={l.tourSlugs ?? []} find={tourBySlug} />
        </div>
      );
      break;
    }
    case "tour": {
      const t = tourBySlug(selection.slug);
      title = t?.title ?? "Guided tour";
      body = (
        <div className="flex flex-col gap-4">
          {t ? <TourCard tour={t} big /> : <p className="text-ink-soft">This tour is not in the catalogue right now.</p>}
          <RideFacts kind="tours" id={selection.slug} name={t?.title ?? selection.slug} />
        </div>
      );
      break;
    }
  }

  return (
    <Sheet open side="right" title={title} onClose={onClose}>
      {body}
    </Sheet>
  );
}

function TunnelBody({ info, open, lengthKm }: { info?: TunnelInfo; open: boolean; lengthKm?: number }) {
  const closed = info ? info.status === "closed" : !open;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {info && <Tag tone="ghost">Note {info.letter}</Tag>}
        <Tag tone={closed ? "ghost" : "ok"} className={cx(closed && "bg-danger/20 text-danger")}>
          {closed ? "Closed to cyclists" : "Open to cyclists"}
        </Tag>
        {(info?.lengthKm ?? lengthKm) != null && <span className="num text-[13.5px] text-ink-mute">{info?.lengthKm ?? lengthKm} km</span>}
      </div>
      {info?.profile && <p className="num text-[13.5px] text-ink-soft">{info.profile}</p>}
      {info ? (
        <>
          <div className="flex flex-col gap-1">
            <Lbl>Cycling</Lbl>
            <p className="text-[15px] leading-[1.5]">{info.cycling}</p>
          </div>
          {info.bus && (
            <div className="flex flex-col gap-1">
              <Lbl>Bus</Lbl>
              <p className="text-[15px] leading-[1.5]">{info.bus}</p>
            </div>
          )}
        </>
      ) : (
        <p className="text-[15px] leading-[1.5] text-ink-soft">{closed ? "This tunnel is closed to cyclists." : "Open to cyclists — dual lane and lit unless the map says otherwise. Always exercise caution."}</p>
      )}
    </div>
  );
}

function TunnelLink({ letter, onSelect }: { letter: TunnelInfo["letter"]; onSelect: (s: MapSelection, fly?: boolean) => void }) {
  const t = TUNNELS.find((x) => x.letter === letter);
  if (!t) return null;
  return (
    <button
      type="button"
      onClick={() => onSelect({ kind: "tunnel", id: `tunnel-${t.letter}`, name: t.name, open: t.status === "open", letter: t.letter, lengthKm: t.lengthKm }, true)}
      className="self-start text-[14.5px] font-semibold text-brand-bright hover:text-ink"
    >
      See note {t.letter} — {t.name} ›
    </button>
  );
}

function TourCards({ slugs, find }: { slugs: string[]; find: (slug: string) => MapTour | undefined }) {
  const list = slugs.map(find).filter((t): t is MapTour => Boolean(t));
  if (list.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <Lbl>Our guided tours here</Lbl>
      {list.map((t) => (
        <TourCard key={t.slug} tour={t} />
      ))}
    </div>
  );
}

function TourCard({ tour, big }: { tour: MapTour; big?: boolean }) {
  const facts = [tour.weekday && `${tour.weekday}s`, fmtDuration(tour.durationMin), tour.distanceKm && `${tour.distanceKm} km`].filter(Boolean) as string[];
  return (
    <div className="flex flex-col gap-3 overflow-hidden rounded-field bg-white/6">
      {tour.image && <img src={tour.image} alt="" className={cx("w-full object-cover", big ? "h-[150px]" : "h-[96px]")} />}
      <div className="flex flex-col gap-[10px] px-4 pb-4">
        {!big && <span className="text-[15.5px] font-semibold leading-[1.25]">{tour.title}</span>}
        <span className={cx("leading-[1.45] text-ink-soft", big ? "text-[14.5px]" : "text-[13px]")}>{tour.summary}</span>
        <div className="flex flex-wrap gap-[6px]">
          {facts.map((f) => (
            <span key={f} className="num rounded-full bg-white/6 px-[10px] py-[3px] text-[12px] text-ink-soft">
              {f}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 pt-1">
          <Price minor={tour.priceMinor} size="sm" per="per person" />
          <PillLink to={`/tours/${tour.slug}`} tone="primary" size="sm">
            {tour.nextSeatsLeft != null ? "Book" : "See dates"}
          </PillLink>
        </div>
      </div>
    </div>
  );
}

const lineCache = new Map<string, Promise<FeatureCollection>>();
function lines(kind: "loops" | "tours"): Promise<FeatureCollection> {
  let p = lineCache.get(kind);
  if (!p) {
    p = fetch(MAP_DATA_URLS[kind]).then((r) => r.json() as Promise<FeatureCollection>);
    lineCache.set(kind, p);
  }
  return p;
}

/** Climb, profile and a GPX for a loop or a tour, from its drawn geometry. */
function RideFacts({ kind, id, name }: { kind: "loops" | "tours"; id: string; name: string }) {
  const [coords, setCoords] = useState<Coord[] | null>(null);
  useEffect(() => {
    let live = true;
    setCoords(null);
    lines(kind)
      .then((fc) => {
        const f = fc.features.find((x) => x.id === id) as Feature<MultiLineString> | undefined;
        if (live && f) setCoords(f.geometry.coordinates.flat() as Coord[]);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [kind, id]);
  const { profile, loading } = useProfile(coords);
  if (!coords) return null;
  return (
    <div className="flex flex-col gap-3">
      <ProfileChart profile={profile} loading={loading} />
      <PillButton tone="ghost" size="sm" className="self-start" onClick={() => download(`${id}.gpx`, toGpx(name, coords, profile && profile.d.length === coords.length ? profile.e : undefined))}>
        Download GPX
      </PillButton>
    </div>
  );
}
