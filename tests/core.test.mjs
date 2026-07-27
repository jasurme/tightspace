import assert from "node:assert/strict";
import test from "node:test";
import { SITE_ITEMS, isTheme, nextTheme, normalizeSearchQuery, resolveTheme, searchSite } from "../assets/core.js";

const titles = query => searchSite(query).map(item => item.title);

test("normalizes case, accents, null values, and whitespace", () => {
  assert.equal(normalizeSearchQuery("  MÁCBOOK\n M1  "), "macbook m1");
  assert.equal(normalizeSearchQuery(null), "");
});

test("empty and whitespace-only searches return the complete ordered index", () => {
  assert.deepEqual(searchSite(""), [...SITE_ITEMS]);
  assert.deepEqual(searchSite(" \n\t "), [...SITE_ITEMS]);
});

test("search is case-insensitive and matches title, keywords, body, and group", () => {
  assert.deepEqual(titles("MACBOOK"), ["how can i train ai model on Macbook M1 air"]);
  assert.deepEqual(titles("m1 air"), ["how can i train ai model on Macbook M1 air"]);
  assert.deepEqual(titles("hi"), ["how can i train ai model on Macbook M1 air"]);
  assert.deepEqual(titles("posts"), ["Posts", "how can i train ai model on Macbook M1 air"]);
});

test("search rejects partial token sets and handles hostile or extreme input", () => {
  assert.deepEqual(searchSite("macbook impossible"), []);
  assert.deepEqual(searchSite(`<>&"'💥`), []);
  assert.doesNotThrow(() => searchSite("x".repeat(10_000)));
  assert.deepEqual(searchSite("x".repeat(10_000)), []);
});

test("exact title matches rank before keyword matches", () => {
  const items = [{ id: "keyword", group: "Posts", title: "Elsewhere", url: "/elsewhere/", keywords: "posts" }, { id: "exact", group: "Navigation", title: "Posts", url: "/posts/", keywords: "" }];
  assert.deepEqual(searchSite("posts", items).map(item => item.id), ["exact", "keyword"]);
});

test("theme helpers accept only supported values and resolve safe fallbacks", () => {
  assert.equal(isTheme("light"), true); assert.equal(isTheme("dark"), true); assert.equal(isTheme("sepia"), false); assert.equal(isTheme(null), false);
  assert.equal(resolveTheme("dark", false), "dark"); assert.equal(resolveTheme("corrupt", true), "dark"); assert.equal(resolveTheme(null, false), "light");
  assert.equal(nextTheme("dark"), "light"); assert.equal(nextTheme("light"), "dark"); assert.equal(nextTheme("corrupt"), "dark");
});
