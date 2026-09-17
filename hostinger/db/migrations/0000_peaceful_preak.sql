CREATE TABLE `app_users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` text NOT NULL,
	`password_hash` varchar(255),
	`email_verified_at` timestamp,
	`auth_version` int NOT NULL DEFAULT 1,
	`email` varchar(254),
	`role` varchar(32) NOT NULL DEFAULT 'operator',
	`active` boolean NOT NULL DEFAULT false,
	CONSTRAINT `app_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `app_users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actor_email` varchar(254) NOT NULL,
	`action` varchar(100) NOT NULL,
	`resource_id` varchar(100) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `document_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL DEFAULT (''),
	`department` text NOT NULL DEFAULT ('RI/RTDPJ'),
	`subject` text NOT NULL DEFAULT (''),
	`recipient` varchar(254) NOT NULL DEFAULT (''),
	`recipient_role` text NOT NULL DEFAULT (''),
	`salutation` text NOT NULL DEFAULT ('Prezado(a),'),
	`body` text NOT NULL DEFAULT (''),
	`closing` text NOT NULL DEFAULT (''),
	`source_file_key` varchar(512) NOT NULL,
	`source_file_name` text NOT NULL,
	`source_file_type` text NOT NULL,
	`source_file_size` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `document_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `email_deliveries` (
	`id` varchar(100) NOT NULL,
	`letter_id` int NOT NULL,
	`owner_email` varchar(254) NOT NULL,
	`recipient` varchar(254) NOT NULL,
	`document_key` varchar(512) NOT NULL,
	`request_hash` varchar(100) NOT NULL,
	`state` varchar(32) NOT NULL,
	`provider_id` varchar(100),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `email_deliveries_id` PRIMARY KEY(`id`),
	CONSTRAINT `email_delivery_document_recipient_unique` UNIQUE(`document_key`,`recipient`)
);
--> statement-breakpoint
CREATE TABLE `email_recipients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` text NOT NULL,
	`organization` text NOT NULL DEFAULT (''),
	`email` varchar(254) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `email_recipients_id` PRIMARY KEY(`id`),
	CONSTRAINT `email_recipients_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `letters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`number` int NOT NULL,
	`year` int NOT NULL,
	`suffix` varchar(40) NOT NULL DEFAULT (''),
	`issue_date` text NOT NULL,
	`department` text NOT NULL,
	`subject` text NOT NULL,
	`reference` text NOT NULL DEFAULT (''),
	`recipient` varchar(254) NOT NULL,
	`recipient_email` text NOT NULL DEFAULT (''),
	`recipient_role` text NOT NULL DEFAULT (''),
	`salutation` text NOT NULL DEFAULT ('Prezado(a),'),
	`body` text NOT NULL,
	`closing` text NOT NULL DEFAULT (''),
	`signer_name` text NOT NULL,
	`signer_role` text NOT NULL,
	`status` text NOT NULL DEFAULT ('Rascunho'),
	`notes` text NOT NULL DEFAULT (''),
	`signed_file_key` varchar(512),
	`signed_file_name` text,
	`signed_file_size` int,
	`signed_at` timestamp,
	`sent_at` timestamp,
	`signature_provider` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `letters_id` PRIMARY KEY(`id`),
	CONSTRAINT `letters_number_year_suffix_unique` UNIQUE(`number`,`year`,`suffix`)
);
--> statement-breakpoint
CREATE TABLE `signature_sessions` (
	`token` varchar(64) NOT NULL,
	`letter_id` int NOT NULL,
	`letter_version` int NOT NULL,
	`owner_email` varchar(254) NOT NULL,
	`data` text NOT NULL,
	`prepared_file_key` varchar(512) NOT NULL,
	`expires_at` bigint NOT NULL,
	`completed_file_key` varchar(512),
	CONSTRAINT `signature_sessions_token` PRIMARY KEY(`token`)
);
--> statement-breakpoint
CREATE TABLE `system_settings` (
	`key` varchar(100) NOT NULL,
	`value` text NOT NULL,
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `system_settings_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
ALTER TABLE `email_deliveries` ADD CONSTRAINT `email_deliveries_letter_id_letters_id_fk` FOREIGN KEY (`letter_id`) REFERENCES `letters`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `signature_sessions` ADD CONSTRAINT `signature_sessions_letter_id_letters_id_fk` FOREIGN KEY (`letter_id`) REFERENCES `letters`(`id`) ON DELETE no action ON UPDATE no action;