import sharp from 'sharp';
import {mkdir,writeFile} from 'node:fs/promises';
import {download,imageUrl,xml,CoverError} from './core.mjs';
const GENRES={Action:'Aksiyon',Adventure:'Macera',Animation:'Animasyon',Biography:'Biyografi',Comedy:'Komedi',Crime:'Suç',Documentary:'Belgesel',Drama:'Dram',Family:'Aile',Fantasy:'Fantastik',History:'Tarih',Horror:'Korku',Music:'Müzik',Musical:'Müzikal',Mystery:'Gizem',Romance:'Romantik','Sci-Fi':'Bilim Kurgu','Science Fiction':'Bilim Kurgu',Sport:'Spor',Thriller:'Gerilim',War:'Savaş',Western:'Western'};
export function posterLabels(meta){
  const genre=(meta.genres??[]).map(g=>GENRES[g]??(Object.values(GENRES).includes(g)?g:null)).find(Boolean)??'';
  const raw=String(meta.imdbRating??'').trim();
  const rating=/^\d{1,2}(\.\d)?$/.test(raw)?Number(raw):NaN;
  return {genre,rating:Number.isFinite(rating)&&rating>0&&rating<=10?`IMDB ${rating.toFixed(1).replace('.',',')}`:''};
}
export async function renderPoster(bytes,meta){
  const {genre,rating}=posterLabels(meta);
  // Keep the complete original artwork and its title clear of the metadata footer.
  const art=await sharp(bytes,{limitInputPixels:40_000_000}).rotate().resize(600,800,{fit:'contain',background:'#080c12'}).toBuffer();
  const overlay=Buffer.from(`<svg width="600" height="900" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="800" width="600" height="100" fill="#101720"/><rect x="26" y="24" width="180" height="48" rx="12" fill="#111820" fill-opacity=".94"/><text x="116" y="56" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="24" font-weight="700" fill="white">GÜNDEMDE</text><text x="26" y="861" font-family="DejaVu Sans,sans-serif" font-size="30" font-weight="700" fill="white">${xml(genre)}</text><text x="574" y="862" text-anchor="end" font-family="DejaVu Sans,sans-serif" font-size="35" font-weight="700" fill="#f5cf65">${xml(rating)}</text></svg>`);
  return sharp({create:{width:600,height:900,channels:3,background:'#080c12'}}).composite([{input:art,top:0,left:0},{input:overlay}]).jpeg({quality:90}).toBuffer();
}
export async function buildPosters(manifest,readSource,output){
  const candidates=(await readSource(manifest,{catalogType:'movie',catalogId:'trending_movies'},false)).filter(m=>/^tt\d+$/.test(m.id)).slice(0,100);
  if(!candidates.length)throw new CoverError('Türkçe afiş denemesi için gündem kataloğu boş.');
  await mkdir(`${output}/posters/movie`,{recursive:true});
  const entries=[];let failed=0;
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
      const bytes=await renderPoster(await download(photo,12_000_000),meta);
      await writeFile(`${output}/posters/movie/${original.id}.jpg`,bytes);
      return {id:original.id,name:original.name,...posterLabels(meta)};
    }));
    for(const r of results)if(r.status==='fulfilled')entries.push(r.value);else failed++;
  }
  if(!entries.length)throw new CoverError('Türkçe afiş üretimi başarısız; mevcut yayın korunuyor.');
  const status={generatedAt:new Date().toISOString(),scope:'trending_movies',ratingSource:'Cinemeta imdbRating',ranking:false,generated:entries.length,candidates:candidates.length,failed,entries};
  await writeFile(`${output}/posters/status.json`,JSON.stringify(status,null,2));
  await writeFile(`${output}/posters/index.html`,`<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ozan · Türkçe Afiş Denemesi</title><style>body{background:#0b0d10;color:#fff;font:18px system-ui;margin:32px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:20px}img{width:100%;border-radius:16px}p{color:#bec5cf}article{max-width:300px}</style><h1>Gündemdeki Filmler · Türkçe Afişler</h1><p>Türkçe tür · Kaynağı belirtilen IMDB puanı · Günlük yenileme</p><p>Puan Cinemeta üzerinden alınır; puanı bulunmayan yapımlarda puan gösterilmez. Gündemde etiketi katalog üyeliğini belirtir; izlenebilirlik veya sıralama iddiası değildir. Görseller ilgili hak sahiplerine aittir.</p><main>${entries.map(e=>`<article><img src="movie/${e.id}.jpg" alt="${xml(e.name)}"><p>${xml(e.name)}</p></article>`).join('')}</main></html>`);
  return status;
}
