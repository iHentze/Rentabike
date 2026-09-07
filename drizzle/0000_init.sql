CREATE TABLE `addons` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`unit` text NOT NULL,
	`price_minor` integer NOT NULL,
	`is_sale` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `addons_slug_idx` ON `addons` (`slug`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`entity` text NOT NULL,
	`entity_id` text NOT NULL,
	`from_status` text,
	`to_status` text,
	`actor` text NOT NULL,
	`note` text,
	`at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_log_entity_idx` ON `audit_log` (`entity`,`entity_id`,`at`);--> statement-breakpoint
CREATE TABLE `bike_addons` (
	`bike_type_id` text NOT NULL,
	`addon_id` text NOT NULL,
	PRIMARY KEY(`bike_type_id`, `addon_id`),
	FOREIGN KEY (`bike_type_id`) REFERENCES `bike_types`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`addon_id`) REFERENCES `addons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `bike_types` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`model` text,
	`size_label` text,
	`rider_min_cm` integer,
	`rider_max_cm` integer,
	`stock` integer DEFAULT 0 NOT NULL,
	`listed` integer DEFAULT true NOT NULL,
	`description` text,
	`image` text,
	`wc_product_id` integer,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bike_types_slug_idx` ON `bike_types` (`slug`);--> statement-breakpoint
CREATE INDEX `bike_types_category_idx` ON `bike_types` (`category`);--> statement-breakpoint
CREATE TABLE `booking_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`kind` text NOT NULL,
	`bike_type_id` text,
	`addon_id` text,
	`tour_departure_id` text,
	`rider_label` text,
	`label` text NOT NULL,
	`qty` integer DEFAULT 1 NOT NULL,
	`unit_price_minor` integer NOT NULL,
	`line_total_minor` integer NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`bike_type_id`) REFERENCES `bike_types`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`addon_id`) REFERENCES `addons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tour_departure_id`) REFERENCES `tour_departures`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `booking_lines_booking_idx` ON `booking_lines` (`booking_id`);--> statement-breakpoint
CREATE INDEX `booking_lines_bike_type_idx` ON `booking_lines` (`bike_type_id`,`kind`);--> statement-breakpoint
CREATE INDEX `booking_lines_departure_idx` ON `booking_lines` (`tour_departure_id`);--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`start_at` integer NOT NULL,
	`end_at` integer NOT NULL,
	`customer_name` text NOT NULL,
	`customer_email` text NOT NULL,
	`customer_phone` text,
	`pickup_location_id` text,
	`dropoff_location_id` text,
	`channel` text DEFAULT 'web' NOT NULL,
	`notes` text,
	`total_minor` integer DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'DKK' NOT NULL,
	`hold_expires_at` integer,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`pickup_location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dropoff_location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_code_idx` ON `bookings` (`code`);--> statement-breakpoint
CREATE INDEX `bookings_status_window_idx` ON `bookings` (`status`,`start_at`,`end_at`);--> statement-breakpoint
CREATE INDEX `bookings_hold_expiry_idx` ON `bookings` (`status`,`hold_expires_at`);--> statement-breakpoint
CREATE INDEX `bookings_email_idx` ON `bookings` (`customer_email`);--> statement-breakpoint
CREATE TABLE `guides` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`mtb_certified` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `locations` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`address` text,
	`pickup_fee_minor` integer DEFAULT 0 NOT NULL,
	`dropoff_fee_minor` integer DEFAULT 0 NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `locations_slug_unique` ON `locations` (`slug`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`provider` text DEFAULT 'epay' NOT NULL,
	`session_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`amount_minor` integer NOT NULL,
	`currency` text DEFAULT 'DKK' NOT NULL,
	`event_id` text,
	`raw_payload` text,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `payments_booking_idx` ON `payments` (`booking_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `payments_event_idx` ON `payments` (`event_id`);--> statement-breakpoint
CREATE INDEX `payments_session_idx` ON `payments` (`session_id`);--> statement-breakpoint
CREATE TABLE `rate_tiers` (
	`id` text PRIMARY KEY NOT NULL,
	`bike_type_id` text NOT NULL,
	`min_days` integer NOT NULL,
	`max_days` integer NOT NULL,
	`price_minor` integer NOT NULL,
	`per_day` integer NOT NULL,
	FOREIGN KEY (`bike_type_id`) REFERENCES `bike_types`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `rate_tiers_bike_type_idx` ON `rate_tiers` (`bike_type_id`,`min_days`);--> statement-breakpoint
CREATE TABLE `tour_bike_types` (
	`tour_id` text NOT NULL,
	`bike_type_id` text NOT NULL,
	PRIMARY KEY(`tour_id`, `bike_type_id`),
	FOREIGN KEY (`tour_id`) REFERENCES `tours`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`bike_type_id`) REFERENCES `bike_types`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tour_departures` (
	`id` text PRIMARY KEY NOT NULL,
	`tour_id` text NOT NULL,
	`schedule_id` text,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`capacity` integer NOT NULL,
	`seats_taken` integer DEFAULT 0 NOT NULL,
	`price_minor` integer NOT NULL,
	`min_participants` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`guide_id` text,
	`is_private` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`tour_id`) REFERENCES `tours`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`schedule_id`) REFERENCES `tour_schedules`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`guide_id`) REFERENCES `guides`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `tour_departures_tour_time_idx` ON `tour_departures` (`tour_id`,`starts_at`);--> statement-breakpoint
