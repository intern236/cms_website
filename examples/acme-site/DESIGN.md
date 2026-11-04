# Acme Studio — example client site

This is the **example theme** for the CMS: a design-studio website whose journal
is powered entirely by the CMS through `@cms/site-kit`. Fork this folder per
client and change the design; the content plumbing stays the same.

## Design plan

```
>>> random.seed(len(brief))            # brief = 239 characters
>>> hero, font = 'Cinematic Center', 'Cabinet Grotesk'
>>> components = ['Horizontal Accordions', 'Testimonial Carousel', 'Inline Typography Images']
>>> motion = ['Card Stacking', 'Scroll Pinning (GSAP Split)']
```

- **AIDA:** floating glass-pill navigation → cinematic centred hero (Attention) →
  services as horizontal accordions (Interest) → pinned "From the journal" split
  with live CMS posts, then stacking process cards (Desire) → testimonial carousel
  and a full-bleed call to action + footer (Action).
- **Hero maths:** H1 is `max-w-6xl` at `clamp(3rem, 6.4vw, 6.75rem)`, so it sets in
  2–3 lines at every width. No stamps, no pill tags, no stats in the hero.
  Exactly two CTAs, ink-on-paper and paper-on-ink, both high contrast.
- **Grids:** every grid uses `grid-flow-dense`; spans are checked so no cell is empty.
- **Labels:** no "SECTION 01" style meta-labels anywhere.
- **Type:** Cabinet Grotesk (display and UI, self-hosted from Fontshare) with
  Newsreader for long-form reading in posts.
- **Colour:** warm paper `#f2efe8`, ink `#0e0e0c`, and the client's brand colour
  from the CMS (`site.accent`) as the single accent — change it in the CMS and the
  site follows.
- **Motion:** GSAP + ScrollTrigger for pinning, card stacking and image scale;
  Lenis for smooth scroll; everything respects `prefers-reduced-motion`.
