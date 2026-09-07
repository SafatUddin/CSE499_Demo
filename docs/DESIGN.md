# Remlin — Merchant Console Design System

**v2 — Obsidian liquid glass.** Pure-black canvas, graphite liquid-glass cards, white/silver light. This document is the complete specification for the
ShopMate AI merchant console: colour, type, elevation, component anatomy, states, motion,
content rules, and page-by-page structure.

**Files in this package**

| File | What it is |
|---|---|
| `ShopMate Merchant.dc.html` | Console source (edit this) |
| `ShopMate Landing.dc.html` | Marketing landing page source (edit this) |
| `ShopMate Merchant v1 navy.dc.html` | Previous navy-blue version, kept for reference |
| `shopmate-merchant-prototype.html` | Console prototype — self-contained, opens offline |
| `shopmate-landing-prototype.html` | Landing page prototype — self-contained, opens offline |
| `design.md` | This document |
| `image-slot.js` | Drop-in portrait placeholder component used by every avatar |
| `logo-mark.svg` | Logo mark only — square, for the console sidebar (incl. collapsed rail) |
| `logo-lockup.svg` | Full logo lockup, mark + wordmark — for the landing nav |
| `footer-brand.png` | Supplied brand artwork used as the landing footer band |

---

## 1. Core principle — one black room, lit from the corners

Everything sits in a single black room. Depth comes from **light**, not from hue: corner
spotlights wash the canvas, and every card is a slab of liquid glass that catches that light on its
top-left edge and fades to black at the opposite corner.

Three rules hold the whole system together:

1. **The canvas is black** (`#050506`) with a faint dot grid. Never a coloured background.
2. **Every surface is glass** — a light sheen radial + a dark base gradient + a 1px top highlight +
   a deep outer shadow. A flat fill is always wrong.
3. **Colour is light.** White and silver carry all emphasis. Hue appears only as status.

### Spotlights

Four canvas-level blooms, all `border-radius: 50%`, heavily blurred, `pointer-events: none`:

| Position | Size | Fill | Blur |
|---|---|---|---|
| top −26% / left −8% | 62vw | `rgba(255,255,255,0.16)` → transparent 68% | 60px, `sheen` 9s |
| top −18% / right −12% | 52vw | `rgba(255,255,255,0.10)` → transparent 70% | 70px |
| bottom −32% / right −6% | 58vw | `rgba(255,255,255,0.09)` → transparent 72% | 80px |
| bottom −24% / left 14% | 40vw | `rgba(255,255,255,0.06)` → transparent 65% | 70px |

Plus a top vignette `radial-gradient(130% 70% at 50% -8%, rgba(255,255,255,0.07), transparent 58%)`.

Each page then adds **its own** spotlights so no two pages are lit identically — catalog from the
top-right, analytics from the top-left plus bottom-right, integrations from above the headline plus
bottom-left. Inbox uses the canvas lighting only.

**Dot grid:** `radial-gradient(rgba(255,255,255,0.055) 1px, transparent 1px)` at `26px 26px`, 0.6 opacity.

---

## 2. Colour

### 2.1 Canvas

`#050506`, plus the dot grid and spotlights above. `html, body { background: #000 }`.

### 2.2 The liquid-glass recipe

Every card is built from the same four ingredients. Only the sheen's origin corner changes.

```css
background:
  radial-gradient(120% 80% at 0% 0%,   rgba(255,255,255,0.09), transparent 46%),  /* sheen  */
  radial-gradient(90% 70% at 100% 100%, rgba(255,255,255,0.05), transparent 52%), /* bounce */
  linear-gradient(160deg, rgba(26,26,29,0.90), rgba(13,13,14,0.94) 55%, rgba(4,4,5,0.96));
border: 1px solid rgba(255,255,255,0.11);
box-shadow: 0 40px 100px rgba(0,0,0,0.70), inset 0 1px 0 rgba(255,255,255,0.16);
backdrop-filter: blur(30px);
```

Variants, by role:

