// Generates the web images (WebP) from the kit in design/source/kit. The kit's PNGs stay the
// source of truth; run `npm run images` after changing any of them (and
// `python3 scripts/register-razor.py` / `python3 scripts/trace-brand.py` first if a razor layer
// or a brand mark changed).
//
// - Photos get a few widths for srcset.
// - Razor layers are cut to their visible box; src/data/razor.json (from register-razor.py)
//   says where each one sits on the open razor's 1536 x 1024 frame.
// - The portrait cut-out keeps its full frame: it lines up pixel for pixel with
//   look-01-signature-fade.png, which is what makes the hand-off into the gallery invisible.
// - Favicon, touch icon and the social image are drawn from the traced brand SVGs.
import sharp from 'sharp';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const KIT = 'design/source/kit';
const OUT = 'src/assets/img';
const PUBLIC = 'public';
const GRAPHITE = '#101315';

const photo = { quality: 80, effort: 6, smartSubsample: true };
const cutout = { quality: 84, alphaQuality: 92, effort: 6, smartSubsample: true };

await mkdir(OUT, { recursive: true });
await mkdir(path.join(PUBLIC, 'gallery'), { recursive: true });
const report = [];

async function write(input, name, width, options = photo, extract) {
  let img = sharp(input);
  if (extract) img = img.extract(extract);
  const info = await img.resize({ width, withoutEnlargement: true }).webp(options).toFile(path.join(OUT, name));
  report.push(`${name.padEnd(32)} ${String(info.width).padStart(4)}x${String(info.height).padEnd(5)} ${(info.size / 1024).toFixed(0).padStart(4)} KB`);
}
const src = (p) => path.join(KIT, p);
const boxOf = ([x0, y0, x1, y1]) => ({ left: x0, top: y0, width: x1 - x0, height: y1 - y0 });

// ---------- photos ----------
for (const w of [1672, 1200, 800]) await write(src('01-hero/hero-desktop.png'), `hero-desktop-${w}.webp`, w);
for (const w of [1086, 720]) await write(src('01-hero/hero-mobile.png'), `hero-mobile-${w}.webp`, w);
for (const w of [1672, 960]) await write(src('01-hero/fundo-grafite.png'), `graphite-${w}.webp`, w);
for (const w of [1672, 1000]) await write(src('02-animacao/macro-fio-navalha.png'), `macro-${w}.webp`, w);
for (const [file, slug] of [
  ['04-secoes/craft-acabamento.png', 'craft'],
  ['04-secoes/servicos-ferramentas.png', 'services'],
  ['04-secoes/ritual-cadeira-espelho.png', 'ritual'],
]) {
  for (const w of [1672, 1000]) await write(src(file), `${slug}-${w}.webp`, w);
}
const LOOKS = [
  ['03-galeria/look-01-signature-fade.png', 'look-signature-fade'],
  ['03-galeria/look-02-texture-perms.png', 'look-texture-perms'],
  ['03-galeria/look-03-haircut-beard.png', 'look-haircut-beard'],
];
for (const [file, slug] of LOOKS) {
  for (const w of [1086, 640]) await write(src(file), `${slug}-${w}.webp`, w);
  await copyFile(path.join(OUT, `${slug}-1086.webp`), path.join(PUBLIC, 'gallery', `${slug.replace('look-', '')}.webp`));
}

// ---------- razor layers ----------
const razor = JSON.parse(await readFile('src/data/razor.json', 'utf8'));
const open = boxOf(razor.open.box);
for (const w of [open.width, 760]) await write(src('02-animacao/navalha-montada.png'), `razor-open-${w}.webp`, w, cutout, open);
const closed = boxOf(razor.closed.box);
for (const w of [closed.width, 760]) await write(src('02-animacao/navalha-fechada.png'), `razor-closed-${w}.webp`, w, cutout, closed);
for (const [name, file] of [['blade', 'lamina.png'], ['support', 'suporte.png'], ['handle', 'cabo.png']]) {
  const box = boxOf(razor.parts[name].box);
  for (const w of [box.width, 640]) await write(src(`02-animacao/${file}`), `razor-${name}-${w}.webp`, w, cutout, box);
}

// ---------- final portrait (full frame, aligned with look 01) ----------
for (const w of [1086, 720]) await write(src('02-animacao/retrato-final-transparente.png'), `portrait-cutout-${w}.webp`, w, cutout);

// ---------- favicon + touch icon: the traced O on graphite ----------
const monogram = await readFile('src/assets/brand/monogram.svg', 'utf8');
const [, mw, mh] = monogram.match(/viewBox="0 0 (\d+) (\d+)"/).map(Number);
const inner = monogram.replace(/^[\s\S]*?<path/, '<path').replace(/<\/svg>\s*$/, '');
function iconSvg(size, pad, radius) {
  const k = (size * (1 - 2 * pad)) / Math.max(mw, mh);
  const x = (size - mw * k) / 2;
  const y = (size - mh * k) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" rx="${radius}" fill="${GRAPHITE}"/><g fill="#DCE3E8" transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${k.toFixed(4)})">${inner.replace(/ fill="[^"]*"/, '')}</g></svg>\n`;
}
await writeFile(path.join(PUBLIC, 'favicon.svg'), iconSvg(64, 0.12, 12));
await sharp(Buffer.from(iconSvg(64, 0.12, 12))).png().toFile(path.join(PUBLIC, 'favicon.png'));
await sharp(Buffer.from(iconSvg(180, 0.16, 0))).png().toFile(path.join(PUBLIC, 'apple-touch-icon.png'));

// ---------- social preview ----------
{
  const W = 1200;
  const H = 630;
  const photoBuf = await sharp(src('01-hero/hero-desktop.png')).resize({ width: W, height: H, fit: 'cover', position: 'right' }).toBuffer();
  const shade = Buffer.from(
    `<svg width="${W}" height="${H}"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="${GRAPHITE}" stop-opacity="0.96"/><stop offset="0.42" stop-color="${GRAPHITE}" stop-opacity="0.72"/><stop offset="0.72" stop-color="${GRAPHITE}" stop-opacity="0"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`,
  );
  const logo = await sharp(Buffer.from(await readFile('src/assets/brand/logo.svg', 'utf8')), { density: 144 }).resize({ width: 380 }).png().toBuffer();
  const lm = await sharp(logo).metadata();
  await sharp(photoBuf)
    .composite([{ input: shade }, { input: logo, left: 84, top: Math.round((H - lm.height) / 2) }])
    .jpeg({ quality: 84, mozjpeg: true })
    .toFile(path.join(PUBLIC, 'og-image.jpg'));
  report.push('public/og-image.jpg             1200x630');
}

console.log(report.join('\n'));
