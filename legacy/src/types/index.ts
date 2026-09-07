export interface Location {
  id: string;
  name: string;
  slug: string;
  address: string;
  phone: string;
  pickup_fee: number;
  dropoff_fee: number;
  opening_hour: number;
  closing_hour: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;
  created_at: string;
}

export interface Bike {
  id: string;
  name: string;
  category_id: string;
  description: string;
  price_per_day: number;
  size: string;
  total_quantity: number;
  image_url: string;
  is_active: boolean;
  created_at: string;
  category?: Category;
  available_quantity?: number;
}

export interface CartItem {
  bike: Bike;
  quantity: number;
  personIndex?: number;
}

export interface BookingPersonSetup {
  name: string;
  accessoriesOnly: boolean;
}

export interface BookingPerson {
  id: string;
  booking_id: string;
  person_label: string;
  sort_order: number;
  created_at: string;
}

export type PaymentMethod = 'at_pickup' | 'card_online';
export type PaymentStatus = 'none' | 'pending' | 'authorized' | 'captured' | 'failed' | 'voided' | 'refunded';

export interface Booking {
  id: string;
  confirmation_code: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  start_date: string;
  end_date: string;
  start_at: string;
  end_at: string;
  total_price: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'picked_up' | 'returned';
  notes: string;
  internal_notes: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_time: string;
  dropoff_time: string;
  created_at: string;
  modified_at: string;
  cancellation_reason: string;
  status_history: { status: string; at: string; by?: string }[];
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  payment_session_id: string | null;
  payment_transaction_id: string | null;
  payment_amount_minor: number | null;
  items?: BookingItem[];
  persons?: BookingPerson[];
}

export type ItemStatus = 'pending' | 'picked_up' | 'returned' | 'released';

export interface BookingItem {
  id: string;
  booking_id: string;
  bike_id: string;
  quantity: number;
  price_per_day: number;
  item_status: ItemStatus;
  person_id?: string | null;
  created_at: string;
  bike?: Bike;
  person?: BookingPerson;
}

export type TourActivityType = 'bike' | 'combo' | 'hike' | 'trail-run';
export type TourDifficulty = 'easy' | 'moderate';
export type TourBookingStatus = 'pending' | 'confirmed' | 'cancelled';

export interface Tour {
  id: string;
  name: string;
  slug: string;
  description: string;
  short_description: string;
  activity_type: TourActivityType;
  difficulty: TourDifficulty;
  price_per_person: number;
  duration_hours: number;
  max_participants: number;
  meeting_point: string;
  image_url: string;
  is_active: boolean;
  needs_bike: boolean;
  created_at: string;
  allowed_bikes?: TourAllowedBike[];
  dates?: TourDate[];
}

export interface TourAllowedBike {
  tour_id: string;
  bike_id: string;
  bike?: Bike;
}

export interface TourDate {
  id: string;
  tour_id: string;
  date: string;
  start_time: string;
  available_spots: number;
  is_cancelled: boolean;
  created_at: string;
  tour?: Tour;
}

export interface TourBooking {
  id: string;
  confirmation_code: string;
  tour_date_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  num_attendees: number;
  total_price: number;
  status: TourBookingStatus;
  notes: string;
  internal_notes: string;
  status_history: { status: string; at: string; by?: string }[];
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  payment_session_id: string | null;
  payment_transaction_id: string | null;
  payment_amount_minor: number | null;
  created_at: string;
  modified_at: string;
  tour_date?: TourDate;
  participants?: TourParticipant[];
}

export interface PaymentSessionResponse {
  sessionId: string;
  sessionKey: string;
  javascriptUrl: string;
  paymentWindowUrl: string;
}

export interface TourParticipant {
  id: string;
  tour_booking_id: string;
  person_label: string;
  bike_id: string | null;
  sort_order: number;
  created_at: string;
  bike?: Bike;
}

export interface TourBikeSelection {
  tourId: string;
  tourName: string;
  tourDateId: string;
  tourDate: string;
  tourTime: string;
  durationHours: number;
  meetingPoint: string;
  pricePerPerson: number;
  numAttendees: number;
  attendeeBikes: (string | null)[];
  bikes: Bike[];
}

export interface TourBookingSetup {
  tourId: string;
  tourDateId: string;
  numAttendees: number;
  attendeeBikes: { label: string; bikeId: string | null }[];
  tourName: string;
  tourDate: string;
  tourTime: string;
  durationHours: number;
  meetingPoint: string;
  pricePerPerson: number;
  needsBike: boolean;
}

export type Page =
  | 'home'
  | 'booking-setup'
  | 'person-catalog'
  | 'checkout'
  | 'confirmation'
  | 'my-booking'
  | 'tours'
  | 'tour-detail'
  | 'tour-bike-catalog'
  | 'tour-checkout'
  | 'tour-confirmation'
  | 'admin';
