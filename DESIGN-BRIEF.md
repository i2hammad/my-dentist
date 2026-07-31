# My Dentist — Website Design Brief

Spec for redesigning **mydentistpk.com**. Every number here is read from the live
database or the shipped stylesheet, not estimated — where a figure is a target
rather than a fact, it says so.

**What the product is:** a directory for finding and booking PMDC-verified
dentists in Pakistan. Patients compare dentists by specialty, experience, clinic
and fee, then book online instead of phoning clinics one at a time.

**Who it's for:** a patient with a specific problem (toothache, crooked teeth,
a missing tooth) who wants to know who can treat it, where, and what it costs.
Most arrive on a phone, from Google, landing on a deep page rather than the
homepage.

---

## 1. What the data actually contains

*Live figures, July 2026. Design to these, not to aspirational numbers.*

| | |
|---|---|
| Dentists | **29** |
| Cities | **Islamabad (10)**, **Rawalpindi (19)** |
| Specialties | General 19 · Cosmetic 4 · Endodontist 2 · Orthodontist 2 · Implant Specialist 1 · Prosthodontist 1 |

**Per-dentist field coverage:**

| Field | Coverage | Design implication |
|---|---|---|
| Photo, clinic name, address | 29/29 | Always show |
| Experience, consultation fee | 29/29 | Always show |
| PMDC verified, clinic tier | 29/29 | Always show |
| Timings | 29/29 | Powers the open/closed dot |
| Languages | 29/29 | Secondary chip |
| Coordinates | 23/29 | **6 dentists cannot appear on the map** |
| About text | 20/29 | 9 need a generated fallback |
| **Rating / reviews** | **3/29** | **Design must look right with no stars** |

### Three constraints that shape everything

1. **Only 3 of 29 dentists have reviews.** Any design that leans on star ratings
   will look broken for 90% of the directory. Ratings are a bonus element, never
   a structural one.
2. **Consultation fee is PKR 1,500 for every dentist.** It carries no comparative
   information today, so it is shown once per page (in a stat bar or booking
   panel), never repeated on every card. Show it per-card only once fees vary.
3. **No per-treatment pricing exists.** Treatment pages must not display price
   ranges until real figures are supplied — an invented range is one a patient
   will hold a clinic to.

---

## 2. Design tokens

Taken verbatim from the shipped stylesheet.

```
--blue    #0052FF   primary, CTAs, active states, links
--ink     #0A1551   headings
--body    #0F172A   body text
--muted   #64748B   secondary text
--border  #EEF2F7   hairlines, card borders
--line    #E2E8F0   input borders
--bg      #F8FAFC   page background
--green   #16A34A   verified, open now
--amber   #F59E0B   star ratings
--red     #DC2626   destructive, form errors
```

**Type** — system stack: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
'Helvetica Neue', sans-serif`

| Role | Size / weight | Notes |
|---|---|---|
| Page h1 | 30–34px / 800 | `letter-spacing: -0.4px`, cap at ~19ch |
| Section h2 | 16–19px / 800 | |
| Card title | 15–17px / 750 | |
| Body | 14.5–16.5px / 400 | `line-height: 1.6`, cap at 68ch |
| Secondary | 12.5–13.5px / 600 | muted |
| Chip / label | 11.5–13px / 700 | |

**Surfaces** — cards: 16–18px radius, `1px solid #EEF2F7`,
`box-shadow: 0 1px 2px rgba(2,6,23,.04)`. Hover: border `#BFD7FF`, shadow
`0 10px 24px rgba(2,6,23,.09)`, `translateY(-2px)`.

Avoid heavy shadows. An earlier build used `0 4px 12px rgba(0,0,0,.1)` on the
search bar and it read as a grey haze rather than a lift.

**Layout** — content column **1080px** (static pages) / **1100px** (app).

| Breakpoint | Behaviour |
|---|---|
| ≥1024px | Header nav links appear; 3-column card grids |
| ≥900px | Two-column page layouts (content + sidebar) |
| ≥700px | 2-column card grids |
| <700px | Single column throughout |

---

## 3. Shared components

### Doctor card
The most-repeated element on the site. Ordered by what decides a booking.

```
┌──────────────────────────────────────────┐
│ ┌────┐  Dr. Adeel Tahir                  │
│ │ 72 │  ORTHODONTIST          ← blue caps│
│ │ px │  DENTAL INN            ← clinic   │
│ └────┘  [15+ yrs] [PMDC verified] [★5.0] │
├──────────────────────────────────────────┤
│ 239/5 aziz bhatti road, Rawalpindi       │
└──────────────────────────────────────────┘
```

Use a **fixed-row grid**, not flow layout — clinic names and addresses vary
wildly in length, and without it every card in a row ends at a different height.
Address is one truncated line; it is real but rarely decides anything.

