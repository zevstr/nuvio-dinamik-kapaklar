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

function number(value) {
  const n = parseFloat(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

export function titleScore(meta, spec, date) {
  const rating = number(meta.imdbRating ?? meta.vote_average ?? meta.rating);
  const votes = number(meta.vote_count ?? meta.voteCount ?? meta.imdbVotes ?? meta.votes);
  const popularity = number(meta.popularity);
  // Rank is a modest fallback when the catalog doesn't expose votes/popularity.
  let score = 22 - Math.min(20, number(meta._sourceRank) * 0.4);
  score += Math.min(10, rating) * 4;
  score += Math.min(22, Math.log10(votes + 1) * 4);
  score += Math.min(18, Math.log10(popularity + 1) * 7);
  if (/^tt\d+$/.test(meta.id)) score += 5;
  const genres = (Array.isArray(meta.genres) ? meta.genres : []).join(' ').toLowerCase();
  // Cover photography favors live-action; animated titles remain in the catalog.
  if(/animation|animasyon/.test(genres))score-=35;
  const runtime = number(meta.runtime);
  if (meta.type === 'movie' && runtime > 0 && runtime < 45) score -= 30;
  if (spec.policy === 'latest') {
    const raw = meta.released ?? meta.releaseDate ?? meta.release_date ?? meta.releaseInfo;
    const match = String(raw ?? '').match(/\d{4}-\d{2}-\d{2}/);
    if (match) {
      const age = (Date.parse(date) - Date.parse(match[0])) / 86400000;
      score += Math.max(0, 24 - Math.max(0, age) / 12);
      if (age < -1) score -= 60;
    }
    if (/talk|news|reality|haber|söyleşi/.test(genres)) score -= 24;
  }
  return score;
}

export function rankedCandidates(metas, spec, date, previous = null) {
  const ranked = metas.map(m => ({meta:m,score:titleScore(m,spec,date)}))
    .sort((a,b)=>b.score-a.score || a.meta.id.localeCompare(b.meta.id));
  const candidates = ranked.slice(0,12);
  const old = ranked.find(x=>x.meta.id===previous?.contentId);
  if (old && !candidates.some(x=>x.meta.id===old.meta.id)) candidates.push(old);
  return candidates;
}

export async function pictureScore(bytes) {
  const info = await sharp(bytes,{limitInputPixels:40_000_000}).metadata();
  const ratio = info.width / info.height;
  // A portrait poster cropped into a wide tile is deliberately not a candidate.
  if (!['jpeg','png','webp','avif'].includes(info.format) || info.width<960 || info.height<540 || ratio<1.45 || ratio>2.5) return null;
  const {data,info:raw} = await sharp(bytes).resize(160,90,{fit:'fill'}).removeAlpha().greyscale().raw().toBuffer({resolveWithObject:true});
  let sum=0,sum2=0,edge=0,edges=0,dark=0,bright=0;
  for(let y=0;y<raw.height;y++) for(let x=0;x<raw.width;x++) {
    const i=y*raw.width+x,v=data[i];sum+=v;sum2+=v*v;
    if(v<12)dark++;if(v>245)bright++;
    if(x){edge+=Math.abs(v-data[i-1]);edges++;}
    if(y){edge+=Math.abs(v-data[i-raw.width]);edges++;}
  }
  const mean=sum/data.length,contrast=Math.sqrt(sum2/data.length-mean*mean),detail=edge/edges;
  if(contrast<12 || detail<1.5 || dark/data.length>.78 || bright/data.length>.78) return null;
  let score=20 + Math.min(18,Math.log2(info.width/960+1)*9);
  score+=Math.max(0,15-Math.abs(ratio-16/9)*25);
  score+=Math.min(10,detail*.7) + Math.min(8,contrast/8);
  return {score,width:info.width,height:info.height};
}

export function selectWinner(candidates, previous = null) {
  const sorted=[...candidates].sort((a,b)=>b.score-a.score || a.meta.id.localeCompare(b.meta.id));
  if(!sorted.length)throw new CoverError('Bu klasör için uygun yatay görsel bulunamadı.');
  const old=previous?.selectionPolicy===2 ? sorted.find(c=>c.meta.id===previous.contentId) : null;
  // Keep a strong current title until a clearly better candidate appears.
  if(old && sorted[0].score < old.score+12)return old;
  return sorted[0];
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
    <text x="111" y="101" font-family="DejaVu Sans,sans-serif" font-size="25" font-weight="600" letter-spacing="3" fill="#fff7ea">${xml((spec.section || 'En Yeniler').toLocaleUpperCase('tr-TR').replace('İMDB','IMDB'))}</text>
    <g font-family="DejaVu Sans,sans-serif" font-weight="bold" fill="#fff7ea" letter-spacing="-5">
      ${lines.map((line, i) => `<text x="76" y="${lines.length===1?751:634+i*117}" font-size="${Math.min(116,Math.floor(1380/(line.length*.75)))}">${xml(line)}</text>`).join('')}
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

const imageCache=new Map();
export async function choosePhoto(metas, spec, date, fetcher = fetch, previous = null) {
  const ranked=rankedCandidates(metas,spec,date,previous), candidates=[];
  for(let start=0;start<ranked.length;start+=4) {
    await Promise.all(ranked.slice(start,start+4).map(async ({meta,score})=>{
      const fields=['background','backdrop'];
      if(meta.posterShape==='landscape')fields.push('poster');
      for(const field of fields) {
        const url=imageUrl(meta[field]);if(!url)continue;
        try {
          const key=url.href;
          if(!imageCache.has(key)) imageCache.set(key,(async()=>{
            const bytes=await download(url,12_000_000,fetcher);
            const quality=await pictureScore(bytes);
            return quality ? {bytes,...quality} : null;
          })().catch(()=>null));
          const picture=await imageCache.get(key);
          if(!picture)continue;
          candidates.push({meta,bytes:picture.bytes,imageKind:field,score:score+picture.score,imageWidth:picture.width,imageHeight:picture.height});
          break;
        } catch { /* Try the next safe image field. */ }
      }
    }));
  }
  return selectWinner(candidates,previous);
}
