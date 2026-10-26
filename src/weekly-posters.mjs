import sharp from 'sharp';
import {mkdir,writeFile} from 'node:fs/promises';
import {download,imageUrl,xml,CoverError} from './core.mjs';
import {seriesArtwork} from './tmdb-trends.mjs';
export function episodeLabels(item){
  const season=Number(item.lastEpisodeSeason),episode=Number(item.lastEpisodeNumber);
  const time=Date.parse(item.lastEpisodeReleased);
  if(!Number.isInteger(season)||season<1||!Number.isInteger(episode)||episode<1||!Number.isFinite(time))throw new CoverError('Bölüm bilgisi eksik.');
  return {episode:`${season}. SEZON · ${episode}. BÖLÜM`,date:new Intl.DateTimeFormat('tr-TR',{timeZone:'Europe/Istanbul',day:'numeric',month:'long'}).format(new Date(time)).toLocaleUpperCase('tr-TR')+' · '+new Intl.DateTimeFormat('tr-TR',{timeZone:'Europe/Istanbul',weekday:'long'}).format(new Date(time)).toLocaleUpperCase('tr-TR')};
}
export async function renderEpisodePoster(bytes,item,local){
  const labels=episodeLabels(item);
  const art=await sharp(bytes).rotate().resize(600,750,{fit:'contain',background:'#080c12'}).toBuffer();
  const overlay=Buffer.from(`<svg width="600" height="900" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="750" width="600" height="150" fill="#101720"/><text x="300" y="798" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="30" font-weight="700" fill="white">${xml(labels.episode)}</text><text x="300" y="856" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="30" font-weight="700" fill="#f5cf65">${xml(labels.date)}</text><rect x="22" y="20" width="240" height="42" rx="10" fill="#101720"/><text x="142" y="49" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="23" font-weight="700" fill="white">${local?'YERLİ DİZİ':'YABANCI DİZİ'}</text></svg>`);
  return sharp({create:{width:600,height:900,channels:3,background:'#080c12'}}).composite([{input:art,top:0,left:0},{input:overlay}]).jpeg({quality:90}).toBuffer();
}
export async function buildWeeklyPosters(weekly,output){
  await mkdir(`${output}/episode-posters`,{recursive:true});
  const version=Date.now();let generated=0,fallback=0;
  for(const group of ['local','foreign'])for(let i=0;i<weekly[group].length;i+=4){
    await Promise.all(weekly[group].slice(i,i+4).map(async item=>{
      let photo=imageUrl(item.poster);
      try{const artwork=await seriesArtwork(item.id,process.env.TMDB_READ_ACCESS_TOKEN);if(artwork?.name)item.name=artwork.name;if(imageUrl(artwork?.poster))photo=imageUrl(artwork.poster);}catch{fallback++;}
      if(!photo)throw new CoverError('Dizi afiş kaynağı eksik; önceki yayın korunuyor.');
      const filename=`${encodeURIComponent(item.id)}.jpg`;
      const bytes=await download(photo,12_000_000);
      await writeFile(`${output}/episode-posters/${filename}`,await renderEpisodePoster(bytes,item,group==='local'));
      item.poster=`https://zevstr.github.io/nuvio-dinamik-kapaklar/episode-posters/${filename}?v=${version}`;
      item.posterShape='poster';generated++;
    }));
  }
  return {generated,fallback};
}
