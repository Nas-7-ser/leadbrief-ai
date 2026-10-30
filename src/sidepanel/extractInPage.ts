/**
 * Runs inside the prospect tab via chrome.scripting.executeScript.
 * Self-contained (no imports). Goal: return clean human-readable page prose.
 */
export type ExtractedPageContext = {
  pageUrl: string;
  pageTitle: string;
  metaDescription?: string;
  headings: string[];
  visibleText: string;
  extractedAt: string;
};

export function extractPageInPageContext(): ExtractedPageContext {
  const SKIP_TAGS = new Set([
    "SCRIPT",
    "STYLE",
    "NOSCRIPT",
    "IFRAME",
    "SVG",
    "CANVAS",
    "TEXTAREA",
    "INPUT",
    "BUTTON",
    "SELECT",
    "OPTION",
  ]);

  function isVisible(el: Element): boolean {
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
    if (el.getAttribute("aria-hidden") === "true") return false;
    return true;
  }

  /** Walk the DOM (including open shadow roots) and collect visible text nodes. */
  function collect(root: ParentNode, lines: string[], total: { n: number }, limit: number): void {
    if (total.n >= limit) return;
    for (const child of root.childNodes) {
      if (total.n >= limit) return;

      if (child.nodeType === Node.TEXT_NODE) {
        const parent = child.parentElement;
        if (!parent || !isVisible(parent)) continue;
        const text = (child as Text).textContent?.replace(/\s+/g, " ").trim();
        if (!text || text.length < 2) continue;
        lines.push(text);
        total.n += text.length;
        continue;
      }

      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const el = child as Element;
      if (SKIP_TAGS.has(el.tagName)) continue;
      if (!isVisible(el)) continue;
      if ((el as HTMLElement & { shadowRoot?: ShadowRoot }).shadowRoot) {
        collect((el as HTMLElement & { shadowRoot: ShadowRoot }).shadowRoot, lines, total, limit);
      }
      collect(el, lines, total, limit);
    }
  }

  const lines: string[] = [];
  if (document.body) collect(document.body, lines, { n: 0 }, 30000);

  // Deduplicate consecutive identical lines and short navigation chrome
  const seen = new Set<string>();
  const cleaned: string[] = [];
  const nav = new Set([
    "home",
    "menu",
    "search",
    "login",
    "log in",
    "sign in",
    "sign up",
    "subscribe",
    "contact",
    "about",
    "more",
    "share",
    "like",
    "comment",
    "follow",
    "save",
    "send",
    "skip to content",
    "skip to main content",
    "open menu",
    "close",
    "next",
    "previous",
  ]);
  for (const raw of lines) {
    const t = raw.trim();
    if (!t) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    if (t.length < 25 && nav.has(t.toLowerCase())) continue;
    cleaned.push(t);
  }

  const visibleText = cleaned.join("\n").slice(0, 18000);

  const metaDescription =
    document.querySelector('meta[name="description"]')?.getAttribute("content") ??
    document.querySelector('meta[property="og:description"]')?.getAttribute("content") ??
    undefined;

  const headings = Array.from(document.querySelectorAll("h1, h2, h3"))
    .filter((el) => isVisible(el))
    .map((el) => el.textContent?.trim() ?? "")
    .filter(Boolean)
    .slice(0, 30);

  return {
    pageUrl: window.location.href,
    pageTitle: document.title || "Untitled page",
    metaDescription,
    headings,
    visibleText,
    extractedAt: new Date().toISOString(),
  };
}
