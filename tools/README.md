# tools

## contrast-audit.mjs

Walks the public pages at desktop and phone width and reports every piece of text that
fails the WCAG AA contrast ratio for its size — 4.5:1, or 3:1 for large text.

```bash
npm i playwright            # once, anywhere
node tools/contrast-audit.mjs https://agrik.co
```

Three things it has to get right, each of which produced a page of imaginary failures
before it did:

- **Gradients are background-images, not background-colors.** Reading only
  `backgroundColor` reports a dark gradient panel as transparent, so every white label on
  it looks like white-on-white.
- **Gradient stops carry alpha.** A gradient of `rgba(31,111,61,0.08)` stops is a faint
  tint over whatever is beneath it, not a solid green panel.
- **Translucent layers have to composite properly.** Forcing the result to `a=1` makes
  the walk stop at the first translucent layer and resolve a dark panel as near-white.

It exempts disabled controls, which WCAG 1.4.3 also exempts.

If it reports a failure, look at the element before changing a colour. Twice during this
work the tool was wrong and the page was fine.
