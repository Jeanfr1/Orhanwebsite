// Destino direto contido no link fornecido para a ORHAN.
export const BOOKING_URL = "https://orhanbarberltd.booksy.com/a/?utm_source=ig&utm_medium=social&utm_content=link_in_bio&fbclid=PAZXh0bgNhZW0CMTEAcGRvZgJzcnRjBmFwcF9pZA85MzY2MTk3NDMzOTI0NTkAAaeIp1XU5TobhJ1ERDCB6ugv6LYDhFGNoRmTMPQRL_qvHaxrItxKLSLRjyWJcA_aem_ET2kGJVyXgOJKqShhH49lw";

export function connectBookingButtons(root = document) {
  for (const link of root.querySelectorAll('a[data-booking]')) {
    link.href = BOOKING_URL;
    link.target = '_blank';
    link.rel = 'noopener';
  }
}
