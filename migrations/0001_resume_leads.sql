CREATE TABLE IF NOT EXISTS resume_leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL,
  consent_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  first_ip_hash TEXT,
  last_ip_hash TEXT,
  user_agent TEXT,
  is_disposable INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_resume_leads_created_at
  ON resume_leads(created_at);

CREATE INDEX IF NOT EXISTS idx_resume_leads_last_seen_at
  ON resume_leads(last_seen_at);
