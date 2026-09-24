# Role dashboards

AGRIK has five user roles. This directory holds one plan per role that does not yet
have a dashboard built for it, plus the audit that produced them.

Written for whoever picks up this work next, including a future me.

## Where each role lands today

| Role | Route | Pages | Mobile height | State |
|---|---|---|---|---|
| `farmer` | `/dashboard` | 13 | ~1,700px | Built and recently rebuilt |
| `buyer` | `/buyer` | 2 | 879px | A menu, not a dashboard |
| `offtaker` | `/buyer` | 2 | 879px | **Byte-identical to buyer** |
| `service_provider` | `/provider` | 4 | 4,911px | Nine sections, most reading zero |
| `input_supplier` | `/provider` | 4 | 4,911px | **Byte-identical to service provider** |

Measured 2026-09-24 at 390x844 against a database seeded with 46 users, 34 listings,
28 prices and 19 alerts.

## What the audit found

**Two roles are aliases, not roles.** `offtaker` renders the buyer surface and
`input_supplier` renders the provider surface, with no difference in content or
behaviour — the buyer page even titles itself "Buyer and offtaker command center". A
role that changes nothing is a field in the database, not a product.

**Nobody has ever used these surfaces.** All five production accounts are farmers. That
is the same condition that hid three crashing bugs in the admin console until it was
opened with real data, so none of this should be assumed to work.

**Neither shell got the phone pass.** The mobile work targeted `.farmer-*` and
`.admin-*`. The buyer and provider shells use their own classes and received none of it:
`/buyer/market` is 11,333px, `/provider/leads` is 11,384px, and `/provider` has six
controls under 40px.

**The two shells fail in opposite directions.** Buyer is four stat cards and three links
to other pages. Provider is a hero, a next-action panel, six stats, an opportunity queue,
a district board, an operations feed, a service-health panel, a pipeline panel, a price
watch and a readiness checklist — stacked, and mostly zero.

## The principle these plans follow

A dashboard answers "what should I do next", not "here is everything we know". Each plan
below names the two or three questions that role opens the app to answer, and treats
everything else as a different page or as nothing at all.

Shared rules:

- **Reuse the farmer vocabulary.** `fw-bar`, `fw-panel`, `fw-stats`, `admin-grid` and the
  phone block already exist and are tested. New roles adopt them rather than inventing a
  third and fourth set of classes, which is how `/buyer` and `/provider` ended up outside
  the mobile pass.
- **Never render a figure that has no value.** The farmer and admin work removed walls of
  `--` and `0`; do not reintroduce them here.
- **Separate a real role from an alias deliberately.** Where a role genuinely differs,
  give it its own surface. Where it does not, say so in its plan and let it share.

## Status

All four plans have been built to the point their own status sections describe, on
2026-09-24. Measured again at 390x844 afterwards:

| Role | Before | After |
|---|---|---|
| buyer `/buyer` | 879px of menu | 2,772px of produce |
| offtaker `/buyer` | identical to buyer | its own sourcing panel |
| service provider `/provider` | 4,911px, 10 sections | 2,755px, 3 sections |
| service provider `/provider/leads` | 11,384px | 6,916px |
| input supplier | identical to provider | `/provider/planting`, its own |

No horizontal overflow and no control under 40px on any role page. The farmer routes were
swept afterwards for regressions from the shared CSS: clean.

## Plans

- [buyer.md](buyer.md) — spot buyers sourcing produce now
- [offtaker.md](offtaker.md) — contracted aggregators with volume commitments
- [service-provider.md](service-provider.md) — transport, storage, spraying, mechanisation
- [input-supplier.md](input-supplier.md) — seed, fertiliser, agrochemicals
