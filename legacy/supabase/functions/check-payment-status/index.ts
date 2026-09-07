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
    const supabase = createClient(supabaseUrl, serviceKey);

    const table = booking_type === "tour" ? "tour_bookings" : "bookings";
    const { data: booking, error: fetchErr } = await supabase
      .from(table)
      .select("id, payment_status, payment_session_id, payment_transaction_id")
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

    if (booking.payment_status === "authorized" || booking.payment_status === "captured") {
      return new Response(
        JSON.stringify({
          payment_status: booking.payment_status,
          transaction_id: booking.payment_transaction_id,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (booking.payment_session_id) {
      const epayApiKey = Deno.env.get("EPAY_API_KEY") || "test_3450fdd5-e62a-4221-9947-649c48236d4f";

      if (epayApiKey) {
        const epayRes = await fetch(
          `https://payments.epay.eu/public/api/v1/sessions/${booking.payment_session_id}`,
          {
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${epayApiKey}`,
            },
          }
        );

        if (epayRes.ok) {
          const sessionData = await epayRes.json();

          await supabase.from("payment_events").insert({
            booking_id: booking_type === "rental" ? booking_id : null,
            tour_booking_id: booking_type === "tour" ? booking_id : null,
            session_id: booking.payment_session_id,
            event_type: "status_check",
            payload: sessionData,
          });

          if (sessionData.state === "COMPLETED" && booking.payment_status !== "authorized") {
            const transactionId = sessionData.transaction?.id || null;
            await supabase
              .from(table)
              .update({
                payment_status: "authorized",
                payment_transaction_id: transactionId,
                status: "confirmed",
              })
              .eq("id", booking_id);

            return new Response(
              JSON.stringify({
                payment_status: "authorized",
                transaction_id: transactionId,
              }),
              {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }

          if (sessionData.state === "EXPIRED") {
            await supabase
              .from(table)
              .update({ payment_status: "failed" })
              .eq("id", booking_id);

            return new Response(
              JSON.stringify({ payment_status: "failed" }),
              {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        payment_status: booking.payment_status,
        transaction_id: booking.payment_transaction_id,
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