| Surface | Sheen origin | Base |
|---|---|---|
| Workspace shell / tables / catalog / orders | `0% 0%` + bounce at `100% 100%` | `rgba(26,26,29,0.90)` → `rgba(4,4,5,0.96)` |
| Asides (persona, activity) | `100% 0%` | `rgba(28,28,31,0.90)` → `rgba(8,8,9,0.96)` |
| Stat cards | `0% 0%` at 0.10 | `rgba(28,28,31,0.90)` → `rgba(8,8,9,0.96)` |
| Chart card | `0% 0%` + `100% 0%` | `rgba(24,24,26,0.90)` → `rgba(0,0,0,0.97)` |
| Inner panes (list, cart) | `0% 0%` at 0.06 | `rgba(32,32,35,0.86)` → `rgba(17,17,19,0.90)` |
| Message thread — deepest | `100% 0%` at 0.05 | `rgba(15,15,16,0.94)` → `rgba(0,0,0,0.98)` |
| Tooltip / insight banner | `0% 0%` at 0.12–0.14 | `rgba(30,30,38,0.86)` → `rgba(5,5,6,0.97)` |

### 2.3 Chrome (sidebar + top bar)

Lighter glass than the workspace, so the chrome still reads as a separate layer:

- Sidebar: `radial-gradient(110% 40% at 0% 0%, rgba(255,255,255,0.10), transparent 60%)` over
  `linear-gradient(180deg, rgba(255,255,255,0.075), rgba(255,255,255,0.015) 55%, rgba(255,255,255,0.04))`,
  `blur(34px) saturate(170%)`, `30px 0 70px rgba(0,0,0,0.6)`.
- Top bar: `linear-gradient(180deg, rgba(255,255,255,0.065), rgba(255,255,255,0.01))`, `blur(26px)`.

### 2.4 Emphasis — white and silver only

There is **no blue accent**. Emphasis is light.

| Token | Value | Used for |
|---|---|---|
| Solid light | `linear-gradient(180deg,#ffffff,#cfd3da)` on `#08090b` text | primary buttons, send, AI copilot when on |
| Silver glass | `linear-gradient(150deg, rgba(255,255,255,0.16), rgba(255,255,255,0.05))` | AI/agent bubbles, active nav, active tab |
| Light hairline | `rgba(255,255,255,0.10–0.30)` | all borders |
| Chart stroke | `linear-gradient(90deg,#8b9099,#e9ecf1 55%,#ffffff)` | conversations line |
| Glow | `0 0 18px rgba(255,255,255,0.7)` | marker dot, live dots, logo |

### 2.5 Semantic colours (unchanged — status only)

| State | Border | Fill | Text |
|---|---|---|---|
| Success / Trained / Connected / Delivered | `rgba(61,220,132,0.42)` | `rgba(20,90,55,0.35)` | `#7ff0b0` |
| Warning / Pending | `rgba(240,180,60,0.45)` | `rgba(96,66,10,0.40)` | `#ffcf6b` |
| Danger / Cancelled / expired token | `rgba(244,72,58,0.45)` | `rgba(96,20,14,0.40)` | `#ff9d92` |
| Info / Confirmed / Shipped / AI managed | `rgba(255,255,255,0.28)` | `rgba(255,255,255,0.12)` | `#ffffff` |
| Neutral / Manual | `rgba(255,255,255,0.16)` | `rgba(255,255,255,0.07)` | `rgba(255,255,255,0.70)` |
| Live dot | — | `#3ddc84` + `0 0 10px rgba(61,220,132,0.9)` | — |
| Caveat text | — | — | `#d9b160` |

Notification counts: red `linear-gradient(160deg,#f4483a,#c62212)` for **Unread, Complaints, Spam**
only; every other count is graphite glass `rgba(255,255,255,0.22 → 0.08)`. White text always.

### 2.6 Text

| Role | Colour |
|---|---|
| Primary | `#ffffff` |
| Secondary | `rgba(255,255,255,0.62–0.75)` |
| Tertiary / meta | `rgba(255,255,255,0.45–0.55)` |
| Placeholder | `rgba(255,255,255,0.38)` |
| On light buttons | `#08090b` |
| Link | `rgba(255,255,255,0.86)`, hover `#ffffff` |
| Mono (SKUs) | `ui-monospace, SFMono-Regular, Menlo` at 0.45 |

---

## 3. Typography

**Inter only** (weights 400–800, loaded from Google Fonts). Applies to body, headings, inputs,
buttons and selects — no element inherits a system font.

| Role | Size | Weight | Tracking |
|---|---|---|---|
| Display (integrations hero) | 44px | 800 | −0.03em |
| Page/card title | 19px | 700 | −0.01em |
| Panel title | 17–18px | 700 | normal |
| Stat value | 34px | 750 | −0.02em |
| Body | 13–15px | 400–600 | normal |
| Row name | 14–14.5px | 650–700 | normal |
| Eyebrow / column head / chip | 10.5–12px | 700–800 | 0.10–0.16em |
| Meta / timestamp | 10.5–12px | 400–500 | 0.04–0.06em |

