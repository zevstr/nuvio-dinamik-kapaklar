import sharp from 'sharp';
import {loadTmdbTrends,trendLabel} from './tmdb-trends.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import {download,imageUrl,xml,CoverError} from './core.mjs';
const GENRES={Action:'Aksiyon',Adventure:'Macera',Animation:'Animasyon',Biography:'Biyografi',Comedy:'Komedi',Crime:'Suç',Documentary:'Belgesel',Drama:'Dram',Family:'Aile',Fantasy:'Fantastik',History:'Tarih',Horror:'Korku',Music:'Müzik',Musical:'Müzikal',Mystery:'Gizem',Romance:'Romantik','Sci-Fi':'Bilim Kurgu','Science Fiction':'Bilim Kurgu',Sport:'Spor',Thriller:'Gerilim',War:'Savaş',Western:'Western'};
export function posterLabels(meta){
  const genre=(meta.genres??[]).map(g=>GENRES[g]??(Object.values(GENRES).includes(g)?g:null)).find(Boolean)??'';
  const raw=String(meta.imdbRating??'').trim();
  const rating=/^\d{1,2}(\.\d)?$/.test(raw)?Number(raw):NaN;
  return {genre,rating:Number.isFinite(rating)&&rating>0&&rating<=10?`IMDB ${rating.toFixed(1).replace('.',',')}`:''};
}
export function comparePosterTrends(a,b){
  const key=e=>trendLabel(e.tmdbTrend)?[e.tmdbTrend.period==='day'?0:1,e.tmdbTrend.rank]:[2,0];
  const x=key(a),y=key(b);
  return x[0]-y[0]||x[1]-y[1];
}
export function posterCatalogMeta(original,detail,version){
  if(!/^tt\d+$/.test(original.id))throw new Error('Invalid IMDb identifier');
  const labels=posterLabels({genres:detail?.genres??original.genres,imdbRating:detail?.imdbRating});
  const meta={id:original.id,type:'movie',name:String(original.name).slice(0,300),posterShape:'poster',
    poster:`https://zevstr.github.io/nuvio-dinamik-kapaklar/posters/movie/${original.id}.jpg?v=${version}`};
  const releaseInfo=String(original.releaseInfo??detail?.releaseInfo??'').match(/\b(?:19|20)\d{2}\b/)?.[0];
  if(releaseInfo)meta.releaseInfo=releaseInfo;
  if(typeof original.description==='string')meta.description=original.description.slice(0,6000);
  if(labels.genre)meta.genres=[labels.genre];
  if(labels.rating)meta.imdbRating=Number(detail.imdbRating).toFixed(1);
  const background=imageUrl(original.background)??imageUrl(detail?.background);
  if(background)meta.background=background.href;
  return meta;
}
export function posterManifest(){return {id:'org.ozan.turkce-afisler',version:'1.0.0',name:'Ozan · Türkçe Afişli Filmler',description:'TMDB günlük ilk 20 film; Türkçe tür ve Cinemeta üzerinden IMDB puanı. Oynatma bağlantısı doğrulanmaz.',resources:['catalog'],types:['movie'],idPrefixes:['tt'],catalogs:[{id:'ozan-trending',type:'movie',name:'Gündemdeki Filmler · Türkçe Afişler'}]};}
export async function renderPoster(bytes,meta){
  const {genre,rating}=posterLabels(meta);
  const label=trendLabel(meta.tmdbTrend);
  // Keep the complete original artwork and its title clear of the metadata footer.
  const art=await sharp(bytes,{limitInputPixels:40_000_000}).rotate().resize(600,800,{fit:'contain',background:'#080c12'}).toBuffer();
  const overlay=Buffer.from(`<svg width="600" height="900" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="800" width="600" height="100" fill="#101720"/>${label?`<rect x="26" y="24" width="430" height="48" rx="12" fill="#111820" fill-opacity=".94"/><text x="241" y="56" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="24" font-weight="700" fill="white">${xml(label)}</text>`:''}<text x="26" y="861" font-family="DejaVu Sans,sans-serif" font-size="30" font-weight="700" fill="white">${xml(genre)}</text><text x="574" y="862" text-anchor="end" font-family="DejaVu Sans,sans-serif" font-size="35" font-weight="700" fill="#f5cf65">${xml(rating)}</text></svg>`);
  return sharp({create:{width:600,height:900,channels:3,background:'#080c12'}}).composite([{input:art,top:0,left:0},{input:overlay}]).jpeg({quality:90}).toBuffer();
}
export async function buildPosters(manifest,readSource,output,{trends}={}){
  const trendData=trends??await loadTmdbTrends(process.env.TMDB_READ_ACCESS_TOKEN);
  const candidates=trendData.dailyCandidates;
  if(!Array.isArray(candidates))throw new CoverError('TMDB günlük katalog verisi eksik.');
  if(!candidates.length)throw new CoverError('Türkçe afiş denemesi için gündem kataloğu boş.');
  await mkdir(`${output}/posters/movie`,{recursive:true});
  const entries=[],metas=[];let failed=0;
  const version=Date.now();
  for(let i=0;i<candidates.length;i+=4){
    const results=await Promise.allSettled(candidates.slice(i,i+4).map(async original=>{
      // Catalog ratings can be TMDB/composite values: only Cinemeta's explicit IMDb field is used.
      let detail=null;
      try{detail=JSON.parse((await download(new URL(`https://v3-cinemeta.strem.io/meta/movie/${original.id}.json`),2_000_000)).toString()).meta;}catch{}
      if(detail?.id!==original.id)detail=null;
      const photo=imageUrl(original.poster)??imageUrl(detail?.poster);
      if(photo?.hostname==='images.metahub.space')photo.pathname=photo.pathname.replace('/poster/small/','/poster/medium/');
      if(!photo)throw new Error('No original artwork');
      const meta={...original,genres:detail?.genres??original.genres,imdbRating:detail?.imdbRating};
      return {original,detail,meta,bytes:await download(photo,12_000_000)};
    }));
    for(const r of results){
      if(r.status!=='fulfilled'){failed++;continue;}
      const {original,detail,meta,bytes}=r.value;
      const tmdbTrend=trendData.byImdb.get(original.id)??null;
      try{
        const poster=await renderPoster(bytes,{...meta,tmdbTrend});
        await writeFile(`${output}/posters/movie/${original.id}.jpg`,poster);
        entries.push({id:original.id,name:original.name,tmdbTrend,...posterLabels(meta)});
        metas.push(posterCatalogMeta(original,detail,version));
      }catch{failed++;}
    }
  }
  if(entries.length!==candidates.length)throw new CoverError('Türkçe afiş üretimi başarısız; mevcut yayın korunuyor.');
  entries.sort(comparePosterTrends);
  const positions=new Map(entries.map((entry,index)=>[entry.id,index]));
  metas.sort((a,b)=>positions.get(a.id)-positions.get(b.id));
  const status={generatedAt:new Date().toISOString(),scope:'tmdb_daily_top20',ratingSource:'Cinemeta imdbRating',ranking:'tmdb_global_trending',rankingSource:'TMDB',trendCheckedAt:trendData.checkedAt,trendCoverage:{day:trendData.dayCount,week:trendData.weekCount,mapped:trendData.mapped,failed:trendData.failed},generated:entries.length,candidates:candidates.length,failed,entries};
  await mkdir(`${output}/posters/catalog/movie`,{recursive:true});
  await writeFile(`${output}/posters/manifest.json`,JSON.stringify(posterManifest()));
  await writeFile(`${output}/posters/catalog/movie/ozan-trending.json`,JSON.stringify({metas,cacheMaxAge:3600}));
  await writeFile(`${output}/posters/status.json`,JSON.stringify(status,null,2));
  await writeFile(`${output}/posters/index.html`,`<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ozan · Türkçe Afiş Denemesi</title><style>body{background:#0b0d10;color:#fff;font:18px system-ui;margin:32px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:20px}img{width:100%;border-radius:16px}p{color:#bec5cf}article{max-width:300px}</style><h1>Gündemdeki Filmler · Türkçe Afişler</h1><p>Türkçe tür · Kaynağı belirtilen IMDB puanı · Günlük yenileme</p><p>Puan Cinemeta üzerinden alınır; puanı bulunmayan yapımlarda puan gösterilmez. Bu katalog doğrudan TMDB günlük ilk 20 filminden oluşur. Üst rozet ve katalog sırası aynı günlük veriden üretilir. Oynatma bağlantısı doğrulanmaz. Görseller ilgili hak sahiplerine aittir. <a href="https://www.themoviedb.org/">TMDB</a> · This product uses the TMDB API but is not endorsed or certified by TMDB.</p><main>${entries.map(e=>`<article><img src="movie/${e.id}.jpg?v=${version}" alt="${xml(e.name)}"><p>${xml(e.name)}</p></article>`).join('')}</main></html>`);
  return status;
}
