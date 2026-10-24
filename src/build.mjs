import {readFile, writeFile, mkdir, rm, rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {catalogUrl, download, normalizeCatalog, choosePhoto, renderCover, CoverError, xml} from './core.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const specs = JSON.parse(await readFile(`${root}covers.json`, 'utf8'));
const today = new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const output = `${root}dist`;
const staging = `${root}.staging`;

try {
  const manifest = process.env.XPERIENCE_MANIFEST_URL?.trim();
  if (!manifest) throw new CoverError('XPERIENCE_MANIFEST_URL gizli ayarı henüz eklenmedi.');
  // Avoid any raw URL, response body, profile config or key in logs/public output.
  await rm(staging, {recursive:true, force:true});
  await mkdir(`${staging}/covers`,{recursive:true});
  const entries = [];
  for (const spec of specs) {
    if (!/^[a-z0-9-]+$/.test(spec.slug)) throw new CoverError('Kapak dosya adı geçersiz.');
    const raw = await download(catalogUrl(manifest, spec), 5_000_000);
    let payload;
    try { payload = JSON.parse(raw.toString()); } catch { throw new CoverError('Katalog JSON yanıtı geçersiz.'); }
    const metas = normalizeCatalog(payload);
    const selected = metas.length ? await choosePhoto(metas, spec, today) : null;
    const {cover, hero} = await renderCover(selected?.bytes, spec, selected?.meta.name, !selected);
    const hash = createHash('sha256').update(cover).digest('hex').slice(0,12);
    await writeFile(`${staging}/covers/${spec.slug}.jpg`,cover);
    await writeFile(`${staging}/covers/${spec.slug}-hero.jpg`,hero);
    await writeFile(`${staging}/covers/${spec.slug}-${hash}.jpg`,cover);
    entries.push({slug:spec.slug,title:spec.heading.join(' '),updated:today,contentId:selected?.meta.id ?? null,contentName:selected?.meta.name ?? null,empty:!selected,sha256:hash,imageKind:selected?.imageKind ?? null});
    console.log(`${spec.slug}: ${selected ? 'güncel katalogdan gerçek görsel hazır' : 'boş katalog için bekleme kapağı hazır'}.`);
  }
  await writeFile(`${staging}/status.json`,JSON.stringify({updated:today,covers:entries},null,2));
  await writeFile(`${staging}/.nojekyll`,'');
  const cards = entries.map(e=>`<article><img src="covers/${e.slug}-${e.sha256}.jpg" alt="${xml(e.title)}"><h2>${xml(e.title)}</h2><p>${xml(e.contentName || 'Yeni içerikler bekleniyor')}</p><label>Xperience kapak bağlantısı</label><input readonly data-cover="covers/${e.slug}.jpg" aria-label="${xml(e.title)} kapak bağlantısı"><button type="button">Bağlantıyı kopyala</button><p class="small">Güncelleme: ${today}</p></article>`).join('');
  await writeFile(`${staging}/index.html`,`<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ozan · Güncel Kapaklar</title><style>*{box-sizing:border-box}body{background:#0b0f14;color:#f8f4ec;font:16px/1.5 system-ui;margin:0;padding:50px 22px}main{max-width:1100px;margin:auto}h1{font-size:clamp(30px,5vw,56px);line-height:1.1}header p{color:#aeb7c4;max-width:650px}article{margin:40px 0;background:#151c25;border:1px solid #27303b;border-radius:22px;overflow:hidden;padding:0 25px 22px}img{width:calc(100% + 50px);margin-left:-25px;display:block}h2{font-size:23px;margin-bottom:0}p{color:#bfc6d0}label{display:block;margin:20px 0 8px;font-size:13px}input{width:100%;background:#0c121b;border:1px solid #384455;border-radius:8px;padding:12px;color:#e4cfaa}button{margin-top:12px;padding:12px 18px;background:#e8c58f;border:0;border-radius:8px;cursor:pointer;font-weight:700}.small,footer{font-size:12px;color:#98a3b0}a{color:#e8c58f}</style><main><header><p>OZAN · SİNEMA KOLEKSİYONLARI</p><h1>Güncel hikâyeler.<br>Gerçek fotoğraflar.</h1><p>Koleksiyonun güncel listesinden seçilen gerçek film görselleri. Türkçe başlık sabit kalır, fotoğraf yenilenir.</p></header>${cards}<footer>Görseller ilgili yapımların hak sahiplerine aittir. Bu ürün TMDB API'sini kullanan Xperience katalog verilerinden yararlanır; TMDB tarafından onaylanmış veya sertifikalandırılmış değildir. <a href="https://www.themoviedb.org/">TMDB</a><p>Otomatik çalışma günlük planlanır; GitHub yoğunluğunda gecikebilir. Nuvio'nun görsel önbelleği nedeniyle cihazda görünmesi daha geç olabilir.</p></footer></main><script>document.querySelectorAll('[data-cover]').forEach(e=>e.value=new URL(e.dataset.cover,location.href).href);document.querySelectorAll('button').forEach(b=>b.onclick=async()=>{try{await navigator.clipboard.writeText(b.previousElementSibling.value);b.textContent='Kopyalandı'}catch{b.previousElementSibling.select();b.textContent='Bağlantıyı seçip kopyala'}})</script></html>`);
  await rm(output,{recursive:true,force:true});
  await rename(staging,output);
} catch (error) {
  // Never log external error messages: libraries can include credential-bearing URLs.
  console.error(error instanceof CoverError ? error.message : 'Kapak üretilemedi. Önceki yayın korunuyor.');
  await rm(staging,{recursive:true,force:true});
  process.exitCode=1;
}
