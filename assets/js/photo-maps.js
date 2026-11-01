// Both map views share one SDK download and the same authorization state.
(() => {
  const pageMapElement = document.getElementById("map");
  const data = document.getElementById("photo-map-data");
  if (!pageMapElement || !data) return;
  const config = JSON.parse(data.textContent);
  let sdkPromise;
  let articlePromise;

  function notifyState(state) {
    if (state) pageMapElement.dataset.mapkitState = state;
    document.dispatchEvent(new Event("photo-map-statechange"));
  }

  window.loadPhotoMapKit = function () {
    if (sdkPromise) return sdkPromise;
    sdkPromise = (async () => {
      if (!window.mapkit) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://cdn.apple-mapkit.com/mk/6/mapkit.core.js";
          script.crossOrigin = "anonymous";
          script.async = true;
          script.addEventListener("load", resolve, { once: true });
          script.addEventListener("error", () => reject(new Error("MapKit could not be loaded")), { once: true });
          document.head.append(script);
        });
      }
      const kit = window.mapkit;
      kit.addEventListener("configuration-change", () => notifyState("ready"));
      kit.addEventListener("error", () => notifyState("error"));
      kit.init({
        authorizationCallback: (done) => done(config.token),
        language: "fr",
        libraries: ["map", "annotations"],
      });
      await kit.load(["map", "annotations"]);
      // In development, the grid and pins remain usable without authorized tiles.
      notifyState();
      return kit;
    })().catch((error) => {
      notifyState("error");
      throw error;
    });
    return sdkPromise;
  };

  function renderArticleMap(mapkit) {
    const map = new mapkit.Map(pageMapElement, { mapType: mapkit.MapType.Hybrid });
    let photoCalloutId = 0;
    const photoCallout = {
        calloutElementForAnnotation(annotation) {
            const photo = annotation.data;
            const button = document.createElement("button");
            button.type = "button";
            button.className = "map-photo-callout";
            button.setAttribute("aria-label", "Ouvrir la photo dans la galerie");
            // MapKit measures the callout before the image has loaded.
            const scale = Math.min(108 / photo.previewWidth, 144 / photo.previewHeight, 1);
            const width = photo.previewWidth * scale;
            const height = photo.previewHeight * scale;
            button.style.width = `${width}px`;
            button.style.height = `${height}px`;

            const svgElement = tag => document.createElementNS("http://www.w3.org/2000/svg", tag);
            const preview = svgElement("svg");
            preview.setAttribute("viewBox", `0 0 ${width} ${height}`);
            preview.setAttribute("aria-hidden", "true");
            const defs = svgElement("defs");
            const clip = svgElement("clipPath");
            const clipId = `map-photo-clip-${++photoCalloutId}`;
            clip.id = clipId;
            clip.setAttribute("clipPathUnits", "userSpaceOnUse");
            const shape = svgElement("path");
            const radius = Math.min(10, width / 4, height / 4);
            const center = width / 2;
            const tail = Math.min(12, width / 6, height / 6);
            const body = height - tail;
            shape.setAttribute("d", `M ${radius} 0 H ${width - radius}
                Q ${width} 0 ${width} ${radius} V ${body - radius}
                Q ${width} ${body} ${width - radius} ${body} H ${center + tail}
                C ${center + tail / 2} ${body} ${center + tail / 2} ${height} ${center} ${height}
                C ${center - tail / 2} ${height} ${center - tail / 2} ${body} ${center - tail} ${body}
                H ${radius} Q 0 ${body} 0 ${body - radius} V ${radius} Q 0 0 ${radius} 0 Z`);
            clip.append(shape);
            defs.append(clip);
            const image = svgElement("image");
            image.setAttribute("href", photo.preview);
            image.setAttribute("width", width);
            image.setAttribute("height", height);
            image.setAttribute("preserveAspectRatio", "xMidYMid meet");
            image.setAttribute("clip-path", `url(#${clipId})`);
            preview.append(defs, image);
            button.append(preview);
            button.addEventListener("click", () => {
                const thumbnails = document.querySelectorAll("#photo-gallery .photo-gallery-thumb");
                thumbnails[photo.photoIndex]?.click();
            });
            return button;
        }
    };

    const annotations = config.photos.map((location) => {
        const coordinate = new mapkit.Coordinate(location.lat, location.long);
        return new mapkit.MarkerAnnotation(coordinate, {
            glyphImage: { 1: "/img/pin.png", 2: "/img/pin@2x.png" },
            color: "#487b00",
            titleVisibility: mapkit.FeatureVisibility.Hidden,
            subtitleVisibility: mapkit.FeatureVisibility.Hidden,
            accessibilityLabel: "Afficher l’aperçu de la photo",
            data: location,
            calloutEnabled: true,
            callout: photoCallout
        });
    });

    map.showItems(annotations, {
        padding: new mapkit.Padding(48, 48, 48, 48)
    });
  }

  function showArticleMap() {
    if (!articlePromise) {
      articlePromise = window.loadPhotoMapKit()
        .then(renderArticleMap)
        .catch(() => notifyState("error"));
    }
    return articlePromise;
  }

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        showArticleMap();
      }
    }, { rootMargin: "400px" });
    observer.observe(pageMapElement);
  } else {
    showArticleMap();
  }
})();
