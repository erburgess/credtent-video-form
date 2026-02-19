# Design Ideas: Credtent Video Content Valuation Form

<response>
<idea>
**Design Movement:** Minimal Editorial — inspired by modern legal/financial intake forms (think Stripe, Linear)

**Core Principles:**
- Radical clarity: one question or section at a time, no visual noise
- Trust through restraint: white space signals professionalism
- Credtent brand anchoring: navy + orange as the only accent colors

**Color Philosophy:**
- Background: near-white (#F9FAFB)
- Section headers: deep navy (#1B2057)
- CTA / progress: Credtent orange (#F97316)
- Input borders: light gray, focus ring in navy

**Layout Paradigm:**
- Left-anchored single-column form with a sticky progress sidebar on the left
- Section headers float left, inputs fill the right column

**Signature Elements:**
- Thin orange progress bar at the top
- Section number badges in navy circles
- Pill-shaped radio/checkbox options instead of raw HTML inputs

**Interaction Philosophy:**
- Smooth section transitions (fade + slide up)
- Inline validation with gentle color shifts
- Completion checkmarks animate in

**Animation:**
- Sections fade in as user scrolls
- Progress bar animates on section completion

**Typography System:**
- Display: DM Sans Bold for section titles
- Body: DM Sans Regular for questions
- Labels: uppercase tracking-wide small caps
</idea>
<probability>0.08</probability>
</response>

<response>
<idea>
**Design Movement:** Structured Workbench — inspired by professional assessment tools (Typeform meets Notion)

**Core Principles:**
- Step-by-step wizard with clear section grouping
- Visual hierarchy through card-based sections
- Credtent brand colors used purposefully, not decoratively

**Color Philosophy:**
- White cards on a very light slate background
- Navy for section titles and active states
- Orange for progress, CTAs, and section icons
- Muted gray for helper text

**Layout Paradigm:**
- Multi-step wizard with a top progress stepper
- Each section is a card with a colored left border in navy
- Compact two-column layout for related short questions

**Signature Elements:**
- Colored left-border cards per section
- Icon + label section tabs at the top
- Toggle chips for yes/no and multi-select answers

**Interaction Philosophy:**
- Section-by-section navigation with back/next
- Smart defaults and pre-filled options reduce typing
- Summary review screen before submission

**Animation:**
- Card slide-in on section change
- Smooth progress stepper transitions

**Typography System:**
- Display: Space Grotesk Bold for headings
- Body: Space Grotesk Regular
- Micro-labels: uppercase 11px tracking
</idea>
<probability>0.09</probability>
</response>

<response>
<idea>
**Design Movement:** Clean Assessment Dashboard — inspired by SaaS intake forms (Airtable, Notion forms)

**Core Principles:**
- All sections visible on one scrollable page, grouped by theme
- Inputs are compact and friendly: sliders, chips, toggles over text boxes
- Credtent shield logo anchors the header

**Color Philosophy:**
- White background with light gray section dividers
- Navy headings, orange accents on active/hover states
- Green checkmarks for completed sections

**Layout Paradigm:**
- Single-page scroll with sticky section nav on the left
- Section groups use card containers with subtle shadows
- Short questions use inline chip selectors; longer ones use compact text areas

**Signature Elements:**
- Sticky left nav with section completion dots
- Chip-based multi-select for genres, formats, demographics
- Collapsible advanced sections to reduce visual weight

**Interaction Philosophy:**
- Progressive disclosure: basic questions first, advanced optional
- Chips and toggles replace most free-text inputs
- Live completion percentage in the header

**Animation:**
- Smooth scroll to section on nav click
- Completion percentage counter animates

**Typography System:**
- Display: Sora Bold for section titles
- Body: Sora Regular
- Helper text: italic muted gray
</idea>
<probability>0.07</probability>
</response>

## Selected Approach: Option 3 — Clean Assessment Dashboard

Chosen for its balance of completeness (all sections visible) and friendliness (chips, toggles, sliders replace heavy text inputs). The sticky left nav gives users orientation without a rigid wizard flow, and the progressive disclosure keeps the form light despite covering 7+ sections.
