-- M-5: Prevent duplicate active warranty alerts for the same project and description.
-- A unique partial index applies only to unresolved alerts (is_resolved = false) so that
-- resolved historical records can accumulate without conflict.
--
-- This closes the race between concurrent applyProjectCompletion calls that both bypass
-- the idempotency guard (projects.status = 'completed' check) and both insert default
-- warranty alert rows.

CREATE UNIQUE INDEX IF NOT EXISTS warranty_alerts_active_project_description_unique
  ON warranty_alerts (project_id, description)
  WHERE is_resolved = false;
