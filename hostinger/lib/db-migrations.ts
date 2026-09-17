import type { Pool, RowDataPacket } from "mysql2/promise";

export async function ensureDatabaseTables(pool: Pool) {
  const connection = await pool.getConnection();
  try {
    const [tables] = await connection.query<RowDataPacket[]>(
      "SELECT TABLE_NAME AS name FROM information_schema.tables WHERE table_schema = DATABASE()"
    );
    const existing = new Set(tables.map((t) => String(t.name).toLowerCase()));

    if (existing.has("app_users") && existing.has("letters") && existing.has("auth_sessions")) {
      return { status: "already_initialized", tables: Array.from(existing) };
    }

    console.log("==> Inicializando tabelas do banco de dados MySQL...");

    await connection.query(`
      CREATE TABLE IF NOT EXISTS app_users (
        id int AUTO_INCREMENT NOT NULL,
        name text NOT NULL,
        password_hash varchar(255),
        email_verified_at timestamp NULL DEFAULT NULL,
        auth_version int NOT NULL DEFAULT 1,
        email varchar(254),
        role varchar(32) NOT NULL DEFAULT 'operator',
        active boolean NOT NULL DEFAULT false,
        CONSTRAINT app_users_id PRIMARY KEY(id),
        CONSTRAINT app_users_email_unique UNIQUE(email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS audit_events (
        id int AUTO_INCREMENT NOT NULL,
        actor_email varchar(254) NOT NULL,
        action varchar(100) NOT NULL,
        resource_id varchar(100) NOT NULL,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT audit_events_id PRIMARY KEY(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS document_templates (
        id int AUTO_INCREMENT NOT NULL,
        title text NOT NULL,
        description text NOT NULL,
        department text NOT NULL,
        subject text NOT NULL,
        recipient varchar(254) NOT NULL DEFAULT '',
        recipient_role text NOT NULL,
        salutation text NOT NULL,
        body text NOT NULL,
        closing text NOT NULL,
        source_file_key varchar(512) NOT NULL,
        source_file_name text NOT NULL,
        source_file_type text NOT NULL,
        source_file_size int NOT NULL,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT document_templates_id PRIMARY KEY(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS letters (
        id int AUTO_INCREMENT NOT NULL,
        version int NOT NULL DEFAULT 1,
        number int NOT NULL,
        year int NOT NULL,
        suffix varchar(40) NOT NULL DEFAULT '',
        issue_date text NOT NULL,
        department text NOT NULL,
        subject text NOT NULL,
        reference text NOT NULL,
        recipient varchar(254) NOT NULL,
        recipient_email text NOT NULL,
        recipient_role text NOT NULL,
        salutation text NOT NULL,
        body text NOT NULL,
        closing text NOT NULL,
        signer_name text NOT NULL,
        signer_role text NOT NULL,
        status text NOT NULL,
        notes text NOT NULL,
        signed_file_key varchar(512),
        signed_file_name text,
        signed_file_size int,
        signed_at timestamp NULL DEFAULT NULL,
        sent_at timestamp NULL DEFAULT NULL,
        signature_provider text,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT letters_id PRIMARY KEY(id),
        CONSTRAINT letters_number_year_suffix_unique UNIQUE(number, year, suffix)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS email_deliveries (
        id varchar(100) NOT NULL,
        letter_id int NOT NULL,
        owner_email varchar(254) NOT NULL,
        recipient varchar(254) NOT NULL,
        document_key varchar(512) NOT NULL,
        request_hash varchar(100) NOT NULL,
        state varchar(32) NOT NULL,
        provider_id varchar(100),
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT email_deliveries_id PRIMARY KEY(id),
        CONSTRAINT email_delivery_document_recipient_unique UNIQUE(document_key, recipient),
        INDEX idx_deliveries_letter (letter_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS email_recipients (
        id int AUTO_INCREMENT NOT NULL,
        name text NOT NULL,
        organization text NOT NULL,
        email varchar(254) NOT NULL,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT email_recipients_id PRIMARY KEY(id),
        CONSTRAINT email_recipients_email_unique UNIQUE(email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS signature_sessions (
        token varchar(64) NOT NULL,
        letter_id int NOT NULL,
        letter_version int NOT NULL,
        owner_email varchar(254) NOT NULL,
        data text NOT NULL,
        prepared_file_key varchar(512) NOT NULL,
        expires_at bigint NOT NULL,
        completed_file_key varchar(512),
        CONSTRAINT signature_sessions_token PRIMARY KEY(token),
        INDEX idx_sessions_letter (letter_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        \`key\` varchar(100) NOT NULL,
        value text NOT NULL,
        updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT system_settings_key PRIMARY KEY(\`key\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS auth_tokens (
        id varchar(64) PRIMARY KEY,
        user_id int NOT NULL,
        kind varchar(16) NOT NULL,
        code_hash varchar(64),
        auth_version int,
        attempts int NOT NULL DEFAULT 0,
        expires_at bigint NOT NULL,
        INDEX auth_tokens_user (user_id),
        INDEX auth_tokens_expiry (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS auth_sessions (
        id varchar(64) PRIMARY KEY,
        user_id int NOT NULL,
        auth_version int NOT NULL,
        expires_at bigint NOT NULL,
        INDEX auth_sessions_user (user_id),
        INDEX auth_sessions_expiry (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS auth_limits (
        scope_key varchar(64) PRIMARY KEY,
        hits int NOT NULL,
        reset_at bigint NOT NULL,
        INDEX auth_limits_expiry (reset_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS stored_objects (
        object_key varchar(512) PRIMARY KEY,
        object_id varchar(36) UNIQUE NOT NULL,
        content_type varchar(150) NOT NULL,
        size_bytes int NOT NULL,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS stored_object_chunks (
        object_id varchar(36) NOT NULL,
        part_number int NOT NULL,
        data mediumblob NOT NULL,
        PRIMARY KEY(object_id, part_number)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Inserção dos usuários iniciais se não existirem
    const [adminRows] = await connection.query<RowDataPacket[]>(
      "SELECT id FROM app_users WHERE email = 'iagofeitosa3@gmail.com'"
    );
    if (adminRows.length === 0) {
      await connection.query(`
        INSERT INTO app_users(name, email, role, active)
        VALUES ('Administrador', 'iagofeitosa3@gmail.com', 'admin', 1)
      `);
      console.log("==> Administrador iagofeitosa3@gmail.com inserido com sucesso!");
    }

    const [operatorRows] = await connection.query<RowDataPacket[]>(
      "SELECT count(*) as count FROM app_users WHERE role = 'operator'"
    );
    if (Number(operatorRows[0]?.count || 0) === 0) {
      await connection.query(`
        INSERT INTO app_users(name, role, active) VALUES
        ('Késsila Tayná Ambrózio da Silva', 'operator', 0),
        ('Marcellus Mozart Silva Batista', 'operator', 0),
        ('Altair Ferreira Thury Neto', 'operator', 0),
        ('Lucas do Espírito Santo Ribeiro', 'operator', 0),
        ('Gilvany dos Santos Thury', 'operator', 0)
      `);
      console.log("==> Operadores iniciais cadastrados!");
    }

    console.log("==> Banco de dados inicializado com sucesso!");
    return { status: "initialized_successfully" };
  } finally {
    connection.release();
  }
}