**Casing rule: sentence case everywhere.** No block capitals, no `text-transform: uppercase`
anywhere in the system. Wide letter-spacing on small labels carries the "system" tone instead.

Permanent exceptions, preserved verbatim: customer and person names, `AI`, `SKU`, brand names
(ShopMate AI, Facebook, Instagram, WhatsApp, WooCommerce, Shopify), and order refs (`#ORD-9021`).

Long text uses `text-wrap: pretty`. Single-line data (names, chips, timestamps, table cells) uses
`white-space: nowrap` with `text-overflow: ellipsis`.

---

## 4. Geometry, elevation, spacing

**Radii** — 22px workspace cards · 20px inner cards & banners · 16–18px list rows, composer, search ·
13–14px buttons, inputs, nav rows · 11–12px small buttons, chips · 7–9px badges & tags · 50% avatars ·
99px pills (filter tabs, counts, toggle track).

**Elevation** — every raised surface pairs an outer shadow with a top inset highlight:

```
Card:      0 40px 100px rgba(0,0,0,0.70), inset 0 1px 0 rgba(255,255,255,0.16)
Inner:     0 24px 60px  rgba(0,0,0,0.60), inset 0 1px 0 rgba(255,255,255,0.16)
Control:   0 10px 30px  rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.14)
Light:     0 14px 34px  rgba(0,0,0,0.60), inset 0 1px 0 rgba(255,255,255,0.95)
Sunken:    inset 0 3px 8px rgba(0,0,0,0.80), inset 0 -1px 0 rgba(255,255,255,0.16)
```

**Spacing** — 4px base. Page padding 24/30px · card padding 22–28px · row padding 14–18px ·
list gap 8px · card grid gap 18–22px · control gap 10–14px.

**Layout is always flex/grid with `gap`** — never margins between siblings, never whitespace-spaced
inline elements. Tables are CSS grids with explicit `grid-template-columns` shared by header and rows.

**Responsive contract (learned the hard way — do not regress):**

- Workspace row: `flex: 1 1 auto` with `min-height: 560px` and `min-width: 1040px`.
  `flex-shrink: 0` breaks the definite-height chain and makes panes stop scrolling internally.
- The padded content container owns `overflow: auto` — the app scrolls there, panes scroll inside.
- Chat column needs its own `min-width: 430px`; message thread `min-height: 150px`.
- Filter tab row is `flex-wrap: nowrap; min-width: max-content` — it scrolls, it never stacks.
- Sidebar nav is `overflow-y: auto` with the scrollbar hidden (`scrollbar-width: none` +
  `::-webkit-scrollbar { width: 0 }`) so collapsed icons stay centred on one axis.

---

## 5. Components

### 5.1 Sidebar

290px expanded / 92px collapsed, `transition: width .28s cubic-bezier(.4,0,.2,1)`.

- **Brand block** — 44px logo mark, "ShopMate AI" 16px/700, "Elite sales command" 11.5px tertiary,
  collapse chevron on the right.
- **Nav rows** — 22px icon well + label. Active: `rgba(255,255,255,0.20 → 0.07)` gradient,
  `1px solid rgba(255,255,255,0.20)`, white icon, `0 8px 22px rgba(0,0,0,0.55)`.
  Inactive: transparent, `rgba(255,255,255,0.68)`, hover `rgba(255,255,255,0.09)`.
- **AI training card** — pulsing green dot (`pulseDot` 2.2s), label, 5px progress track at 78%
  with a `rgba(255,255,255,0.55)`→`#ffffff` fill and a `0 0 14px rgba(255,255,255,0.55)` glow.
- **Footer** — Settings, Log out. Log out hover tints red: `rgba(255,90,90,0.14)` / `#ffb4b4`.

**Collapsed rule:** every row switches to `justify-content: center; gap: 0; padding: 11px 0`, and
labels are removed from the DOM (not hidden). Icons, logo, chevron, training dot, footer icons must
all land on the same centre line.

### 5.2 Top bar

No page title — the workspace supplies its own headings. Right-aligned cluster:

