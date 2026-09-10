import { useEffect, useState } from "react";
import { profileFor, type Profile } from "~/lib/map/elevation";
import type { Coord } from "~/lib/map/router";

/** Height along the ride, from the terrain tiles. Browser only. */
export function useProfile(coords: Coord[] | null): { profile: Profile | null; loading: boolean } {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let live = true;
    setProfile(null);
    if (!coords || coords.length < 2) return;
    setLoading(true);
    profileFor(coords)
      .then((p) => live && setProfile(p))
      .catch(() => live && setProfile(null))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [coords]);
  return { profile, loading };
}

export function ProfileChart({ profile, loading }: { profile: Profile | null; loading: boolean }) {
  if (loading) return <div className="h-[92px] animate-pulse rounded-field bg-white/5" aria-hidden />;
  if (!profile) return null;
  const W = 320;
  const H = 80;
  const padB = 14;
  const total = profile.d[profile.d.length - 1] ?? 1;
  const lo = Math.floor(profile.minM / 50) * 50;
  const hi = Math.max(lo + 100, Math.ceil(profile.maxM / 50) * 50);
  const x = (d: number) => (d / total) * W;
  const y = (e: number) => H - padB - ((e - lo) / (hi - lo)) * (H - padB - 4);
  const path = profile.d.map((d, i) => `${i ? "L" : "M"}${x(d).toFixed(1)} ${y(profile.e[i]!).toFixed(1)}`).join(" ");
  const area = `${path} L${W} ${H - padB} L0 ${H - padB} Z`;
  const km = Math.round(total / 100) / 10;
  return (
    <figure className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13.5px]">
        <span className="num">
          <span className="text-ink-mute">Climb</span> <b>{profile.ascentM} m</b>
        </span>
        <span className="num">
          <span className="text-ink-mute">Descent</span> <b>{profile.descentM} m</b>
        </span>
        <span className="num">
          <span className="text-ink-mute">High point</span> <b>{profile.maxM} m</b>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Elevation profile: ${profile.ascentM} m of climbing over ${km} km, high point ${profile.maxM} m`}>
        <path d={area} fill="rgba(79,166,232,.22)" />
        <path d={path} fill="none" stroke="#4fa6e8" strokeWidth="1.6" />
        <line x1="0" x2={W} y1={H - padB} y2={H - padB} stroke="rgba(255,255,255,.15)" />
        <text x="0" y={H - 2} fill="#7f95a8" fontSize="10">
          0 km
        </text>
        <text x={W} y={H - 2} fill="#7f95a8" fontSize="10" textAnchor="end">
          {km} km
        </text>
        <text x="2" y={y(hi) + 9} fill="#7f95a8" fontSize="10">
          {hi} m
        </text>
      </svg>
    </figure>
  );
}
