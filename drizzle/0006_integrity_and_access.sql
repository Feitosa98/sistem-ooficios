ALTER TABLE letters ADD COLUMN version integer NOT NULL DEFAULT 1;
--> statement-breakpoint
CREATE TABLE app_users (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  name text NOT NULL,
  email text UNIQUE,
  role text NOT NULL DEFAULT 'operator' CHECK(role IN ('admin', 'operator')),
  active integer NOT NULL DEFAULT 0 CHECK(active IN (0, 1))
);
--> statement-breakpoint
INSERT INTO app_users (name) VALUES
('Késsila Tayná Ambrózio da Silva'),
('Marcellus Mozart Silva Batista'),
('Altair Ferreira Thury Neto'),
('Lucas do Espírito Santo Ribeiro'),
('Gilvany dos Santos Thury');
--> statement-breakpoint
INSERT INTO app_users (name, email, role, active) VALUES ('Administrador', 'iagofeitosa3@gmail.com', 'admin', 1);
--> statement-breakpoint
CREATE TABLE signature_sessions (
  token text PRIMARY KEY NOT NULL,
  letter_id integer NOT NULL REFERENCES letters(id),
  letter_version integer NOT NULL,
  owner_email text NOT NULL,
  data text NOT NULL,
  prepared_file_key text NOT NULL,
  expires_at integer NOT NULL,
  completed_file_key text
);
--> statement-breakpoint
CREATE TABLE email_deliveries (
  id text PRIMARY KEY NOT NULL,
  letter_id integer NOT NULL REFERENCES letters(id),
  owner_email text NOT NULL,
  recipient text NOT NULL,
  document_key text NOT NULL,
  request_hash text NOT NULL,
  state text NOT NULL CHECK(state IN ('sending','sent','unknown','failed')),
  provider_id text,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE UNIQUE INDEX email_delivery_document_recipient_unique ON email_deliveries(document_key, recipient);
--> statement-breakpoint
CREATE TABLE audit_events (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  actor_email text NOT NULL,
  action text NOT NULL,
  resource_id text NOT NULL,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