- **Search** — 300px, `padding: 5px 5px 5px 13px`, radius 12px, deliberately understated.
  Fill is a top-down gradient `#000000 → #0b0b0d 42% → #1d1e21 78% → #2a2b2f`, with the sunken
  shadow from §4. Contains a 16px magnifier, a 13px input, and a 32×28 arrow button.
  Placeholder changes per page ("Search conversations…", "Search catalog…", "Search orders…",
  "Search commands…", "Search extensions…").
- **Notification bell** — 38px glass button, 7px white dot with glow.
- **Profile** — 32px avatar in a 99px glass pill with a chevron.

### 5.3 Filter tabs

99px pills, `10px 16px 10px 20px`, 11.5px/700, `letter-spacing: 0.10em`, one line always.
Active: `rgba(255,255,255,0.26 → 0.10)` with `1px solid rgba(255,255,255,0.42)` and
`0 8px 24px rgba(0,0,0,0.55)`. Inactive: `rgba(255,255,255,0.05)` on a 0.11 border, text at 0.60.
Each carries a 20px count pill (red or graphite per §2.5); tabs with nothing pending carry none.

### 5.4 Conversation row

40px avatar (initials + hidden portrait slot) with a 16px channel badge bottom-right — a light
silver disc with a dark `f` (Facebook) or `⚡` (websocket) glyph, 2px `#0b0b0c` ring. Name 14.5px/650 left, time 11px tertiary right,
one-line preview at 0.55, then a status tag ("Manual" neutral, "AI managed" silver-glass per §2.5).
Selected: `rgba(255,255,255,0.16 → 0.05)`, 0.24 border, `0 12px 30px rgba(0,0,0,0.55)`.

### 5.5 Message bubbles

Radius 20px with a 8px "tail" corner — `border-bottom-left-radius: 8px` for the customer,
`border-bottom-right-radius: 8px` for AI/agent.

- **Customer** (left, max-width 58%) — `linear-gradient(160deg, rgba(255,255,255,0.055), rgba(255,255,255,0.02))`,
  `1px solid rgba(255,255,255,0.10)`, `0 12px 30px rgba(0,0,0,0.5)`, blur 18px.
- **AI / agent** (right, max-width 72%) — liquid glass: `radial-gradient(120% 120% at 100% 0%, rgba(255,255,255,0.20), transparent 60%)`
  over `linear-gradient(150deg, rgba(255,255,255,0.16), rgba(255,255,255,0.05))`,
  `1px solid rgba(255,255,255,0.26)`, `0 16px 40px rgba(0,0,0,0.55)`.
  AI bubbles carry a `✦ AI` eyebrow (11px white glyph + 10.5px/700 label).
- Timestamp 10.5px at 0.50, aligned to the bubble's side.

### 5.6 Composer

Radius 18px glass bar: 34px `+` attach button, flexible input, 38px light send button.
Below it, left to right: "Suggest quote" and "Insert SKU" glass chips (11px/700), then the
**AI copilot** control — the most prominent element in the composer: `11px 14px 11px 20px`,
radius 99px, padding `11px 14px 11px 18px`, 12px/800 label preceded by a 16px sparkle AI glyph.

- **On** — the signature glowing blue pill, the brightest object in the product and the only place
  hue appears outside status: `linear-gradient(180deg, #2f9dff, #4fb3ff 34%, #8fd4f7 66%, #dff4fb)`,
  white text with `text-shadow: 0 1px 3px rgba(10,50,110,0.4)`, a `rgba(255,255,255,0.7)` rim, and a
  two-stage halo `0 0 0 4px rgba(120,180,255,0.16), 0 0 34px rgba(70,160,255,0.6), 0 10px 30px rgba(20,90,200,0.45)`.
  Track `rgba(12,58,120,0.6)`, knob `#ffffff → #d2d6dd`.
- **Off** — `rgba(255,255,255,0.08)` glass on a 0.16 border, text at 0.78. Track `rgba(255,255,255,0.2)`,
  knob `rgba(255,255,255,0.8)`.
- Track is 40×22, knob 16px at `top: 3px`, `left: 3px → 21px`,
  `transition: left .2s cubic-bezier(.4,0,.2,1)`. Track and knob are both `box-sizing: border-box` —
  that is what keeps the knob inside the track.

### 5.7 Tables

CSS grid, identical `grid-template-columns` on header and body rows.
Header: `rgba(255,255,255,0.05)`, hairlines top and bottom, 11px/700 `0.11em` labels at 0.50.
Rows: 16–18px vertical padding, `1px solid rgba(255,255,255,0.055)` divider.
Money and names bold white; SKUs monospace tertiary; status via chips or a styled `select`.
Status `select` is `appearance: none` and takes the semantic colour of its current value.

