-- Make phone_number nullable (was NOT NULL) so existing users aren't blocked
ALTER TABLE profiles ALTER COLUMN phone_number DROP NOT NULL;

-- Remove the old blanket UNIQUE constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_phone_number_key;

-- Enforce uniqueness only when phone_number is set (allows multiple NULLs)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_number_unique
  ON profiles (phone_number)
  WHERE phone_number IS NOT NULL;
