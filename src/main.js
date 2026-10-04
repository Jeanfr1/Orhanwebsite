import '@fontsource-variable/archivo/wdth.css';
import './styles/main.css';

import { connectBookingButtons } from './js/booking.js';
import { initAnchors } from './js/scroll.js';
import { initHeader } from './js/header.js';
import { initHero } from './js/hero.js';
import { initGallery } from './js/gallery.js';
import { initServices } from './js/services.js';
import { initStickyBooking } from './js/sticky.js';
import { initThread } from './js/thread.js';
import { initReveal } from './js/reveal.js';

const year = document.querySelector('[data-year]');
if (year) year.textContent = String(new Date().getFullYear());

connectBookingButtons();
initAnchors();
initHeader();
initHero();
initGallery();
initServices();
initStickyBooking();
initReveal();
initThread();
