# TERRAWISE AI — Design System & Visual Specification

**Theme**: "A Living Farm Window" — Golden Hour on a Maharashtra Farm  
**Target User**: Smallholder farmers in Ahilya Nagar (Ahmednagar) & Nashik, Maharashtra  
**Design Principle**: Simple enough for a farmer, and for a child, to read. High-contrast, Grade-4 Marathi first, real data only.

---

## 1. Color Palette (Maharashtra Agro-Ecosystem)

| Token Name | Hex Code | Semantic Role | Accessibility (WCAG) |
| :--- | :--- | :--- | :--- |
| **Cream Paper** | `#F6EFDF` | Main card background, soft parchment feel | Base background |
| **Forest Green** | `#1F4D2B` | Primary actions, branding, safe indicators | AAA on `#F6EFDF` (> 8.5:1) |
| **Deep Forest** | `#143820` | Hover states, card text, dark headers | AAA on light grounds |
| **Leaf Emerald** | `#4C8B3F` | Secondary badges, moisture-good status | AA on white / dark |
| **Soil Brown** | `#7A4E2D` | Earthy borders, land identifiers | AA on `#F6EFDF` |
| **Marigold Gold** | `#F2A93B` | Sun accents, warnings, demo badges | High visibility |
| **Water Teal** | `#2A7F8E` | Satellite hydrology, irrigation feeds | High visibility |
| **Night Indigo** | `#141B34` | Night backdrop, deep twilight skies | AAA background |
| **Danger Rose** | `#BE123C` | Pest outbreaks, severe drought alerts | AAA on light grounds |

---

## 2. Typography & Devanagari Scale

- **Primary Font**: `Noto Sans Devanagari` (embedded, self-hosted fallback to system sans-serif).
- **Rule R2 & R5 Compliance**:
  - Base body text: **18px or larger** (`1.125rem` minimum).
  - Devanagari line-height: **1.6 minimum** (no tight letter-spacing on Devanagari characters).
  - Headings: Bold, confident, high contrast.
  - Numbers: Monospace or tabular figures with unambiguous units (`°C`, `मिमी`, `एकर`).

---

## 3. Dynamic Astronomical Sun Engine (`sunEngine.ts`)

Solar position calculated for the pilot centroid (19.9975° N, 73.7898° E, UTC+5:30):

```
       Altitude (deg)        Azimuth (deg)      Phase Name
Dawn:        0° to 9°         85° to 105°       पहाट (Dawn)
Morning:    10° to 50°       105° to 160°       सकाळ (Morning)
Midday:     55° to 75°       165° to 235°       दुपार (Midday)
Golden Hour: 5° to 25°       240° to 265°       सुवर्ण संध्याकाळ (Golden Hour)
Dusk:       -6° to 3°        270° to 285°       सायंकाळ (Dusk)
Night:      < -6°              N/A              रात्र (Night)
```

- **Dynamic Shadows**: Box-shadow offsets are computed opposite to sun azimuth:
  `shadowX = -sin(azimuth) * 14px`, `shadowY = cos(azimuth) * 10px + 12px`.
- **Dynamic Sky Tint**: Radial gradients follow the sun's trajectory across the screen.

---

## 4. Two Render Tiers (Full & Lite)

1. **Full Tier**:
   - `backdrop-blur-xl` frosted glass card (`rgba(246, 239, 223, 0.94)`).
   - Sun-azimuth dynamic shadow displacement.
   - Ambient particle canvas (subtle floating dust motes during day, glowing fireflies at night).
   - Smooth 1000ms cross-fades between time phases.

2. **Lite Tier**:
   - Zero canvas loop; zero GPU particle overhead.
   - Solid cream card (`#F6EFDF`) with static shadow.
   - Reduced motion, instant transitions.
   - Optimized for low-end Android phones (2G/3G networks, low RAM).

---

## 5. Clean Input Paradigm (No Demo Clutter)

- **Main Login Card**:
  - Farmer ID input with auto-formatting (`AHN-001`, `NSK-001`).
  - Example hint: `उदा. AHN-001 किंवा NSK-001`.
  - Zero hardcoded demo buttons on the primary card.
- **Evaluator & Demo Drawer**:
  - Accessed discreetly via keyboard shortcut `D` or URL parameter `?demo=1`, or clicking the subtle `✨ प्रात्यक्षिक चाचणी व माहिती` footer trigger.
  - Includes instant 1-click credential fill and 24-hour Sun Scrubber slider.

---

## 6. Real Data & Provenance Guarantee (Rules R1, R2, R3, R4)

- Every figure displays live source attribution and timestamp:
  - Weather: `Open-Meteo API` (live fetch, 3-hour cache fallback).
  - Soil Water & Solar Radiation: `NASA POWER` satellite agroclimatology.
  - Crop Agronomy: `MPKV Rahuri` (Mahatma Phule Krishi Vidyapeeth) Package of Practices.
  - Pest Surveillance: `CROPSAP` (Maharashtra Agriculture Dept).
- `null` strictly renders as "माहिती नाही" (No data); never coerced to `0`.
