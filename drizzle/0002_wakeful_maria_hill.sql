CREATE TABLE `document_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`department` text DEFAULT 'RI/RTDPJ' NOT NULL,
	`subject` text DEFAULT '' NOT NULL,
	`recipient` text DEFAULT '' NOT NULL,
	`recipient_role` text DEFAULT '' NOT NULL,
	`salutation` text DEFAULT 'Prezado(a),' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`closing` text DEFAULT '' NOT NULL,
	`source_file_key` text NOT NULL,
	`source_file_name` text NOT NULL,
	`source_file_type` text NOT NULL,
	`source_file_size` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
