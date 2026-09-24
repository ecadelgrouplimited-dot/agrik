# Offtaker

An aggregator, cooperative or processor with **volume commitments** — they have agreed to
take a quantity over a season and must fill it. A buyer asks "what is available today";
an offtaker asks "am I going to make my number".

Today they render the buyer dashboard, which cannot answer that.

## What they open the app to find out

1. **Am I on track against my commitment** — contracted volume versus sourced to date,
   with time left in the window.
2. **Where is the shortfall going to come from** — which districts and which farmers can
   still supply the gap.
3. **Who have I bought from before** — a supplier list is an offtaker's main asset.

## The honest position

**An offtaker dashboard needs data the platform does not store.** There is no contract,
no commitment, no volume target and no record of a completed purchase anywhere in the
schema. `MarketOffer` records an offer against a listing; nothing records that produce
actually changed hands.

Building a progress bar against a commitment that does not exist would mean inventing
the commitment in the UI, and that is the "confident number derived from nothing" this
project has been removing everywhere else.

## What to build, in order

### Phase 1 — make the role honest (build now)

Do not give the offtaker the buyer's page and call it theirs. Give them the buyer
sourcing view, which is genuinely useful to them, plus:

- **Supplier list** — the farmers this account has made offers to, with crop, district and
  last contact. This is derivable from `MarketOffer` today, and it is the single most
  useful thing an aggregator can have.
- **Sourcing so far** — offers made, accepted, and total quantity under offer, over a
  chosen window. Real numbers from real rows.

The role then differs from buyer in a way a user can see, using only data that exists.

### Phase 2 — commitments (needs a schema change)

A `SupplyCommitment` model: crop, target quantity, unit, window start and end, optional
counterparty. Then the progress view becomes real:

- Committed versus sourced, with days remaining
- Shortfall by crop
- Districts that could close the gap, from the price and listing board

**Do not start phase 2 until someone asks for it.** No offtaker has ever signed in.

## What not to build

- **No progress bar without a commitment record.** It would be fiction.
- **No credit or prepayment tooling.** Far beyond what the platform does.

## Done when

Phase 1: an offtaker sees a supplier list and their own sourcing activity, and the page is
visibly not the buyer's page. Phase 2 is gated on a real user asking.

## Status — built 2026-09-24

Phase 1 done: an offtaker gets the buyer sourcing view plus a "Sourcing so far" panel
counting offers made, distinct suppliers and districts, with a line stating plainly that
volume commitments are not tracked so this is activity rather than progress. The role is
now visibly not the buyer's page.

Phase 2 not started, and deliberately so — no offtaker has ever signed in.