### Chips
Weighted by meaning, never uniform:

- **Specialty** — `#EFF4FF` bg, `#0052FF` text, 700 (the filter axis)
- **PMDC verified** — `#ECFDF5` bg, `#047857` text (the trust signal)
- **Rating** — `#FFFBEB` bg, `#B45309` text, only when reviews exist
- **Everything else** — `#F1F5F9` bg, `#475569` text

### Stat bar
Row of 3–4 cells, value (17px/800) over label (12px/muted), hairline dividers,
one rounded container. Always computed from the listing below it — never
decorative.

### Sticky booking panel
Right column, `position: sticky; top: 84px`. Price (26px/800) → primary CTA
full-width → reassurance line → open-hours row with a green dot.

Degrades when a dentist has no fee: show "Book a visit" rather than a bare
button under an empty heading.

### Empty state
Icon → specific cause → route out. Never a shrug. Distinguish:
- *No dentists in this city* → offer cities that have some
- *Filter excluded them* → offer to clear the filter
- *Request failed* → say so, offer retry

### Facts list
Icon column (26px tile) + label (132px) + value. Use this instead of a run of
`<h2>` sections where each introduces a single line.

### Footer
Four columns — Find a dentist / Treatments / Company / brand blurb — over a
baseline with copyright and app link. Present on every page; it is how a crawler
that lands on a doctor page reaches the rest of the site.

---

## 4. Pages

### 4.1 Homepage `/`

**Purpose:** orient a first-time visitor and get them into a listing fast.

```
[ Header: logo · Islamabad Rawalpindi Treatments About · Log in  Sign up ]

  Find & book the best dentists in Pakistan          ← h1, 34px, ~19ch
  Compare verified PMDC dentists by specialty,
  experience and clinic — then book online.

  ✓ PMDC verified  ·  Free to book  ·  ★ Real patient reviews

  [ 🔍 Search Dentist / Clinic / Treatment            ] ← full content width
  [ 📍 Islamabad, Pakistan                          ⌄ ]

  ( Nearby )( Elite Clinic )( Modern Clinic )( Standard Clinic )

  Nearby Doctors                              [ 🗺 See Map ]
  Top dentists near you

  ┌──── card ────┐ ┌──── card ────┐ ┌──── card ────┐
```

Below the fold: browse-by-city, browse-by-specialty, browse-by-treatment link
directory, then the footer.

**Note:** the headline and trust row are shown on web ≥700px only. On mobile the
app shows a personalised greeting in a blue header instead; a second headline
there would just repeat it.

### 4.2 City page `/dentists/islamabad`

**Ranks for:** "best dentist in Islamabad", "dentist in Rawalpindi"

```
Home › Dentists in Rawalpindi

Best dentists in Rawalpindi                        ← h1
Compare verified PMDC dentists in Rawalpindi by
specialty, experience and clinic, then book online.

┌ 19 dentists ┬ 19 PMDC verified ┬ 6 specialties ┬ PKR 1,500 fee ┐

Jump to  (Cosmetic Dentists)(Endodontists)(General Dentists)…

General Dentists in Rawalpindi  [13]
┌── card ──┐ ┌── card ──┐
```

Group by specialty with counts and a jump bar. A flat wall of 19 cards is hard
to scan, and specialty is the axis patients narrow on. Fall back to one grid
when a page has a single specialty.

### 4.3 Doctor profile `/dentist/dr-adeel-tahir-0klrqm`

**Ranks for:** the dentist's own name.

```
Home › Dentists in Rawalpindi › Dr. Adeel Tahir

┌──────────────────────────────────────────────────────┐
│ ┌──────┐  Dr. Adeel Tahir                            │
│ │ 104  │  Orthodontist · DENTAL INN · Rawalpindi     │
│ │  px  │  [Orthodontist][✓ PMDC verified][15+ yrs]   │
│ └──────┘  [modern clinic][English, Urdu]             │
└──────────────────────────────────────────────────────┘

┌ About Dr. Adeel Tahir ───────────┐  ┌ PKR 1,500 ─────┐
│ Bio…                             │  │ consultation   │
└──────────────────────────────────┘  │ [Book appt →]  │
┌ Clinic & appointment details ────┐  │ Free to book   │
│ 🏥 Clinic    DENTAL INN          │  │ ● Open 9–21    │
│ 📍 Address   239/5 aziz bhatti…  │  └────────────────┘
│ 🕒 Open      Mon–Sat  09:00–21:00│  ┌ Nearby ────────┐
│ 🎓 Experience 15+ years          │  │ All dentists…  │
│ 💬 Languages English, Urdu       │  │ Orthodontists… │
└──────────────────────────────────┘  └────────────────┘
```

