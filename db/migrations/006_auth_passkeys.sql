CREATE TABLE auth_identities (
  profile_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role user_role NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX auth_identities_email_unique ON auth_identities (lower(email));

CREATE TABLE auth_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES auth_identities(profile_id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  activated_at timestamptz,
  used_at timestamptz,
  revoked_at timestamptz,
  invited_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_invitations_profile_idx ON auth_invitations (profile_id, created_at DESC);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  email text NOT NULL UNIQUE,
  "emailVerified" timestamptz,
  image text,
  "profileId" uuid NOT NULL UNIQUE REFERENCES auth_identities(profile_id) ON DELETE CASCADE,
  "organizationId" uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role user_role NOT NULL
);

CREATE TABLE accounts (
  id bigserial PRIMARY KEY,
  "userId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL,
  provider text NOT NULL,
  "providerAccountId" text NOT NULL,
  refresh_token text,
  access_token text,
  expires_at bigint,
  token_type text,
  scope text,
  id_token text,
  session_state text,
  UNIQUE (provider, "providerAccountId")
);

CREATE TABLE sessions (
  id bigserial PRIMARY KEY,
  "sessionToken" text NOT NULL UNIQUE,
  "userId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires timestamptz NOT NULL
);
CREATE INDEX sessions_user_idx ON sessions ("userId");

CREATE TABLE verification_token (
  identifier text NOT NULL,
  token text NOT NULL,
  expires timestamptz NOT NULL,
  PRIMARY KEY (identifier, token)
);

CREATE TABLE authenticators (
  "credentialID" text NOT NULL UNIQUE,
  "userId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "providerAccountId" text NOT NULL,
  "credentialPublicKey" text NOT NULL,
  counter integer NOT NULL,
  "credentialDeviceType" text NOT NULL,
  "credentialBackedUp" boolean NOT NULL,
  transports text,
  PRIMARY KEY ("userId", "credentialID")
);

CREATE TABLE auth_login_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  profile_id uuid REFERENCES profiles(id),
  email text NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('success', 'denied')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION sync_auth_identity_from_profile() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE auth_identities SET email = NEW.email, role = NEW.role, active = NEW.active
  WHERE profile_id = NEW.id;
  RETURN NEW;
END $$;

CREATE TRIGGER profiles_sync_auth_identity
AFTER UPDATE OF email, role, active ON profiles
FOR EACH ROW EXECUTE FUNCTION sync_auth_identity_from_profile();
