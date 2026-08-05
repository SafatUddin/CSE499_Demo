# ShopMate AI — Merchant Console Design System

Navy-glass chrome, greyscale workspace. This document is the complete specification for the
ShopMate AI merchant console: colour, type, elevation, component anatomy, states, motion,
content rules, and page-by-page structure.

**Files in this package**

| File | What it is |
|---|---|
| `ShopMate Merchant.dc.html` | The source design component (edit this) |
| `shopmate-merchant-prototype.html` | Self-contained prototype — opens offline in any browser, no server |
| `design.md` | This document |
| `image-slot.js` | Drop-in portrait placeholder component used by every avatar |
| `uploads/Group 36119.svg` | Product logo mark |

---

## 1. Core principle — two zones

The interface is split into two deliberately different material zones. Never blend them.

**Zone A — Chrome (sidebar + top bar).** Navy glass. Translucent white-over-navy gradients,
heavy backdrop blur, visible inset highlight on the top edge. This is the "hardware" of the app:
it floats above the gradient navy background and lets it show through.

**Zone B — Workspace (everything inside the padded content area).** Dark grey → black. Near-opaque
neutral surfaces, no navy tint, minimal blur. This is the "screen" — content lives here and must
read with maximum contrast.

The contrast between A and B is the single most important visual decision in the system. If a new
surface looks ambiguous, ask which zone it belongs to and commit fully.

---

## 2. Colour

### 2.1 Page background (behind the chrome)

```
linear-gradient(165deg, #0a1a3f 0%, #061128 42%, #040a18 74%, #02050d 100%)
```

Plus two soft radial blooms, both `filter: blur(40–50px)`, non-interactive:

- top-left: `rgba(43,108,255,0.34)` → transparent, 60vw circle
- bottom-right: `rgba(24,72,196,0.28)` → transparent, 55vw circle
- a top vignette: `radial-gradient(120% 80% at 50% -10%, rgba(255,255,255,0.06), transparent 55%)`

### 2.2 Chrome surfaces (Zone A)

| Token | Value |
|---|---|
| Sidebar fill | `linear-gradient(180deg, rgba(255,255,255,0.085), rgba(255,255,255,0.02) 60%, rgba(255,255,255,0.05))` |
| Top bar fill | `linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.015))` |
| Blur | `blur(34px) saturate(170%)` sidebar · `blur(26px) saturate(160%)` top bar |
| Hairline | `1px solid rgba(255,255,255,0.07–0.08)` |
| Top highlight | `inset 0 1px 0 rgba(255,255,255,0.10–0.16)` |

### 2.3 Workspace surfaces (Zone B) — the greyscale ladder

Four steps, darkest = most focus. Never introduce a fifth.

| Step | Use | Value |
|---|---|---|
| Grey 1 | Side panels inside the workspace (conversation list, cart) | `linear-gradient(180deg, rgba(30,30,33,0.90), rgba(19,19,21,0.92))` |
| Grey 2 | Cards, tables, panels (catalog, orders, analytics, integrations) | `linear-gradient(160deg, rgba(24,24,26,0.94), rgba(13,13,14,0.96) 55%, rgba(5,5,6,0.97))` |
| Grey 3 | Inner cards / asides (persona panel, activity, stat cards) | `linear-gradient(160deg, rgba(26,26,29,0.94), rgba(9,9,10,0.96))` |
| Black | Message thread — the deepest surface in the product | `linear-gradient(175deg, rgba(14,14,15,0.96), rgba(7,7,8,0.97) 55%, rgba(0,0,0,0.98))` |

Inputs and textareas sink below their card: `linear-gradient(180deg, rgba(0,0,0,0.70), rgba(24,24,26,0.70))`
with `inset 0 2px 6px rgba(0,0,0,0.6)`.

### 2.4 Accent — blue

Blue is *reserved*. It appears only on: AI/agent message bubbles, the AI copilot control when on,
the primary chart line, the "Add product" button, and the notification dot. Nothing else.

| Token | Value |
|---|---|
| Accent | `#4d8bff` |
| Accent light | `#7aa8ff` |
| Accent pale (text on dark blue) | `#a9c6ff` / `#bcd2ff` |
| Accent gradient (fills, buttons) | `linear-gradient(150deg, rgba(72,128,255,0.72), rgba(24,58,175,0.60))` |
| Accent glow | `0 12px 32px rgba(28,78,220,0.55)` |

