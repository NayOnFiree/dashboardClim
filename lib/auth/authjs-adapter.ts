import "server-only";

import PostgresAdapter from "@auth/pg-adapter";
import type { Adapter, AdapterAuthenticator, AdapterUser } from "next-auth/adapters";
import { database } from "@/lib/db";

export function ClimPilotAuthAdapter(): Adapter {
  const base = PostgresAdapter(database);
  return {
    ...base,
    async createUser(user: AdapterUser) {
      const result = await database.query(`
        INSERT INTO users (name, email, "emailVerified", image, "profileId", "organizationId", role)
        SELECT $1, identity.email, $3, $4, identity.profile_id, identity.organization_id, identity.role
        FROM auth_identities identity
        WHERE lower(identity.email) = lower($2) AND identity.active = true
        RETURNING id, name, email, "emailVerified", image, "profileId", "organizationId", role::text
      `, [user.name ?? null, user.email, user.emailVerified ?? new Date(), user.image ?? null]);
      if (!result.rowCount) throw new Error("Identité non invitée ou désactivée.");
      return result.rows[0] as AdapterUser;
    },
    async getAccount(providerAccountId, provider) {
      const result = await database.query(`SELECT "userId", type, provider, "providerAccountId", refresh_token,
        access_token, expires_at, token_type, scope, id_token, session_state
        FROM accounts WHERE provider = $1 AND "providerAccountId" = $2 LIMIT 1`, [provider, providerAccountId]);
      return result.rows[0] ?? null;
    },
    async createAuthenticator(authenticator: AdapterAuthenticator) {
      const result = await database.query(`INSERT INTO authenticators
        ("credentialID", "userId", "providerAccountId", "credentialPublicKey", counter, "credentialDeviceType", "credentialBackedUp", transports)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING "credentialID", "userId", "providerAccountId", "credentialPublicKey", counter, "credentialDeviceType", "credentialBackedUp", transports`,
      [authenticator.credentialID, authenticator.userId, authenticator.providerAccountId, authenticator.credentialPublicKey, authenticator.counter, authenticator.credentialDeviceType, authenticator.credentialBackedUp, authenticator.transports]);
      return result.rows[0];
    },
    async getAuthenticator(credentialID) {
      const result = await database.query(`SELECT "credentialID", "userId", "providerAccountId", "credentialPublicKey", counter,
        "credentialDeviceType", "credentialBackedUp", transports FROM authenticators WHERE "credentialID" = $1 LIMIT 1`, [credentialID]);
      return result.rows[0] ?? null;
    },
    async listAuthenticatorsByUserId(userId) {
      const result = await database.query(`SELECT "credentialID", "userId", "providerAccountId", "credentialPublicKey", counter,
        "credentialDeviceType", "credentialBackedUp", transports FROM authenticators WHERE "userId" = $1 ORDER BY "credentialID"`, [userId]);
      return result.rows;
    },
    async updateAuthenticatorCounter(credentialID, newCounter) {
      const result = await database.query(`UPDATE authenticators SET counter = $2 WHERE "credentialID" = $1
        RETURNING "credentialID", "userId", "providerAccountId", "credentialPublicKey", counter, "credentialDeviceType", "credentialBackedUp", transports`, [credentialID, newCounter]);
      if (!result.rowCount) throw new Error("Passkey introuvable.");
      return result.rows[0];
    },
  };
}
