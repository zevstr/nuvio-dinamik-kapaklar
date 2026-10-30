import {CoverError} from './core.mjs';
const ROOT='https://api.themoviedb.org/3/';
export function trendLabel(trend){
  if(trend?.source!=='TMDB'||!['day','week'].includes(trend.period)||!Number.isInteger(trend.rank)||trend.rank<1||trend.rank>1000)return '';
  return `TMDB · ${trend.period==='day'?'BUGÜN':'BU HAFTA'} #${trend.rank}`;
}
async function readJson(path,token,fetcher){
  for(let attempt=0;attempt<3;attempt++)try{
    const response=await fetcher(new URL(path,ROOT),{redirect:'error',signal:AbortSignal.timeout(20000),headers:{Authorization:`Bearer ${token}`,Accept:'application/json'}});
    if(!response.ok||!response.body){
      if(response.status===429||response.status>=500)throw Error();
      throw new CoverError('TMDB isteği reddedildi. Önceki yayın korunuyor.');
    }
    let size=0;const chunks=[];
    for await(const c of response.body){size+=c.length;if(size>4_000_000)throw Error();chunks.push(c);}
    return JSON.parse(Buffer.concat(chunks).toString());
  }catch(error){
    if(error instanceof CoverError)throw error;
    if(attempt===2)throw new CoverError('TMDB trend verisi okunamadı. Önceki yayın korunuyor.');
    await new Promise(resolve=>setTimeout(resolve,250*2**attempt));
  }
}
export async function seriesArtwork(id,token,fetcher=fetch){
  if(!/^tt\d+$/.test(id)||!token)return null;
  const data=await readJson(`find/${id}?external_source=imdb_id&language=tr-TR`,token,fetcher);
  const item=data.tv_results?.length===1?data.tv_results[0]:null;
  if(!item)return null;
  return {name:item.name,poster:item.poster_path?`https://image.tmdb.org/t/p/w780${item.poster_path}`:null};
}
const ART_GENRES={28:'Action',12:'Adventure',16:'Animation',35:'Comedy',80:'Crime',99:'Documentary',18:'Drama',10751:'Family',14:'Fantasy',36:'History',27:'Horror',10402:'Music',9648:'Mystery',10749:'Romance',878:'Sci-Fi',53:'Thriller',10752:'War',37:'Western',10759:'Action',10762:'Kids',10763:'News',10764:'Reality',10765:'Sci-Fi',10766:'Soap',10767:'Talk',10768:'War'};
export async function titleArtwork(identity,token,fetcher=fetch){
  if(!/^tt\d+$/.test(identity.id)||!['movie','series'].includes(identity.type)||!token)return null;
  const data=await readJson(`find/${identity.id}?external_source=imdb_id&language=tr-TR`,token,fetcher);
  const results=identity.type==='movie'?data.movie_results:data.tv_results;
  const item=results?.length===1?results[0]:null;
  if(!item?.poster_path||!/^\/[A-Za-z0-9._-]+$/.test(item.poster_path))return null;
  return {...identity,name:item.title??item.name??identity.id,poster:`https://image.tmdb.org/t/p/w780${item.poster_path}`,
    genres:(item.genre_ids??[]).map(id=>ART_GENRES[id]).filter(Boolean)};
}
export async function loadTmdbTrends(token,{fetcher=fetch,pages=5,now=new Date()}={}){
  if(!token?.trim())throw new CoverError('TMDB_READ_ACCESS_TOKEN gizli ayarı gerekiyor. Önceki yayın korunuyor.');
  const dailyItems=[];const checkedAt=now.toISOString();const lists={day:new Map(),week:new Map()};
  for(const period of ['day','week']){
    let rank=0;
    for(let page=1;page<=pages;page++){
      const data=await readJson(`trending/movie/${period}?language=tr-TR&page=${page}`,token,fetcher);
      if(!Array.isArray(data.results)||!data.results.length)throw new CoverError('TMDB trend listesi boş veya eksik. Önceki yayın korunuyor.');
      for(const item of data.results){rank++;if(period==='day')dailyItems.push({...item,rank});if(Number.isInteger(item.id)&&item.id>0&&!lists[period].has(item.id))lists[period].set(item.id,rank);}
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
  const dailyTop=dailyItems.slice(0,20);
  const dailyCandidates=dailyTop.map(item=>({id:imdbIds.get(item.id),type:'movie',name:item.title||item.original_title||`TMDB ${item.id}`,description:item.overview||'',releaseInfo:item.release_date||'',poster:item.poster_path?`https://image.tmdb.org/t/p/w780${item.poster_path}`:null,background:item.backdrop_path?`https://image.tmdb.org/t/p/w1280${item.backdrop_path}`:null})).filter(item=>item.id);
  const skippedDaily=dailyTop.length-dailyCandidates.length;
  if(!dailyCandidates.length||dailyCandidates.length<Math.ceil(dailyTop.length*.8))throw new CoverError('TMDB günlük kimlik kapsamı yetersiz. Önceki yayın korunuyor.');
  return {dailyCandidates,byImdb,checkedAt,dayCount:lists.day.size,weekCount:lists.week.size,skippedDaily,mapped:imdbIds.size,failed};
}

