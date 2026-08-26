# Design System

Visual specification derived from the Al-Jabr landing page mockup.

Brand personality: **playful but credible**. It has to reassure a paying parent
and appeal to a child at the same time. The ocean/octopus theme carries the warmth;
the typography and structure carry the credibility. Never let the playfulness
undermine the sense that this is a serious academic service.

---

## 1. Colour

Values are read from the mockup and should be treated as the starting palette.

### Core

| Token | Hex | Use |
|---|---|---|
| `--blue-600` | `#1B4FD8` | Primary buttons, links, the deep wave section |
| `--blue-700` | `#153FAE` | Button hover, wave depth layering |
| `--navy-900` | `#152A5E` | Headings, body text on light backgrounds |
| `--amber-500` | `#F5A623` | Accent: highlighted words, script text, mascot |
| `--amber-400` | `#FBBF4C` | Icon fills, softer accents |
| `--cream-50` | `#FDFBF5` | Page background |
| `--white` | `#FFFFFF` | Cards, floating panels |

### Support

| Token | Hex | Use |
|---|---|---|
| `--blue-50` | `#EEF3FE` | Tinted section backgrounds, icon circles |
| `--blue-100` | `#D8E3FB` | Card borders, dividers, tab rails |
| `--slate-500` | `#5A6785` | Secondary body copy, captions |

### Rules

- Blue and amber are the only two brand colours. Do not introduce a third hue.
- Amber is an **accent**, never a surface. Use it for a highlighted word, an icon,
  a mascot, a small badge — never a full-width background.
- On the deep blue section, text is white and the accent stays amber.
- Body copy on cream uses `--navy-900`, not pure black.

---

## 2. Typography

Three roles, three treatments.

### Display / headings

Heavy geometric sans, tight leading, large size jumps. Poppins or Nunito Sans
at weight 700–800 matches the mockup.

- H1: 56–64px, weight 800, leading 1.05
- H2: 40–44px, weight 800, leading 1.15
- H3: 22–24px, weight 700

The H1 mixes colour inside one sentence: most of it `--navy-900`, the emphasised
phrase in `--amber-500` with a hand-drawn underline swash beneath it.

### Script accent

A casual handwritten face (Caveat, Kalam) in `--amber-500`, used **sparingly** —
one short phrase above a section heading, or as a label on an illustration.

Seen on: "Not just tutoring.", "Emotional awareness", "Adaptability",
"Thoughtful innovation".

Never set a full sentence or any body copy in the script face.

### Body

Same sans family as the headings at weight 400–500.

- Lead paragraph: 17–18px, leading 1.6
- Body: 15–16px, leading 1.6
- Caption / eyebrow: 13–14px, weight 600, sometimes uppercase

---

## 3. Shape and depth

- **Corner radius**: 16px on cards, 24px on large panels, fully rounded
  (`9999px`) on buttons, pills and icon circles.
- **Shadows**: soft, wide, low opacity — `0 8px 24px rgba(21, 42, 94, 0.08)`.
  Floating cards sit slightly stronger at `0 12px 32px rgba(21, 42, 94, 0.12)`.
- **Hero imagery** is masked into an organic blob, not a rectangle or a circle.
- **Section transitions** use a layered wave divider: two or three overlapping
  wave paths in tints of blue, giving a sense of water depth.

---

## 4. Decoration

Hand-drawn, sparse, always secondary to content.

- Maths and science doodles scattered around the hero: square-root symbol,
  triangle, lightbulb, sparkles, small dot grids.
- Fish silhouettes and bubbles inside the deep blue section.
- Seaweed or coral at the base of ocean sections.
- A short curved swash underlining the accent phrase in the H1.

Rule: decoration never overlaps text it would make harder to read, and never
appears inside a card that holds important information.

---

## 5. The mascot

An orange octopus wearing a graduation cap. It is the single most recognisable
brand element.

Meaning, as stated on the page:

- **Emotional awareness** — the character carries the warmth of the brand
- **Adaptability** — it fits the child, not the other way round
- **Thoughtful innovation** — a considered, modern approach

