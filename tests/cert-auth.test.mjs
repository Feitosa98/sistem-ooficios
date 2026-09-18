import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import crypto from "node:crypto";
import { certificateFixture } from "./certificates.mjs";
import { harness } from "./helpers.mjs";

process.env.AUTH_SECRET = "test-secret-at-least-32-characters-long-123456";

test("createCertChallenge generates valid HMAC-signed challenge and hash", async () => {
  const h = harness();
  try {
    const service = h.load("hostinger/lib/auth/service.ts");
    const { challenge, toSignHash } = await service.createCertChallenge();

    assert.ok(challenge);
    assert.ok(toSignHash);

    const parts = challenge.split(".");
    assert.equal(parts.length, 3);
    const [nonce, timestampStr] = parts;
    assert.ok(nonce.length > 20);
    assert.ok(Number(timestampStr) > Date.now() - 5000);

    const expectedHash = crypto.createHash("sha256").update(Buffer.from(challenge, "utf8")).digest("base64");
    assert.equal(toSignHash, expectedHash);
  } finally {
    h.close();
  }
});

test("loginWithCertificate validates challenge, verifies RSA signature and creates session", async () => {
  const h = harness();
  try {
    const fix = await certificateFixture();
    const certDer = Buffer.from(fix.raw);
    const certBase64 = certDer.toString("base64");

    const limits = new Map();
    const users = [
      { id: 1, name: "Pessoa Teste", email: "pessoa@cartorio.test", role: "operator", active: 1, auth_version: 1 },
      { id: 2, name: "Usuario Desativado", email: "inativo@cartorio.test", role: "operator", active: 0, auth_version: 1 },
    ];
    const sessions = [];
    const audit = [];

    const mockConnection = {
      beginTransaction: async () => {},
      commit: async () => {},
      rollback: async () => {},
      release: () => {},
      execute: async (sql, params) => {
        if (sql.includes("INSERT INTO auth_limits")) {
          const key = params[0];
          const current = limits.get(key) || 0;
          limits.set(key, current + 1);
          return [{ affectedRows: 1 }];
        }
        if (sql.includes("SELECT hits FROM auth_limits")) {
          const key = params[0];
          return [[{ hits: limits.get(key) || 0 }]];
        }
        return [[]];
      },
    };

    const mockPool = {
      getConnection: async () => mockConnection,
      execute: async (sql, params) => {
        if (sql.includes("SELECT id, name, email, role, active, auth_version FROM app_users WHERE active = 1")) {
          return [users.filter((u) => u.active === 1)];
        }
        if (sql.includes("UPDATE app_users SET email_verified_at")) {
          return [{ affectedRows: 1 }];
        }
        if (sql.includes("INSERT INTO auth_sessions")) {
          sessions.push({ id: params[0], userId: params[1], version: params[2], expiresAt: params[3] });
          return [{ affectedRows: 1 }];
        }
        if (sql.includes("INSERT INTO audit_events")) {
          audit.push({ actor: params[0], action: params[1], resId: params[2] });
          return [{ affectedRows: 1 }];
        }
        return [[]];
      },
    };

    globalThis.oficiosPool = mockPool;

    const service = h.load("hostinger/lib/auth/service.ts");
    const { challenge } = await service.createCertChallenge();

    const sigBuffer = await webcrypto.subtle.sign("RSASSA-PKCS1-v1_5", fix.privateKey, Buffer.from(challenge, "utf8"));
    const signature = Buffer.from(sigBuffer).toString("base64");

    // Test 1: Successful login
    const result = await service.loginWithCertificate(challenge, certBase64, signature);
    assert.equal(result.directLogin, true);
    assert.equal(result.user.name, "Pessoa Teste");
    assert.equal(result.user.role, "operator");
    assert.equal(sessions.length, 1);

    // Test 2: Replay attack with same challenge is blocked
    await assert.rejects(
      service.loginWithCertificate(challenge, certBase64, signature),
      (err) => err.status === 400 && err.message.includes("já foi utilizado")
    );

    // Test 3: Tampered challenge rejected
    const fakeChallenge = challenge.slice(0, -4) + "abcd";
    await assert.rejects(
      service.loginWithCertificate(fakeChallenge, certBase64, signature),
      (err) => err.status === 400 && err.message.includes("adulterado")
    );

    // Test 4: Tampered signature rejected
    const { challenge: challenge2 } = await service.createCertChallenge();
    const corruptSig = Buffer.from(sigBuffer);
    corruptSig[0] ^= 0xff;
    await assert.rejects(
      service.loginWithCertificate(challenge2, certBase64, corruptSig.toString("base64")),
      (err) => err.status === 401 && err.message.includes("Assinatura digital inválida")
    );

    // Test 5: Unknown user rejected
    const { challenge: challenge3 } = await service.createCertChallenge();
    users.length = 0;
    const sig3 = Buffer.from(await webcrypto.subtle.sign("RSASSA-PKCS1-v1_5", fix.privateKey, Buffer.from(challenge3, "utf8"))).toString("base64");
    await assert.rejects(
      service.loginWithCertificate(challenge3, certBase64, sig3),
      (err) => err.status === 403 && err.message.includes("não possui cadastro ativo")
    );
  } finally {
    h.close();
  }
});