### 5.8 Segmented controls

5px-padded track (`rgba(0,0,0,0.45)`, 0.10 border, radius 12–13px) holding equal-flex buttons.
Selected button: `rgba(255,255,255,0.20 → 0.07)`, 0.20 border, white. Unselected: transparent at 0.55.
Used for response layout, order auto-finalization, and the 30/90-day chart range.

### 5.9 Buttons

| Variant | Style |
|---|---|
| Primary (light) | `linear-gradient(180deg,#ffffff,#cfd3da)`, `#08090b` text, 700–750 — Add product, send, Redeploy, Apply insight, Connect, copilot-on |
| Glass | `rgba(255,255,255,0.06–0.08)`, 0.14 border, inset highlight, hover to 0.14–0.15 |
| Ghost | transparent, tertiary text, hover glass |

All buttons: `cursor: pointer`, `transition: all .18s ease`, and an explicit hover state.

### 5.10 Chart — the reference structure

A single luminous filament on black. **260 samples** regardless of range, so the line is dense and
organic rather than a polyline of daily dots.

- **Shape:** rising trend + four stacked sines, amplitude growing left→right:
  `0.50·sin(34t) + 0.28·sin(15.5t) + 0.14·sin(61t) + 0.08·sin(96t)`, scaled by an
  envelope of `0.45 + 0.55t`. Small ripples early, tall crests late.
- **Smoothing:** Catmull-Rom → cubic bezier (`t = 0.5`), round caps and joins,
  `vector-effect: non-scaling-stroke`.
- **Conversations:** drawn twice — a 6px `rgba(255,255,255,0.28)` pass with `filter: blur(6px)`
  for the glow, then a 2px `url(#convStroke)` gradient pass (`#8b9099 → #e9ecf1 → #ffffff`).
  Area fill `rgba(255,255,255,0.22) → 0`.
- **Converted sales:** 1.6px `rgba(255,255,255,0.26)`, fill `rgba(255,255,255,0.07) → 0` — a quiet
  second voice, never competing.
- **Marker (at 62% of the series):** a 1px vertical light shaft, a 13px white dot with
  `0 0 0 4px rgba(255,255,255,0.14), 0 0 18px rgba(255,255,255,0.7)`, and a glass tooltip
  (timestamp / value / "✦ See ShopMate overview"). Position is computed in the logic class as
  percentages so it tracks the data, not the pixels — and it **flips side**: past 55% of the plot it
  anchors `right: 100% − markerLeft` with `translate(-18px,-14px)` and opens leftward, so it can
  never overhang the card onto the neighbouring panel.
- **Grid:** 4 lines at `rgba(255,255,255,0.07)`, baseline 0.25. Axis labels 10.5px at 0.35.

### 5.11 Avatars & portrait slots

Every avatar is initials on a gradient disc **plus** an `<image-slot>` layered on top at
`position: absolute; inset: 0`. The slot's chrome is suppressed (`font-size: 0; opacity: 0`) and
revealed on hover or permanently once filled:

```css
[data-avatar-slot] { position:absolute; inset:0; font-size:0; opacity:0; transition:opacity .18s ease; }
[data-avatar-slot]:hover,
[data-avatar-slot]:has(image-slot[data-filled]) { opacity:1; }
```

Slot ids must be unique per element (`conv-portrait-0…4`, `active-conversation-portrait`,
`merchant-profile-avatar`). Drop an image on any avatar and it persists across reloads.

### 5.12 Empty states

Dashed 16–20px card, `rgba(255,255,255,0.04)` fill, `1px dashed rgba(255,255,255,0.14–0.16)`,
centred 13.5px text at 0.50. Example: "No items in cart yet."

---

## 6. Motion

| Interaction | Transition |
|---|---|
| Hover / colour | `all .18s ease` |
| Toggle knob, segment slide | `.2s cubic-bezier(.4,0,.2,1)` |
| Sidebar collapse | `.28s cubic-bezier(.4,0,.2,1)` |
| Live dot | `pulseDot` 2.2s ease-in-out infinite (opacity 1→.45, scale 1→.82) |
| Corner spotlight | `sheen` 9s ease-in-out infinite (opacity .55→.85) — the primary bloom only |

No entrance animations, no parallax, no bouncing. Motion confirms input; it never decorates.

---

## 7. Content rules

