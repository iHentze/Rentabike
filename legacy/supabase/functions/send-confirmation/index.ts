import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.103.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface BookingItem {
  quantity: number;
  price_per_day: number;
  bike: { name: string; size?: string } | null;
  person: { person_label: string } | null;
}

interface BookingPerson {
  id: string;
  person_label: string;
  sort_order: number;
}

interface Booking {
  id: string;
  confirmation_code: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  start_date: string;
  end_date: string;
  pickup_time: string;
  dropoff_time: string;
  pickup_location: string;
  dropoff_location: string;
  total_price: number;
  status: string;
  notes: string;
  payment_method: string;
  payment_status: string;
  items: BookingItem[];
  persons: BookingPerson[];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function generateEmailHtml(booking: Booking): string {
  const persons = (booking.persons || []).sort(
    (a, b) => a.sort_order - b.sort_order
  );
  const isGroup = persons.length > 1;

  let itemsHtml = "";

  if (isGroup) {
    for (const person of persons) {
      const pItems = (booking.items || []).filter(
        (i) => i.person?.person_label === person.person_label
      );
      if (pItems.length === 0) continue;
      itemsHtml += `<tr><td colspan="3" style="padding:12px 0 4px;font-weight:600;border-bottom:1px solid #e5e5e5;">${person.person_label}</td></tr>`;
      for (const item of pItems) {
        itemsHtml += `<tr>
          <td style="padding:8px 0;">${item.bike?.name || "Item"}${item.bike?.size ? ` (${item.bike.size})` : ""}</td>
          <td style="padding:8px 0;text-align:center;">${item.quantity}</td>
          <td style="padding:8px 0;text-align:right;">${item.price_per_day} DKK/day</td>
        </tr>`;
      }
    }
  } else {
    for (const item of booking.items || []) {
      itemsHtml += `<tr>
        <td style="padding:8px 0;">${item.bike?.name || "Item"}${item.bike?.size ? ` (${item.bike.size})` : ""}</td>
        <td style="padding:8px 0;text-align:center;">${item.quantity}</td>
        <td style="padding:8px 0;text-align:right;">${item.price_per_day} DKK/day</td>
      </tr>`;
    }
  }

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e0e0e0;">
      <div style="background:#0a0a0e;padding:32px 24px;text-align:center;">
        <h1 style="color:#fff;margin:0 0 8px;font-size:24px;">Booking Confirmed</h1>
        <p style="color:rgba(255,255,255,0.7);margin:0;font-size:14px;">Thank you, ${booking.customer_name}!</p>
      </div>

      <div style="padding:24px;text-align:center;">
        <p style="margin:0 0 8px;color:#666;font-size:13px;">Your confirmation code</p>
        <div style="display:inline-block;background:#f0f4ff;border:1px solid #d0d8f0;border-radius:8px;padding:12px 24px;">
          <span style="font-size:24px;font-weight:700;letter-spacing:2px;color:#1a1a1a;">${booking.confirmation_code}</span>
        </div>
        ${isGroup ? `<p style="margin:8px 0 0;color:#666;font-size:13px;">${persons.length} people in your group</p>` : ""}
      </div>

      <div style="padding:0 24px 24px;">
        <div style="background:#fafafa;border-radius:8px;padding:16px;margin-bottom:16px;">
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr>
              <td style="padding:4px 0;color:#666;">Dates</td>
              <td style="padding:4px 0;text-align:right;font-weight:500;">
                ${formatDate(booking.start_date)}${booking.pickup_time ? ` at ${booking.pickup_time.slice(0, 5)}` : ""}
                &ndash;
                ${formatDate(booking.end_date)}${booking.dropoff_time ? ` at ${booking.dropoff_time.slice(0, 5)}` : ""}
              </td>
            </tr>
            ${booking.pickup_location ? `<tr><td style="padding:4px 0;color:#666;">Pick-up</td><td style="padding:4px 0;text-align:right;font-weight:500;">${booking.pickup_location}</td></tr>` : ""}
            ${booking.dropoff_location ? `<tr><td style="padding:4px 0;color:#666;">Drop-off</td><td style="padding:4px 0;text-align:right;font-weight:500;">${booking.dropoff_location}</td></tr>` : ""}
          </table>
        </div>

        ${
          itemsHtml
            ? `<table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:16px;">
          <thead><tr style="border-bottom:2px solid #e5e5e5;">
            <th style="padding:8px 0;text-align:left;font-weight:600;">Item</th>
            <th style="padding:8px 0;text-align:center;font-weight:600;">Qty</th>
            <th style="padding:8px 0;text-align:right;font-weight:600;">Price</th>
          </tr></thead>
          <tbody>${itemsHtml}</tbody>
        </table>`
            : ""
        }

        <div style="background:#0a0a0e;border-radius:8px;padding:16px;display:flex;justify-content:space-between;align-items:center;">
          <span style="color:rgba(255,255,255,0.7);font-size:14px;">Total</span>
          <span style="color:#fff;font-size:20px;font-weight:700;">${booking.total_price.toLocaleString()} DKK</span>
        </div>

        <p style="color:#999;font-size:12px;margin:16px 0 0;text-align:center;">
          ${booking.payment_method === "card_online" && (booking.payment_status === "authorized" || booking.payment_status === "captured")
            ? "Your card has been authorized. The amount will be charged when you pick up your equipment."
            : "Payment is collected at the shop upon pick-up."}
        </p>
      </div>

      ${
        booking.notes
          ? `<div style="padding:0 24px 24px;">
        <div style="background:#fff8e6;border:1px solid #ffe0a0;border-radius:8px;padding:12px;">
          <p style="margin:0 0 4px;font-size:12px;color:#996600;font-weight:600;">Special Requests</p>
          <p style="margin:0;font-size:14px;color:#664400;">${booking.notes}</p>
        </div>
      </div>`
          : ""
      }

      <div style="padding:0 24px 24px;">
        <div style="background:#fafafa;border-radius:8px;padding:16px;text-align:center;">
          <p style="margin:0 0 4px;font-size:13px;font-weight:600;">RentABike.fo</p>
          <p style="margin:0;font-size:12px;color:#666;">
            Sverrisgota 20, FO-100 Torshavn<br/>
            (+298) 270600 &middot; rentabike@rentabike.fo
          </p>
        </div>
      </div>
    </div>

    <p style="text-align:center;color:#999;font-size:11px;margin:16px 0 0;">
      You can look up your booking at any time using your confirmation code.
    </p>
  </div>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { booking_id } = await req.json();

    if (!booking_id) {
      return new Response(
        JSON.stringify({ error: "booking_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: booking, error: fetchError } = await supabase
      .from("bookings")
      .select(
        "*, items:booking_items(*, bike:bikes(name, size), person:booking_persons(person_label)), persons:booking_persons(*)"
      )
      .eq("id", booking_id)
      .maybeSingle();

    if (fetchError || !booking) {
      return new Response(
        JSON.stringify({ error: "Booking not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailHtml = generateEmailHtml(booking as Booking);

    return new Response(
      JSON.stringify({
        success: true,
        email_html: emailHtml,
        recipient: booking.customer_email,
        subject: `Booking Confirmed - ${booking.confirmation_code} | RentABike.fo`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
