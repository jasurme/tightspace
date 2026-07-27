import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), pages = ["index.html", "posts/index.html", "posts/how-can-i-train-ai-model-on-macbook-m1-air/index.html"], articleTitle = "how can i train ai model on Macbook M1 air";
const read = file => readFile(path.join(root, file), "utf8");

test("every page has the shared semantic and interactive shell", async () => {
  for (const page of pages) {
    const html = await read(page);
    assert.match(html, /^<!doctype html>/i, page); assert.match(html, /<html lang="en">/, page); assert.match(html, /name="viewport"/, page); assert.match(html, /href="#main-content"/, page); assert.match(html, /<main id="main-content">/, page);
    assert.equal((html.match(/<h1(?:\s|>)/g) ?? []).length, 1, `${page} must have one h1`);
    assert.match(html, /<nav class="primary-nav" aria-label="Primary">/, page); assert.match(html, />About<\/a>/, page); assert.match(html, />Posts<\/a>/, page);
    assert.match(html, /data-search-open/, page); assert.match(html, /data-search-dialog/, page); assert.match(html, /data-theme-toggle/, page); assert.match(html, /type="module" src="\/assets\/site\.js"/, page);
    assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1, `${page} must expose one current section`);
  }
});

test("the post index and article preserve the requested title and body", async () => {
  const index = await read("posts/index.html"), article = await read("posts/how-can-i-train-ai-model-on-macbook-m1-air/index.html");
  assert.ok(index.includes(articleTitle)); assert.match(article, new RegExp(`<h1>${articleTitle}<\\/h1>`)); assert.match(article, /<div class="article-body"><p>hi<\/p><\/div>/);
});

test("all local page resources and routes resolve on a static server", async () => {
  const targets = new Set();
  for (const page of pages) {
    const html = await read(page);
    for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const url = match[1]; if (/^(?:https?:|mailto:|#)/.test(url)) continue;
      const clean = url.split(/[?#]/)[0], target = clean.startsWith("/") ? clean.slice(1) : path.join(path.dirname(page), clean);
      targets.add(target.endsWith("/") || target === "" ? path.join(target, "index.html") : target);
    }
  }
  for (const target of targets) await assert.doesNotReject(access(path.join(root, target)), `Missing ${target}`);
});

test("deployment markers contain the production domain exactly", async () => {
  assert.equal(await read("CNAME"), "tightspace.xyz\n"); await assert.doesNotReject(access(path.join(root, ".nojekyll")));
});

test("the search index exposes each public route exactly once", async () => {
  const source = await read("assets/core.js");
  for (const url of ["/", "/posts/", "/posts/how-can-i-train-ai-model-on-macbook-m1-air/"]) assert.equal(source.split(`url: "${url}"`).length - 1, 1, url);
});
