import sharp from 'sharp';

export class CoverError extends Error {}
const trustedImages = new Set(['image.tmdb.org', 'images.metahub.space', 'img.metahub.space']);
export const WIDTH = 1600;
export const HEIGHT = 900;

export function catalogUrl(manifest, spec) {
  let u;
  try { u = new URL(manifest); } catch { throw new CoverError('Kurulum bağlantısı geçersiz.'); }
  if (u.protocol !== 'https:' || u.hostname !== 'xperience-app.com' || u.username || u.password ||
      !u.pathname.endsWith('/manifest.json') || u.hash) {
    throw new CoverError('HTTPS Xperience manifest bağlantısı gerekiyor.');
  }
  const base = u.pathname.slice(0, -'manifest.json'.length);
  u.pathname = `${base}catalog/${encodeURIComponent(spec.catalogType)}/${encodeURIComponent(spec.catalogId)}.json`;
  return u;
}

export function imageUrl(value) {
  try {
    const u = new URL(value);
    // Never contact arbitrary catalog-supplied hosts or publish credential-bearing URLs.
    if (u.protocol !== 'https:' || !trustedImages.has(u.hostname) || u.port || u.username || u.password || u.search || u.hash) return null;
    return u;
  } catch { return null; }
}

export async function download(url, limit, fetcher = fetch) {
  let response;
  try { response = await fetcher(url, {redirect: 'error', signal: AbortSignal.timeout(30000), headers: {'User-Agent': 'NuvioCoverBot/0.1'}}); }
  catch { throw new CoverError('Kaynak bağlantısına ulaşılamadı.'); }
  if (!response.ok) throw new CoverError(`Kaynak yanıtı başarısız (${response.status}).`);
  if (Number(response.headers.get('content-length')) > limit) throw new CoverError('Kaynak boyut sınırını aşıyor.');
  if (!response.body) throw new CoverError('Kaynak boş yanıt verdi.');
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > limit) throw new CoverError('Kaynak boyut sınırını aşıyor.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export function normalizeCatalog(payload) {
  if (!Array.isArray(payload?.metas)) throw new CoverError('Katalog yanıtında metas listesi bulunamadı.');
  const seen = new Set();
  return payload.metas.filter(m => {
    if (!m || typeof m.id !== 'string' || !m.id || typeof m.name !== 'string' || !m.name || seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}

export function orderedCandidates(metas, date, poolSize = 8) {
  const pool = metas.slice(0, Math.max(1, Math.min(20, poolSize)));
  if (!pool.length) return [];
  const day = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400000);
  if (!Number.isFinite(day)) throw new CoverError('Tarih geçersiz.');
  const offset = ((day % pool.length) + pool.length) % pool.length;
  return [...pool.slice(offset), ...pool.slice(0, offset)];
}

export function xml(value) {
  return String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[x]));
}

export function overlay(spec, name, empty = false) {
  const lines = spec.heading.slice(0, 2);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
    <defs>
      <linearGradient id="bottom" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#05090e" stop-opacity="0"/><stop offset=".5" stop-color="#05090e" stop-opacity=".4"/><stop offset="1" stop-color="#05090e" stop-opacity=".97"/></linearGradient>
      <linearGradient id="side"><stop stop-color="#05090e" stop-opacity=".4"/><stop offset=".8" stop-color="#05090e" stop-opacity="0"/></linearGradient>
    </defs>
    <rect width="1600" height="900" fill="url(#side)"/>
    <rect y="300" width="1600" height="600" fill="url(#bottom)"/>
    <rect x="82" y="75" width="8" height="33" rx="4" fill="#e8c58f"/>
    <text x="111" y="101" font-family="DejaVu Sans,sans-serif" font-size="25" font-weight="600" letter-spacing="3" fill="#fff7ea">EN YENİLER</text>
    <g font-family="DejaVu Sans,sans-serif" font-weight="bold" fill="#fff7ea" letter-spacing="-5">
      ${lines.map((line, i) => `<text x="76" y="${634+i*117}" font-size="116">${xml(line)}</text>`).join('')}
    </g>
    <rect x="82" y="793" width="55" height="3" fill="#e8c58f"/>
    <text x="158" y="805" font-family="DejaVu Sans,sans-serif" font-size="25" font-weight="500" letter-spacing="2" fill="#e4e0d7">${xml(empty ? 'YENİ İÇERİKLER BEKLENİYOR' : spec.subtitle)}</text>
    ${!empty && name ? `<text x="1516" y="852" text-anchor="end" font-family="DejaVu Sans,sans-serif" font-size="20" fill="#d3d3d3">${xml(name.slice(0, 65))}</text>` : ''}
  </svg>`);
}

export async function renderCover(bytes, spec, name, empty = false) {
  const base = bytes ? sharp(bytes, {limitInputPixels: 40_000_000, animated: false}).rotate().resize(WIDTH, HEIGHT, {fit:'cover', position:'attention'}) : sharp({create:{width:WIDTH,height:HEIGHT,channels:3,background:'#141e28'}});
  const hero = await base.jpeg({quality:92, mozjpeg:true}).toBuffer();
  const cover = await sharp(hero).composite([{input:overlay(spec, name, empty)}]).jpeg({quality:92, mozjpeg:true}).toBuffer();
  return {cover, hero};
}

export async function choosePhoto(metas, spec, date, fetcher = fetch) {
  for (const meta of orderedCandidates(metas, date, spec.rotationPool)) {
    for (const field of ['background', 'backdrop', 'poster']) {
      const url = imageUrl(meta[field]);
      if (!url) continue;
      try {
        const bytes = await download(url, 12_000_000, fetcher);
        const info = await sharp(bytes, {limitInputPixels:40_000_000}).metadata();
        if (!['jpeg','png','webp','avif'].includes(info.format) || info.width < 640 || info.height < 360) continue;
        return {meta, bytes, imageKind:field};
      } catch {
        // A broken artwork must not prevent trying another title in the same current catalog.
      }
    }
  }
  throw new CoverError('Güncel listedeki içerikler için uygun gerçek görsel bulunamadı; önceki yayın korunacak.');
}