### 2.5 Semantic colours

Used **only** for status. Never decoratively.

| State | Border | Fill | Text |
|---|---|---|---|
| Success / Trained / Connected / Delivered | `rgba(61,220,132,0.42)` | `rgba(20,90,55,0.35)` | `#7ff0b0` |
| Warning / Pending / drafting | `rgba(240,180,60,0.45)` | `rgba(96,66,10,0.40)` | `#ffcf6b` |
| Danger / Not connected (error) / Cancelled | `rgba(244,72,58,0.45)` | `rgba(96,20,14,0.40)` | `#ff9d92` |
| Info / Confirmed / Shipped / AI managed | `rgba(122,168,255,0.45)` | `rgba(24,58,150,0.40)` | `#bcd2ff` |
| Neutral / Manual / not-connected (no error) | `rgba(255,255,255,0.16)` | `rgba(255,255,255,0.07)` | `rgba(255,255,255,0.70–0.78)` |
| Live indicator dot | — | `#3ddc84` + `0 0 10px rgba(61,220,132,0.9)` | — |

Notification counts: red `linear-gradient(160deg,#f4483a,#c62212)` for **Unread, Complaints, Spam**
only. Every other count is navy `linear-gradient(160deg,#20438f,#0d2159)`. White text always.

### 2.6 Text

| Role | Colour |
|---|---|
| Primary | `#ffffff` |
| Secondary | `rgba(255,255,255,0.62–0.75)` |
| Tertiary / meta | `rgba(255,255,255,0.45–0.55)` |
| Disabled / placeholder | `rgba(255,255,255,0.38)` |
| Inverted (on white buttons) | `#061128` |
| Link | `#7aa8ff`, hover `#a9c6ff` |
| Mono (SKUs) | `ui-monospace, SFMono-Regular, Menlo` at `rgba(255,255,255,0.45)` |

---

## 3. Typography

**Inter only** (weights 400–800, loaded from Google Fonts). Applies to body, inputs, buttons and
selects — no element inherits a system font.

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
Card:      0 30px 80px rgba(0,0,0,0.65),  inset 0 1px 0 rgba(255,255,255,0.10)
Inner:     0 24px 60px rgba(0,0,0,0.60),  inset 0 1px 0 rgba(255,255,255,0.10)
Control:   0 10px 30px rgba(0,0,0,0.45),  inset 0 1px 0 rgba(255,255,255,0.14)
Accent:    0 12px 32px rgba(28,78,220,0.55), inset 0 1px 0 rgba(255,255,255,0.40)
Sunken:    inset 0 3px 8px rgba(0,0,0,0.75), inset 0 -1px 0 rgba(120,160,255,0.22)
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
  `1px solid rgba(255,255,255,0.20)`, white icon, `0 8px 22px rgba(6,14,40,0.5)`.
  Inactive: transparent, `rgba(255,255,255,0.68)`, hover `rgba(255,255,255,0.09)`.
- **AI training card** — pulsing green dot (`pulseDot` 2.2s), label, 5px progress track at 78%
  with a white→`#a9c6ff` fill and glow.
- **Footer** — Settings, Log out. Log out hover tints red: `rgba(255,90,90,0.14)` / `#ffb4b4`.

**Collapsed rule:** every row switches to `justify-content: center; gap: 0; padding: 11px 0`, and
labels are removed from the DOM (not hidden). Icons, logo, chevron, training dot, footer icons must
all land on the same centre line.

### 5.2 Top bar

No page title — the workspace supplies its own headings. Right-aligned cluster:

- **Search** — 300px, `padding: 5px 5px 5px 13px`, radius 12px, deliberately understated.
  Fill is a top-down gradient `#01030a → #061336 42% → #0c2360 78% → #123072`, with the sunken
  shadow from §4. Contains a 16px magnifier, a 13px input, and a 32×28 arrow button.
  Placeholder changes per page ("Search conversations…", "Search catalog…", "Search orders…",
  "Search commands…", "Search extensions…").
- **Notification bell** — 38px glass button, 7px accent dot with glow.
- **Profile** — 32px avatar in a 99px glass pill with a chevron.

### 5.3 Filter tabs

