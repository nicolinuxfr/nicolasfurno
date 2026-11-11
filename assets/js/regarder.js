import { selectServices } from "./regarder-services.mjs";

document.querySelectorAll("[data-regarder]").forEach(async (element) => {
  const params = new URLSearchParams({ source: element.dataset.source });
  if (element.dataset.saisons) params.set("saisons", element.dataset.saisons);
  try {
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
    const response = await fetch(local ? element.dataset.source : `/api/regarder?${params}`);
    if (!response.ok) return;
    const data = await response.json();
    if (local && ![2, 3].includes(data.version) && !data.override) return;
    const services = local ? selectServices(data, "fr", element.dataset.saisons?.split(",") ?? []) : data.services;
    if (!Array.isArray(services) || !services.length) return;
    const target = element.querySelector("span");
    services.forEach(({ name, link }, index) => {
      const url = new URL(link);
      if (url.protocol !== "https:") return;
      if (index) target.append(", ");
      const anchor = document.createElement("a");
      anchor.href = url.href;
      anchor.textContent = name;
      target.append(anchor);
    });
    if (target.childElementCount) element.hidden = false;
  } catch {
    // Une indisponibilité de l'API ne doit pas affecter la lecture.
  }
});
