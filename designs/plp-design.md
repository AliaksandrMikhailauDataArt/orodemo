# Carnival Cruise Line — Deals Search Section Design Guidelines

> **Scope:** Desktop only. Covers the deals filter panel (left column) and deal card listing (right column).  
> **Source:** [carnival.com/cruise-deals-2025](https://www.carnival.com/cruise-deals-2025)  
> **Scraped:** March 2026

---

## 1. Brand Tokens

### 1.1 Color Palette

| Token | Hex | Usage |
|---|---|---|
| **Primary / Brand Blue** | `#10559A` | Headings, links, filter titles, chevron icons, text accents |
| **Page Background** | `#F1F4F9` | Light gray-blue page background behind the entire deals section |
| **Card Background** | `#FFFFFF` | Deal card surfaces, filter panel surface |
| **Accent Red (Checkmark)** | `#DC1125` | Benefit checkmark SVG icons |
| **CTA Gradient Start** | `#0057B8` | "SHOP NOW" button gradient — left/top stop (deep blue) |
| **CTA Gradient End** | `#00B2E3` | "SHOP NOW" button gradient — right/bottom stop (bright cyan) |
| **Text Primary** | `#10559A` | Primary text throughout the section |
| **Text Dark** | `#333333` | Body/secondary text fallback |
| **Border / Divider** | `#D6DCE5` | Filter dropdown borders, card inner dividers |
| **Clear All Link** | `#10559A` | "Clear all" interactive text in filter header |

### 1.2 Typography

| Role | Font Stack | Weight | Size |
|---|---|---|---|
| **Filter Header ("Filters")** | `Open Sans, Helvetica, sans-serif` | 700 (Bold) | 18px |
| **Filter Dropdown Title** (e.g. "Sort By:", "Sail To") | `Open Sans, Helvetica, sans-serif` | 600 (SemiBold) | 14px |
| **Filter Dropdown Subtitle** (e.g. "Recommended") | `Open Sans, Helvetica, sans-serif` | 400 (Regular) | 14px |
| **Deal Card Title (h3)** | `Open Sans, Helvetica, sans-serif` | 700 (Bold) | 18px |
| **Benefit Item Text** | `Open Sans, Helvetica, sans-serif` | 400 (Regular) | 14px |
| **Price Amount** | `Open Sans, Helvetica, sans-serif` | 800 (ExtraBold) | 32px |
| **Price Label** ("average per person") | `Open Sans, Helvetica, sans-serif` | 400 (Regular) | 12px |
| **CTA Button Text** ("SHOP NOW") | `Open Sans, Helvetica, sans-serif` | 700 (Bold) | 14px, uppercase, letter-spacing ~1px |
| **Results Count** ("11 Deals") | `Open Sans, Helvetica, sans-serif` | 700 (Bold) | 16px |
| **Taxes Disclaimer** | `Open Sans, Helvetica, sans-serif` | 400 (Regular) | 12px |
| **View Details Toggle** | `Open Sans, Helvetica, sans-serif` | 600 (SemiBold) | 12px |
| **Fine Print Label** | `Open Sans, Helvetica, sans-serif` | 600 (SemiBold) | 12px |
| **Fine Print Items** | `Open Sans, Helvetica, sans-serif` | 400 (Regular) | 12px |
| **"Clear all" text** | `Open Sans, Helvetica, sans-serif` | 400 (Regular) | 14px |

### 1.3 Spacing & Sizing

| Token | Value |
|---|---|
| **Base spacing unit** | 4px |
| **Card border-radius** | 8px |
| **Button border-radius** | 20px (pill-shaped) |
| **Filter dropdown border-radius** | 0px (square edges) |
| **Card image aspect ratio** | ~16:9 |
| **Card image height (desktop)** | ~200px |
| **Card gap (between deal cards)** | 24px |
| **Filter-to-results gap** | 24px |
| **Section horizontal padding** | 24px (inside max-width container) |
| **Max content width** | ~1200px, centered |

---

## 2. Page Layout (Desktop)

```
┌─────────────────────────────────────────────────────────┐
│                   [Page Background #F1F4F9]              │
│  ┌──────────────┐  ┌─────────────────────────────────┐  │
│  │              │  │  Results Disclaimer Bar          │  │
│  │  FILTER      │  │  "11 Deals"  ·  "*Starting..."  │  │
│  │  PANEL       │  ├─────────────────────────────────┤  │
│  │              │  │  Deal Card 1                     │  │
│  │  ~240px      │  ├─────────────────────────────────┤  │
│  │  width       │  │  Deal Card 2                     │  │
│  │              │  ├─────────────────────────────────┤  │
│  │  sticky/     │  │  [VIFP Login Invitation Card]    │  │
│  │  scrollable  │  ├─────────────────────────────────┤  │
│  │              │  │  Deal Card 3                     │  │
│  │              │  ├─────────────────────────────────┤  │
│  │              │  │  Deal Card 4                     │  │
│  │              │  │  ...                             │  │
│  └──────────────┘  └─────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

- **Two-column flexbox layout** with left filter panel and right results area
- Filter panel width: **~240px**, fixed/sticky as user scrolls
- Results area: **flex-grow: 1**, takes remaining width
- Gap between columns: **24px**

---

## 3. Filter Panel (Left Column)

### 3.1 Header

```
┌──────────────────────────┐
│  Filters      Clear all  │
└──────────────────────────┘
```

- Header displays "**Filters**" label (bold, 18px, `#10559A`) left-aligned
- "**Clear all**" link right-aligned, same row; color `#10559A`, 14px regular, underlined on hover
- A subtle bottom border separates header from dropdown list

### 3.2 Filter Dropdown Items

Each filter is a collapsible accordion row:

```
┌──────────────────────────────────┐
│  Sort By:  Recommended       ▼   │
├──────────────────────────────────┤
│  Sail To                     ▼   │
├──────────────────────────────────┤
│  Sail From                   ▼   │
├──────────────────────────────────┤
│  Dates                       ▼   │
├──────────────────────────────────┤
│  Duration                    ▼   │
├──────────────────────────────────┤
│  Number of Guests            ▼   │
├──────────────────────────────────┤
│  Special Rates               ▼   │
├──────────────────────────────────┤
│  Ships                       ▼   │
├──────────────────────────────────┤
│  Vacation Budget             ▼   │
├──────────────────────────────────┤
│  Specialty Sailings          ▼   │
└──────────────────────────────────┘
```

**Filter List (10 items in order):**
1. Sort By: (shows subtitle value, e.g. "Recommended")
2. Sail To
3. Sail From
4. Dates
5. Duration
6. Number of Guests
7. Special Rates
8. Ships
9. Vacation Budget
10. Specialty Sailings

**Visual Spec per Row:**
- Each row is a horizontal flex container:
    - **Left:** Title label (`14px`, SemiBold, `#10559A`). For "Sort By:" there is also a subtitle value below/beside in Regular weight.
    - **Right:** Chevron icon (▼), `16×16px` SVG, filled `#10559A`, rotates 180° on expand
- Row padding: `12px 0` vertical, full-width horizontally
- Separator: `1px solid #D6DCE5` between items
- **Closed state:** Single-line row with title + chevron
- **Expanded state:** Reveals filter options below (checkboxes, radio buttons, or calendar picker depending on filter type)
- `aria-expanded` toggles on the chevron button
- **Background:** White (`#FFFFFF`) same as card/panel background
- No border-radius on individual dropdown items

---

## 4. Results Area (Right Column)

### 4.1 Results Disclaimer Bar

Sits above the deal card list, spans the full width of the right column.

```
┌──────────────────────────────────────────────────────────┐
│  11 Deals                *Starting price in USD. Taxes   │
│                          and fees are included.          │
└──────────────────────────────────────────────────────────┘
```

- Left: **"N Deals"** heading (`h2`, 16px, Bold, `#10559A`)
- Right: Disclaimer text (`12px`, Regular, muted text color)
- Flex row, `justify-content: space-between`, `align-items: center`
- Bottom margin: ~16px before first deal card

### 4.2 Deal Card

Each deal is a white card on the `#F1F4F9` background.

#### Card Layout (Horizontal on Desktop)

```
┌───────────────────────────────────────────────────────────┐
│ ┌────────────┐  ┌─────────────────────────┐  ┌─────────┐ │
│ │            │  │  DEAL TITLE (h3, link)   │  │  $174*  │ │
│ │   DEAL     │  │                          │  │ average │ │
│ │   IMAGE    │  │  ✔ Benefit line 1        │  │   per   │ │
│ │            │  │  ✔ Benefit line 2        │  │ person  │ │
│ │  (~200px   │  │  ✔ Benefit line 3        │  │         │ │
│ │   wide)    │  │                          │  │ ┌─────┐ │ │
│ │            │  │  ▼ View Details           │  │ │SHOP │ │ │
│ │            │  │                          │  │ │ NOW │ │ │
│ └────────────┘  └─────────────────────────┘  │ └─────┘ │ │
│                                               └─────────┘ │
└───────────────────────────────────────────────────────────┘
```

**Three-part horizontal structure:**

1. **Image container** (~30% width):
    - Full-height image, `object-fit: cover`
    - Images are lifestyle/cruise photos
    - Wrapped in `<a>` link to cruise search
    - Border-radius: top-left and bottom-left `8px`

2. **Content container** (~50% width):
    - **Offer title** (`h3`): 18px Bold, `#10559A`, clickable link
    - **Benefits list** (`<ul>`): Each item is a flex row:
        - Red checkmark SVG icon (16×16px, `#DC1125`) on the left
        - Benefit text (14px Regular) on the right
        - Gap between icon and text: `8px`
        - First 3 benefits visible by default; additional ones hidden (`aria-hidden="true"`)
    - **"View Details" toggle**: 12px SemiBold, `#10559A`, with a small chevron-down image (14×8px) that rotates on expand. Reveals additional benefits and "The Fine Print" section
    - **Fine Print section** (hidden by default):
        - "The Fine Print" label (12px SemiBold)
        - Offer code text (12px Regular)
        - "Terms and Conditions" link (opens new tab)

3. **Price & CTA container** (~20% width):
    - Vertically centered, right-aligned
    - **Price**: `$NNN*` — 32px ExtraBold, `#10559A`
    - Asterisk `*` superscript beside price
    - **Label**: "average per person" — 12px Regular, muted
    - **"SHOP NOW" button** — see §4.3 below

**Card Styling:**
- Background: `#FFFFFF`
- Border-radius: `8px`
- Box-shadow: subtle `0 2px 8px rgba(0,0,0,0.08)`
- Card gap between cards: `24px`
- Internal padding: `0` (image bleeds to edges; content sections have their own padding ~16–20px)

### 4.3 "SHOP NOW" Button (Gradient CTA)

This is the most distinctive interactive element. It's an `<a>` tag styled as a button.

```css
/* Reconstructed CSS for SHOP NOW button */
.shop-now-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 24px;
  min-width: 140px;

  /* ★ GRADIENT BACKGROUND — key visual feature */
  background: linear-gradient(135deg, #0057B8 0%, #00B2E3 100%);

  color: #FFFFFF;
  font-family: 'Open Sans', Helvetica, sans-serif;
  font-weight: 700;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 1px;
  text-decoration: none;

  border: none;
  border-radius: 20px;  /* pill shape */
  cursor: pointer;

  transition: opacity 0.2s ease, box-shadow 0.2s ease;
}

.shop-now-btn:hover {
  opacity: 0.9;
  box-shadow: 0 4px 12px rgba(0, 87, 184, 0.3);
}
```

- **Gradient direction:** ~135° (top-left → bottom-right)
- **From:** `#0057B8` (Carnival deep blue)
- **To:** `#00B2E3` (bright cyan/teal)
- **Shape:** Fully rounded pill (`border-radius: 20px`)
- **Text:** "SHOP NOW", white, bold uppercase with letter-spacing
- **Size:** Approximately `140×40px`
- **Hover:** Slight opacity reduction + blue-tinted shadow

### 4.4 VIFP Login Invitation Card

Inserted between deal cards (after 2nd deal). A special card variant.

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│    VIFP Club                                             │
│    LOG IN TO                                             │
│    SEE MY DEALS                                          │
│                                                          │
│    [ LOG IN ]      Create Account                        │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

- Same card dimensions as deal cards
- "VIFP Club" — small text label
- "LOG IN TO SEE MY DEALS" — large bold text
- **"LOG IN" button** — styled with the same gradient as SHOP NOW
- **"Create Account"** — text link, underlined, `#10559A`
- Background: white or light blue tint
- This card has no image section — it's full-width text/CTA content

---

## 5. Interactive States

### 5.1 Filter Dropdown
- **Closed:** Title row + right-aligned chevron (pointing down)
- **Open:** Chevron rotates 180° (pointing up), options revealed below with a slide/fade animation
- **Selected filter:** Subtitle text appears next to title (like "Sort By: Recommended")

### 5.2 Deal Card
- **Default:** White card, subtle shadow
- **Hover on image:** Slight zoom or brightness increase (CSS transform/filter)
- **Hover on title link:** Underline appears
- **"View Details" collapsed:** Shows 3 benefit items
- **"View Details" expanded:** Shows all benefit items + Fine Print section; chevron rotates upward

### 5.3 SHOP NOW Button
- **Default:** Blue-to-cyan gradient
- **Hover:** Slight darkening / shadow increase
- **Active/Pressed:** Slightly darker gradient shift
- **Focus:** Blue outline ring for accessibility

---

## 6. Key SVG Icons

### 6.1 Chevron Down (Filter Dropdowns)
- Size: 16×16px
- Color fill: `#10559A`
- Used in all filter dropdown rows

### 6.2 Red Checkmark (Benefits)
- Size: 16×16px
- Color fill: `#DC1125`
- Used as bullet marker for each benefit item in deal cards

### 6.3 Chevron Down (View Details Toggle)
- Size: 14×8px (wider, shorter variant)
- Raster image (PNG), loaded from CDN
- Rotates on expand

---

## 7. Data-Testid Reference Map

Key `data-testid` attributes for QA and development reference:

| Element | data-testid |
|---|---|
| Content container (whole section) | `content-container` |
| Filter panel wrapper | `filter-panel-contianer` (note: typo in original) |
| Filter header title | `filterHeaderTitle` |
| Clear all button | `filterclearAllButton` |
| Filters wrapper | `filtersContainer` |
| Sort By dropdown | `sortByFilterDropdown` |
| Sail To dropdown | `sailToFilterDropdown` |
| Sail From dropdown | `sailFromFilterDropdown` |
| Dates dropdown | `datesFilterDropdown` |
| Duration dropdown | `durationFilterDropdown` |
| Number of Guests dropdown | `numberOfGuestsFilterDropdown` |
| Special Rates dropdown | `qualifiersFilterDropdown` |
| Ships dropdown | `shipsFilterDropdown` |
| Vacation Budget dropdown | `vacationBudgetFilterDropdown` |
| Specialty Sailings dropdown | `specialtySailingsFilterDropdown` |
| Results container | `results-container` |
| Results disclaimer | `results-disclaimer-container` |
| Total results count | `totalResults` |
| Taxes disclaimer | `taxes-disclaimer` |
| Deal card list | `deal-card-list-container` |
| Deal card (by code) | `deal-card-{CODE}` (e.g. `deal-card-PEG`) |
| Deal card container | `deal-card-container` |
| Deal image container | `deal-image-container` |
| Deal image link | `deal-image-link` |
| Offer title container | `offer-title-container` |
| Offer title link | `offer-title-link` |
| Benefits container | `benefits-container` |
| Benefits item | `benefits-item-container` |
| Benefits item text | `benefits-item-text` |
| Fine print container | `fine-print-container` |
| View Details toggler | `offer-benefits-section-toggler` |
| Price container | `deal-price-and-select-button-container` |
| Price amount | `offer-price` |
| Price text | `offer-price-text` |
| SHOP NOW button | `selectDealButton` |
| VIFP login card | `login-invitation-card` |
| VIFP login button | `login-invitation-button` |
| Create Account link | `create-account-button` |

---

## 8. Styled Components Class Prefix Reference

The site uses **styled-components** (CSS-in-JS). Key class prefixes for reverse-engineering:

| Component | Prefix |
|---|---|
| App shell | `shell-styles__*` |
| Filter panel | `filter-panel-style__*` |
| Filter dropdowns | `filter-dropdown-styles__*` |
| Filter option list | `filter-option-list-style__*` |
| Deal card list | `deal-card-list-style__*` |
| Deal card | `deal-card-style__*` |
| Benefits list | `benefits-style__*` |
| Fine prints | `fine-prints-style__*` |
| Section toggler | `section-toggler-styles__*` |
| Results disclaimer | `results-disclaimer-style__*` |
| Login invitation card | `login-invitation-card-style__*` |
| CTA buttons/anchors | `esm__Anchor-*`, `esm__Button-*` |

---

## 9. Component Hierarchy Summary

```
ContentContainer
├── FilterPanelContainer (~240px, sticky)
│   ├── FilterHeader
│   │   ├── "Filters" label
│   │   └── "Clear all" button
│   └── FiltersWrapper
│       ├── SortByFilterDropdown (with subtitle)
│       ├── SailToFilterDropdown
│       ├── SailFromFilterDropdown
│       ├── DatesFilterDropdown
│       ├── DurationFilterDropdown
│       ├── NumberOfGuestsFilterDropdown
│       ├── QualifiersFilterDropdown ("Special Rates")
│       ├── ShipsFilterDropdown
│       ├── VacationBudgetFilterDropdown
│       └── SpecialtySailingsFilterDropdown
│
└── ResultsContainer (flex-grow)
    ├── ResultsDisclaimerBar
    │   ├── "N Deals" (h2)
    │   └── Taxes disclaimer text
    │
    └── DealCardListContainer
        ├── DealGroup[0]  →  DealCard (code=PEG)
        ├── DealGroup[1]  →  DealCard (code=PUG)
        ├── DealGroup[2]  →  VIFPLoginInvitationCard
        ├── DealGroup[3]  →  DealCard (code=HCA)
        ├── DealGroup[4]  →  DealCard (code=HCB)
        ├── DealGroup[5]  →  DealCard (code=O7L)
        ├── DealGroup[6]  →  DealCard (code=OS5)
        ├── DealGroup[7]  →  DealCard (code=PHY)
        ├── DealGroup[8]  →  DealCard (code=O4S)
        ├── DealGroup[9]  →  DealCard (code=O6Y)
        └── DealGroup[10] →  DealCard (code=O6Z)
```

Each `DealCard` internally:
```
DealCard
├── DealImageContainer
│   └── DealImageLink > img
├── CouponCodeAndContentContainer
│   └── DealContentContainer
│       ├── OfferTitleContainer > h3 > a
│       ├── BenefitsContainer > ul > li[] (checkmark + text)
│       ├── FinePrintsContainer (hidden by default)
│       │   ├── "The Fine Print" label
│       │   ├── Offer Code
│       │   └── Terms and Conditions link
│       └── TogglerBenefitsContainer > "View Details" button
└── DealPriceAndSelectButtonContainer
    ├── OfferPrice ("$NNN*")
    ├── "average per person" label
    └── SHOP NOW (gradient pill button/link)
```