99px pills, `10px 16px 10px 20px`, 11.5px/700, `letter-spacing: 0.10em`, one line always.
Active: `rgba(255,255,255,0.26 → 0.10)` with `1px solid rgba(255,255,255,0.42)` and a blue-tinted
outer glow. Inactive: `rgba(255,255,255,0.05)` on a 0.11 border, text at 0.60.
Each carries a 20px count pill (red or navy per §2.5); tabs with nothing pending carry none.

### 5.4 Conversation row

40px avatar (initials + hidden portrait slot) with a 16px channel badge bottom-right — blue `f`
for Facebook, teal `⚡` for websocket, 2px dark ring. Name 14.5px/650 left, time 11px tertiary right,
one-line preview at 0.55, then a status tag ("Manual" neutral, "AI managed" info-blue).
Selected: `rgba(255,255,255,0.16 → 0.05)`, 0.24 border, `0 10px 28px rgba(4,10,30,0.5)`.

### 5.5 Message bubbles

Radius 20px with a 8px "tail" corner — `border-bottom-left-radius: 8px` for the customer,
`border-bottom-right-radius: 8px` for AI/agent.

- **Customer** (left, max-width 58%) — `rgba(255,255,255,0.075)`, 0.13 border, blur 18px.
- **AI / agent** (right, max-width 72%) — `linear-gradient(150deg, rgba(58,110,240,0.55), rgba(24,58,170,0.42))`,
  `1px solid rgba(150,190,255,0.35)`, `0 14px 38px rgba(12,40,140,0.42)`.
  AI bubbles carry a `✦ AI` eyebrow (11px accent-pale glyph + 10.5px/700 label).
- Timestamp 10.5px at 0.50, aligned to the bubble's side.

### 5.6 Composer

Radius 18px glass bar: 34px `+` attach button, flexible input, 38px accent send button.
Below it, left to right: "Suggest quote" and "Insert SKU" glass chips (11px/700), then the
**AI copilot** control — the most prominent element in the composer: `11px 14px 11px 20px`,
radius 14px, 12px/800 label, accent gradient and glow when on, plus a 40×22 track with a 16px knob
(`top: 3px`, `left: 3px → 21px`, `transition: left .2s cubic-bezier(.4,0,.2,1)`).
Track and knob are `box-sizing: border-box` — that is what keeps the knob inside the track.

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
| Primary (accent) | accent gradient + glow, white text, 12.5px/700 |
| Primary (light) | `linear-gradient(180deg,#ffffff,#dfe6f5)`, `#061128` text, 750 — for terminal actions (Redeploy, Apply insight, Connect) |
| Glass | `rgba(255,255,255,0.06–0.08)`, 0.14 border, inset highlight, hover to 0.14–0.15 |
| Ghost | transparent, tertiary text, hover glass |

All buttons: `cursor: pointer`, `transition: all .18s ease`, and an explicit hover state.

### 5.10 Chart

- Curves only. Points are converted to cubic beziers via Catmull-Rom (`t = 0.5`) so the line passes
  through every point without overshoot. `stroke-linecap`/`linejoin: round`, `vector-effect: non-scaling-stroke`.
- Data must be **low-frequency**: a steady trend with one soft crest and dip
  (`start + (end−start)·t + wave·sin(4.6t+0.35)·sin(πt)`). No noisy zig-zag.
- Conversations: `#4d8bff` at 2.75px over a `rgba(77,139,255,0.38) → 0` area fill.
  Converted sales: `rgba(255,255,255,0.50)` at 2px over a `rgba(255,255,255,0.16) → 0` fill.
- Grid: 4 lines at `rgba(255,255,255,0.07)`, baseline at 0.25. Axis labels 10.5px at 0.35.

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

## 9. Tweakable props

Exposed on the root component: `startCollapsed` (boolean), `copilotOn` (boolean),
`glassBlur` (0–60px range, default 34). Colour and copy are edited directly in place, so they are
deliberately not props.

---

## 10. Do not

- Do not tint workspace surfaces navy, or make chrome grey. The two zones stay distinct.
- Do not use blue for anything that is not AI, primary action, or the chart line.
- Do not use semantic colours decoratively.
- Do not use block capitals anywhere.
- Do not add a fifth greyscale step or a second accent hue.
- Do not use sharp-cornered charts, hand-drawn illustration, or emoji as UI iconography.
- Do not space siblings with margins or source whitespace — flex/grid + `gap` only.
- Do not set `flex-shrink: 0` on the workspace row, or wrap the filter tabs.
- Do not remove the initials fallback behind a portrait slot.