# GradeLens design system: "Ink & Highlighter"

Source of truth for every screen. Page files in `pages/` (none yet) override this.

## Where it came from
- **UI UX Pro Max** (`--design-system "student grade calculator mobile utility" --variance 7 --motion 4 --density 5`) gave the structure: hero → value → features → CTA, a minimal/Swiss base, Outfit + Work Sans, and its pre-delivery checklist (SVG icons and never emoji, 44px targets, 4.5:1 contrast, visible focus, reduced motion, 375/768/1024/1440 checks).
- **frontend-design** rejected its "operation orange on dark" palette and the generic education palettes (study purple, Comic Neue) as defaults that could be anyone's. The direction is grounded in the subject instead: the marksheet and answer booklet every SKASC student handles.
- **Emil Kowalski's skills** (emil-design-eng, choreograph, mobile-native) set the motion and touch rules below.

## Palette
| Token | Light | Dark | Role |
|---|---|---|---|
| `--paper` | `#F4F6FA` | `#0D1424` | Page: answer-booklet paper / desk at night |
| `--sheet` | `#FFFFFF` | `#141D33` | Cards ("sheets") |
| `--rule` / `--rule-strong` | `#DDE4F0` / `#BFCADF` | `#253252` / `#364672` | Ruled lines, borders |
| `--ink` | `#121C3A` | `#EEF2FF` | Text (fountain-pen navy) |
| `--ink-2` / `--ink-3` | `#45527A` / `#5C6990` | `#A9B6D6` / `#8794B8` | Secondary / tertiary text (≥4.5:1) |
| `--pen` / `--pen-strong` | `#2347D9` | `#9DB1FF` / `#3D5BE6` | Ballpoint blue: links, primary buttons |
| `--marker` | `#FFE14A` | `#FFD93D` | Highlighter: one number per screen, max |
| `--margin` | `#F0A3B0` | rgba(255,138,148,.4) | Red margin line |
| `--pass` / `--warn` / `--fail` | `#0E7A55` / `#9A5300` / `#C3283A` | `#5BE0A6` / `#FFC452` / `#FF8A94` | Green tick, amber, red pen |

No gradient washes, no glassmorphism, no purple.

## Type
- **Bricolage Grotesque** 500–800: headlines and every big number (`.num`, tabular).
- **Work Sans** 400–700: body and UI. Inputs are always 16px or larger.
- **Kalam** (Indian Type Foundry): only for teacher-style margin notes (remarks, "× 4 credits = 30 points", "not counted"). Three to five per screen at most.

## Visual language (all custom SVG in `src/components/art.tsx`)
LogoMark (sheet + highlighted rule + lens), PenCircle (hand-drawn loop around the lead number), HandTick / HandCross (pass/fail marks), Stamp (rubber stamp with ink texture), SpotThisSem / SpotAllSems (journey illustrations), Protractor (CGPA gauge), graph-paper TrendChart, ScanningSheet (OCR progress), line icons (on-device, stamp, stopwatch, type, snap, PDF). Lucide is used only for small UI glyphs (arrows, chevrons, sun/moon).

Shapes: sheets at a 20px radius, controls at 14px; dashed rules divide sections inside a sheet; the primary journey card gets a hard ink offset shadow (`6px 6px 0 var(--ink)`).

## Motion
- Easing: `--ease-out: cubic-bezier(0.23,1,0.32,1)` for entries, `--ease-in-out: cubic-bezier(0.77,0,0.175,1)` for pen strokes.
- Press: `.press` scales to 0.97 in 160ms on `:active`. Hover styles only apply on hover-capable pointers (Tailwind v4).
- One orchestrated moment per screen. Landing: the lens settles on a row, the note appears, the stamp fades in. Results: the number counts up, then the pen circle closes, then the remark appears (and confetti for 8+, landing as the circle closes).
- Views fade up 6px in 220ms with no exit wait. Steps slide 24px in the direction of travel.
- Reduced motion: no movement, opacity only, everything appears together.

## Copy
Second person, plain and short, with a little warmth. No emoji anywhere, and no "→" glued onto labels. Errors say what happened and what to do next.
