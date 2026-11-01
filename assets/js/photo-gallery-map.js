// The page map initializes MapKit; this second view is created when a geotagged
// photo is first opened. One instance serves the whole gallery at every size.
(() => {
  const lightbox = document.querySelector(".photo-lightbox");
  const container = lightbox?.querySelector(".photo-lightbox-map");
  if (!container) return;
  // Hugo's development server can show MapKit's grid and local annotations
  // without authorized tiles, which is useful for checking the design.
  const preview = container.dataset.preview === "true";

  const thumbnails = Array.from(document.querySelectorAll(".photo-gallery-thumb"));
  const locations = thumbnails.map((thumbnail) => {
    const { lat, long } = thumbnail.dataset;
    if (lat === undefined || long === undefined) return null;
    const latitude = Number(lat);
    const longitude = Number(long);
    return Number.isFinite(latitude) && Number.isFinite(longitude) &&
      Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 &&
      (latitude !== 0 || longitude !== 0) ? { latitude, longitude } : null;
  });
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const compact = matchMedia("(max-width: 800px)");
  let activeIndex = 0;
  let map;
  let marker;
  let routeSpan;
  let failed = false;

  function updateMap() {
    const location = locations[activeIndex];
    container.hidden = !lightbox.open || !location || failed || !window.mapkit ||
      (!preview && document.getElementById("map")?.dataset.mapkitState !== "ready");
    if (container.hidden) return;

    try {
      const kit = window.mapkit;
      const coordinate = new kit.Coordinate(location.latitude, location.longitude);
      const firstPhoto = !map;
      if (firstPhoto) {
        const points = locations.filter(Boolean);
        const latitudes = points.map((point) => point.latitude);
        // Unwrap longitudes so a trip across the date line keeps a local framing.
        const origin = points[0].longitude;
        const longitudes = points.map((point) => origin + ((point.longitude - origin + 540) % 360) - 180);
        const south = Math.min(...latitudes);
        const north = Math.max(...latitudes);
        const west = Math.min(...longitudes);
        const east = Math.max(...longitudes);
        map = new kit.Map(container, {
          mapType: kit.Map.MapTypes.MutedStandard,
          colorScheme: kit.Map.ColorSchemes.Dark,
          showsMapTypeControl: false,
          showsZoomControl: false,
          showsCompass: kit.FeatureVisibility.Hidden,
          showsScale: kit.FeatureVisibility.Hidden,
          isScrollEnabled: false,
          isZoomEnabled: false,
          isRotationEnabled: false,
        });
        routeSpan = new kit.CoordinateSpan(
          Math.min(180, Math.max(0.004, (north - south) * 1.5)),
          Math.min(360, Math.max(0.004, (east - west) * 1.5)),
        );
        marker = new kit.MarkerAnnotation(coordinate, {
          color: "#487b00",
          glyphImage: { 1: "/img/pin.png", 2: "/img/pin@2x.png" },
          titleVisibility: kit.FeatureVisibility.Hidden,
          subtitleVisibility: kit.FeatureVisibility.Hidden,
          calloutEnabled: false,
          animates: false,
          accessibilityLabel: "Lieu de prise de vue de la photo affichée",
        });
        map.addAnnotation(marker);
      }

      const size = container.clientWidth;
      // Keep a fixed framing in the corner, even when the photo overlaps it.
      const visibleWidth = size * 0.52;
      map.padding = compact.matches
        ? new kit.Padding(48, 24, 48, 24)
        : new kit.Padding(64, 24, size * 0.5, size - visibleWidth);
      marker.coordinate = coordinate;
      if (firstPhoto) {
        map.showItems([marker], { animate: false, minimumSpan: routeSpan });
        return;
      }
      if (compact.matches) {
        map.setCenterAnimated(coordinate, false);
        return;
      }
      const point = map.convertCoordinateToPointOnPage(coordinate);
      const mapFrame = container.getBoundingClientRect();
      const x = point.x - mapFrame.left - window.scrollX;
      const y = point.y - mapFrame.top - window.scrollY;
      if (x < size - visibleWidth || x > size - 24 || y < 64 || y > size * 0.5 - 24) {
        map.setCenterAnimated(coordinate, !preview && !reducedMotion.matches);
      }
    } catch {
      // A map failure must never prevent the photo viewer from working.
      failed = true;
      container.hidden = true;
    }
  }

  lightbox.addEventListener("photochange", (event) => {
    activeIndex = event.detail.index;
    updateMap();
  });
  lightbox.addEventListener("close", () => { container.hidden = true; });
  document.addEventListener("photo-map-statechange", updateMap);
  compact.addEventListener("change", () => requestAnimationFrame(updateMap));
  const observer = new ResizeObserver(() => {
    if (lightbox.open) requestAnimationFrame(updateMap);
  });
  observer.observe(lightbox);
  observer.observe(container);
})();
