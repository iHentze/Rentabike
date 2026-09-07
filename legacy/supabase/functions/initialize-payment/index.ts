import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.103.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { booking_id, booking_type } = await req.json();

    if (!booking_id || !booking_type) {
      return new Response(
        JSON.stringify({ error: "booking_id and booking_type are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const epayApiKey = Deno.env.get("EPAY_API_KEY") || "test_3450fdd5-e62a-4221-9947-649c48236d4f";
    const epayPosId = Deno.env.get("EPAY_POS_ID") || "019a919d-964e-7349-8b93-768c0853c4ca";

    const supabase = createClient(supabaseUrl, serviceKey);

    const table = booking_type === "tour" ? "tour_bookings" : "bookings";
    const { data: booking, error: fetchErr } = await supabase
      .from(table)
      .select("id, total_price, confirmation_code, payment_status")
      .eq("id", booking_id)
      .maybeSingle();

    if (fetchErr || !booking) {
      return new Response(
        JSON.stringify({ error: "Booking not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (
      booking.payment_status === "authorized" ||
      booking.payment_status === "captured"
    ) {
      return new Response(
        JSON.stringify({ error: "Payment already completed for this booking" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const amountMinor = Math.round(Number(booking.total_price) * 100);
    const webhookUrl = `${supabaseUrl}/functions/v1/payment-webhook`;
    const suffix = Date.now().toString(36);
    const reference = `${booking.confirmation_code}-${suffix}`;

    const sessionBody = {
      pointOfSaleId: epayPosId,
      amount: amountMinor,
      currency: "DKK",
      reference,
      instantCapture: "OFF",
      notificationUrl: webhookUrl,
      timeout: 20,
    };

    const epayRes = await fetch(
      "https://payments.epay.eu/public/api/v1/cit",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${epayApiKey}`,
        },
        body: JSON.stringify(sessionBody),
      }
    );

    if (!epayRes.ok) {
      const errBody = await epayRes.text();
      return new Response(
        JSON.stringify({
          error: "Failed to initialize payment session",
          details: errBody,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const epayData = await epayRes.json();

    await supabase
      .from(table)
      .update({
        payment_session_id: epayData.session.id,
        payment_status: "pending",
        payment_amount_minor: amountMinor,
        payment_method: "card_online",
      })
      .eq("id", booking_id);

    return new Response(
      JSON.stringify({
        sessionId: epayData.session.id,
        sessionKey: epayData.key,
        javascriptUrl: epayData.javascript,
        paymentWindowUrl: epayData.paymentWindowUrl,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Internal error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
