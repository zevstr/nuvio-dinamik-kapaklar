import {catalogUrl,download,imageUrl,CoverError} from './core.mjs';

export function lastAiredEpisode(videos,now=new Date()){
  const end=+now,start=end-7*86400000;
  return (Array.isArray(videos)?videos:[]).filter(v=>Number(v.season)>0&&Number(v.episode)>0&&typeof v.released==='string')
    .map(v=>({...v,time:Date.parse(v.released)})).filter(v=>Number.isFinite(v.time)&&v.time>=start&&v.time<=end)
    .sort((a,b)=>b.time-a.time||Number(b.season)-Number(a.season)||Number(b.episode)-Number(a.episode))[0]??null;
}

export function weeklyEntry(candidate,meta,now=new Date()){
  const episode=lastAiredEpisode(meta?.videos,now);
  if(!episode||!candidate?.id||!meta?.name)return null;
  const genres=Array.isArray(meta.genres)?meta.genres:[];
  if(/talk|reality|news|haber|söyleşi|çocuk|kids/i.test(genres.join(' ')))return null;
  const country=Array.isArray(meta.country)?meta.country.join(','):String(meta.country??'');
  const local=/\b(TR|Turkey|Türkiye|Turkiye)\b/i.test(country)||candidate._weeklyLocal===true;
  if(!local&&!country)return null;
  const date=new Intl.DateTimeFormat('tr-TR',{timeZone:'Europe/Istanbul',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(episode.time));
  const item={id:candidate.id,type:'series',name:meta.name,releaseInfo:`S${Number(episode.season)} · B${Number(episode.episode)} · ${date}`,lastEpisodeReleased:new Date(episode.time).toISOString(),lastEpisodeSeason:Number(episode.season),lastEpisodeNumber:Number(episode.episode)};
  for(const key of ['poster','background','logo'])if(imageUrl(meta[key]??candidate[key]))item[key]=meta[key]??candidate[key];
  for(const key of ['description','imdbRating','released'])if(typeof meta[key]==='string')item[key]=meta[key];
  item.genres=genres.filter(x=>typeof x==='string');
  return {local,item};
}

export async function buildWeeklyCatalogs(manifest,readSource,now=new Date(),fetcher=fetch){
  const groups=[{id:'airing_today_series~c2',local:true,limit:40},{id:'world_tr_popular_series',local:true,limit:80},{id:'airing_today_series',limit:100},{id:'on_the_air_series',limit:160},{id:'tmdb_popular_series',limit:160}];
  const candidates=new Map();let sourceFailures=0;
  for(const group of groups){
    try{const items=await readSource(manifest,{catalogType:'series',catalogId:group.id},true);for(const m of items.slice(0,group.limit)){if(!candidates.has(m.id))candidates.set(m.id,{...m,_weeklyLocal:group.local===true});else if(group.local)candidates.get(m.id)._weeklyLocal=true;}}
    catch{sourceFailures++;}
  }
  // Independent caps keep provider traffic bounded while preserving a local pool.
  const all=[...candidates.values()];
  const queue=[...all.filter(m=>m._weeklyLocal).slice(0,80),...all.filter(m=>!m._weeklyLocal).slice(0,240)];
  if(!queue.length)throw new CoverError('Dizi tarama kaynakları boş; önceki başarılı yayın korunuyor.');
  const local=[],foreign=[];let inspected=0,failed=0,retried=0,recovered=0;
  const base=catalogUrl(manifest,{catalogType:'series',catalogId:'unused'});
  let cursor=0;
  await Promise.all(Array.from({length:4},async()=>{
    while(cursor<queue.length){const candidate=queue[cursor++];
      try{const u=new URL(base);u.pathname=u.pathname.replace(/catalog\/series\/unused\.json$/,`meta/series/${encodeURIComponent(candidate.id)}.json`);
        let body;
        for(let attempt=0;attempt<2;attempt++){
          try{body=JSON.parse((await download(u,5_000_000,fetcher)).toString());
            if(!body?.meta||typeof body.meta!=='object')throw new CoverError('Dizi ayrıntıları alınamadı.');
            if(attempt)recovered++;
            break;
          }catch(error){if(attempt)throw error;retried++;await new Promise(resolve=>setTimeout(resolve,250));}
        }
        inspected++;
        const entry=weeklyEntry(candidate,body.meta,now);if(entry)(entry.local?local:foreign).push(entry.item);
      }catch{failed++;}
    }
  }));
  if(failed>Math.max(5,queue.length*.25))throw new CoverError('Dizi ayrıntı kaynağında yaygın hata var; önceki başarılı yayın korunuyor.');
  const order=(a,b)=>b.lastEpisodeReleased.localeCompare(a.lastEpisodeReleased)||a.name.localeCompare(b.name,'tr');
  return {local:local.sort(order),foreign:foreign.sort(order),generatedAt:now.toISOString(),windowStart:new Date(+now-7*86400000).toISOString(),inspected,failed,retried,recovered,sourceFailures,candidateCount:queue.length};
}

export function weeklyManifest(){return {id:'org.ozan.weeklyepisodes',version:'1.0.0',name:'Ozan · Son 7 Günde Yeni Bölümler',description:'Bölüm yayın tarihleri doğrulanarak günlük yenilenen yerli ve yabancı dizi katalogları. Oynatma bağlantısı doğrulamaz.',resources:['catalog'],types:['series'],idPrefixes:['tt','tmdb:','tvdb:'],catalogs:[{type:'series',id:'weekly-local',name:'Yerli Diziler • Son 7 Gün',extra:[]},{type:'series',id:'weekly-foreign',name:'Yabancı Diziler • Son 7 Gün',extra:[]}],behaviorHints:{configurable:false}};}
