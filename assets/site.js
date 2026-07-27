import { SITE_ITEMS, isTheme, nextTheme, resolveTheme, searchSite } from "./core.js";

const root = document.documentElement, themeButton = document.querySelector("[data-theme-toggle]"), media = window.matchMedia("(prefers-color-scheme: dark)");
let savedTheme = null, hasThemeOverride = false;
try { savedTheme = localStorage.getItem("tightspace-theme"); hasThemeOverride = isTheme(savedTheme); } catch {}

function applyTheme(theme, persist = false) {
  root.dataset.theme = theme; root.style.colorScheme = theme;
  if (themeButton) { const dark = theme === "dark"; themeButton.setAttribute("aria-label", `Switch to ${dark ? "light" : "dark"} mode`); themeButton.setAttribute("title", `Switch to ${dark ? "light" : "dark"} mode`); themeButton.setAttribute("aria-pressed", String(dark)); }
  if (!persist) return;
  hasThemeOverride = true;
  try { localStorage.setItem("tightspace-theme", theme); } catch {}
}

applyTheme(resolveTheme(savedTheme, media.matches));
themeButton?.addEventListener("click", () => applyTheme(nextTheme(root.dataset.theme), true));
const syncSystemTheme = event => { if (!hasThemeOverride) applyTheme(event.matches ? "dark" : "light"); };
if (typeof media.addEventListener === "function") media.addEventListener("change", syncSystemTheme); else media.addListener?.(syncSystemTheme);

const modifierKey = /Mac|iPhone|iPad|iPod/i.test(navigator.userAgentData?.platform ?? navigator.platform) ? "⌘" : "Ctrl";
document.querySelectorAll("[data-modifier-key]").forEach(element => { element.textContent = modifierKey; });

const dialog = document.querySelector("[data-search-dialog]"), openButton = document.querySelector("[data-search-open]"), closeButton = dialog?.querySelector("[data-search-close]"), input = dialog?.querySelector("[data-search-input]"), results = dialog?.querySelector("[data-search-results]"), status = dialog?.querySelector("[data-search-status]");
let visibleItems = [...SITE_ITEMS], activeIndex = 0, restoreFocus = null;

function setActiveResult(index) {
  const options = [...results.querySelectorAll('[role="option"]')];
  if (!options.length) { activeIndex = -1; input.removeAttribute("aria-activedescendant"); return; }
  activeIndex = (index + options.length) % options.length;
  options.forEach((option, optionIndex) => { const active = optionIndex === activeIndex; option.classList.toggle("is-active", active); option.setAttribute("aria-selected", String(active)); });
  input.setAttribute("aria-activedescendant", options[activeIndex].id); options[activeIndex].scrollIntoView({ block: "nearest" });
}

function renderResults(query = "") {
  visibleItems = searchSite(query); results.replaceChildren();
  if (!visibleItems.length) { const empty = document.createElement("p"); empty.className = "search-empty"; empty.textContent = "No results"; results.append(empty); status.textContent = "No results found"; setActiveResult(-1); return; }
  const groupedItems = Map.groupBy(visibleItems, item => item.group);
  for (const [group, items] of groupedItems) {
    const section = document.createElement("section"), heading = document.createElement("h2"), list = document.createElement("div");
    section.className = "search-group"; heading.className = "search-group-title"; heading.textContent = group; list.setAttribute("role", "presentation"); section.append(heading, list);
    items.forEach(item => { const link = document.createElement("a"); link.id = `search-result-${item.id}`; link.className = "search-result"; link.href = item.url; link.setAttribute("role", "option"); link.setAttribute("aria-selected", "false"); link.tabIndex = -1; link.textContent = item.title; list.append(link); });
    results.append(section);
  }
  status.textContent = `${visibleItems.length} result${visibleItems.length === 1 ? "" : "s"} found`; setActiveResult(0);
}

function openSearch() {
  if (!dialog || !input) return;
  if (dialog.open) { input.focus(); input.select(); return; }
  restoreFocus = document.activeElement; renderResults(input.value); root.classList.add("search-is-open");
  if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.setAttribute("open", "");
  input.focus(); input.select();
}

function closeSearch() {
  if (!dialog?.open) return;
  if (typeof dialog.close === "function") dialog.close(); else { dialog.removeAttribute("open"); finishClosingSearch(); }
}

function finishClosingSearch() { root.classList.remove("search-is-open"); const target = restoreFocus instanceof HTMLElement && restoreFocus !== document.body ? restoreFocus : openButton; target?.focus(); if (document.activeElement !== target) openButton?.focus(); restoreFocus = null; }

openButton?.addEventListener("click", openSearch); closeButton?.addEventListener("click", closeSearch); dialog?.addEventListener("close", finishClosingSearch);
dialog?.addEventListener("click", event => { if (event.target === dialog) closeSearch(); });
input?.addEventListener("input", () => renderResults(input.value));
input?.addEventListener("keydown", event => {
  if (event.isComposing) return;
  if (event.key === "ArrowDown") { event.preventDefault(); setActiveResult(activeIndex + 1); }
  else if (event.key === "ArrowUp") { event.preventDefault(); setActiveResult(activeIndex - 1); }
  else if (event.key === "Enter" && activeIndex >= 0) { event.preventDefault(); window.location.assign(visibleItems[activeIndex].url); }
});
dialog?.addEventListener("keydown", event => {
  if (event.key === "Escape") { event.preventDefault(); closeSearch(); return; }
  if (event.key !== "Tab") return;
  const focusable = [input, closeButton].filter(Boolean), first = focusable[0], last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});
document.addEventListener("keydown", event => { if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "k") { event.preventDefault(); openSearch(); } });
