// Phones: a booking button pinned to the bottom once the hero has gone, out of the way
// again wherever another booking button is already in view (the closing call, the footer).
export function initStickyBooking() {
  const bar = document.querySelector('[data-sticky-book]');
  const track = document.querySelector('[data-hero-track]');
  if (!bar || !track || !('IntersectionObserver' in window)) return;
  const covering = [document.querySelector('[data-thread-end]'), document.querySelector('.site-footer')].filter(Boolean);
  let pastHero = false;
  const inView = new Set();
  const update = () => bar.classList.toggle('is-shown', pastHero && inView.size === 0);

  new IntersectionObserver(([en]) => {
    pastHero = !en.isIntersecting && en.boundingClientRect.top < 0;
    update();
  }).observe(track);
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => (en.isIntersecting ? inView.add(en.target) : inView.delete(en.target)));
    update();
  });
  covering.forEach((el) => io.observe(el));
}
