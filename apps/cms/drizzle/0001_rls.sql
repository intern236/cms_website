-- Row-level security: the database itself keeps clients apart.
--
-- Client content is read and written as the restricted role `cms_app`, inside a
-- transaction that has set `app.workspace_id` (see lib/db/index.ts, inWorkspace).
-- The policies below then hide every row belonging to any other workspace, and
-- refuse to write one. `cms_app` has no access at all to users, sessions, keys or
-- any other system table.
--
-- `current_setting(..., true)` returns NULL when the setting is missing, and
-- `workspace_id = NULL` is never true, so a query that forgot to pin a workspace
-- sees nothing rather than everything.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cms_app') THEN
    CREATE ROLE cms_app NOLOGIN;
  END IF;
END
$$;
--> statement-breakpoint
GRANT cms_app TO CURRENT_USER;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO cms_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON authors, posts, contact_messages, contact_rate, audit_log TO cms_app;
--> statement-breakpoint
ALTER TABLE authors ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE contact_rate ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY workspace_isolation ON authors TO cms_app
  USING (workspace_id = current_setting('app.workspace_id', true))
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true));
--> statement-breakpoint
CREATE POLICY workspace_isolation ON posts TO cms_app
  USING (workspace_id = current_setting('app.workspace_id', true))
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true));
--> statement-breakpoint
CREATE POLICY workspace_isolation ON contact_messages TO cms_app
  USING (workspace_id = current_setting('app.workspace_id', true))
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true));
--> statement-breakpoint
CREATE POLICY workspace_isolation ON contact_rate TO cms_app
  USING (workspace_id = current_setting('app.workspace_id', true))
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true));
--> statement-breakpoint
CREATE POLICY workspace_isolation ON audit_log TO cms_app
  USING (workspace_id = current_setting('app.workspace_id', true))
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true));
--> statement-breakpoint
ALTER TABLE posts ADD CONSTRAINT posts_status_check CHECK (status IN ('draft', 'review', 'published'));
--> statement-breakpoint
ALTER TABLE posts ADD CONSTRAINT posts_format_check CHECK (format IN ('editor', 'html'));
--> statement-breakpoint
ALTER TABLE memberships ADD CONSTRAINT memberships_role_check CHECK (role IN ('owner', 'editor', 'writer'));
--> statement-breakpoint
ALTER TABLE invites ADD CONSTRAINT invites_role_check CHECK (role IN ('owner', 'editor', 'writer', 'agency'));
--> statement-breakpoint
ALTER TABLE invites ADD CONSTRAINT invites_scope_check CHECK ((role = 'agency') = (workspace_id IS NULL));
