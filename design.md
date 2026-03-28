# Carnival Cruise Line — UI/UX Design Guidelines

> **Reference pages:**
> - [Cruise Deals (Catalog)](https://www.carnival.com/cruise-deals-2025)
> - [Login](https://www.carnival.com/profilemanagement/accounts/login)
> - [Itinerary / Product Page](https://www.carnival.com/itinerary/3-day-baja-mexico-cruise/long-beach-los-angeles/firenze/3-days/lx5)

---

## 1. Brand Foundation

### 1.1 Color Palette

| Token              | Value       | Usage                                              |
|---------------------|-------------|------------------------------------------------------|
| **Primary**         | `#10559A`   | Headings, links, accent text, nav items, icons       |
| **Background**      | `#F1F4F9`   | Page body, card backgrounds, section backgrounds     |
| **Surface / White**  | `#FFFFFF`   | Card surfaces, button fills, input backgrounds       |
| **Text Primary**    | `#10559A`   | All headings, navigation labels                      |
| **Text Body**       | `#333333`   | Body copy, descriptions (dark gray on light bg)      |
| **Text Muted**      | `#666666`   | Secondary info, disclaimers, fine print              |
| **CTA Accent**      | `#E44D2E`   | "SHOP NOW" buttons, urgency badges (warm red-orange) |
| **Success / Green**  | contextual  | Checkmarks in deal bullet lists                      |

**Color scheme:** Light. The site is dominated by a single deep ocean blue (`#10559A`) providing a strong nautical brand identity, paired with a cool light-gray page background (`#F1F4F9`). Pops of warm red-orange appear only on primary action CTAs to create contrast and urgency.

### 1.2 Typography

| Role          | Font Stack                                        | Size Reference |
|---------------|---------------------------------------------------|----------------|
| **Display / H1** | `Tempo`, `Open Sans`, `Helvetica`, `sans-serif` | ~48–100px (hero banners) |
| **Headings (H2–H4)** | `Open Sans`, `Helvetica`, `sans-serif`      | 20–32px |
| **Body / Paragraph** | `Open Sans`, `Helvetica`, `sans-serif`      | 14–16px |
| **Small / Caption** | `Open Sans`, `Helvetica`, `sans-serif`       | 12–13px |

- `Tempo` is a custom branded display font used exclusively for large hero headlines.
- `Open Sans` is the workhorse font for everything else — headings, body, navigation, buttons.
- Font weights: Regular (400) for body, Semi-Bold (600) for subheadings, Bold (700) for headings and CTAs.

### 1.3 Spacing & Grid

| Property         | Value  | Notes                                  |
|------------------|--------|----------------------------------------|
| **Base unit**     | `4px`  | All spacing follows 4px increments: 4, 8, 12, 16, 20, 24, 32, 40, 48… |
| **Border radius** | `4px`  | Default for cards, inputs, containers  |
| **Pill radius**   | `40px` | Primary CTA buttons                    |
| **Max content width** | `~1200px` | Centered container with side padding |

---

## 2. Header

### 2.1 Structure

The header is a sticky top bar with three zones:

```
[ ☰ Hamburger ]  [ Logo (center) ]  [ Utility icons (right) ]
        ↓ (mobile)
[ Logo (left) ] [ Navigation links (center) ] [ LOG IN button (right) ]
        ↓ (desktop)
```

### 2.2 Components

- **Logo:** Carnival wordmark (SVG/raster hybrid), links to homepage. Placed center on mobile, left on desktop.
- **Hamburger menu (mobile):** Three-bar icon in primary blue (`#10559A`), top-left.
- **Primary navigation (desktop):** Horizontal link row: `Plan a Cruise` · `Our Ships` · `Destinations` · `Deals` · `Loyalty` · `Manage Bookings`.
    - Font: Open Sans, ~14px, semi-bold, primary blue.
    - Active/hover: underline or bottom border indicator.
- **LOG IN button (right):** Text-style button or ghost button. White background, primary blue text. On the deals page it sits as a simple text link.

### 2.3 Design Rules

- Background: white (`#FFFFFF`), with a subtle bottom shadow or 1px border to separate from content.
- Height: ~60–70px desktop, ~56px mobile.
- Navigation items are spaced evenly, with ~24–32px gaps.
- No heavy dropdowns visible on initial load — sub-menus appear on hover/click.

---

## 3. Footer

### 3.1 Structure

Multi-column layout on a dark or medium background:

```
[ Phone CTA: "Call Us 1-800-764-7419" ] [ Country selector ]
─────────────────────────────────────────────────────
[ Plan A Cruise ] [ Destinations ] [ Already Booked ] [ Customer Service ] [ About Carnival ]
   link list        link list        link list           link list            link list
─────────────────────────────────────────────────────
[ Legal links row: Legal Notices · Privacy · Careers · Travel Partners · Newsroom · Site Map ]
─────────────────────────────────────────────────────
[ Social icons: Facebook · X · Instagram · TikTok · Pinterest · YouTube · Threads ]
─────────────────────────────────────────────────────
[ Carnival logo (white/light version) ]
[ © 2026 Carnival Corporation. All rights reserved. ]
[ Disclaimer fine print ]
```

### 3.2 Design Rules

- **5 main columns** of links, each with a bold heading and 8–15 links underneath.
- Link text: ~13px, light color on dark background, regular weight.
- Column headings: ~14px bold, uppercase or sentence case.
- Social icons: Row of circular or simple SVG icons. 7 platforms represented.
- Bottom bar: Centered logo (light/white variant), copyright, and fine-print legal text.
- Phone number CTA prominently displayed at top of footer section.

---

## 4. Product Catalog (Deals Page)

### 4.1 Page Layout

```
[ Hero Banner Image — full width, ~300px tall ]
[ H1: "Cruise Deals" ]
[ Filter Bar ]
[ Sort Dropdown ] [ Results Count: "11 Deals" ]
[ Deal Cards — vertical list, 1 card per row ]
[ SEO Content Block ]
[ Footer ]
```

### 4.2 Filter Bar

A horizontal row of filter dropdowns, collapsible on mobile:

| Filter           | Type          |
|------------------|---------------|
| Sail To          | Dropdown      |
| Sail From        | Dropdown      |
| Dates            | Date picker   |
| Duration         | Dropdown      |
| Number of Guests | Dropdown      |
| Special Rates    | Dropdown      |
| Ships            | Dropdown      |
| Vacation Budget  | Range / Dropdown |
| Specialty Sailings | Dropdown   |

- Each filter has a chevron icon on the right.
- "Filters" label + "Clear all" link on the left.
- Sort control: "Sort By: Recommended" dropdown, right-aligned above results.
- Disclaimer: `*Starting price in USD. Taxes and fees are included.` below results count.

### 4.3 Deal Cards

Each deal card is a **horizontal layout** (image left, content right on desktop) or **stacked** (image top, content bottom on mobile):

```
┌──────────────────────────────────────────────────────┐
│ [Image: ~300×200]  │  H3: Deal Title                 │
│                    │  • Bullet benefit 1 (with icon)  │
│                    │  • Bullet benefit 2              │
│                    │  • Bullet benefit 3 (urgency)    │
│                    │                                   │
│                    │  "The Fine Print" expandable      │
│                    │  Offer Code: XXX                  │
│                    │  Terms link                       │
│                    │────────────────────────────────── │
│                    │  $XXX*          [SHOP NOW] button │
│                    │  average per person               │
└──────────────────────────────────────────────────────┘
```

**Card design tokens:**
- Card background: white, `border-radius: 4px`, subtle shadow.
- Image: Left column (~40% width), full height of card, rounded left corners.
- Deal title: `Open Sans`, bold, ~18–20px, primary blue.
- Benefit list: Bulleted with small checkmark/icon, ~14px body text.
- Urgency text ("Hurry! Ends Sunday, March 29th"): Highlighted or bold, potentially with a warm accent color.
- Price: Large bold text, ~28–32px, primary blue, with asterisk.
- Sub-price label: "average per person" — muted text, ~12px.
- **"SHOP NOW" button:** Pill shape (`border-radius: 40px`), warm red-orange or primary blue background, white uppercase text, bold, ~14px.
- "View Details" expandable: Text link with chevron-down icon, toggles fine print section.

### 4.4 VIFP Club Inline Card

A special promotional card inserted between deal cards:

```
┌────────────────────────────┐
│  VIFP Club                 │
│  LOG IN TO SEE MY DEALS    │
│  [LOG IN]  [Create Account]│
└────────────────────────────┘
```

- Differentiated background (slightly darker or branded).
- Two CTAs: Primary "LOG IN" button + secondary "Create Account" text link.

---

## 5. Product Page (Itinerary)

### 5.1 Page Layout

```
[ Image Carousel — full width, destination photos with captions ]
[ Subtitle badge: "Carnival Fun Italian Style" ]
[ H1: "3-Day Baja Mexico from Los Angeles, CA" ]
[ Ship name: "Carnival Firenze" ]
[ Route: Start → Ports → End ]
[ Date range + "Change Date" link + "What's included?" link ]
[ Price Block: "From $183* average per person, 2 person room" ]
[ START BOOKING — primary CTA button ]
─────────────────────────────────
[ Itinerary Timeline — day-by-day vertical list ]
─────────────────────────────────
[ Ship Overview Section ]
   - Rich text description with bold venue names
   - Blockquote styling for editorial content
─────────────────────────────────
[ Onboard Activities — horizontal scrollable card grid ]
[ Onboard Dining — horizontal scrollable card grid ]
─────────────────────────────────
[ "Change Your Itinerary" search form ]
[ Footer ]
```

### 5.2 Image Carousel

- Full-width hero area with multiple destination photos.
- Each image has a text overlay caption (e.g., "Ensenada") at bottom-left.
- Navigation dots or arrows for carousel control.
- Images: high-quality landscape photos, ~16:9 or wider aspect ratio.

### 5.3 Price & Booking Block

```
From $183*
average per person, 2 person room

[ START BOOKING ]  ← primary CTA
```

- Price: Large bold display, ~32–40px, primary blue.
- "From" prefix: smaller, regular weight.
- Asterisk note: linked to terms.
- CTA: Pill-shaped button, bold uppercase, full-width on mobile.

### 5.4 Itinerary Timeline

Each day is a card:

```
┌──────────────────────────────────────┐
│ [Port Photo]  │ Day X: Port Name     │
│  (~200×150)   │ Time: 8:00 AM - 5 PM │
│               │ Description text...   │
│               │ [Read more] link      │
│               │ [SHORE EXCURSIONS] btn│
└──────────────────────────────────────┘
```

- Vertical stack of day cards.
- Each card: image left, content right (desktop); stacked (mobile).
- "Fun Day at Sea" cards have a generic ship/entertainment image.
- Action buttons: "SHORE EXCURSIONS" or "THINGS TO DO" — secondary style.

### 5.5 Activity / Dining Cards

Horizontal scrollable grid of small square cards:

```
┌──────────────┐
│  [Image]     │
│  ~1:1 ratio  │
│──────────────│
│  Venue Name  │
│  Included /  │
│  Additional  │
└──────────────┘
```

- Card size: ~180×220px.
- Image: top, fills card width.
- Title: Bold, ~14px, centered.
- Tag: "Included" (green or neutral) / "Additional" (muted) — indicates pricing model.
- Horizontal scroll with left/right arrows on desktop.

---

## 6. Login Page

### 6.1 Layout

Split-screen layout:

```
┌───────────────────┬──────────────────────┐
│   Login Form      │   Welcome Panel      │
│                   │                      │
│   H1: "Log in"    │   H2: "Welcome Back" │
│   [X Close]       │   • VIFP offers      │
│                   │   • Save itineraries  │
│   Email input     │   • Manage cruise     │
│   [Forgot user?]  │                      │
│   Password input  │                      │
│   [Skip Password] │                      │
│   [Forgot pass?]  │                      │
│                   │                      │
│   [LOG IN] btn    │                      │
│                   │                      │
│   Don't have      │                      │
│   an account?     │                      │
│   [Create account]│                      │
│                   │                      │
│   ─── footer ──── │                      │
│   Logo · Legal ·  │                      │
│   Privacy         │                      │
└───────────────────┴──────────────────────┘
```

### 6.2 Form Components

- **Text inputs:** Transparent/white background, primary blue text, no visible border radius (flat/underline style `border-radius: 0px`), no shadow. Bottom-border style input.
- **Labels:** Floating or above-field, ~12–13px, muted color.
- **Helper links:** "Forgot username?" and "Forgot password?" — small text links below their respective fields, primary blue.
- **Passwordless option:** "Skip Password — Sign in with a one-time code" — secondary action, text link style with explanation text.
- **Primary CTA:** `[LOG IN]` — full-width button, pill shape, bold uppercase, primary blue background, white text.
- **Secondary link:** "Don't have an account? Create an account" — text with linked portion in primary blue.

### 6.3 Welcome Panel (Right Side)

- Background: branded blue or image background.
- White text content.
- Bulleted value propositions (3 items).
- Carnival logo (white version) at bottom.
- Legal links (Legal Notices, Privacy Policy) in small white text.

---

## 7. CTAs (Calls to Action)

### 7.1 Primary CTA

| Property        | Value                              |
|-----------------|------------------------------------|
| Shape           | Pill (`border-radius: 40px`)       |
| Background      | Primary blue `#10559A` or warm accent `#E44D2E` |
| Text            | White, uppercase, bold, 14–16px    |
| Padding         | 12px 32px                          |
| Shadow          | None                               |
| Hover           | Slightly darker shade, cursor pointer |

**Usage:** "START BOOKING", "LOG IN", "SHOP NOW", "SEARCH CRUISES".

### 7.2 Secondary CTA

| Property        | Value                              |
|-----------------|------------------------------------|
| Shape           | Pill or rounded rect               |
| Background      | Transparent / white                |
| Border          | 1–2px solid primary blue           |
| Text            | Primary blue, uppercase, semi-bold |
| Hover           | Light blue background fill         |

**Usage:** "View Details", "Create Account", filter toggles.

### 7.3 Text Link CTA

| Property        | Value                              |
|-----------------|------------------------------------|
| Color           | Primary blue `#10559A`             |
| Decoration      | Underline on hover                 |
| Weight          | Regular or semi-bold               |
| Font size       | Matches surrounding text           |

**Usage:** "Forgot password?", "Read more", "Terms and Conditions", footer links.

### 7.4 CTA Hierarchy Rules

1. **One primary CTA per card/section** — the most important action (e.g., "SHOP NOW", "START BOOKING").
2. **Warm accent color** (`#E44D2E`) reserved for highest-urgency actions on the deals page.
3. **Blue primary** used for standard booking/login flows.
4. **Never two pill buttons side by side** — pair one primary pill with one text link or ghost button.

---

## 8. General Component Patterns

### 8.1 Cards

- Background: white.
- Border-radius: 4px.
- Shadow: subtle (`0 2px 8px rgba(0,0,0,0.08)`).
- Image fills top or left zone, no gap/padding between image and card edge.
- Content padding: 16–24px.

### 8.2 Expandable / Accordion Sections

- Trigger: text label + chevron-down icon.
- Chevron rotates 180° when expanded.
- Content slides in with smooth animation.
- Used for "The Fine Print" on deal cards, "View Details" toggles.

### 8.3 Badges & Tags

- Small pill-shaped labels.
- "Included" / "Additional" on activity cards.
- Offer codes displayed in muted text near fine print.
- Urgency badges: "Hurry! Ends Sunday" — bold, potentially warm accent color.

### 8.4 Image Treatment

- All images: high-quality photography, vibrant colors, lifestyle/destination focus.
- Aspect ratios: 16:9 for banners, 4:3 for card images, 1:1 for activity tiles.
- No visible borders on images — they bleed to card edges.
- Captions overlaid on bottom of images with semi-transparent dark gradient.

---

## 9. Responsive Behavior

| Breakpoint    | Behavior                                                    |
|---------------|-------------------------------------------------------------|
| **Desktop** (≥1024px) | Full navigation visible, deal cards horizontal, multi-column footer, split login |
| **Tablet** (768–1023px) | Navigation collapses to hamburger, cards stack, 2-column footer |
| **Mobile** (<768px)  | Full hamburger nav, single-column everything, full-width CTAs, stacked cards |

- Filters collapse into a "Filters" button opening a bottom sheet or modal on mobile.
- Image carousels become swipeable.
- Footer columns stack vertically.
- CTAs become full-width blocks on mobile.

---

## 10. Design Personality Summary

| Attribute       | Value                                              |
|-----------------|------------------------------------------------------|
| **Tone**         | Professional yet approachable — "vacation-ready"    |
| **Energy**       | Medium — confident, not aggressive                  |
| **Audience**     | Travel enthusiasts, families, vacationers           |
| **Visual feel**  | Clean, nautical, blue-dominant with warm CTA pops   |
| **Framework**    | Custom (Next.js based, no public component library) |
| **Key principle** | One dominant brand color + white/gray canvas = clarity and trust |