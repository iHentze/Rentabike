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
    const payload = await req.json();
    const sessionId = payload?.session?.id || payload?.sessionId;

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: "No session ID in payload" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    let bookingId: string | null = null;
    let bookingType: "rental" | "tour" | null = null;

    const { data: rental } = await supabase
      .from("bookings")
      .select("id")
      .eq("payment_session_id", sessionId)
      .maybeSingle();

    if (rental) {
      bookingId = rental.id;
      bookingType = "rental";
    } else {
      const { data: tour } = await supabase
        .from("tour_bookings")
        .select("id")
        .eq("payment_session_id", sessionId)
        .maybeSingle();

      if (tour) {
        bookingId = tour.id;
        bookingType = "tour";
      }
    }

    await supabase.from("payment_events").insert({
      booking_id: bookingType === "rental" ? bookingId : null,
      tour_booking_id: bookingType === "tour" ? bookingId : null,
      session_id: sessionId,
      event_type: "webhook_notification",
      payload,
    });

    if (!bookingId || !bookingType) {
      return new Response(
        JSON.stringify({ received: true, matched: false }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const sessionState = payload?.session?.state;
    const table = bookingType === "tour" ? "tour_bookings" : "bookings";

    if (sessionState === "COMPLETED") {
      const transactionId =
        payload?.transaction?.id || payload?.transactionId || null;

      await supabase
        .from(table)
        .update({
          payment_status: "authorized",
          payment_transaction_id: transactionId,
          status: "confirmed",
        })
        .eq("id", bookingId);

      if (bookingType === "rental") {
        const confirmUrl = `${supabaseUrl}/functions/v1/send-confirmation`;
        fetch(confirmUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ booking_id: bookingId }),
        }).catch(() => {});
      }
    } else if (
      sessionState === "EXPIRED" ||
      sessionState === "FAILED"
    ) {
      await supabase
        .from(table)
        .update({ payment_status: "failed" })
        .eq("id", bookingId);
    }

    return new Response(
      JSON.stringify({ received: true, matched: true }),
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
