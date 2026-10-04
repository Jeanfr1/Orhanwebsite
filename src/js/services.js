// "Serviços: a linha continua como régua curta que destaca o item ativo."
// The group crossing the middle of the screen gets the short silver rule.
export function initServices() {
  const groups = [...document.querySelectorAll('[data-service]')];
  if (!groups.length || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => en.target.classList.toggle('is-active', en.isIntersecting));
    },
    { rootMargin: '-46% 0px -46% 0px' },
  );
  groups.forEach((g) => io.observe(g));
}
