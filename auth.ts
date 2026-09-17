import NextAuth from "next-auth";
import Passkey from "next-auth/providers/passkey";
import { ClimPilotAuthAdapter } from "@/lib/auth/authjs-adapter";
import { database } from "@/lib/db";
import type { AppRole } from "@/lib/auth/session";

export const { handlers, auth, signIn: authSignIn, signOut: authSignOut } = NextAuth({
  adapter: ClimPilotAuthAdapter(),
  secret: process.env.AUTH_SECRET ?? process.env.SESSION_SECRET,
  trustHost: process.env.NODE_ENV !== "production" || process.env.AUTH_TRUST_HOST === "true",
  experimental: { enableWebAuthn: true },
  providers: [Passkey({
    formFields: { email: { label: "E-mail professionnel", required: true, autocomplete: "username webauthn" } },
  })],
  pages: { signIn: "/login", error: "/login" },
  session: { strategy: "database", maxAge: 60 * 60 * 8, updateAge: 60 * 15 },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      const result = await database.query<{ profile_id: string; active: boolean; existing: boolean; invitation_valid: boolean }>(`
        SELECT identity.profile_id, identity.active,
          EXISTS (SELECT 1 FROM users WHERE lower(email) = lower(identity.email)) AS existing,
          EXISTS (SELECT 1 FROM auth_invitations invitation WHERE invitation.profile_id = identity.profile_id
            AND invitation.activated_at > now() - interval '10 minutes' AND invitation.used_at IS NULL
            AND invitation.revoked_at IS NULL AND invitation.expires_at > now()) AS invitation_valid
        FROM auth_identities identity WHERE lower(identity.email) = lower($1) LIMIT 1
      `, [user.email]);
      const identity = result.rows[0]; const allowed = Boolean(identity?.active && (identity.existing || identity.invitation_valid));
      await database.query("INSERT INTO auth_login_events (profile_id, email, outcome) VALUES ($1, $2, $3)", [identity?.profile_id ?? null, user.email, allowed ? "success" : "denied"]);
      return allowed;
    },
    async session({ session, user }) {
      const extended = user as typeof user & { profileId?: string; organizationId?: string; role?: string };
      if (session.user) {
        session.user.id = extended.profileId ?? user.id;
        session.user.organizationId = extended.organizationId ?? "";
        session.user.role = (extended.role ?? "technician") as AppRole;
      }
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      if (user.email) await database.query(`UPDATE auth_invitations SET used_at = now()
        WHERE profile_id = (SELECT profile_id FROM auth_identities WHERE lower(email) = lower($1))
        AND activated_at IS NOT NULL AND used_at IS NULL`, [user.email]);
    },
  },
});
