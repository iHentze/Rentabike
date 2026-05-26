import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface EmailRequest {
  type: "confirmation" | "reminder";
  booking_id: string;
  customer_email: string;
  customer_name: string;
  confirmation_code: string;
  start_date: string;
  end_date: string;
  total_price: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const payload: EmailRequest = await req.json();

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: "Resend API key not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const emailContent = generateEmailContent(payload);

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "noreply@rentabike.faroe",
        to: payload.customer_email,
        subject: emailContent.subject,
        html: emailContent.html,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      return new Response(JSON.stringify({ error: result }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, messageId: result.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Email send error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function generateEmailContent(payload: EmailRequest): { subject: string; html: string } {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  if (payload.type === "confirmation") {
    return {
      subject: `Booking Confirmation - ${payload.confirmation_code}`,
      html: `
        <html>
          <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
            <h2>Booking Confirmation</h2>
            <p>Hi ${payload.customer_name},</p>
            <p>Thank you for your booking with RentABike Faroe Islands! Your reservation has been confirmed.</p>

            <h3>Booking Details</h3>
            <ul>
              <li><strong>Confirmation Code:</strong> ${payload.confirmation_code}</li>
              <li><strong>Check-in:</strong> ${formatDate(payload.start_date)}</li>
              <li><strong>Check-out:</strong> ${formatDate(payload.end_date)}</li>
              <li><strong>Total Price:</strong> ${payload.total_price} DKK</li>
            </ul>

            <p>Our team will contact you shortly with pickup details and final instructions.</p>
            <p>If you have any questions, please don't hesitate to reach out.</p>

            <p>Best regards,<br>RentABike Faroe Islands</p>
          </body>
        </html>
      `,
    };
  } else {
    return {
      subject: `Reminder: Your RentABike Booking ${payload.confirmation_code}`,
      html: `
        <html>
          <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
            <h2>Booking Reminder</h2>
            <p>Hi ${payload.customer_name},</p>
            <p>This is a friendly reminder about your upcoming bike rental with RentABike Faroe Islands.</p>

            <h3>Your Booking</h3>
            <ul>
              <li><strong>Confirmation Code:</strong> ${payload.confirmation_code}</li>
              <li><strong>Check-in:</strong> ${formatDate(payload.start_date)}</li>
              <li><strong>Check-out:</strong> ${formatDate(payload.end_date)}</li>
              <li><strong>Total Price:</strong> ${payload.total_price} DKK</li>
            </ul>

            <p>Please arrive 15 minutes early for your pickup. Our rental team is looking forward to helping you explore the beautiful Faroe Islands!</p>

            <p>Best regards,<br>RentABike Faroe Islands</p>
          </body>
        </html>
      `,
    };
  }
}