CREATE INDEX `tour_departures_status_time_idx` ON `tour_departures` (`status`,`starts_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `tour_departures_schedule_slot_idx` ON `tour_departures` (`schedule_id`,`starts_at`);--> statement-breakpoint
CREATE TABLE `tour_inclusions` (
	`id` text PRIMARY KEY NOT NULL,
	`tour_id` text NOT NULL,
	`seq` integer DEFAULT 0 NOT NULL,
	`label` text NOT NULL,
	`included` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`tour_id`) REFERENCES `tours`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tour_inclusions_tour_idx` ON `tour_inclusions` (`tour_id`);--> statement-breakpoint
CREATE TABLE `tour_legs` (
	`id` text PRIMARY KEY NOT NULL,
	`tour_id` text NOT NULL,
	`seq` integer NOT NULL,
	`mode` text NOT NULL,
	`label` text NOT NULL,
	`distance_km` real,
	`ascent_m` integer,
	`duration_min` integer,
	FOREIGN KEY (`tour_id`) REFERENCES `tours`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tour_legs_order_idx` ON `tour_legs` (`tour_id`,`seq`);--> statement-breakpoint
CREATE TABLE `tour_options` (
	`id` text PRIMARY KEY NOT NULL,
	`tour_id` text NOT NULL,
	`group_label` text NOT NULL,
	`choice_label` text NOT NULL,
	`price_delta_minor` integer DEFAULT 0 NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`tour_id`) REFERENCES `tours`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tour_options_tour_idx` ON `tour_options` (`tour_id`,`group_label`);--> statement-breakpoint
CREATE TABLE `tour_schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`tour_id` text NOT NULL,
	`season_start` text NOT NULL,
	`season_end` text NOT NULL,
	`weekday_mask` integer NOT NULL,
	`start_time` text NOT NULL,
	`capacity` integer NOT NULL,
	`price_minor` integer NOT NULL,
	`private_price_minor` integer,
	`min_participants` integer DEFAULT 0 NOT NULL,
	`booking_cutoff_hours` integer DEFAULT 12 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`tour_id`) REFERENCES `tours`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tour_schedules_tour_idx` ON `tour_schedules` (`tour_id`,`active`);--> statement-breakpoint
CREATE TABLE `tours` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`difficulty` text NOT NULL,
	`summary` text NOT NULL,
	`body` text NOT NULL,
	`duration_min` integer NOT NULL,
	`distance_km` real,
	`ascent_m` integer,
	`summit_m` integer,
	`meeting_point` text DEFAULT 'Sverrisgøta 20, Tórshavn' NOT NULL,
	`end_point` text,
	`pricing_mode` text DEFAULT 'per_person' NOT NULL,
	`requires_bike` integer DEFAULT false NOT NULL,
	`image` text,
	`published` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tours_slug_idx` ON `tours` (`slug`);--> statement-breakpoint
CREATE INDEX `tours_category_idx` ON `tours` (`category`,`published`);