// Every booking call to action goes to Booksy (07-integracao/reserva.json, copied to
// src/data/booking.json). The links already carry the URL in the HTML, so booking works without
// JavaScript; this only keeps them in sync with the config if it changes.
import booking from '../data/booking.json';

export const BOOKING_URL = booking.booking_url;

export function connectBookingButtons(root = document) {
  for (const link of root.querySelectorAll('a[data-booking]')) {
    link.href = BOOKING_URL;
    if (booking.open_in_new_tab) {
      link.target = '_blank';
      link.rel = 'noopener';
    }
  }
}