- Sentence case, always (§3).
- Never invent or alter product copy — labels, table values, guardrail text and descriptions are
  authored content and are reproduced verbatim.
- Counts are real numbers, never placeholders; a zero state gets an empty-state card, not a "0" badge.
- Timestamps are short and absolute in lists (`10:02 AM`, `Jul 31`) and relative in the activity
  feed (`Just now`, `14m ago`, `2h ago`).
- Addresses and long strings truncate with an ellipsis rather than wrapping table rows.

---

## 8. Pages

All five pages share the sidebar, top bar, and padded workspace container. Sidebar nav switches pages.

### Unified inbox
Filter tabs (11, with counts) over a three-pane workspace: conversation list (36%, min 320px) ·
message thread (flex, min 430px, black) · cart (22%, min 250px). Thread auto-scrolls to the newest
message. Sending a message appends it right-aligned; with AI copilot on, an AI reply follows ~900ms later.

### Product catalog
Left: "Neural indexed products" card — 46-item context line, "Add product" accent button, and an
8-row table (Product · SKU · Price · Inventory · AI status · Action) with Trained/Pending chips.
Right (420px): "AI agent persona" — editable tone-of-voice and guardrails textareas, response-layout
and order-auto-finalization segmented controls, an amber caveat line, and a light "Redeploy persona
model" button.

### Orders
"Real orders" table (Customer · Items · Address · Total · Status · Placed). Status is a live
`select`; changing it recolours the control through the semantic scale.

### Analytics
Four stat cards (AI automation rate, avg response time, order uplift, AI messages used) with
green/orange deltas · "Conversations vs. sales" curve chart with a 30/90-day segmented control ·
"Recent activity" feed with semantic tags and a "View all history" button · a dismissible
"AI sales strategy update" banner with Apply insight / Dismiss.

### Integrations
Eyebrow pill, 44px display heading, intro paragraph, then a 3-column card grid: Facebook page,
Instagram, WhatsApp business, Shopify store, WooCommerce, Website chat widget, plus a dashed
"System insight" card. Connected cards are neutral grey with a green badge; a plain not-connected
card is grey with a **dashed** border and neutral badge; only an **error** state (WhatsApp's expired
token) gets the red tint. Connect/Disconnect toggles state and restyles the card live.

---

## 9. The landing page

The marketing site shares this system exactly — same black canvas, same glass recipe, same type
scale and casing rules — with two additions permitted only here.

### 9.1 Additions specific to marketing

**Ambient motion.** The console's spotlights are static; the landing page's drift continuously.
Three blooms on independent long loops, never synchronised, all `pointer-events: none`:

| Bloom | Animation |
|---|---|
| top-left, 60vw, `rgba(255,255,255,0.17)` | `driftA` 26s — translate ±6vw/7vh, scale .94→1.12 |
| right, 52vw, `rgba(215,225,245,0.12)` | `driftB` 32s — translate −7vw/−5vh, scale .9→1.05 |
| bottom, 48vw, `rgba(255,255,255,0.10)` | `driftC` 38s — translate 5vw/−6vh, scale .95→1.15 |

Durations are deliberately long and coprime; anything under ~20s reads as a loading state.

Four supporting animations: `shimmer` (6s, a light sweep across the headline's clipped gradient
text), `sweep` (4.4s, a specular streak crossing the primary CTA), `marquee` (28s linear, the client
logo rail — the list is duplicated, edge-masked, and carries a trailing `padding-right` equal to its
gap so `translateX(-50%)` lands exactly one copy over and the loop is seamless), `floaty` (9s, the hero chat card), plus `spinSlow`
(18s, the dashed ring on the Visual intelligence icon) and the shared `pulseDot`.

**The blue CTA.** Hero and closing CTAs use the same glowing blue pill as the console's AI copilot
(§5.6) — it is the one hue in the system, so it marks the one action that matters per screen. Every
other button is light, glass, or ghost.

### 9.2 Structure

Nav (sticky glass) → hero (headline + CTAs + social proof, live conversation card) → 4-up stats
strip → "The elite sales suite" (3 feature cards: Always on, One-click checkout, Visual
intelligence) → Unified command (copy + three connected channel rows) → AI intelligence report
(Predictive inventory management + the §5.10 chart) → client logo marquee → closing CTA → footer.

