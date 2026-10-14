# Compliance Tracker

Pulls Controls, Monitoring Tests, Policies, and Evidence out of Drata (across
all workspaces in your tenant) into a local database, lets you tag Controls
and Tests with your own labels, and tracks pass/fail status over time so it
can be sliced and reported on by tag.

## Status: all three phases built

1. ✅ **Sync + tagging + dashboard** — pull data from Drata, tag Controls/Tests,
   view current status filtered by workspace/tag, drill from a Control down
   to its linked Tests and Evidence.
2. ✅ **Scheduled daily checks + history** — configurable time-of-day run
   (Settings → Scheduled checks), status history logged per check, a Trends
   page with pass-rate over time and current failures broken down by tag.
3. ✅ **Notifications** — rules (Notifications page) scoped by tag/workspace/
   entity type, posting to Slack or opening a Jira ticket when something
   newly fails. An ongoing failure gets a thread reply / comment on later
   runs instead of a new alert each time, and is marked resolved once it
   passes again.

Checks can still be run manually from Settings at any time, in addition to
the daily schedule.

## Connections and Notifications

**Connections** (its own page) hold named credentials for Slack, Jira, or
Linear — add more than one of the same type, e.g. a separate Linear
connection per subsidiary that all roll up into this one tool. Each has a
**Test** button to confirm it authenticates.

- **Slack** needs a bot token (not an incoming webhook) so one connection can
  post to any channel by name — create a Slack app in your workspace, add the
  `chat:write` scope, install it, and paste the Bot User OAuth Token
  (`xoxb-…`).
- **Jira** needs a base URL, an account email, and an API token (Jira Cloud,
  Basic auth).
- **Linear** needs an API key (Linear → Settings → API).

**Notification rules** (Notifications page) then pick a connection and a
destination within it:

- **Scope**: optionally limit a rule to one tag, one workspace, and/or just
  Controls or just Tests. An unscoped rule matches everything.
- **Destination**: a Slack rule names a channel; a Jira rule names a project
  key + issue type; a Linear rule picks a team and, optionally, a project
  (fetched live from that connection).
- **Ticket content**: Jira and Linear rules can customize the title and
  description with `{{code}}` `{{name}}` `{{label}}` `{{status}}`
  `{{reasonCode}}` `{{reasonDetail}}` `{{workspace}}` `{{tags}}`
  `{{entityType}}` `{{providerName}}` `{{failureCount}}` `{{failureDetails}}`
  `{{ruleName}}` placeholders (a dropdown on each field inserts one at the
  cursor, and highlights them inline) — see `DEFAULT_TITLE_TEMPLATE` /
  `DEFAULT_DESCRIPTION_TEMPLATE` in `src/lib/templateVars.ts` for the built-in
  default when left blank, and the **Preview** button on the rule form to see
  it rendered against real current data. `{{failureCount}}`/
  `{{failureDetails}}`/`{{providerName}}` come from Drata's per-resource
  monitoring-test-failures endpoint (specific failing resources and why),
  fetched live when a ticket is created — a Jira or Linear rule only. Jira's
  `additionalFields` (for projects with other required fields) is supported
  in the data model but not yet exposed in the UI.
- **Per-provider rules**: Tests are tagged with a best-effort provider
  (AWS/Azure/GCP/...) inferred from Drata's test-naming convention (there's no
  provider field on the test itself in Drata's API — only per-resource,
  inside that same expensive-per-test failures endpoint). A rule can be
  scoped to one provider, e.g. routing AWS failures to one Linear
  team/project and Azure failures to another.
- **Native formatting**: Slack alerts use Block Kit (a header, a field grid,
  a red/green color bar) instead of a single line of text. Jira/Linear
  descriptions support a light markdown-like convention — `## Heading` and
  `- bullet` lines — which Linear renders natively and Jira's client
  (`src/lib/jira.ts`) translates into real ADF headings/bullet lists rather
  than one flat paragraph per line. Jira issues also get labels derived from
  the entity's tags and provider (sanitized to Jira's label format) plus a
  fixed `compliance-tracker` label.
