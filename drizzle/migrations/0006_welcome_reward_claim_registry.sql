CREATE TABLE welcome_reward_claims (
	business_id text NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
	identity_type text NOT NULL CHECK (identity_type IN ('email', 'mobile')),
	identity_hash text NOT NULL,
	claimed_at integer NOT NULL
);

CREATE UNIQUE INDEX welcome_reward_claims_identity_unq
ON welcome_reward_claims (business_id, identity_type, identity_hash);

CREATE INDEX welcome_reward_claims_business_claimed_idx
ON welcome_reward_claims (business_id, claimed_at);
