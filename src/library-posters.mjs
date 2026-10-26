import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {join} from 'node:path';
import {download,imageUrl,CoverError} from './core.mjs';
import {renderPoster,posterLabels} from './posters.mjs';
import {titleArtwork} from './tmdb-trends.mjs';

const BASE='https://zevstr.github.io/nuvio-dinamik-kapaklar/';
const DAY=86400000;
export function posterIdentity(item,sourceType){
  const type=item.type??sourceType;
  return /^tt\d+$/.test(item.id)&&['movie','series'].includes(type)?{id:item.id,type}:null;
}
export function posterSources(specs,manifest){
  const sources=specs.flatMap(s=>s.sources??[]);
  for(const c of manifest?.catalogs??[])if(['movie','series'].includes(c.type)&&typeof c.id==='string')sources.push({catalogType:c.type,catalogId:c.id});
  return [...new Map(sources.filter(s=>['movie','series'].includes(s.catalogType)&&typeof s.catalogId==='string').map(s=>[`${s.catalogType}:${s.catalogId}`,s])).values()];
}
export function trustedDetail(payload,identity){
  const m=payload?.meta;
  if(m?.id!==identity.id||(m.type&&m.type!==identity.type))return null;
  const photo=imageUrl(m.poster);
  if(photo?.hostname==='images.metahub.space')photo.pathname=photo.pathname.replace('/poster/small/','/poster/medium/');
  return {id:identity.id,type:identity.type,name:typeof m.name==='string'?m.name.slice(0,300):identity.id,
    genres:Array.isArray(m.genres)?m.genres.filter(g=>typeof g==='string'):[],imdbRating:m.imdbRating,
    poster:photo?.href??null};
}

