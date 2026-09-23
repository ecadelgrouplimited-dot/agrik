# Service provider

Transport, storage, spraying, mechanisation, veterinary, agronomy. They sell a service
with capacity and a coverage area, and their problem is keeping that capacity busy.

## What they open the app to find out

1. **Who needs me right now** — open demand in the districts they cover.
2. **Is my listing actually findable** — priced, with photos, in the right districts.
3. **What did I quote, and did it land** — offers out and their outcome.

## What exists today

`/provider` is 4,911px on a phone: a hero, a next-action panel, six stat cards, an
opportunity queue, a district board, an operations feed, a service-health panel, a
pipeline panel, a price watch and a readiness checklist. Most of it reads zero. Six
controls are under 40px. `/provider/leads` is 11,384px.

The parts are not wrong — the opportunity queue and the district board are genuinely the
right idea — but ten stacked sections is a report, not a dashboard, and it is the same
problem the farm workspace and admin overview had before they were rebuilt.

## What to build

### 1. Cut the overview to three answers

Keep, in this order:

- **Leads worth acting on** — the existing opportunity queue, which already scores
  listings by fit, capped at five with the rest behind a link to `/provider/leads`.
- **Districts where demand is strongest** — the district board, which tells a provider
  where to move, already works. Keep it, compact it.
- **A single readiness line** — "3 of 4 services priced, 2 missing photos" replacing the
  service-health, pipeline-health and readiness-checklist panels, which all answer
  variations of "is my catalog any good".

Everything else moves behind a link or goes. The price watch belongs on the farmer price
board, which a provider can already read.

### 2. Give the shell the phone pass

`/provider` and `/provider/leads` never received the mobile work because they use their
own classes. Adopt `fw-bar`, `fw-panel`, `fw-stats` and `admin-grid` so they inherit it,
rather than adding a third set of breakpoints.

### 3. Make the leads list a table

`/provider/leads` at 11,384px is the same card-list problem the admin user directory had
at 10,135px. A table with crop, district, quantity, age and a fit score, and the detail in
a panel beside it.

## What not to build

- **No booking or scheduling.** Nothing in the schema models a job, a calendar or a
  confirmation, and a provider with no leads does not need a calendar.
- **No route optimisation or capacity planning.** Interesting, and unreachable from the
  data that exists.
- **No separate provider price board.** They read the same market prices farmers do.

## Done when

`/provider` fits roughly one and a half screens on a phone, every figure shown has a
value, and `/provider/leads` is a table. No control under 40px.
