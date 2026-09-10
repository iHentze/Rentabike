/** A GPX track for a bike computer or a phone app. */
export function toGpx(name: string, coords: Array<[number, number]>, elevations?: number[]): string {
  const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!);
  const pts = coords.map(([lon, lat], i) => `<trkpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}">${elevations?.[i] != null ? `<ele>${elevations[i]!.toFixed(1)}</ele>` : ""}</trkpt>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Rent a Bike & Outdoor — rentabike.fo" xmlns="http://www.topografix.com/GPX/1/1">
<metadata><name>${esc(name)}</name><time>${new Date().toISOString()}</time></metadata>
<trk><name>${esc(name)}</name><trkseg>
${pts}
</trkseg></trk>
</gpx>
`;
}

/** Offer a text file to save. Browser only. */
export function download(filename: string, text: string, type = "application/gpx+xml") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
