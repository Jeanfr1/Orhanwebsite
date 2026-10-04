import { media } from './state.js';

// "A linha prata segue como divisor entre seções … encerra no botão de reserva."
// One SVG path behind the content, through anchor points placed in each section
// (CSS --tx/--ty) and ending on [data-thread-end], drawn as you scroll.
export function initThread() {
  const content = document.querySelector('[data-content]');
  const svg = document.querySelector('[data-thread]');
  const path = svg && svg.querySelector('[data-thread-path]');
  const points = [...document.querySelectorAll('[data-thread-point]')];
  const end = document.querySelector('[data-thread-end]');
  if (!content || !path || points.length < 2) return;

  let length = 0;
  let samples = [];

  function build() {
    const box = content.getBoundingClientRect();
    const W = content.clientWidth;
    const H = content.scrollHeight;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.style.height = `${H}px`;
    const pts = points.map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left - box.left, y: r.top - box.top };
    });
    if (end) {
      // down the gutter to the button's height, then straight into its nearer edge
      const r = end.getBoundingClientRect();
      const last = pts[pts.length - 1];
      const y = r.top - box.top + r.height / 2;
      const fromLeft = last.x < r.left - box.left;
      pts.push({ x: last.x, y: y - 40 });
      pts.push({ x: fromLeft ? r.left - box.left - 2 : r.right - box.left + 2, y });
    }
    let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const k = 0.22;
      const c1 = { x: p1.x + (p2.x - p0.x) * k, y: p1.y + (p2.y - p0.y) * k };
      const c2 = { x: p2.x - (p3.x - p1.x) * k, y: p2.y - (p3.y - p1.y) * k };
      d += ` C${c1.x.toFixed(1)},${c1.y.toFixed(1)} ${c2.x.toFixed(1)},${c2.y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
    }
    path.setAttribute('d', d);
    length = path.getTotalLength();
    samples = [];
    let maxY = -Infinity;
    for (let i = 0; i <= 200; i++) {
      const l = (length * i) / 200;
      maxY = Math.max(maxY, path.getPointAtLength(l).y); // monotonic: never shrinks while going down
      samples.push([maxY, l]);
    }
    path.style.strokeDasharray = `${length} ${length}`;
    draw();
  }

  function draw() {
    if (!length) return;
    if (media.reduced.matches) {
      path.style.strokeDashoffset = '0';
      return;
    }
    const y = window.innerHeight * 0.75 - content.getBoundingClientRect().top;
    let l = 0;
    for (const [sy, sl] of samples) {
      if (sy <= y) l = sl;
      else break;
    }
    path.style.strokeDashoffset = String(length - l);
  }

  let ticking = false;
  window.addEventListener(
    'scroll',
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        draw();
      });
    },
    { passive: true },
  );
  new ResizeObserver(() => build()).observe(content);
  window.addEventListener('load', build, { once: true });
  build();
}
