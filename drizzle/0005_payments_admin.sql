ALTER TABLE `bookings` ADD `payment_method` text DEFAULT 'shop' NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `paid_minor` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `refunded_minor` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `staff_notes` text;--> statement-breakpoint
ALTER TABLE `payments` ADD `transaction_id` text;--> statement-breakpoint
ALTER TABLE `payments` ADD `captured_minor` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `payments` ADD `refunded_minor` integer DEFAULT 0 NOT NULL;