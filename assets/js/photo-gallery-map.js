// The page map initializes MapKit; this second view is created when a geotagged
// photo is first opened. One instance serves the whole gallery at every size.
(() => {
  const lightbox = document.querySelector(".photo-lightbox");
  const container = lightbox?.querySelector(".photo-lightbox-map");
  if (!container) return;
  const stage = lightbox.querySelector(".photo-lightbox-stage");
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
  const compact = matchMedia("(max-width: 900px)");
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
          mapType: kit.MapType.MutedStandard,
          colorScheme: kit.ColorScheme.Dark,
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
      const mapFrame = container.getBoundingClientRect();
      const photoFrame = stage.getBoundingClientRect();
      const photoRight = photoFrame.right;
      const uncoveredLeft = Math.max(24, photoRight - mapFrame.left + 24);
      // Center within the exposed strip, rather than behind the overlapping photo.
      const defaultLeft = compact.matches ? 24 : size * 0.48;
      const leftPadding = size - 24 - uncoveredLeft >= 48
        ? Math.max(defaultLeft, uncoveredLeft) : defaultLeft;
      map.padding = compact.matches
        ? new kit.Padding(48, 24, 48, leftPadding)
        : new kit.Padding(64, 24, size * 0.5, leftPadding);
      if (compact.matches && photoFrame.top - mapFrame.top >= 96) {
        const viewerFrame = lightbox.getBoundingClientRect();
        const credits = container.querySelector(".mk-controls-container");
        const top = Math.max(64, (credits?.getBoundingClientRect().bottom ?? mapFrame.top + 44) - mapFrame.top + 20);
        const bottom = Math.max(top + 40, Math.min(photoFrame.top - mapFrame.top - 16, top + 80));
        const left = Math.max(24, viewerFrame.left - mapFrame.left + 24);
        map.padding = new kit.Padding(top, 24, Math.max(0, size - bottom), left);
      }
      marker.coordinate = coordinate;
      if (firstPhoto) {
        map.showItems([marker], { animate: false, minimumSpan: routeSpan });
        return;
      }
      // Follow every selected photo, including moves within the visible area.
      map.setCenterAnimated(coordinate, !preview && !reducedMotion.matches && !compact.matches);
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
  observer.observe(stage);
})();
