const gallery = document.querySelector("#photo-gallery");
const lightbox = document.querySelector(".photo-lightbox");

if (gallery && lightbox && typeof lightbox.showModal === "function") {
  const thumbnails = Array.from(gallery.querySelectorAll(".photo-gallery-thumb"));
  const image = lightbox.querySelector(".photo-lightbox-image");
  const caption = lightbox.querySelector(".photo-lightbox-caption");
  const stage = lightbox.querySelector(".photo-lightbox-stage");
  const legend = lightbox.querySelector("figcaption");
  const previous = lightbox.querySelector(".photo-lightbox-previous");
  const next = lightbox.querySelector(".photo-lightbox-next");
  let activeIndex = 0;
  let touchStart = null;
  let ratio = 0.75;

  function layoutPhoto() {
    if (!lightbox.open) return;
    const style = getComputedStyle(lightbox);
    const width = lightbox.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const height = lightbox.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    const gap = parseFloat(getComputedStyle(stage.parentElement).gap);
    const sideWidth = Math.min(256, width / 3);
    legend.style.width = `${sideWidth}px`;
    const sideHeight = Math.min(height, Math.max(0, width - sideWidth - gap) / ratio);
    const sideFits = legend.offsetHeight <= sideHeight;

    let belowHeight = Math.min(height, width / ratio);
    for (let step = 0; step < 3; step++) {
      legend.style.width = `${belowHeight * ratio}px`;
      belowHeight = Math.max(1, Math.min(width / ratio, height - legend.offsetHeight - gap));
    }
    const beside = sideFits && sideHeight >= belowHeight;
    const imageHeight = beside ? sideHeight : belowHeight;
    lightbox.dataset.captionPosition = beside ? "beside" : "below";
    stage.style.width = `${imageHeight * ratio}px`;
    stage.style.height = `${imageHeight}px`;
    legend.style.width = `${beside ? sideWidth : imageHeight * ratio}px`;
    const frame = lightbox.getBoundingClientRect();
    const group = stage.parentElement.getBoundingClientRect();
    const photo = stage.getBoundingClientRect();
    const outside = group.left - frame.left >= 52 && frame.right - group.right >= 52;
    lightbox.dataset.controls = outside ? "outside" : "inset";
    previous.style.left = `${(outside ? group.left - 50 : photo.left + 6) - frame.left}px`;
    next.style.left = `${(outside ? group.right + 6 : photo.right - 50) - frame.left}px`;
    previous.style.top = next.style.top = `${photo.top - frame.top + photo.height / 2}px`;
  }

  function showPhoto(index) {
    activeIndex = (index + thumbnails.length) % thumbnails.length;
    const thumbnail = thumbnails[activeIndex];
    const preview = thumbnail.querySelector("img");
    ratio = Number(preview.getAttribute("width")) / Number(preview.getAttribute("height"));

    image.alt = thumbnail.dataset.alt || "";
    image.src = thumbnail.dataset.fullSrc;
    caption.replaceChildren();
    [thumbnail.dataset.camera, thumbnail.dataset.details, thumbnail.dataset.date]
      .filter(Boolean)
      .forEach((text) => {
        const item = document.createElement("li");
        item.textContent = text;
        caption.append(item);
      });

    if (!lightbox.open) lightbox.showModal();
    layoutPhoto();
  }

  image.addEventListener("load", () => {
    ratio = image.naturalWidth / image.naturalHeight;
    layoutPhoto();
  });
  new ResizeObserver(() => requestAnimationFrame(layoutPhoto)).observe(lightbox);
  document.fonts.ready.then(layoutPhoto);

  thumbnails.forEach((thumbnail, index) => {
    thumbnail.addEventListener("click", () => showPhoto(index));
  });

  lightbox.querySelector(".photo-lightbox-close").addEventListener("click", () => lightbox.close());
  previous.addEventListener("click", () => showPhoto(activeIndex - 1));
  next.addEventListener("click", () => showPhoto(activeIndex + 1));

  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) lightbox.close();
  });

  lightbox.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") showPhoto(activeIndex - 1);
    if (event.key === "ArrowRight") showPhoto(activeIndex + 1);
  });

  lightbox.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "touch") {
      touchStart = { x: event.clientX, y: event.clientY };
    }
  });

  lightbox.addEventListener("pointerup", (event) => {
    if (!touchStart) return;

    const deltaX = event.clientX - touchStart.x;
    const deltaY = event.clientY - touchStart.y;
    touchStart = null;

    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) < Math.abs(deltaY) * 1.3) return;
    showPhoto(activeIndex + (deltaX < 0 ? 1 : -1));
  });

  lightbox.addEventListener("pointercancel", () => {
    touchStart = null;
  });
}
