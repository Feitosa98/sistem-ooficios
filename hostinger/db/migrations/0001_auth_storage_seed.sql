CREATE TABLE auth_tokens (
 id varchar(64) PRIMARY KEY,
 user_id int NOT NULL,
 kind varchar(16) NOT NULL,
 code_hash varchar(64),
 auth_version int,
 attempts int NOT NULL DEFAULT 0,
 expires_at bigint NOT NULL,
 INDEX auth_tokens_user (user_id),
 INDEX auth_tokens_expiry (expires_at),
 FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
);
CREATE TABLE auth_sessions (
 id varchar(64) PRIMARY KEY,
 user_id int NOT NULL,
 auth_version int NOT NULL,
 expires_at bigint NOT NULL,
 INDEX auth_sessions_user (user_id),
 INDEX auth_sessions_expiry (expires_at),
 FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
);
CREATE TABLE auth_limits (
 scope_key varchar(64) PRIMARY KEY,
 hits int NOT NULL,
 reset_at bigint NOT NULL,
 INDEX auth_limits_expiry (reset_at)
);
CREATE TABLE stored_objects (
 object_key varchar(512) PRIMARY KEY,
 object_id varchar(36) UNIQUE NOT NULL,
 content_type varchar(150) NOT NULL,
 size_bytes int NOT NULL,
 created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE stored_object_chunks (
 object_id varchar(36) NOT NULL,
 part_number int NOT NULL,
 data mediumblob NOT NULL,
 PRIMARY KEY(object_id, part_number),
 FOREIGN KEY(object_id) REFERENCES stored_objects(object_id) ON DELETE CASCADE
);
INSERT INTO app_users(name,email,role,active) VALUES('Administrador','iagofeitosa3@gmail.com','admin',1);
INSERT INTO app_users(name,role,active) VALUES
('Késsila Tayná Ambrózio da Silva','operator',0),
('Marcellus Mozart Silva Batista','operator',0),
('Altair Ferreira Thury Neto','operator',0),
('Lucas do Espírito Santo Ribeiro','operator',0),
('Gilvany dos Santos Thury','operator',0);
