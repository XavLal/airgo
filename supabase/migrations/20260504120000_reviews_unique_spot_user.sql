-- At most one review per spot per user (enforced in production; idempotent for fresh DBs).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.reviews'::regclass
      AND conname = 'reviews_spot_id_user_id_key'
  ) THEN
    ALTER TABLE public.reviews
      ADD CONSTRAINT reviews_spot_id_user_id_key UNIQUE (spot_id, user_id);
  END IF;
END $$;