Usage: peeking beside a floating card, held in a hero photo, illustrating the
"Why the octopus?" section. It should read as a companion, not a logo stamp.
Do not place it over body copy, and do not scale it below roughly 40px.

---

## 6. Components

### Buttons

- **Primary** — solid `--blue-600`, white text, pill radius, trailing arrow icon.
  Used for "Book a Free Trial".
- **Secondary** — transparent fill, 1.5px `--blue-600` border, blue text, pill
  radius. Used for "Explore Subjects".
- **Tertiary / inline** — blue text with a trailing arrow, no container.
  Used for "Learn More".

Primary and secondary sit side by side in the hero. Only one primary per view region.

### Eyebrow pill

Small rounded pill on a white or tinted background with a leading sparkle icon.
Example: "Confidence. Curiosity. Capability."

### Floating info card

White card overlapping the edge of the hero image. Holds a small icon tile,
a bold one-line title, and two or three lines of supporting copy.
Example: "A different kind of start".

### Trust bar

A single row beneath the hero. Three to four items, each a small amber icon plus
a short label, separated by thin vertical rules.
Example: GCSE & A-Level · Online & in-centre · Trusted in Berkshire.

### Feature badge

Circular icon on a tinted disc, centred, with a bold heading and a line of copy
beneath. Used in threes on the deep blue section.

### Subject tabs

A tab rail (Early Years, Primary, GCSE, A-Level) above a white card. The active
tab is filled blue with white text; inactive tabs are plain. The card below lists
subjects in two columns, each with a small mascot or icon marker.

### Format card

Photo at the top, then title, two lines of description, and a "Learn More" link.
Used in a four-across grid: In-Centre Tuition, Online Lessons, Group Classes,
Home Visits.

### Testimonial note

Styled like a sticky note, slightly rotated, holding a short parent quote.
Cluster two or three at varied angles.

---

## 7. Page structure

Order as built in the mockup:

1. **Header** — logo left, nav centre, primary CTA right
2. **Hero** — eyebrow pill, H1 with amber accent phrase, lead line, two CTAs,
   blob-masked photo, floating info card, doodles
3. **Trust bar** — three credibility markers
4. **Wave divider** into the deep blue section
5. **Promise section** — script line, H2, lead copy, three feature badges
6. **Subjects** — "Maths & Science, clearly organised", tabbed subject card,
   plus a soft CTA for parents who are unsure
7. **Why the octopus?** — brand story, mascot illustrations, script labels,
   "Read Our Story"
8. **Four ways to learn** — four format cards under one consistent-standard promise
9. **Testimonials** — "Trusted by families who want both confidence and results"

---

## 8. Voice

Short, warm, parent-facing. Confidence and reassurance over hype.

- Headlines speak to the feeling: "tutoring they will look forward to",
  "a place they want to come back to".
- Subheads carry the proof: ages, levels, locations, structure.
- Sentences stay short. No jargon, no exclamation marks in body copy.

---

## 9. Responsive

- Hero becomes a single column on mobile; the photo sits below the copy.
- The floating info card moves into static flow beneath the image rather than
  overlapping it.
- Four-across format cards go to 2×2 on tablet, single column on mobile.
- Wave dividers reduce in height on small screens; keep at least one wave layer.
- Doodle decorations are the first thing to drop on narrow viewports.
- Minimum tap target 44px.

---

## 10. Accessibility

- Amber `#F5A623` on white fails WCAG AA for normal-size text. Use it only for
  large display text, icons, and decorative marks — never for body copy or links.
  For an amber-toned link on a light background, darken to roughly `#B36F00`.
- White on `--blue-600` passes AA comfortably. Keep it for the deep blue section.
- Doodles and the mascot are decorative: mark them `aria-hidden` with empty alt text.
- Every format card link needs an accessible name beyond "Learn More" — append
  visually hidden context, for example "Learn More about Online Lessons".
- Respect `prefers-reduced-motion` on any wave or mascot animation.
