# Input supplier

Seed, fertiliser, agrochemicals. Today they render the service provider dashboard.

## How they actually differ from a service provider

A service provider sells **capacity** — a lorry, a sprayer, a store — and cares about
utilisation and coverage radius. An input supplier sells **stock**, and cares about
which crops are being planted near them and when, because demand for seed and fertiliser
follows the planting calendar rather than a stream of individual requests.

That difference is real, and the platform already holds the data behind it: farmer crop
profiles, planting dates and districts.

## What they open the app to find out

1. **What is being planted near me, and when** — crop mix and planting windows by
   district, which is what tells a supplier what to stock.
2. **Who is asking for inputs** — the same lead queue, filtered to input-supply demand.
3. **Is my catalog findable** — priced, with photos, in the right districts.

## What to build

### 1. A planting-demand view, which is the one thing that is genuinely theirs

From `FarmProfile.crops` and `plantingDates` aggregated by district: which crops are being
planted in each district and in what window. A supplier reads that as "stock maize seed in
Lira in the next six weeks".

This is the only screen in any of these plans that does not already exist somewhere, and
it is the reason this role deserves its own surface rather than an alias.

**Caveat to respect:** planting dates are sparse — most farm profiles have not filled
them in. The view must show coverage honestly ("based on 12 of 46 farms in this district")
rather than presenting a thin sample as a market signal.

### 2. Share everything else with the service provider

Leads, catalog and marketing are the same job. Share the pages; do not fork them. The
difference between these two roles is one screen, not four.

## What not to build

- **No inventory or stock levels.** AGRIK is not a supplier's ERP, and asking them to
  keep stock counts current in a second system means the numbers will be wrong.
- **No agro-dealer certification or licensing.** Regulatory workflow, not marketplace.
- **No demand prediction from planting dates.** Aggregating what farmers recorded is
  honest; projecting tonnage of fertiliser from it is not.

## Done when

An input supplier sees a planting-demand view their service-provider counterpart does not,
with its data coverage stated plainly, and shares the rest of the shell.

## Status — built 2026-09-24

Done: `/provider/planting` aggregates farmer crop profiles and planting dates by
district, showing what to stock overall and per district. It appears in the navigation
only for `input_supplier`, so the role now differs from a service provider by exactly
the one screen this plan argued for.

The coverage caveat is enforced in the UI: the page states how many farms have a crop
profile and what share recorded a planting date, and says outright when no planting date
exists so the crop mix is trustworthy but the timing is not. In production today that
reads 5 of 5 farms with crops, 2 with dates.

One change the plan did not anticipate: the aggregation falls back to `Identity.crops`
when `FarmProfile.crops` is empty. Onboarding writes to the former and the farm workspace
to the latter, so reading only the farm profile made every farmer who signed up but never
opened the workspace invisible — which was most of them.
