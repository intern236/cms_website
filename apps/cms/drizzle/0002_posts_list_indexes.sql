CREATE INDEX "posts_ws_updated" ON "posts" USING btree ("workspace_id","updated_at");--> statement-breakpoint
CREATE INDEX "posts_ws_creator" ON "posts" USING btree ("workspace_id","created_by");