- **Dedupe**: the first time an entity fails under a rule, it opens a new
  alert (Slack message / Jira or Linear issue). While it stays failing, later
  runs add a thread reply / comment instead of a new one. Once it passes
  again, a final reply/comment marks it resolved. Each rule also caps how
  many *new* alerts it opens in a single run (25) so an unscoped rule can't
  flood a channel or project if enabled against a large pre-existing backlog
  of failures.
- A send failure (bad token, wrong channel, etc.) is recorded as a warning on
  that check run rather than failing the whole sync, and nothing is marked as
  sent, so it retries automatically on the next run once fixed.

## How status is computed

Drata's own `isReady` flag on a Control is treated as the source of truth for
pass/fail — this app mirrors that verdict rather than recomputing Drata's own
compliance logic. The `reason` shown for a failing Control is a best-effort
attribution based on which of these is the likely cause, derived from the
same data Drata exposes:

- a linked **Monitoring Test** is failing (`checkResultStatus` isn't `PASSED`)
- the Control has **no approved/published policy** (`hasPolicy` is false)
- linked **Evidence** is expired, expiring soon, or missing an artifact

Monitoring Tests are also tracked and snapshotted individually, since that's
usually the most common and most specific failure mode.

## Local development

Requires Node 20+.

```bash
npm install
npx prisma migrate dev   # creates ./data/app.db and applies the schema
npm run dev
```

Open http://localhost:3000, go to **Settings**, and paste in a Drata API key
(Drata → Settings → API; needs read access to Controls, Monitoring Tests,
Policies, Evidence, and Workspaces — see
[developers.drata.com](https://developers.drata.com)). Use **Test connection**
to confirm it works, then **Run check now** to pull your data in.

## Running with Docker

```bash
docker compose up --build
```

This builds the image, starts the app on http://localhost:3000, and persists
the SQLite database in a named Docker volume (`compliance-tracker-data`) so
your data, tags, and settings survive container restarts/rebuilds.

To run it without Compose:

```bash
docker build -t compliance-tracker .
docker run -p 3000:3000 -v compliance-tracker-data:/app/data compliance-tracker
```

The Drata API key is entered through the Settings page after the container
is up (stored in the mounted SQLite database), not as an environment
variable — this makes the same image shareable without baking in credentials.

## Architecture

- **Next.js** (App Router) for both the UI and the API routes — one process,
  one Docker image.
- **SQLite via Prisma** (with the `better-sqlite3` driver adapter) as the
  "light database" — one file, easy to back up, mounted as a Docker volume.
- Drata's public API v2 (`https://public-api.drata.com/public/v2`) is called
  directly from the server using a stored API key (Bearer token) — see
  `src/lib/drata.ts`. Drata's API is key-based only; there's no OAuth client
  flow for third-party apps.
- `src/lib/sync.ts` is the sync + status-computation job, triggered either
  manually via `/api/sync` or by the scheduler.
- `src/lib/scheduler.ts` runs the daily check in-process via `node-cron`,
  started once per server instance from `src/instrumentation.ts` (Next's
  `register()` hook) and rebuilt whenever schedule settings are saved. One
  workspace's API hiccup during a run doesn't fail the whole check — see the
  per-resource error isolation in `runSync`.
- Tagging is entirely local — see the `Tag` / `TagAssignment` models in
  `prisma/schema.prisma` — and keyed off Drata's own Control/Test IDs, so a
  re-sync never loses your tags.
- `StatusSnapshot` + `CheckRun` give every check run a row per Control/Test;
  the Trends page queries these for pass-rate-over-time and failures-by-tag.
- `src/lib/notifications.ts` evaluates enabled `NotificationRule`s against a
  check run's snapshots and sends via `src/lib/slack.ts` / `src/lib/jira.ts` /
  `src/lib/linear.ts`, using the credentials on each rule's `Connection`;
  `NotificationLog` tracks per-(rule, entity) state (`OPEN`/`RESOLVED`) so
  re-runs know whether to open a new alert, follow up, or resolve.
- `Connection` holds named, reusable credentials per channel type
  (`credentialsJson`, shape varies by type); a `NotificationRule` references
  exactly one and stores its own destination (channel/project/team) and
  optional ticket templates in `configJson`.
