import { describe, expect, it } from "vitest";
import { assignBike, nextStep, riderLabel, unassignBike, type Basket } from "./basket";
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
