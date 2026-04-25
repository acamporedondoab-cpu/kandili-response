-- Migration 014 — Cross-org transfer metadata
-- Adds original_org_id and transfer_reason to incidents table.
-- original_org_id: the org that owned the incident before transfer
-- transfer_reason: human-readable context shown to receiving org TL

ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS original_org_id uuid REFERENCES organizations(id),
  ADD COLUMN IF NOT EXISTS transfer_reason  text;
