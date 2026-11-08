# DESIGN CONTEXT — EduAlert Design System

*Crafted in accordance with the [Impeccable](https://github.com/pbakaus/impeccable) visual craftsmanship and anti-slop guidelines.*

## 1. Visual Philosophy: The Academic Diagnostic Ledger
- **Core Metaphor:** A hybrid of an **Official University Registrar's Seal of Record** and a **Modern Scientific Computing Diagnostic Terminal**.
- **The Anti-AI-Slop Manifesto:**
  - ❌ **No Inter-for-everything:** Uses an authoritative academic serif (`Charter`, `Bitstream Charter`, `Cambria`, `Georgia`) for institutional credibility, headings, and stamps; paired with a crisp system sans-serif and tabular monospace numerals for metrics and tables.
  - ❌ **No generic purple-to-blue neon gradients:** The palette is grounded in authentic institutional paper and ink (`#0F172A` Slate Ink, `#F8FAFC` Archival Paper, `#1E3A8A` Academic Blue).
  - ❌ **No cards nested inside cards:** Flat surfaces differentiated by purposeful hairline dividers (`#E2E8F0`), subtle elevation, and crisp typographic weight.
  - ❌ **No low-contrast gray text on colored badges:** High-contrast WCAG AAA compliance across all alert states.

## 2. Color Palette & Semantic Tokens

```css
:root {
  /* Surfaces & Paper */
  --surface-paper: #F8FAFC;       /* Off-white archival canvas */
  --surface-card:  #FFFFFF;       /* Crisp white functional container */
  --surface-subtle:#F1F5F9;       /* Light neutral fill for table headers */
  --line-hairline: #E2E8F0;       /* 1px structural boundary */
  --line-strong:   #CBD5E1;       /* Emphasized divider */

  /* Ink & Typography */
  --ink-primary:   #0F172A;       /* Slate 900 — Maximum readability */
  --ink-secondary: #475569;       /* Slate 600 — Metadata, captions */
  --ink-muted:     #94A3B8;       /* Slate 400 — Disabled, placeholders */

  /* Academic Authority */
  --academic-blue: #1E3A8A;       /* Blue 900 — Official university brand */
  --academic-soft: #EFF6FF;       /* Blue 50 — Stamp background, highlights */
  --academic-glow: rgba(30,58,138,0.12);

  /* Regulatory & Triage Signals (High Contrast) */
  --signal-red-ink:    #991B1B;   /* Red 800 — Violated regulations / High Risk */
  --signal-red-bg:     #FEF2F2;   /* Red 50 — Alert container */
  --signal-red-line:   #FECACA;   /* Red 200 — Alert border */

  --signal-yellow-ink: #92400E;   /* Amber 800 — Early Model Warning */
  --signal-yellow-bg:  #FFFBEB;   /* Amber 50 — Warning container */
  --signal-yellow-line:#FDE68A;   /* Amber 200 — Warning border */

  --signal-green-ink:  #166534;   /* Green 800 — Stable academic standing */
  --signal-green-bg:   #F0FDF4;   /* Green 50 — Normal container */
  --signal-green-line: #BBF7D0;   /* Green 200 — Normal border */
}
```

## 3. Signature UI Component: The Circular Registrar Risk Stamp
The signature visual element of EduAlert is the **Rotated Double-Ring Assessment Stamp (`.stamp`)**:
- **Geometry:** 168px circular badge with a `3.5px double currentColor` border.
- **Physicality:** Subtle `-5.5deg` rotation simulating an authentic ink stamp pressed onto an official transcript.
- **Content Hierarchy:**
  1. Top arc: University designation / System name in uppercase tracked serif.
  2. Center: Large tabular probability figure (`78%`) in heavy serif figures.
  3. Bottom arc: Risk Level (`NGUY CƠ CAO` / `CẦN CHÚ Ý` / `BÌNH THƯỜNG`) and regulatory status.

## 4. Diagnostic Factor Attribution Bars (`.fbar`)
- **Zero-Center Baseline:** A vertical centerline marks zero contribution ($0.0$).
- **Bidirectional Deltas:**
  - Positive risk factors extend **rightward** in red (`var(--signal-red-ink)`), indicating parameters increasing the student's risk (e.g. GPA drop, high debt credits).
  - Protective factors extend **leftward** in green (`var(--signal-green-ink)`), indicating safety buffers (e.g. strong entrance score, stable credit progress).
- **Tabular Figures:** Numbers formatted with `font-variant-numeric: tabular-nums` to ensure exact column alignment.

## 5. Responsive & Tactile Interaction Principles
- **Micro-interactions:** Buttons have a `1px` downward translate on `:active` with immediate tactile response.
- **Data Density:** High information density without visual crowding. Tables utilize clean row-hover highlights (`#F8FAFC`) and monospace alignment for all numerical metrics.
- **Interactive SVG Graphs:** Network nodes scale on hover with dynamic halo rings; edges display Sheaf Attention weights $\alpha_{vu}$ with directional transport indicators.
