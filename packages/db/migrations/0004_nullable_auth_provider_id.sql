-- Make auth_provider_id nullable to support the invite flow
-- (users can be invited before they sign up in Clerk)
ALTER TABLE users ALTER COLUMN auth_provider_id DROP NOT NULL;
