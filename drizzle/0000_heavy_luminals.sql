CREATE TABLE `letters` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`number` integer NOT NULL,
	`year` integer NOT NULL,
	`suffix` text DEFAULT '' NOT NULL,
	`issue_date` text NOT NULL,
	`department` text NOT NULL,
	`subject` text NOT NULL,
	`reference` text DEFAULT '' NOT NULL,
	`recipient` text NOT NULL,
	`recipient_role` text DEFAULT '' NOT NULL,
	`salutation` text DEFAULT 'Prezado(a),' NOT NULL,
	`body` text NOT NULL,
	`closing` text DEFAULT '' NOT NULL,
	`signer_name` text NOT NULL,
	`signer_role` text NOT NULL,
	`status` text DEFAULT 'Rascunho' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `letters_number_year_suffix_unique` ON `letters` (`number`,`year`,`suffix`);