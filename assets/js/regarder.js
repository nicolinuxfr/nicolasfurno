document.querySelectorAll("[data-regarder]").forEach(async (element) => {
  const params = new URLSearchParams({ type: element.dataset.type, id: element.dataset.id });
  if (element.dataset.saisons) params.set("saisons", element.dataset.saisons);
  try {
    const response = await fetch(`/api/regarder?${params}`);
    if (!response.ok) return;
    const { services } = await response.json();
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
