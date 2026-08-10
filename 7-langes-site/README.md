# 7-langes.com — booking feature

`index.html` is the complete 7-langes.com site with client booking added. It is a
single self-contained file, same as the page live today: no build step, no
dependencies, no framework. Drop it in and it works.

> The live site is not in version control anywhere — it was deployed to Netlify
> without a repo. This folder is the current page plus the booking work. If you
> want, connect Netlify to a real repo so future changes deploy on push instead
> of by hand.

## Deploying

**If the Netlify site is drag-and-drop deployed:** Netlify → your site → Deploys →
drag `index.html` onto the drop zone. Live in seconds.

**If you connect it to a repo instead:** push this folder, then point Netlify at
it with build command empty and publish directory set to the folder root.

## Turning on the inbox — do this once, it is the only setup step

Bookings arrive through **Netlify Forms**, which is already wired into the markup.
Netlify only registers a form when it sees it in a deploy, so:

1. Deploy the new `index.html`.
2. Netlify → your site → **Forms**. Two forms appear: `booking` and `inquiry`.
3. Open **Form notifications** → *Add notification* → *Email notification*, and
   put your address in. Do this for both forms.

Until step 3, submissions are still captured — they sit in the Forms tab — but
nothing reaches your inbox.

### Heads up: your contact form was broken

The old form posted to `https://formspree.io/f/YOUR_FORM_ID` — the placeholder
from the template was never replaced with a real form ID. Every inquiry submitted
since launch went nowhere. It now goes through Netlify Forms alongside the
booking form, so both land in the same place.

## What a client sees

A four-step flow on the new **Book** page:

1. **Session type** — Discovery Call (free), Half Day, Full Day, Multi-Day.
2. **Date** — a calendar that greys out anything inside your notice period.
3. **Start time** — real slots, in Pacific, with the client's own local time
   shown next to it if they are not in LA.
4. **Details** — name, email, phone, who they represent, budget, location, and
   the project itself.

Then a confirmation screen with an **Add to Calendar** file, so the date is in
their phone before they close the tab.

Each step stays locked until the one before it is answered, so nothing arrives
half-filled. Every submission carries the session type, the date, and the time as
separate fields, plus a `booking_when` line that reads as one sentence — the
notification email is legible without opening the dashboard.

## Changing availability

Everything adjustable sits in two blocks near the top of the `BOOKING` script,
around line 1050 of `index.html`. No logic to touch.

```js
const BOOKING = {
  openDays: [0, 1, 2, 3, 4, 5, 6],   // 0 = Sunday. Weekends are open.
  horizonDays: 120,                  // how far ahead the calendar opens
  blackout: [],                      // '2026-12-24' closes that date
};
```

Then per session type:

| Field    | Means                                    | Call | Half day | Full day | Multi-day |
| -------- | ---------------------------------------- | ---- | -------- | -------- | --------- |
| `lead`   | minimum notice, in hours                 | 48   | 168 (7d) | 168 (7d) | 336 (14d) |
| `from`   | earliest start offered, 24h clock        | 10   | 8        | 6        | 6         |
| `to`     | latest start offered                     | 18   | 15       | 11       | 11        |
| `step`   | minutes between slots                    | 30   | 60       | 60       | 60        |
| `price`  | the line shown on the card               | Free | $5,000   | $8,500   | $20,000   |

Shoot call-times start early on purpose — a full day starting at 6am is a crew
call, not an office appointment. Change `from`/`to` if that is not how you run a
set.

To take a week off, add the dates to `blackout`. To close Sundays, drop `0` from
`openDays`.

## What this does not do

Slots are **requests, not reservations**. There is no calendar sync, so two
clients can ask for the same slot and nothing stops them — you confirm by email,
which is what the confirmation screen and the fine print both tell the client.
For a booking that blocks itself against your real calendar, the page would need
a scheduler like Cal.com embedded in step 2; the rest of the flow would stay as
it is.

## Also fixed while in here

`#home` set `display: flex` on the id, which outranks the `.page` / `.page.active`
rules that drive navigation — so the homepage hero rendered underneath *every*
other page. Clicking Work, Studio or Contact scrolled you to the top of the hero
and looked like the nav was dead. The layout now hangs off `#home.active`, so one
page shows at a time.

## Tested

Driven in headless Chromium: the full booking flow end to end, the posted payload,
lead-time enforcement on both the 48-hour and 7-day rules, the slot window and
spacing, weekend availability, timezone display for an out-of-state visitor,
Pacific daylight-saving transitions in both directions (Mar 8 2026, Nov 1 2026,
Mar 14 2027), keyboard access to locked steps, the contact form, and mobile
layout at 390px with no horizontal overflow.
