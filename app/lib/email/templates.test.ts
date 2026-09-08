import { describe, expect, it } from "vitest";
import type { BookingView } from "~/lib/booking/lookup";
import { cancellationMail, confirmationMail } from "./templates";
import { ConsoleMailer, parseAddress } from "./mailer";

const T0 = Date.UTC(2026, 5, 12, 9, 0, 0);
const booking: BookingView = {
  id: "b1",
  code: "A7F3C2",
  kind: "rental",
  status: "confirmed",
  startAt: T0,
  endAt: T0 + 72 * 3_600_000,
  customerName: "Jóhanna Olsen",
  customerEmail: "johanna@example.fo",
  customerPhone: null,
  pickupLocationId: "airport",
  dropoffLocationId: "shop",
  pickupName: "Airport",
  dropoffName: "Sverrisgøta 20",
  pickupNote: "Staff meet you if possible; otherwise the locked bike stands right of the only entrance.",
  notes: null,
  staffNotes: null,
  totalMinor: 289000,
  paymentMethod: "card",
  paidMinor: 289000,
  refundedMinor: 0,
  holdExpiresAt: null,
  createdAt: T0 - 86_400_000,
  lines: [
    { kind: "bike", label: "Cube Dual Suspension", riderLabel: "Jóhanna", qty: 1, unitPriceMinor: 40000, lineTotalMinor: 120000, bikeTypeId: "cube-m", sizeLabel: "Medium", tourDepartureId: null },
    { kind: "addon", label: "Helmet for rent", riderLabel: "Jóhanna", qty: 1, unitPriceMinor: 5000, lineTotalMinor: 5000, bikeTypeId: null, sizeLabel: null, tourDepartureId: null },
    { kind: "fee", label: "Pickup at Airport", riderLabel: null, qty: 1, unitPriceMinor: 49000, lineTotalMinor: 49000, bikeTypeId: null, sizeLabel: null, tourDepartureId: null },
  ],
};

describe("confirmation email", () => {
  const mail = confirmationMail(booking, { origin: "https://rentabike.fo" });
  it("carries the code, the dates, every line, the total and the airport note", () => {
    expect(mail.to).toBe("johanna@example.fo");
    expect(mail.subject).toContain("A7F3C2");
    for (const s of ["Hi Jóhanna", "A7F3C2", "Friday 12 June", "Jóhanna — Cube Dual Suspension (Medium): DKK 1,200", "Helmet for rent: DKK 50", "Total: DKK 2,890", "Paid by card: DKK 2,890", "locked bike stands right", "https://rentabike.fo/booking?code=A7F3C2"]) {
      expect(mail.text).toContain(s);
      expect(mail.html).toContain(s.replace("Total: ", "Total "));
    }
  });
  it("attaches the calendar file and escapes HTML in names", () => {
    expect(mail.attachments?.[0]).toMatchObject({ filename: "rentabike-A7F3C2.ics", type: "text/calendar" });
    expect(mail.attachments?.[0]?.content).toContain("BEGIN:VEVENT");
    const evil = confirmationMail({ ...booking, customerName: "<script>alert(1)</script>" }, { origin: "https://rentabike.fo" });
    expect(evil.html).not.toContain("<script>");
    expect(evil.html).toContain("&lt;script&gt;");
  });
  it("says what is owed at the counter when paying on collection", () => {
    const shop = confirmationMail({ ...booking, paymentMethod: "shop", paidMinor: 0 }, { origin: "https://rentabike.fo" });
    expect(shop.text).toContain("To pay when you collect: DKK 2,890");
  });
});

describe("cancellation email", () => {
  it("states the refund, or that nothing was charged", () => {
    const refund = cancellationMail(booking, { refundMinor: 289000, byShop: true, reason: "storm warning" }, { origin: "https://rentabike.fo" });
    expect(refund.text).toContain("We've had to cancel");
    expect(refund.text).toContain("DKK 2,890 goes back to your card");
    expect(refund.text).toContain("storm warning");
    const kept = cancellationMail(booking, { refundMinor: 0, byShop: false }, { origin: "https://rentabike.fo" });
    expect(kept.text).toContain("stays charged");
    const shop = cancellationMail({ ...booking, paymentMethod: "shop", paidMinor: 0 }, { refundMinor: 0, byShop: false }, { origin: "https://rentabike.fo" });
    expect(shop.text).toContain("Nothing was charged");
  });
});

describe("mailer", () => {
  it("parses sender strings", () => {
    expect(parseAddress("Rent a Bike <booking@rentabike.fo>", { email: "x" })).toEqual({ email: "booking@rentabike.fo", name: "Rent a Bike" });
    expect(parseAddress("booking@rentabike.fo", { email: "x" })).toEqual({ email: "booking@rentabike.fo" });
    expect(parseAddress(undefined, { email: "x", name: "Y" })).toEqual({ email: "x", name: "Y" });
  });
  it("the console mailer records instead of sending", async () => {
    const m = new ConsoleMailer();
    expect(await m.send({ to: "a@b", subject: "s", text: "t", html: "h" })).toEqual({ id: null });
    expect(m.sent).toHaveLength(1);
  });
});
