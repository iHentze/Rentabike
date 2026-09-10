import { describe, expect, it } from "vitest";
import { assignBike, basketHeaders, nextStep, peekBasket, readBasket, riderLabel, riderReady, unassignBike, type Basket } from "./basket";
import { quoteRequestFor } from "./quote-basket";

const trip = { startAt: new Date("2026-06-12T09:00:00Z"), endAt: new Date("2026-06-14T17:00:00Z"), riders: 2, explicit: true };

function basket(): Basket {
  return {
    riders: [
      { name: "Jóhanna", heightCm: 168, bikeTypeId: "cube-m", addons: { "addon-helmet-for-rent": 1, "addon-pedals-spd": 1 } },
      { name: "Marek", heightCm: 182, addons: {} },
    ],
    extras: {},
    addons: { "addon-bike-carrier-hook": 1 },
  };
}

describe("nextStep — one rider at a time, bike then extras", () => {
  it("sends the first rider without a bike to pick one", () => {
    expect(nextStep(basket())).toEqual({ rider: 1, step: "bike" });
  });
  it("then asks each rider about extras, in order", () => {
    const b = basket();
    b.riders[1]!.bikeTypeId = "centurion-l";
    expect(nextStep(b)).toEqual({ rider: 0, step: "extras" });
    b.riders[0]!.extrasDone = true;
    expect(nextStep(b)).toEqual({ rider: 1, step: "extras" });
  });
  it("is done when everyone has a bike and has been asked", () => {
    const b = basket();
    b.riders[1]!.bikeTypeId = "centurion-l";
    b.riders.forEach((r) => (r.extrasDone = true));
    expect(nextStep(b)).toBeNull();
  });
  it("keeps a rider on the bike step until they have a name and a height, bike or no bike", () => {
    // The chooser and the catalogue can put a bike on a rider before anyone asked who they are.
    const b = basket();
    b.riders[1]!.bikeTypeId = "centurion-l";
    b.riders.forEach((r) => (r.extrasDone = true));
    delete b.riders[1]!.heightCm;
    expect(riderReady(b.riders[1]!)).toBe(false);
    expect(nextStep(b)).toEqual({ rider: 1, step: "bike" });
    b.riders[1]!.heightCm = 182;
    b.riders[1]!.name = "  ";
    expect(nextStep(b)).toEqual({ rider: 1, step: "bike" });
    b.riders[1]!.name = "Marek";
    expect(nextStep(b)).toBeNull();
  });
});

describe("peekBasket — the resume bar's view of the cookie", () => {
  const now = new Date("2026-06-01T12:00:00Z").getTime();
  async function requestWith(b: Basket): Promise<Request> {
    const headers = new Headers(await basketHeaders(b));
    const cookie = headers.get("Set-Cookie")!.split(";")[0]!;
    return new Request("https://rentabike.fo/tours", { headers: { Cookie: cookie } });
  }
  it("is empty without a basket, and after Start over", async () => {
    expect(await peekBasket(new Request("https://rentabike.fo/"), now)).toBeNull();
  });
  it("remembers the trip and where to go next", async () => {
    // readBasket stamps the trip on the cookie; that is what the bar navigates with.
    const first = await readBasket(new Request("https://rentabike.fo/riders"), trip);
    first.riders[0] = basket().riders[0]!;
    const peek = await peekBasket(await requestWith(first), now);
    expect(peek).not.toBeNull();
    expect(peek!.riders).toBe(2);
    expect(peek!.withBike).toBe(1);
    expect(peek!.ridersReady).toBe(1);
    expect(peek!.href).toBe(`/riders?${peek!.trip}&r=2&step=bike`);
    expect(new URLSearchParams(peek!.trip).get("from")).toBe("2026-06-12");
  });
  it("goes to checkout once every rider is sorted", async () => {
    const b = await readBasket(new Request("https://rentabike.fo/riders"), trip);
    b.riders = basket().riders;
    b.riders[1]!.bikeTypeId = "centurion-l";
    b.riders.forEach((r) => (r.extrasDone = true));
    const peek = await peekBasket(await requestWith(b), now);
    expect(peek!.href).toBe(`/checkout?${peek!.trip}`);
  });
  it("forgets a trip that has already started", async () => {
    const b = await readBasket(new Request("https://rentabike.fo/riders"), trip);
    b.riders[0] = basket().riders[0]!;
    expect(await peekBasket(await requestWith(b), new Date("2026-06-13T12:00:00Z").getTime())).toBeNull();
  });
  it("has nothing to say about an untouched basket", async () => {
    const b = await readBasket(new Request("https://rentabike.fo/riders"), trip);
    expect(await peekBasket(await requestWith(b), now)).toBeNull();
  });
});

describe("assignBike / unassignBike", () => {
  it("drops extras the new bike cannot take and asks again", () => {
    const r = basket().riders[0]!;
    r.extrasDone = true;
    assignBike(r, { id: "road-54", addonIds: ["addon-helmet-for-rent"] });
    expect(r.bikeTypeId).toBe("road-54");
    expect(r.addons).toEqual({ "addon-helmet-for-rent": 1 });
    expect(r.extrasDone).toBe(false);
  });
  it("keeps everything when the bike is the same", () => {
    const r = basket().riders[0]!;
    r.extrasDone = true;
    assignBike(r, { id: "cube-m", addonIds: ["addon-helmet-for-rent", "addon-pedals-spd"] });
    expect(r.addons).toEqual({ "addon-helmet-for-rent": 1, "addon-pedals-spd": 1 });
    expect(r.extrasDone).toBe(true);
  });
  it("takes the extras with the bike", () => {
    const r = basket().riders[0]!;
    unassignBike(r);
    expect(r.bikeTypeId).toBeUndefined();
    expect(r.addons).toEqual({});
  });
});

describe("riderLabel", () => {
  it("names riders, and tells two Annas apart", () => {
    const b: Basket = { riders: [{ name: "Anna", addons: {} }, { addons: {} }, { name: "anna ", addons: {} }], extras: {}, addons: {} };
    expect([0, 1, 2].map((i) => riderLabel(b, i))).toEqual(["Anna", "Rider 2", "anna (2)"]);
  });
});

describe("quoteRequestFor", () => {
  it("ties each rider's extras to their label and leaves booking items unlabelled", () => {
    const req = quoteRequestFor(trip, basket());
    expect(req.bikes).toEqual([{ bikeTypeId: "cube-m", qty: 1, riderLabel: "Jóhanna" }]);
    expect(req.addons).toEqual([
      { addonId: "addon-helmet-for-rent", qty: 1, riderLabel: "Jóhanna" },
      { addonId: "addon-pedals-spd", qty: 1, riderLabel: "Jóhanna" },
      { addonId: "addon-bike-carrier-hook", qty: 1 },
    ]);
  });
});