// One shared identity path across every catalog. Never infer a rating from TMDB or
// infer a stream's audio language from a title's country or original language.
export async function buildLibraryPosters(manifestUrl,readSource,specs,output,{
  cacheDir='.poster-cache',fetcher=fetch,now=Date.now(),maxTitles=8000,concurrency=8,tmdbToken=process.env.TMDB_READ_ACCESS_TOKEN,
}={}){
  let manifest;
  try{manifest=JSON.parse((await download(new URL(manifestUrl),5_000_000,fetcher)).toString());}catch{manifest={};}
  const sources=posterSources(specs,manifest),items=new Map();let sourcesFailed=0;
  for(let i=0;i<sources.length;i+=4){
    const batch=sources.slice(i,i+4);
    const results=await Promise.allSettled(batch.map(s=>readSource(manifestUrl,s,false)));
    for(let n=0;n<results.length;n++){
      const r=results[n];if(r.status!=='fulfilled'){sourcesFailed++;continue;}
      // The first fetched page for normal catalogs, and all fetched IMDb 250 pages.
      // No title outside this scan is represented as covered in the status.
      for(const item of r.value){const identity=posterIdentity(item,batch[n].catalogType);if(identity)items.set(`${identity.type}/${identity.id}`,identity);}
    }
  }
  // Stable examples also make provider verification independent of changing lists.
  for(const item of [{type:'movie',id:'tt0133093'},{type:'movie',id:'tt0816692'},{type:'movie',id:'tt0111161'},{type:'series',id:'tt0903747'}])items.set(`${item.type}/${item.id}`,item);
  if(items.size>maxTitles)throw new CoverError('Ortak afiş taraması güvenli yayın boyutunu aşıyor; önceki yayın korunuyor.');
  if(sourcesFailed>Math.max(3,sources.length*.15))throw new CoverError('Ortak afiş kataloglarının çoğu okunamadı; önceki yayın korunuyor.');
  await mkdir(cacheDir,{recursive:true});
  for(const type of ['movie','series'])await mkdir(join(output,'art',type),{recursive:true});
  const entries=[];let generated=0,reused=0,retained=0,failed=0,totalBytes=0;
  const list=[...items.values()];
  const generate=async identity=>{
    const key=`${identity.type}-${identity.id}`,jpg=join(cacheDir,`${key}.jpg`),json=join(cacheDir,`${key}.json`);
    const destination=join(output,'art',identity.type,`${identity.id}.jpg`);
    let cached;
    try{cached=JSON.parse(await readFile(json,'utf8'));if(![2,3].includes(cached.schema)||cached.id!==identity.id||cached.type!==identity.type)cached=null;}catch{}
    const verifiedArt=cached?.artworkSource==='TMDB exact IMDb lookup';
    const keep=async()=>{const bytes=await readFile(jpg);if(!bytes.length)throw Error();await copyFile(jpg,destination);totalBytes+=bytes.length;entries.push({...cached,stale:now-cached.updatedAt>=DAY});};
    if(verifiedArt&&now-cached.updatedAt<DAY){try{await keep();reused++;return;}catch{}}
    try{
      let imdbRating;
      // Reuse only a fresh, previously validated Cinemeta rating, never its art.
      if(cached&&now-cached.updatedAt<DAY&&/^IMDB \d{1,2},\d$/.test(cached.rating??''))imdbRating=cached.rating.slice(5).replace(',','.');
      else try{
        imdbRating=trustedDetail(JSON.parse((await download(new URL(`https://v3-cinemeta.strem.io/meta/${identity.type}/${identity.id}.json`),2_000_000,fetcher)).toString()),identity)?.imdbRating;
      }catch{}
      const artwork=await titleArtwork(identity,tmdbToken,fetcher);
      if(!artwork?.poster)throw Error();
      // Generic image-CDN lookups can return a different show's image. All art
      // must now come from a single exact, correctly typed TMDB find result.
      const detail={...artwork,imdbRating};
      const bytes=await renderPoster(await download(new URL(artwork.poster),12_000_000,fetcher),detail);
      const entry={schema:3,...identity,name:detail.name,...posterLabels(detail),artworkSource:'TMDB exact IMDb lookup',updatedAt:now};
      await writeFile(jpg,bytes);await writeFile(json,JSON.stringify(entry));
      await writeFile(destination,bytes);totalBytes+=bytes.length;entries.push(entry);generated++;
    }catch{
      if(verifiedArt){try{await keep();retained++;return;}catch{}}
      // A cache miss is deliberately a 404, allowing Xperience to use original art.
      // A generic placeholder here would falsely count as a successful provider image.
      failed++;
    }
  };
  for(let i=0;i<list.length;i+=concurrency){
    await Promise.all(list.slice(i,i+concurrency).map(generate));
    if(totalBytes>800_000_000)throw new CoverError('Ortak afiş yayın boyutu sınırda; önceki yayın korunuyor.');
    if(i%120===0)console.log(`Ortak afişler: ${Math.min(i+concurrency,list.length)}/${list.length} işlendi.`);
  }
  if(!entries.length||failed>Math.max(5,list.length*.15))throw new CoverError('Ortak afiş üretimi tamamlanamadı; önceki yayın korunuyor.');
  const status={schema:1,generatedAt:new Date(now).toISOString(),sources:sources.length,sourcesFailed,candidates:items.size,
    available:entries.length,generated,reused,retained,failed,bytes:totalBytes,ratingSource:'Cinemeta imdbRating',
    scope:'Configured catalog pages, not the complete movie/TV universe',template:`${BASE}art/{type}/{imdb_id}.jpg`,
    fallback:'Xperience original artwork; provider fallback must be verified before activation'};
  await writeFile(join(output,'art','status.json'),JSON.stringify(status,null,2));
  const examples=entries.filter(e=>['tt0133093','tt0816692','tt0111161','tt0903747'].includes(e.id)).concat(entries.filter(e=>e.genre&&e.rating).slice(0,8));
  await writeFile(join(output,'art','index.html'),`<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ozan · Ortak Türkçe Afişler</title><style>body{background:#0b0f14;color:#fff;font:18px system-ui;margin:32px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:24px}img{width:100%;border-radius:14px}article{max-width:300px}p{line-height:1.6;color:#cbd1da}</style><h1>Ortak Türkçe Afişler</h1><p>${status.sources} katalog kaynağı tarandı · ${status.available} afiş hazır · ${status.retained} önceki afiş korundu · ${status.failed} yapımda orijinal afişe dönüş gerekiyor.</p><p>Türkçe tür ve doğrulanabilen IMDB puanı. Saat 06.00 / 16.00 taraması; afiş ve puan önbelleği en fazla 24 saat. İzleme bağlantısı veya ses dili doğrulanmaz. Kataloglarda taranan sayfaların dışındaki yapımlara Türkçe afiş garantisi verilmez.</p><main>${examples.map(e=>`<article><img src="${e.type}/${e.id}.jpg" alt="${e.id}"></article>`).join('')}</main><p>Görseller ilgili yapımların hak sahiplerine aittir. Puan kaynağı: Cinemeta imdbRating. Bu hizmet TMDB tarafından onaylanmış veya sertifikalandırılmış değildir.</p></html>`);
  return status;
}
