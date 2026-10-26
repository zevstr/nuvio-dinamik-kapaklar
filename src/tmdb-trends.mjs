import {CoverError} from './core.mjs';
const ROOT='https://api.themoviedb.org/3/';
export function trendLabel(trend){
  if(trend?.source!=='TMDB'||!['day','week'].includes(trend.period)||!Number.isInteger(trend.rank)||trend.rank<1||trend.rank>1000)return '';
  return `TMDB · ${trend.period==='day'?'BUGÜN':'BU HAFTA'} #${trend.rank}`;
}
async function readJson(path,token,fetcher){
  try{
    const response=await fetcher(new URL(path,ROOT),{redirect:'error',signal:AbortSignal.timeout(20000),headers:{Authorization:`Bearer ${token}`,Accept:'application/json'}});
    if(!response.ok||!response.body)throw Error();
    let size=0;const chunks=[];
    for await(const c of response.body){size+=c.length;if(size>4_000_000)throw Error();chunks.push(c);}
    return JSON.parse(Buffer.concat(chunks).toString());
  }catch{throw new CoverError('TMDB trend verisi okunamadı. Önceki yayın korunuyor.');}
}
export async function loadTmdbTrends(token,{fetcher=fetch,pages=5,now=new Date()}={}){
  if(!token?.trim())throw new CoverError('TMDB_READ_ACCESS_TOKEN gizli ayarı gerekiyor. Önceki yayın korunuyor.');
  const checkedAt=now.toISOString();const lists={day:new Map(),week:new Map()};
  for(const period of ['day','week']){
    let rank=0;
    for(let page=1;page<=pages;page++){
      const data=await readJson(`trending/movie/${period}?language=tr-TR&page=${page}`,token,fetcher);
      if(!Array.isArray(data.results)||!data.results.length)throw new CoverError('TMDB trend listesi boş veya eksik. Önceki yayın korunuyor.');
      for(const item of data.results){rank++;if(Number.isInteger(item.id)&&item.id>0&&!lists[period].has(item.id))lists[period].set(item.id,rank);}
      if(page>=Number(data.total_pages||1))break;
    }
  }
  const ids=[...new Set([...lists.day.keys(),...lists.week.keys()])];const imdbIds=new Map();let failed=0;
  for(let i=0;i<ids.length;i+=4){
    const results=await Promise.allSettled(ids.slice(i,i+4).map(async id=>{
      const result=await readJson(`movie/${id}/external_ids`,token,fetcher);
      if(result.id!==id)throw new Error('TMDB identity mismatch');
      return {id,imdb:typeof result.imdb_id==='string'&&/^tt\d+$/.test(result.imdb_id)?result.imdb_id:null};
    }));
    for(const r of results)if(r.status==='fulfilled'){if(r.value.imdb)imdbIds.set(r.value.id,r.value.imdb);}else failed++;
  }
  if(!imdbIds.size||failed>Math.max(3,ids.length*.2))throw new CoverError('TMDB kimlik eşleştirmeleri tamamlanamadı. Önceki yayın korunuyor.');
  const byImdb=new Map();
  // Daily rank wins; filtering the user's catalog must never compact these global ranks.
  for(const period of ['day','week'])for(const [tmdbId,rank] of lists[period]){
    const imdb=imdbIds.get(tmdbId);
    if(imdb&&!byImdb.has(imdb))byImdb.set(imdb,{source:'TMDB',period,rank,tmdbId,checkedAt});
  }
  return {byImdb,checkedAt,dayCount:lists.day.size,weekCount:lists.week.size,mapped:imdbIds.size,failed};
}
