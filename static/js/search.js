import * as pagefind from "/pagefind/pagefind.js";

const searchInput = document.getElementById("search-input");
const searchInputContainer = document.getElementById("search-input-container");
const searchResults = document.getElementById("search-results");
const searchCategories = document.getElementById("search-categories");
const searchFilters = document.getElementById("search-filters");
const searchFilterToggle = document.getElementById("search-filter-toggle");
const searchFilterPanel = document.getElementById("search-filter-panel");
const searchMore = document.getElementById("search-more");
const categoryFiltersPromise = pagefind.filters();
const resultPageSize = 50;
let visibleLimit = resultPageSize;
const searchParams = new URL(document.location).searchParams;
const searchTerm = searchParams.get("s");
const sourceURLValues = { actuel: "current", archives: "legacy" };
const sortURLValues = { recent: "newest", ancien: "oldest" };
const requestedCategory = searchParams.get("categorie");
const searchDebounceDelay = 60;
let searchNumber = 0;
let searchDebounceTimer = null;
let currentResults = [];
let categoryCounts = {};
let sourceCounts = {};
let allCategoryCount = 0;
let renderNumber = 0;
let activeCategory = [...searchCategories.querySelectorAll("button[data-category]")]
    .some(button => button.dataset.category === requestedCategory && requestedCategory)
    ? requestedCategory : null;
let sourceMode = Object.hasOwn(sourceURLValues, searchParams.get("blog"))
    ? sourceURLValues[searchParams.get("blog")] : "all";
let sortMode = Object.hasOwn(sortURLValues, searchParams.get("tri"))
    ? sortURLValues[searchParams.get("tri")] : "relevance";
let currentTerm = null;
const savedSearchView = history.state?.searchView?.url === location.href
    ? history.state.searchView : null;

window.addEventListener("pagehide", () => {
    history.replaceState({ ...history.state, searchView: {
        url: location.href,
        visibleLimit,
        scrollY: window.scrollY,
        focusedURL: searchResults.contains(document.activeElement) ? document.activeElement.href : null
    } }, "");
});

if (searchTerm) {
    searchInput.value = searchTerm;
}

function updateSearchURL(term, searchView = null) {
    const url = new URL(document.location);
    if (term) {
        url.searchParams.set("s", term);
    } else {
        url.searchParams.delete("s");
    }
    const settings = {
        categorie: activeCategory,
        blog: { current: "actuel", legacy: "archives" }[sourceMode],
        tri: { newest: "recent", oldest: "ancien" }[sortMode]
    };
    for (const [name, value] of Object.entries(settings)) {
        if (value) url.searchParams.set(name, value);
        else url.searchParams.delete(name);
    }
    history.replaceState({ ...history.state, searchView }, "", url);
}

function focusResult(link) {
    link.focus({ preventScroll: true });
    link.scrollIntoView({ block: "center", inline: "nearest" });
}

new ResizeObserver(() => {
    document.documentElement.style.setProperty("--search-input-height", `${searchInputContainer.offsetHeight}px`);
}).observe(searchInputContainer);

async function searchExec(term, restoreView = null) {
    term = term.trim();
    updateSearchURL(term, restoreView);
    currentTerm = term;
    const currentSearch = ++searchNumber;
    renderNumber += 1;
    currentResults = [];
    visibleLimit = restoreView?.visibleLimit || resultPageSize;
    searchResults.replaceChildren();
    searchMore.hidden = true;
    updateFilters();

    try {
        await categoryFiltersPromise;
        if (currentSearch !== searchNumber) return;
        const source = sourceMode === "all" ? { any: ["current", "legacy"] } : sourceMode;
        const options = { filters: { source } };
        if (activeCategory) options.filters.category = activeCategory;
        if ((term || activeCategory) && sortMode !== "relevance") options.sort = { date: sortMode === "newest" ? "desc" : "asc" };
        const [search, counts, sources] = await Promise.all([
            pagefind.search(term || null, options),
            activeCategory
                ? pagefind.search(term || null, { filters: { source } })
                : Promise.resolve(null),
            activeCategory || sourceMode !== "all"
                ? pagefind.search(term || null, { filters: activeCategory ? { category: activeCategory } : {} })
                : Promise.resolve(null)
        ]);
        if (currentSearch !== searchNumber) return;
        currentResults = term || activeCategory ? search.results : [];
        const countResults = counts || search;
        categoryCounts = countResults.filters?.category || (sourceMode === "all" ? countResults.totalFilters?.category : null) || {};
        allCategoryCount = countResults.results.length;
        sourceCounts = (sources || search).filters?.source || {};
        updateFilters();
        await renderResults();
        if (restoreView && currentSearch === searchNumber) {
            requestAnimationFrame(() => {
                if (currentSearch !== searchNumber) return;
                [...searchResults.querySelectorAll("a")]
                    .find(link => link.href === restoreView.focusedURL)?.focus({ preventScroll: true });
                window.scrollTo({ top: restoreView.scrollY, behavior: "instant" });
            });
        }
    } catch (error) {
        if (currentSearch !== searchNumber) return;
        console.error("Recherche Pagefind :", error);
    }
}