**Footer.** Three bands, top to bottom: (1) the positioning line at 15px/600 plus an "Open the
console" glass button, beside the Product / Legal / Support link columns (10px/700 `0.19em` headings,
13.5px links that gain a white underline on hover); (2) a hairline bar with the copyright and an
"All systems operational" pulse; and both sit **over** the artwork: `footer-brand.png` is the footer's own
background layer, absolutely positioned to `bottom: 0` at `width: 100%`, so text and image share one
frame rather than stacking as two blocks.

The image is masked `linear-gradient(180deg, transparent 0%, #000 24%, #000 66%, transparent 98%)` and
covered by `linear-gradient(180deg, rgba(5,5,6,0.86), rgba(5,5,6,0.55) 34%, rgba(5,5,6,0.30) 62%, rgba(5,5,6,0.88))`
— darkest where the text sits, clearest where the wordmark reads. The copyright row carries
`padding-bottom: clamp(150px, 20vw, 320px)` to reserve the lower band for the artwork, and footer copy
gains `text-shadow: 0 1px 10–12px rgba(0,0,0,0.55–0.6)` so it holds over the brighter areas. The image
is `aria-hidden` decoration; the accessible logo is the nav lockup.

Note the file size trade: the PNG roughly quadruples the bundled prototype (443 KB → 2.2 MB). Ship an
optimised or WebP version in production.

Column widths matter here: the link grid is `minmax(150px, 1fr)`, not 200px — at ~900px four 200px
tracks plus gaps exceed the container and the last column wraps to a lonely second row.

### 9.3 Cross-linking

The console's top-left logo is a link to the landing page; the landing page's Sign in, Sign up,
Start your free trial, Get started for free, Open the console, and Explore insights all lead into
the console. In the source files these point at the `.dc.html` names; in the bundled prototypes they
point at each other's bundled filenames, so **keep the two prototype files in the same folder** and
navigation works offline with no server.

### 9.4 Reflow

Unlike the console, the landing page reflows: every display size is `clamp()`d, every multi-column
grid is `repeat(auto-fit, minmax(…, 1fr))`, section padding is fluid, and the nav wraps. It holds
down to roughly 380px without a media query.

Button rows are `flex-wrap: wrap` and every CTA label is `white-space: nowrap` — a pill must stack
below its neighbour rather than break its own label across two lines. The hero is the tight case:
between roughly 800–1050px `auto-fit` yields two ~410px columns, which is exactly the width where an
unguarded label wraps inside the pill.

---

## 10. Prototype tweakable props

Exposed on the root component: `startCollapsed` (boolean), `copilotOn` (boolean),
`glassBlur` (0–60px range, default 34). Colour and copy are edited directly in place, so they are
deliberately not props.

---

## 11. Developer handoff

### 11.1 What the prototype is

`shopmate-merchant-prototype.html` is a **single self-contained file** — no build, no server, no
network. Open it in any modern browser and every interaction listed below works. Treat it as the
behavioural spec: where this document and the prototype disagree, the prototype wins.

The design is authored as one component with a template and a logic class. Ported to React, the
mapping is direct: template markup → JSX, the logic class's returned values → component state,
props, and handlers. All styling is inline; there are no CSS classes to port beyond the four rules in
§11.4.

### 11.2 State model

One store drives all five pages. Every field below already exists in the prototype:

| Field | Type | Purpose |
|---|---|---|
| `activeNav` | enum of the 5 page names | current page |
| `collapsed` | boolean | sidebar rail |
| `activeTab` | one of the 11 filter labels | inbox filter |
| `activeConv` | index | selected conversation |
| `threads` | array of message arrays | `{ text, role: 'customer'\|'ai'\|'agent', time }` |
| `draft` | string | composer input |
| `copilot` | boolean | AI copilot per conversation |
| `orders` | array | `{ customer, items, address, total, status, placed }` |
| `tone`, `guardrails` | string | persona textareas |
| `layout` | `'bullets' \| 'conversational'` | response layout |
| `autoFinalize` | `'managed' \| 'always'` | order auto-finalization |
| `range` | `30 \| 90` | chart window |
| `insightVisible` | boolean | analytics banner |
| `connections` | map of 6 keys → boolean | integration state |

### 11.3 Interaction contract

