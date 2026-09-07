import type { Booking } from '../types';

export async function sendBookingConfirmationEmail(booking: Booking): Promise<void> {
  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-booking-email`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      type: 'confirmation',
      booking_id: booking.id,
      customer_email: booking.customer_email,
      customer_name: booking.customer_name,
      confirmation_code: booking.confirmation_code,
      start_date: booking.start_date,
      end_date: booking.end_date,
      total_price: booking.total_price,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to send confirmation email');
  }
}

export async function sendBookingReminderEmail(booking: Booking): Promise<void> {
  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-booking-email`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      type: 'reminder',
      booking_id: booking.id,
      customer_email: booking.customer_email,
      customer_name: booking.customer_name,
      confirmation_code: booking.confirmation_code,
      start_date: booking.start_date,
      end_date: booking.end_date,
      total_price: booking.total_price,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to send reminder email');
  }
}