function scheduleSearch(term) {
    window.clearTimeout(searchDebounceTimer);
    searchNumber += 1;
    renderNumber += 1;
    searchDebounceTimer = window.setTimeout(() => {
        searchDebounceTimer = null;
        searchExec(term);
    }, searchDebounceDelay);
}

function searchImmediately(term) {
    window.clearTimeout(searchDebounceTimer);
    searchDebounceTimer = null;
    searchExec(term);
}

async function renderResults() {
    const currentRender = ++renderNumber;
    const total = currentResults.length;
    searchMore.hidden = true;
    const visibleResults = await Promise.all(currentResults.slice(0, visibleLimit).map(result => result.data()));
    if (currentRender !== renderNumber) return;
    searchMore.hidden = total <= visibleLimit;

    const items = [];
    let currentYear = null;

    visibleResults.forEach(data => {
        const date = Number(data.meta.date) || 0;
        if (sortMode !== "relevance") {
            const year = date ? String(new Date(date * 1000).getFullYear()) : "Sans date";
            if (year !== currentYear) {
                const yearItem = document.createElement("li");
                const heading = document.createElement("h2");
                yearItem.className = "search-results-year";
                heading.textContent = year;
                yearItem.append(heading);
                items.push(yearItem);
                currentYear = year;
            }
        }

        const item = document.createElement("li");
        const link = document.createElement("a");
        link.href = data.url;
        link.textContent = data.meta.title;
        item.append(link);
        items.push(item);
    });

    searchResults.replaceChildren(...items);
}

function updateFilters() {
    const changed = Boolean(activeCategory) || sourceMode !== "all" || sortMode !== "relevance";
    document.getElementById("search-filter-reset").disabled = !changed;
    searchFilterToggle.classList.toggle("active", changed);
    searchFilterToggle.setAttribute("aria-label", changed ? "Options de recherche, réglages actifs" : "Options de recherche");
    searchFilterPanel.querySelectorAll("button[data-source]").forEach(button => {
        const active = sourceMode === "all" || sourceMode === button.dataset.source;
        const count = sourceCounts[button.dataset.source] || 0;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
        button.querySelector(".search-filter-count").textContent = count;
        const name = button.dataset.source === "current" ? "Nouveau blog" : "Archives";
        button.setAttribute("aria-label", `${name}, ${count} résultat${count > 1 ? "s" : ""}`);
    });
    const sortButton = document.getElementById("search-sort");
    const sortNames = { relevance: "Pertinence", newest: "Plus récents", oldest: "Plus anciens" };
    const nextSort = { relevance: "newest", newest: "oldest", oldest: "relevance" }[sortMode];
    sortButton.dataset.sort = sortMode;
    sortButton.title = `${sortNames[sortMode]} → ${sortNames[nextSort]}`;
    sortButton.setAttribute("aria-label", `Tri : ${sortNames[sortMode]}. Passer à ${sortNames[nextSort]}`);
    document.getElementById("search-sort-status").textContent = sortNames[sortMode];

    searchCategories.querySelectorAll("button[data-category]").forEach((button) => {
        const isActive = (button.dataset.category || null) === activeCategory;
        button.classList.toggle("active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
        const count = !button.dataset.category ? allCategoryCount : currentTerm || sourceMode !== "all"
            ? categoryCounts[button.dataset.category] || 0
            : Number(button.dataset.totalCount);
        const title = button.dataset.categoryTitle;
        button.hidden = false;
        button.disabled = count === 0 && !isActive;
        button.querySelector(".search-filter-count").textContent = count;
        button.setAttribute("aria-label", `${title}, ${count} résultat${count > 1 ? "s" : ""}`);
    });
}

function closeFilters(restoreFocus = false) {
    searchFilterPanel.hidden = true;
    searchFilterToggle.setAttribute("aria-expanded", "false");
    if (restoreFocus) searchFilterToggle.focus({ preventScroll: true });
}

searchFilterToggle.addEventListener("click", () => {
    const open = searchFilterPanel.hidden;
    searchFilterPanel.hidden = !open;
    searchFilterToggle.setAttribute("aria-expanded", String(open));
    if (open) searchCategories.querySelector("button").focus({ preventScroll: true });
});

document.addEventListener("pointerdown", event => {
    if (!searchFilters.contains(event.target)) closeFilters();
});
document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !searchFilterPanel.hidden) {
        event.preventDefault();
        closeFilters(true);
    }
}, true);

