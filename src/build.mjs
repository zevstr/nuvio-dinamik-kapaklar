import {readFile, writeFile, mkdir, rm, rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {catalogUrl, download, normalizeCatalog, choosePhoto, renderCover, CoverError, xml} from './core.mjs';
import {buildWeeklyCatalogs,weeklyManifest} from './weekly.mjs';
import {buildPosters} from './posters.mjs';
import {buildWeeklyPosters} from './weekly-posters.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const specs = JSON.parse(await readFile(`${root}covers.json`, 'utf8'));
const today = new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const output = `${root}dist`;
const staging = `${root}.staging`;
const PUBLIC_BASE='https://zevstr.github.io/nuvio-dinamik-kapaklar/';
const catalogCache=new Map();
let fallbackSeeds=[];
try{fallbackSeeds=JSON.parse(await readFile(`${root}fallbacks/sources.json`,'utf8'));}catch{}

async function fallbackPhoto(spec,old){
  if(old?.contentId&&!old.empty){
    try{return {bytes:await download(new URL(`${PUBLIC_BASE}covers/${spec.slug}-hero.jpg`),12_000_000),contentId:old.contentId,contentName:old.contentName};}catch{}
  }
  const seed=fallbackSeeds.find(s=>s.slug===spec.slug);
  if(seed){try{return {...seed,bytes:await readFile(`${root}fallbacks/${spec.slug}.jpg`)};}catch{}}
  return null;
}

async function readSource(manifest,source,latest) {
  const pages=/imdb_top250/.test(source.catalogId)?5:(/imdb_top100/.test(source.catalogId)?2:(latest?4:1));
  const key=`${source.catalogType}:${source.catalogId}:${pages}`;
  if(!catalogCache.has(key))catalogCache.set(key,(async()=>{
    const all=[],seen=new Set();
    for(let page=0;page<pages;page++) {
      const url=catalogUrl(manifest,source);
      if(page)url.pathname=url.pathname.replace(/\.json$/,`/skip=${all.length}.json`);
      let payload;
      try {payload=JSON.parse((await download(url,5_000_000)).toString());}
      catch(error) {if(page)break;throw new CoverError('Katalog okunamadı.');}
      let items=normalizeCatalog(payload);
      // A first request can start the upstream catalog's background refresh.
      for(let retry=0;page===0&&!items.length&&retry<2;retry++){
        await new Promise(resolve=>setTimeout(resolve,3000));
        try{items=normalizeCatalog(JSON.parse((await download(url,5_000_000)).toString()));}catch{break;}
      }
      const fresh=items.filter(m=>!seen.has(m.id));
      for(const m of fresh){seen.add(m.id);all.push({...m,_sourceRank:all.length});}
      if(!fresh.length || items.length<20)break;
    }
    return all;
  })());
  return catalogCache.get(key);
}

async function previousState() {
  try {
    const state=JSON.parse((await download(new URL(`${PUBLIC_BASE}status.json`),2_000_000)).toString());
    return Array.isArray(state.covers)?state.covers:[];
  }catch{return [];}
}

try {
  const manifest = process.env.XPERIENCE_MANIFEST_URL?.trim();
  if (!manifest) throw new CoverError('XPERIENCE_MANIFEST_URL gizli ayarı henüz eklenmedi.');
  const previous=await previousState();
  // Avoid any raw URL, response body, profile config or key in logs/public output.
  await rm(staging, {recursive:true, force:true});
  await mkdir(`${staging}/covers`,{recursive:true});
  const weekly=await buildWeeklyCatalogs(manifest,readSource);
  weekly.posterStatus=await buildWeeklyPosters(weekly,staging);
  await mkdir(`${staging}/catalog/series`,{recursive:true});
  await writeFile(`${staging}/manifest.json`,JSON.stringify(weeklyManifest()));
  await writeFile(`${staging}/catalog/series/weekly-local.json`,JSON.stringify({metas:weekly.local}));
  await writeFile(`${staging}/catalog/series/weekly-foreign.json`,JSON.stringify({metas:weekly.foreign}));
  await writeFile(`${staging}/weekly-status.json`,JSON.stringify({...weekly,local:weekly.local.length,foreign:weekly.foreign.length},null,2));
  console.log(`Son 7 gün: ${weekly.inspected} dizi incelendi; ${weekly.local.length} yerli, ${weekly.foreign.length} yabancı; ${weekly.failed} yanıt alınamadı.`);
  const posterStatus=await buildPosters(manifest,readSource,staging);
  console.log(`Türkçe afişler: ${posterStatus.generated}/${posterStatus.candidates} hazır.`);
  const entries = [];
  for (const spec of specs) {
    if (!/^[a-z0-9-]+$/.test(spec.slug)) throw new CoverError('Kapak dosya adı geçersiz.');
    const seen=new Set(),metas=[];
    let sourceSuccess=0;
    if(spec.weeklyRole){sourceSuccess=1;for(const m of weekly[spec.weeklyRole])metas.push({...m,released:m.lastEpisodeReleased});}
    for(let start=0;!spec.weeklyRole&&start<spec.sources.length;start+=4) {
      const sourceResults=await Promise.allSettled(spec.sources.slice(start,start+4).map(s=>readSource(manifest,s,spec.policy==='latest')));
      for(const r of sourceResults)if(r.status==='fulfilled'){
        sourceSuccess++;
        for(const m of r.value)if(!seen.has(m.id)){seen.add(m.id);metas.push(m);}
      }
    }
    const old=previous.find(p=>p.slug===spec.slug);
    const fallback=metas.length?null:await fallbackPhoto(spec,old);
    if(!sourceSuccess&&!fallback)throw new CoverError(`${spec.slug}: hiçbir katalog kaynağı okunamadı; mevcut yayın korunuyor.`);
    console.log(`${spec.slug}: ${metas.length} aday, ${sourceSuccess} katalog kaynağı.`);
    const selected = metas.length ? await choosePhoto(metas,spec,today,fetch,old) : null;
    const {cover, hero} = await renderCover(selected?.bytes??fallback?.bytes,spec,selected?.meta.name??fallback?.contentName,!selected&&!fallback);
    const hash = createHash('sha256').update(cover).digest('hex').slice(0,12);
    await writeFile(`${staging}/covers/${spec.slug}.jpg`,cover);
    await writeFile(`${staging}/covers/${spec.slug}-hero.jpg`,hero);
    await writeFile(`${staging}/covers/${spec.slug}-${hash}.jpg`,cover);
    entries.push({slug:spec.slug,title:spec.heading.join(' '),section:spec.section,updated:today,selectedAt:old&&selected&&old.contentId===selected.meta.id ? old.selectedAt||today : today,contentId:selected?.meta.id??fallback?.contentId??null,contentName:selected?.meta.name??fallback?.contentName??null,empty:!selected&&!fallback,artworkFallback:!!fallback,catalogEmpty:!metas.length,sha256:hash,imageKind:selected?.imageKind??(fallback?'previous':'none'),selectionPolicy:3,selectionScore:selected?Math.round(selected.score*10)/10:null,imageWidth:selected?.imageWidth??null,imageHeight:selected?.imageHeight??null,candidateCount:metas.length});
    console.log(`${spec.slug}: ${selected ? 'güncel katalogdan gerçek görsel hazır' : 'boş katalog için bekleme kapağı hazır'}.`);
  }
  await writeFile(`${staging}/status.json`,JSON.stringify({updated:today,selectionPolicy:3,covers:entries},null,2));
  await writeFile(`${staging}/.nojekyll`,'');
  const health=`<aside class="health" aria-label="Güncelleme durumu"><strong>Son tarama: ${xml(new Intl.DateTimeFormat('tr-TR',{timeZone:'Europe/Istanbul',dateStyle:'short',timeStyle:'short'}).format(new Date(weekly.generatedAt)))} · Türkiye saati</strong><p>${entries.length} kapak · ${weekly.local.length} yerli / ${weekly.foreign.length} yabancı dizi · ${weekly.inspected}/${weekly.candidateCount} aday yanıtı · ${weekly.failed} ayrıntı hatası · ${weekly.recovered} kurtarılan istek</p><p>Son 7 gün listeleri yayınlanan bölüm tarihine göredir. Tarama seçili adaylarla sınırlıdır; oynatma bağlantısı doğrulanmaz.</p><p id="freshness" data-generated="${xml(weekly.generatedAt)}"></p></aside>`;
  const cards = entries.map(e=>`<article data-section="${xml(e.section)}"><img src="covers/${e.slug}-${e.sha256}.jpg" alt="${xml(e.title)}"><h2>${xml(e.title)}</h2><p>${xml(e.artworkFallback ? 'Korunan kapak: '+e.contentName+' · katalog yanıtı bekleniyor' : e.contentName || 'Yeni içerikler bekleniyor')}</p><label>Xperience kapak bağlantısı</label><input readonly data-cover="covers/${e.slug}.jpg" aria-label="${xml(e.title)} kapak bağlantısı"><button type="button">Bağlantıyı kopyala</button><p class="small">Güncelleme: ${today}</p></article>`).join('');
  await writeFile(`${staging}/index.html`,`<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ozan · Güncel Kapaklar</title><style>*{box-sizing:border-box}body{background:#0b0f14;color:#f8f4ec;font:16px/1.5 system-ui;margin:0;padding:50px 22px}main{max-width:1400px;margin:auto}.gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:22px}article[hidden]{display:none}select{background:#151c25;color:#fff;padding:12px;border:1px solid #384455;border-radius:8px;margin:12px 0 28px}h1{font-size:clamp(30px,5vw,56px);line-height:1.1}header p{color:#aeb7c4;max-width:650px}article{margin:0;background:#151c25;border:1px solid #27303b;border-radius:22px;overflow:hidden;padding:0 25px 22px}img{width:calc(100% + 50px);margin-left:-25px;display:block}h2{font-size:19px;margin-bottom:0}p{color:#bfc6d0}label{display:block;margin:20px 0 8px;font-size:13px}input{width:100%;background:#0c121b;border:1px solid #384455;border-radius:8px;padding:12px;color:#e4cfaa}button{margin-top:12px;padding:12px 18px;background:#e8c58f;border:0;border-radius:8px;cursor:pointer;font-weight:700}.small,footer{font-size:12px;color:#98a3b0}a{color:#e8c58f}.health{padding:18px 22px;border:1px solid #384455;border-radius:14px;background:#151c25;margin:24px 0}.health p{margin:8px 0 0;font-size:14px}</style><main><header><p>OZAN · SİNEMA KOLEKSİYONLARI</p><h1>Güncel hikâyeler.<br>Gerçek fotoğraflar.</h1><p>Kendi kategorisinin yapımlarından seçilen güçlü görseller. Kapaklar her gün değerlendirilir; daha iyi bir aday bulunduğunda yenilenir.</p></header>${health}<select id="section" aria-label="Koleksiyon seç"><option value="">Tüm koleksiyonlar · ${entries.length} kapak</option>${[...new Set(entries.map(e=>e.section))].map(s=>`<option>${xml(s)}</option>`).join('')}</select><div class="gallery">${cards}</div><footer>Görseller ilgili yapımların hak sahiplerine aittir. Bu ürün TMDB API'sini kullanan Xperience katalog verilerinden yararlanır; TMDB tarafından onaylanmış veya sertifikalandırılmış değildir. <a href="https://www.themoviedb.org/">TMDB</a><p>Otomatik çalışma günlük planlanır; GitHub yoğunluğunda gecikebilir. Nuvio'nun görsel önbelleği nedeniyle cihazda görünmesi daha geç olabilir.</p></footer></main><script>const fresh=document.querySelector('#freshness');const age=Date.now()-Date.parse(fresh.dataset.generated);fresh.textContent=age>36*3600000?'Son başarılı tarama 36 saatten eski. Listelerin güncelliğini kontrol edin.':'Günlük yenileme planı · 06.17';if(age>36*3600000)fresh.style.color='#ffd17a';document.querySelector("#section").onchange=e=>document.querySelectorAll("article").forEach(a=>a.hidden=!!e.target.value&&a.dataset.section!==e.target.value);document.querySelectorAll('[data-cover]').forEach(e=>e.value=new URL(e.dataset.cover,location.href).href);document.querySelectorAll('button').forEach(b=>b.onclick=async()=>{try{await navigator.clipboard.writeText(b.previousElementSibling.value);b.textContent='Kopyalandı'}catch{b.previousElementSibling.select();b.textContent='Bağlantıyı seçip kopyala'}})</script></html>`);
  await rm(output,{recursive:true,force:true});
  await rename(staging,output);
} catch (error) {
  // Never log external error messages: libraries can include credential-bearing URLs.
  console.error(error instanceof CoverError ? error.message : 'Kapak üretilemedi. Önceki yayın korunuyor.');
  if(!(error instanceof CoverError))console.error(String(error.stack??'').match(/src\/\w+\.mjs:\d+:\d+/g)?.join(' ')??'Yerel üretim hatası.');
  await rm(staging,{recursive:true,force:true});
  process.exitCode=1;
}