Strip pasted social URLs from bios (one dentist has TikTok and Instagram links
in theirs) and fall back to a generated summary when little text remains.

### 4.4 Specialist page `/specialists/orthodontist`

Same shape as the city page, grouped by city instead of specialty. Cross-links
back: city pages link to specialties present in them, specialist pages link to
the cities they cover. `<specialty> in <city>` is the query a directory can
realistically win.

### 4.5 Treatment guide `/treatments/root-canal`

**Ranks for:** "root canal cost islamabad", "is a root canal painful", "how long
do braces take" — informational queries clinics rarely write for.

```
Home › Treatments › Root Canal Treatment

┌────┐  Root Canal Treatment
│ 🩺 │  A root canal removes infected pulp from inside a
└────┘  tooth, cleans the canals and seals them.

┌ ① When you need one ─────────────┐  ┌ 2 dentists ────┐
│ …                                │  │ offer this     │
└──────────────────────────────────┘  │ [Find a dentist]│
┌ ② What happens during treatment ─┐  └────────────────┘
│ …                                │  ┌ Other treatments┐
└──────────────────────────────────┘  │ Dental Implants │
┌ ③ Afterwards ────────────────────┐  │ Teeth Whitening │
└──────────────────────────────────┘  └────────────────┘
┌ ? Common questions ──────────────┐
│ Is a root canal painful?       + │  ← <details>
└──────────────────────────────────┘

Dentists offering root canal treatment [2]
```

Numbered sections — the content is a sequence, and identical cards don't convey
that. FAQs collapse; `FAQPage` JSON-LD stays in the head regardless, so rich
results are unaffected.

**Six treatments:** Braces & Orthodontics 🦷 · Dental Implants ⚙️ · Root Canal 🩺
· Teeth Whitening ✨ · Cosmetic Dentistry 💎 · Scaling & Cleaning 🪥

### 4.6 Treatments index `/treatments`

Card grid, each with icon tile, name, summary, and a footer pinned to the card
bottom carrying the real dentist count. Pinning the footer keeps cards aligned
despite differing summary lengths.

### 4.7 About `/about`

Lead paragraph naming the actual problem ("phoning clinics one by one"), stat bar
from live data, two columns: What we do / What PMDC verified means / How booking
works / How we make money, with coverage + contact in the sidebar.

**Keep "How we make money" explicit** — commission on bills, paid promoted
listings, and that promotion is paid position rather than a quality ranking.
Burying it reads as evasive, and Google's quality guidelines specifically reward
transparency on health sites.

### 4.8 Contact, Terms, Privacy

Contact: patient channels (email, WhatsApp) and a clinic-listing route.
Terms and Privacy: single-column prose, section headings, "last updated" date.

---

## 5. Content still to write

Ordered by impact.

1. **Per-treatment price ranges.** "Root canal cost Islamabad" is the highest-volume
   query these pages target and the one thing they currently can't answer. Needs
   real figures from clinics.
2. **Reviews.** 3 of 29 is the biggest trust gap on the site — it's why cards show
   0.0 stars and why Google's Rich Results test still warns on `aggregateRating`.
   A post-appointment review prompt is the fix.
3. **More cities.** Two cities caps addressable search entirely.
4. **Coordinates for the remaining 6 dentists** — they can't appear on the map.
5. City-specific intros, "how to choose a dentist", dental emergency page.

---

## 6. Two constraints worth designing around

**You cannot win "dentist near me."** 9 of the first 10 queries Search Console
recorded were that shape, and they're answered by the Google Maps pack, which
requires a physical business location. A directory structurally cannot enter it.
Design for `<specialty> in <city>` and treatment/cost questions instead.

**Don't design around data you don't have.** Star ratings on every card, "trusted
by 10,000 patients", before/after galleries — all tempting, all currently
fabrications. Every figure on the live site is computed from the database. That's
worth preserving: it's also what keeps the structured data honest, which is what
makes the pages eligible for rich results in the first place.

---

## 7. Accessibility & performance floor

- Exactly one `<h1>` per page; headings nest properly
- Visible keyboard focus: `outline: 2px solid #0052FF; outline-offset: 3px`
- Body text ≥14px, contrast ≥4.5:1 (muted `#64748B` on `#F8FAFC` passes)
- Tap targets ≥44px
- Wide content (tables, card rows) scrolls inside its own container — the page
  body never scrolls horizontally
- Static pages ship **zero JavaScript** and weigh 16–40KB. Keep it that way:
  it's why they're indexable by crawlers that don't run JS, including GPTBot,
  PerplexityBot and ClaudeBot
- Images carry explicit `width`/`height` to avoid layout shift; below-fold images
  use `loading="lazy"`
