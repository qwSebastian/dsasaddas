-- ══════════════════════════════════════════════════════════════
-- FRIZERIE → SALA SPORT
--
-- Renames the first list and replaces its rank ladder.
--   name        : 'Frizerie'  → 'Sala Sport'
--   rank_system : 'frizerie'  → 'sala_sport'
--   list_type   : 'frizerie'  → 'sala_sport'
--   ranks       : Frizer / Hairstylist / Manager
--                 → Personal Trainer / Supervizor / Manager Sala
--                   (lowest → highest)
--
-- Everything else about the list is untouched: it keeps its id, so
-- members, sort_order, add_role ('admin2'), the Executive flag, the
-- concediu range and the visitor-only visibility all carry over.
--
-- Safe to re-run (idempotent).
-- ══════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Remap the members' ranks ───────────────────────────────
-- Runs BEFORE the list keys change so the affected lists can still
-- be found by their old 'frizerie' keys. Any rank that is not one of
-- the three old ones (empty, NULL, leftovers) drops to the lowest
-- new rank so no member is left holding a deleted rank.
UPDATE members m
   SET rank = CASE m.rank
                WHEN 'Frizer'      THEN 'Personal Trainer'
                WHEN 'Hairstylist' THEN 'Supervizor'
                WHEN 'Manager'     THEN 'Manager Sala'
                ELSE 'Personal Trainer'
              END
  FROM lists l
 WHERE m.list_id = l.id
   AND (l.list_type = 'frizerie' OR l.rank_system = 'frizerie')
   AND (m.rank IS NULL OR m.rank NOT IN ('Personal Trainer', 'Supervizor', 'Manager Sala'));

-- ── 2. Rename the list and switch its keys ────────────────────
UPDATE lists
   SET name        = CASE WHEN name = 'Frizerie' THEN 'Sala Sport' ELSE name END,
       rank_system = 'sala_sport',
       list_type   = 'sala_sport'
 WHERE list_type = 'frizerie' OR rank_system = 'frizerie';

COMMIT;
