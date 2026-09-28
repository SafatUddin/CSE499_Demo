// Scale the fixed-width Figma layout to fit tablet widths, and the
// Visual-intelligence scanner stage to its panel on mobile.
const DESIGN_WIDTH = 1379;
const SCANNER_WIDTH = 628.871;
const FOOTER_ART_REACH = 901.5;

function fitLayout() {
  const vw = document.documentElement.clientWidth;
  document.documentElement.style.setProperty("--fit", Math.min(1, vw / DESIGN_WIDTH));
  // Footer art reaches 901.5px right of the page centre; scale up beyond that.
  document.documentElement.style.setProperty("--wide", Math.max(1, vw / 2 / FOOTER_ART_REACH));

  const panel = document.querySelector(".feature__media--visual");
  if (panel) panel.style.setProperty("--vscale", panel.clientWidth / SCANNER_WIDTH);
}

fitLayout();
window.addEventListener("resize", fitLayout);

// Ensure the hero background video starts even where autoplay is flaky.
document.addEventListener("DOMContentLoaded", () => {
  const video = document.querySelector(".hero__video");
  if (!video) return;

  video.muted = true;
  const tryPlay = () => video.play().catch(() => {});
  tryPlay();

  // Retry on first user interaction if the browser blocked autoplay.
  ["click", "touchstart", "scroll"].forEach((evt) =>
    window.addEventListener(evt, tryPlay, { once: true, passive: true })
  );

  // Pause when off-screen to save resources.
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      entry.isIntersecting ? tryPlay() : video.pause();
    }).observe(video);
  }
});
