// "Find your signature": a card opens a larger view with a booking button.
// Without JavaScript (or without <dialog>) the cards stay plain links to the image.
export function initGallery() {
  const cards = [...document.querySelectorAll('[data-look-card]')];
  const dialog = document.querySelector('[data-lightbox]');
  if (!dialog || !cards.length || typeof dialog.showModal !== 'function') return;

  const img = dialog.querySelector('[data-lightbox-img]');
  const tag = dialog.querySelector('[data-lightbox-tag]');
  const title = dialog.querySelector('[data-lightbox-title]');
  const text = dialog.querySelector('[data-lightbox-text]');
  const count = dialog.querySelector('[data-lightbox-count]');
  let index = 0;
  let opener = null;

  const show = (i) => {
    index = (i + cards.length) % cards.length;
    const card = cards[index];
    img.src = card.getAttribute('href');
    img.alt = card.querySelector('img')?.alt || '';
    tag.textContent = card.dataset.tag || '';
    title.textContent = card.dataset.title;
    text.textContent = card.dataset.text;
    count.textContent = `${index + 1} / ${cards.length}`;
  };

  cards.forEach((card, i) => {
    card.setAttribute('aria-haspopup', 'dialog');
    card.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      opener = card;
      show(i);
      dialog.showModal();
      dialog.querySelector('[data-lightbox-close]').focus();
    });
  });

  dialog.querySelector('[data-lightbox-close]').addEventListener('click', () => dialog.close());
  dialog.querySelector('[data-lightbox-prev]').addEventListener('click', () => show(index - 1));
  dialog.querySelector('[data-lightbox-next]').addEventListener('click', () => show(index + 1));
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') show(index - 1);
    if (e.key === 'ArrowRight') show(index + 1);
  });
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => opener?.focus());
}

