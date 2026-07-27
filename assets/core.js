export const THEMES = Object.freeze(["light", "dark"]);

export const SITE_ITEMS = Object.freeze([
  Object.freeze({ id: "about", group: "Navigation", title: "About", url: "/", keywords: "home tightspace" }),
  Object.freeze({ id: "posts", group: "Navigation", title: "Posts", url: "/posts/", keywords: "blog writing index" }),
  Object.freeze({ id: "train-ai-m1", group: "Posts", title: "how can i train ai model on Macbook M1 air", url: "/posts/how-can-i-train-ai-model-on-macbook-m1-air/", keywords: "hi artificial intelligence machine learning apple silicon laptop" })
]);

export const normalizeSearchQuery = value => String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("en").replace(/\s+/g, " ").trim();

export function searchSite(query, items = SITE_ITEMS) {
  const normalizedQuery = normalizeSearchQuery(query);
  if (!normalizedQuery) return [...items];
  const tokens = normalizedQuery.split(" ");
  return items.map((item, order) => {
    const title = normalizeSearchQuery(item.title), haystack = normalizeSearchQuery(`${item.title} ${item.group} ${item.keywords ?? ""}`);
    if (!tokens.every(token => haystack.includes(token))) return null;
    const score = title === normalizedQuery ? 0 : title.startsWith(normalizedQuery) ? 1 : title.includes(normalizedQuery) ? 2 : 3;
    return { item, order, score };
  }).filter(Boolean).sort((a, b) => a.score - b.score || a.order - b.order).map(result => result.item);
}

export const isTheme = value => THEMES.includes(value);
export const resolveTheme = (storedTheme, prefersDark = false) => isTheme(storedTheme) ? storedTheme : prefersDark ? "dark" : "light";
export const nextTheme = currentTheme => currentTheme === "dark" ? "light" : "dark";
