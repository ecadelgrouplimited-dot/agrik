import { chromium } from "playwright";
const S = "/tmp/claude-1000/-home-sisi-labs-Projects-AGRIK/76aea3bf-978e-431f-a734-5122b2ef43eb/scratchpad";
const BASE = process.argv[2] || "https://agrik.co";

/** WCAG relative luminance + contrast ratio, computed on the rendered page. */
const AUDIT = () => {
  const parse = (c) => {
    const m = (c || "").match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1].split(",").map((v) => parseFloat(v));
    return { r, g, b, a };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  /*
   * Proper source-over compositing. Forcing the result to a=1 made the walk stop at the
   * first translucent layer and report a near-white background for text that actually
   * sits on a dark panel, which produced a page of imaginary failures.
   */
  const over = (fg, bg) => {
    const a = fg.a + bg.a * (1 - fg.a);
    if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
    return {
      r: (fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / a,
      g: (fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / a,
      b: (fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / a,
      a,
    };
  };
  /*
   * A CSS gradient is a background-IMAGE, not a background-COLOR, so reading only
   * backgroundColor reports a dark gradient panel as transparent and every white label on
   * it as a contrast failure. Average the gradient's stops instead, which is close enough
   * to judge text sitting anywhere on it.
   */
  const gradientColor = (cs) => {
    const img = cs.backgroundImage;
    if (!img || img === "none") return null;
    const stops = img.match(/rgba?\([^)]+\)/g);
    if (!stops || !stops.length) return null;
    const parsed = stops.map(parse).filter(Boolean);
    if (!parsed.length) return null;
    // Keep the average ALPHA too. A gradient of rgba(31,111,61,0.08) stops is a faint
    // tint over whatever is beneath it, not a solid green panel; treating it as opaque
    // made dark text on a pale tint look like a contrast failure.
    return {
      r: parsed.reduce((s, c) => s + c.r, 0) / parsed.length,
      g: parsed.reduce((s, c) => s + c.g, 0) / parsed.length,
      b: parsed.reduce((s, c) => s + c.b, 0) / parsed.length,
      a: parsed.reduce((s, c) => s + c.a, 0) / parsed.length,
    };
  };

  // Walk up for the first opaque surface actually painted behind the text.
  const bgOf = (el) => {
    let node = el, acc = null;
    while (node && node !== document.documentElement) {
      const cs = getComputedStyle(node);
      const grad = gradientColor(cs);
      if (grad && grad.a > 0) {
        acc = acc ? over(acc, grad) : grad;
        if (acc.a >= 0.999) return acc;
      }
      const c = parse(cs.backgroundColor);
      if (c && c.a > 0) { acc = acc ? over(acc, c) : c; if (acc.a >= 0.999) return acc; }
      node = node.parentElement;
    }
    const white = { r: 255, g: 255, b: 255, a: 1 };
    return acc ? over(acc, white) : white;
  };

  const out = [];
  for (const el of document.querySelectorAll("body *")) {
    const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(" ").trim();
    if (!text) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || parseFloat(cs.opacity) < 0.15) continue;
    // WCAG 1.4.3 exempts inactive controls, which are greyed out on purpose.
    if (el.closest("[disabled], [aria-disabled='true'], .leaflet-disabled, .is-disabled")) continue;
    const fg = parse(cs.color);
    if (!fg) continue;
    const bg = bgOf(el);
    const eff = fg.a < 1 ? over(fg, bg) : fg;
    if (bg.a < 0.999) continue;
    const l1 = lum(eff), l2 = lum(bg);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const size = parseFloat(cs.fontSize);
    const bold = parseInt(cs.fontWeight, 10) >= 700;
    // WCAG AA: 3.0 for large text (>=24px, or >=18.66px bold), 4.5 otherwise.
    const need = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5;
    if (ratio < need) {
      out.push({ text: text.slice(0, 44), cls: (el.className || "").toString().slice(0, 36), ratio: +ratio.toFixed(2), need, size: Math.round(size) });
    }
  }
  return out;
};

const b = await chromium.launch({ args: ["--no-sandbox"] });
const pages = ["/", "/marketplace", "/marketplace/listings/1", "/contact"];
for (const [w, h, tag] of [[1280, 900, "desktop"], [390, 844, "phone"]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: w < 500, hasTouch: w < 500 });
  const p = await ctx.newPage();
  for (const path of pages) {
    await p.goto(BASE + path, { waitUntil: "networkidle" }).catch(() => {});
    await p.waitForTimeout(1300);
    const fails = await p.evaluate(AUDIT);
    console.log(`${tag.padEnd(8)} ${path.padEnd(26)} contrast failures: ${fails.length}`);
    fails.slice(0, 6).forEach((f) => console.log(`    ${String(f.ratio).padStart(5)} (need ${f.need}) ${f.size}px  "${f.text}"  .${f.cls}`));
  }
  await ctx.close();
}
await b.close();
