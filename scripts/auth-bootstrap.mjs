import { createHash, randomBytes } from "node:crypto";
import pg from "pg";
import { loadLocalEnv } from "./load-local-env.mjs";

await loadLocalEnv();
const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, list) => value.startsWith("--") ? [...pairs, [value.slice(2), list[index + 1]]] : pairs, []));
if (args.help || !args.organization || !args.email || !args["first-name"] || !args["last-name"]) {
  console.log('Usage: pnpm auth:bootstrap -- --organization "Clim Air Services" --email admin@example.com --first-name Emma --last-name Martin');
  process.exit(args.help ? 0 : 1);
}
if (!process.env.DATABASE_URL || !process.env.APP_BASE_URL) throw new Error("DATABASE_URL et APP_BASE_URL sont requises.");
const email = args.email.trim().toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Adresse e-mail invalide.");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, application_name: "clim-pilot-auth-bootstrap" });
const token = randomBytes(32).toString("base64url"); const hash = createHash("sha256").update(token).digest("hex");
try {
  await client.connect(); await client.query("BEGIN");
  const existing = await client.query("SELECT id FROM organizations WHERE lower(name) = lower($1) ORDER BY created_at LIMIT 1", [args.organization.trim()]);
  let organizationId = existing.rows[0]?.id;
  if (!organizationId) {
    const organization = await client.query("INSERT INTO organizations (name) VALUES ($1) RETURNING id", [args.organization.trim()]);
    organizationId = organization.rows[0]?.id;
  }
  if (!organizationId) throw new Error("Organisation introuvable.");
  const otherOwner = await client.query("SELECT email FROM profiles WHERE organization_id = $1 AND role = 'owner' AND active = true AND lower(email) <> lower($2) LIMIT 1", [organizationId, email]);
  if (otherOwner.rowCount) throw new Error(`Un Owner actif existe déjà pour cette organisation (${otherOwner.rows[0].email}).`);
  const profile = await client.query(`INSERT INTO profiles (organization_id, email, role, first_name, last_name, active)
    VALUES ($1,$2,'owner',$3,$4,true)
    ON CONFLICT (organization_id, email) DO UPDATE SET role = 'owner', first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, active = true
    RETURNING id`, [organizationId, email, args["first-name"].trim(), args["last-name"].trim()]);
  const profileId = profile.rows[0].id;
  await client.query(`INSERT INTO auth_identities (profile_id, organization_id, email, role, active) VALUES ($1,$2,$3,'owner',true)
    ON CONFLICT (profile_id) DO UPDATE SET email = EXCLUDED.email, role = 'owner', active = true`, [profileId, organizationId, email]);
  await client.query("UPDATE auth_invitations SET revoked_at = now() WHERE profile_id = $1 AND used_at IS NULL AND revoked_at IS NULL", [profileId]);
  await client.query("INSERT INTO auth_invitations (profile_id, token_hash, expires_at) VALUES ($1,$2,now() + interval '30 minutes')", [profileId, hash]);
  await client.query("COMMIT");
  const baseUrl = process.env.APP_BASE_URL.replace(/\/$/, "");
  console.log("Owner prepare. Ouvrez ce lien personnel dans les 30 minutes :");
  console.log(`${baseUrl}/activate/${token}`);
} catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; }
finally { await client.end(); }
