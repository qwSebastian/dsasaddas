-- Add card_bg column to members table
-- Allows the owner GA to toggle a custom background image on individual member cards.
ALTER TABLE members ADD COLUMN IF NOT EXISTS card_bg boolean DEFAULT false;