| Action | Expected behaviour |
|---|---|
| Console logo click | leaves the console for the landing page |
| Sidebar nav click | swap page; search placeholder follows the page |
| Collapse chevron | 290px ⇄ 92px, labels leave the DOM, everything centres on one axis |
| Filter tab click | sets `activeTab`; counts are data-driven, not decorative |
| Conversation click | swaps thread, chat header name/status/avatar, and cart context |
| Send (button or Enter) | appends an `agent` message right-aligned, clears the draft, scrolls to bottom |
| Send while copilot on | an `ai` reply is appended ~900ms later |
| Copilot toggle | switches the pill and track between the two states in §5.6 |
| Order status `select` | rewrites the row's status and recolours the control semantically |
| Persona textareas / segments | controlled inputs writing straight to state |
| 30 / 90 day segment | regenerates the series, axis labels, caption, and marker stamp |
| Dismiss insight | removes the analytics banner for the session |
| Connect / Disconnect | flips `connections[key]` and restyles the card, badge, and action live |
| Manage (Shopify, WooCommerce) | no-op placeholder — wire to real settings |
| Avatar hover | reveals the portrait drop target; a dropped image persists locally |

Not yet wired, and deliberately so: Settings, Log out, search submit, notification bell, profile
menu, attach, Suggest quote, Insert SKU, Add product, Edit, Redeploy persona model, Apply insight,
View all history, ⋮ menu, "Read architecture docs". All are styled and positioned; they need endpoints.

### 11.4 The only global CSS

Everything else is inline. These four rules cannot be:

1. `@keyframes pulseDot` and `@keyframes sheen` (§6).
2. Body reset + font stack + `input::placeholder` colour.
3. Scrollbar styling, and `[data-sidebar-nav]` scrollbar suppression (§4).
4. `[data-avatar-slot]` reveal rules (§5.11).

### 11.5 Data the frontend needs

- **Conversations:** id, display name, initials, channel (`facebook` | `websocket` | …), last-message
  preview, timestamp, management mode (`Manual` | `AI managed`), unread flag.
- **Messages:** id, conversation id, role, body, timestamp.
- **Products:** name, SKU, price, inventory count, AI index status (`Trained` | `Pending`).
- **Orders:** customer, line items, address, total, status enum, placed date.
- **Analytics:** four scalar KPIs with deltas, and two time series (conversations, converted sales)
  at daily granularity for 30/90 days. The prototype's 260-sample interpolation is a *rendering*
  detail — send daily points and resample client-side.
- **Integrations:** per-channel connection state plus an error state distinct from "not connected"
  (WhatsApp's expired token is styled differently from WooCommerce's never-connected).

### 11.6 Accessibility notes for implementation

- Contrast: white on the glass surfaces clears AA; tertiary text at 0.45 is decorative only — never
  put required information there alone.
- The copilot control must be a real `role="switch"` with `aria-checked`; the filter tabs a
  `role="tablist"`; the conversation list a listbox or a list of links.
- Every icon-only button (bell, attach, collapse, ⋮, search) needs an `aria-label`; `title` is
  present in the prototype but is not sufficient.
- Respect `prefers-reduced-motion`: disable `pulseDot` and `sheen`, keep the transitions.
- The status `select` is `appearance: none` — keep the native element so keyboard and screen-reader
  behaviour survives.

### 11.7 Known constraints

- The layout is desktop-only by design; below ~1100px the workspace scrolls horizontally rather than
  reflowing. A tablet or mobile breakpoint is a separate design exercise, not an implementation detail.
- `backdrop-filter` is load-bearing. Without it the glass reads as flat grey; provide a slightly more
  opaque fallback base rather than dropping the blur silently.
- Avatar portraits in the prototype are drop-target placeholders persisted in local storage. Real
  avatars should replace the `<image-slot>` with an `<img>`, keeping the initials fallback beneath.

---

## 12. Do not

- Do not introduce a hue into any surface, border, shadow, or accent. Black, grey, white, silver —
  the AI copilot pill (§5.6) is the single sanctioned exception.
- Do not use a flat fill on a card — every card gets the sheen + base + highlight + shadow recipe.
- Do not let chrome and workspace glass converge; chrome is lighter, workspace is deeper.
- Do not use semantic colours decoratively.
- Do not use block capitals anywhere.
- Do not use sharp-cornered charts, hand-drawn illustration, or emoji as UI iconography.
- Do not remove the corner spotlights or the dot grid; they carry the depth.
- Do not animate the console's spotlights — drift belongs to the landing page only.
- Do not use a low-frequency chart line — the dense filament is the signature.
- Do not space siblings with margins or source whitespace — flex/grid + `gap` only.
- Do not set `flex-shrink: 0` on the workspace row, or wrap the filter tabs.
- Do not remove the initials fallback behind a portrait slot.