searchCategories.addEventListener("click", event => {
    const button = event.target.closest("button[data-category]");
    if (!button || button.disabled) return;
    window.clearTimeout(searchDebounceTimer);
    activeCategory = button.dataset.category || null;
    searchExec(searchInput.value);
});

document.getElementById("search-sources").addEventListener("click", event => {
    const button = event.target.closest("button[data-source]");
    if (!button) return;
    const source = button.dataset.source;
    sourceMode = sourceMode === "all" ? (source === "current" ? "legacy" : "current")
        : sourceMode === source ? (source === "current" ? "legacy" : "current") : "all";
    searchImmediately(searchInput.value);
});

document.getElementById("search-sort").addEventListener("click", () => {
    sortMode = { relevance: "newest", newest: "oldest", oldest: "relevance" }[sortMode];
    searchImmediately(searchInput.value);
});

document.getElementById("search-filter-reset").addEventListener("click", () => {
    window.clearTimeout(searchDebounceTimer);
    activeCategory = null;
    sourceMode = "all";
    sortMode = "relevance";
    searchExec(searchInput.value);
});

searchMore.addEventListener("click", async () => {
    visibleLimit += resultPageSize;
    try {
        await renderResults();
        const links = searchResults.querySelectorAll("a");
        links[visibleLimit - resultPageSize]?.focus({ preventScroll: true });
    } catch (error) {
        console.error("Résultats Pagefind :", error);
    }
});

if (searchTerm || activeCategory || sourceMode !== "all" || sortMode !== "relevance") {
    searchExec(searchInput.value, savedSearchView);
} else {
    updateSearchURL("");
}

searchInput.addEventListener("input", () => scheduleSearch(searchInput.value));

// Safari emits `search` when the built-in clear button is used.
searchInput.addEventListener("search", () => searchImmediately(searchInput.value));

document.addEventListener("keydown", (event) => {
    if (event.isComposing || !["ArrowDown", "ArrowUp", "Escape"].includes(event.key)) return;
    if (searchFilters.contains(event.target)) return;
    const links = [...searchResults.querySelectorAll("a")];
    const currentIndex = links.indexOf(document.activeElement);

    if (event.key === "Escape") {
        if (currentIndex === -1) return;
        event.preventDefault();
        searchInput.focus();
        return;
    }

    if (!links.length) return;
    event.preventDefault();

    if (currentIndex === -1) {
        focusResult(event.key === "ArrowDown" ? links[0] : links.at(-1));
        return;
    }

    const nextIndex = event.key === "ArrowDown"
        ? Math.min(currentIndex + 1, links.length - 1)
        : Math.max(currentIndex - 1, 0);
    focusResult(links[nextIndex]);
});

document.addEventListener("keydown", (event) => {
    const isResultFocused = searchResults.contains(document.activeElement);
    const isCharacter = event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey;
    const isDeletion = event.key === "Backspace" || event.key === "Delete";
    if (!isResultFocused || (!isCharacter && !isDeletion) || event.isComposing) return;

    event.preventDefault();
    searchInput.focus({ preventScroll: true });

    let start = searchInput.selectionStart ?? searchInput.value.length;
    let end = searchInput.selectionEnd ?? start;
    if (isDeletion && start === end) {
        if (event.key === "Backspace") start = Math.max(0, start - 1);
        if (event.key === "Delete") end = Math.min(searchInput.value.length, end + 1);
    }

    searchInput.setRangeText(isCharacter ? event.key : "", start, end, "end");
    searchInput.dispatchEvent(new Event("input", { bubbles: true }));
});

updateFilters();
// Include series/saga landing pages in the initial category counts as well.
categoryFiltersPromise.then(filters => {
    if (currentTerm === null) {
        sourceCounts = filters.source || {};
        allCategoryCount = Object.values(sourceCounts).reduce((sum, count) => sum + count, 0);
    }
    searchCategories.querySelectorAll("button[data-category]").forEach(button => {
        button.dataset.totalCount = filters.category?.[button.dataset.category] || 0;
    });
    updateFilters();
}).catch(error => console.error("Catégories Pagefind :", error));
if (!savedSearchView) searchInput.focus({ preventScroll: true });
