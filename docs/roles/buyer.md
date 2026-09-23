# Buyer

A trader or processor sourcing produce to buy now, usually for a specific crop and a
specific window. They are not committed to anyone in advance; they take what the market
offers this week.

## What they open the app to find out

1. **What is available that I want to buy** — by crop, district and quantity.
2. **Am I being quoted a fair price** — against the market board, not just one seller.
3. **What have I already asked for, and who answered** — my demand listings and the
   offers against them.

Everything else is a different page.

## What exists today

`/buyer` is four stat cards (open seller listings, supply districts, my demand listings,
open offers) and three links to `/buyer/market`. It is 879px and contains no produce.
`/buyer/market` is a 646-line marketplace at 11,333px on a phone.

The stats are the right *facts* but the wrong *shape*: "20 open seller listings" is not
actionable, "3 maize lots in Lira within your price range" is.

## What to build

### 1. Replace the dashboard with a sourcing view

One `fw-bar` carrying the buyer's crop and district focus, then:

- **Matches for you** — open seller listings filtered to the crops this buyer has bought
  or asked for before, newest first, each showing crop, quantity, district, asking price
  and whether the listing has photo evidence. This is the page's reason to exist.
- **Your demand** — the buyer's own open demand listings and the offer count against
  each, so an unanswered request is visible.
- **Price check** — the market board for the crops they care about, reusing the farmer
  price board's per-crop card. A buyer wants the same numbers a farmer does, read from
  the other side: where produce is *cheapest*, not dearest.

### 2. Make evidence a first-class filter

A listing with photos is worth more to a buyer than one without, and the data already
carries `media_urls`. Surface "has photos" as a filter and a badge, not a footnote.

### 3. Give the marketplace the phone treatment

`/buyer/market` at 11,333px is unusable on the device most buyers will hold. It needs the
same compaction the farmer marketplace got: compact cards, a filter bar that wraps, and
no nested scroll.

## What not to build

- **No separate messaging system.** Contact goes through the phone number and WhatsApp
  already on each listing. Building an inbox before anyone has used the marketplace is
  inventing a workflow nobody has asked for.
- **No contracts or escrow.** That is the offtaker's problem, and even there it is a
  later phase.
- **No demand forecasting.** There is not enough transaction history to forecast from,
  and a confident-looking number derived from nothing is worse than no number.

## Done when

A buyer opening `/buyer` on a phone sees produce they could actually buy today, in under
one screen of scroll, with a way to call the seller; and `/buyer/market` fits the phone.
