---
name: Obsidian Command
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1b1b1b'
  surface-container: '#1f1f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353535'
  on-surface: '#e2e2e2'
  on-surface-variant: '#c4c7c7'
  inverse-surface: '#e2e2e2'
  inverse-on-surface: '#303030'
  outline: '#8e9192'
  outline-variant: '#444748'
  surface-tint: '#c6c6c6'
  primary: '#dcdcdc'
  on-primary: '#2f3131'
  primary-container: '#c0c0c0'
  on-primary-container: '#4d4e4f'
  inverse-primary: '#5d5e5f'
  secondary: '#c8c6c6'
  on-secondary: '#303030'
  secondary-container: '#474747'
  on-secondary-container: '#b6b5b4'
  tertiary: '#dedcdb'
  on-tertiary: '#313030'
  tertiary-container: '#c2c0bf'
  on-tertiary-container: '#4f4e4e'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e3e2e2'
  primary-fixed-dim: '#c6c6c6'
  on-primary-fixed: '#1a1c1c'
  on-primary-fixed-variant: '#464747'
  secondary-fixed: '#e4e2e1'
  secondary-fixed-dim: '#c8c6c6'
  on-secondary-fixed: '#1b1c1c'
  on-secondary-fixed-variant: '#474747'
  tertiary-fixed: '#e5e2e1'
  tertiary-fixed-dim: '#c8c6c5'
  on-tertiary-fixed: '#1c1b1b'
  on-tertiary-fixed-variant: '#474746'
  background: '#131313'
  on-background: '#e2e2e2'
  surface-variant: '#353535'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  mono-data:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 48px
  gutter: 20px
  margin-edge: 32px
---

## Brand & Style

The design system is engineered for high-performance sales automation. It targets professional merchants and data analysts who require a sophisticated, high-density interface that prioritizes speed and clarity. The brand personality is authoritative and precise, utilizing a **Sleek Dark Mode** aesthetic.

The visual style leans into a **Modern Corporate** approach with elements of **Glassmorphism** and **Minimalism**. It avoids unnecessary ornamentation, focusing instead on structural integrity and technical elegance. The emotional response is one of controlled power—the user should feel they are operating a high-end command center where AI insights are presented with surgical precision.

## Colors

The palette is a monochromatic study in depth and contrast. 
- **Deep Black (#000000)** serves as the infinite canvas, providing the ultimate contrast for data visualization.
- **Charcoal (#1A1A1A)** and **Ash Grey (#2F2F2F)** are used for surface layering, creating a clear hierarchy of containers without relying on heavy shadows.
- **Silver (#C0C0C0)** acts as the primary action color, used sparingly for high-priority interactive elements, icons, and primary buttons to ensure they "pop" against the dark background.
- Functional colors (Success/Warning/Error) should be desaturated to maintain the sophisticated mood while remaining legible.

## Typography

The design system utilizes **Inter** for its systematic, utilitarian nature, ensuring maximum readability in dense data environments. For technical data points and labels, **Geist** is introduced to provide a "developer-tool" feel, emphasizing the AI-powered technical core of the platform.

- **Headlines:** Use tight letter spacing and semi-bold weights to command attention.
- **Body Text:** Standard weights with generous line height to prevent eye fatigue during long sessions.
- **Data Views:** Use the `mono-data` role for table figures, timestamps, and ID strings to ensure vertical alignment and a technical aesthetic.

## Layout & Spacing

The layout follows a **Fixed Grid** philosophy for desktop to maintain the integrity of complex data dashboards, transitioning to a fluid model for mobile.

- **Desktop:** 12-column grid with a max-width of 1440px. 20px gutters. 32px outer margins.
- **Tablet:** 8-column grid with 16px gutters and 24px margins.
- **Mobile:** 4-column grid with 12px gutters and 16px margins.

Spacing follows a strict 4px base unit. Component internal padding should lean towards "compact" to maximize the information density necessary for a sales automation platform.

## Elevation & Depth

Depth is achieved through **Tonal Layers** and **Low-Contrast Outlines** rather than heavy shadows. 

- **Level 0 (Canvas):** Deep Black (#000000).
- **Level 1 (Cards/Sidebar):** Charcoal (#1A1A1A). Defined by a 1px solid border of Ash Grey (#2F2F2F).
- **Level 2 (Modals/Popovers):** Ash Grey (#2F2F2F). These elements use a subtle 10% opacity Silver (#C0C0C0) border to distinguish them from the background.
- **Interactive States:** Use a soft "inner glow" or a very subtle background-blur (Glassmorphism) when elements are hovered, creating a sense of tactile responsiveness without breaking the sleek, flat aesthetic.

## Shapes

The shape language is **Soft (0.25rem)**. This slight rounding takes the edge off the brutalist tendencies of an all-black interface while maintaining a sharp, professional look. 

- **Small Components:** Checkboxes, tags, and small buttons use the base 4px (0.25rem) radius.
- **Large Containers:** Dashboard cards and main content areas use 8px (0.5rem) to provide a clearer structural definition.
- **Search Bars:** Should remain consistent with the 4px radius; avoid pill shapes to keep the professional, high-tech tone.

## Components

- **Buttons:** Primary buttons are Silver (#C0C0C0) with black text. Secondary buttons are transparent with a 1px Ash Grey border and Silver text.
- **Inputs:** Fields are Charcoal (#1A1A1A) with a 1px Ash Grey border. Upon focus, the border transitions to Silver with a subtle outer glow.
- **Data Tables:** High-density rows with 1px horizontal borders in Charcoal. Alternate row striping is not used; instead, use hover highlights in Ash Grey.
- **Chips/Badges:** Small, rectangular with 4px radius. Use Charcoal backgrounds with muted text colors for status (e.g., desaturated green for "Active").
- **KPI Cards:** Feature large `display-lg` numbers in Silver, paired with `label-caps` descriptions. Include a subtle linear gradient background (Top: #1A1A1A to Bottom: #000000).
- **AI Insight Component:** A specific component styled with a very thin (0.5px) Silver border and a faint Backdrop Blur to signify "AI-generated" content, separating it from standard data.