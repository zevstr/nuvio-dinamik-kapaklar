import {test} from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {episodeLabels,renderEpisodePoster} from '../src/weekly-posters.mjs';
import {seriesArtwork} from '../src/tmdb-trends.mjs';
test('Episode labels use Istanbul date and reject missing episode information',async()=>{
 const item={lastEpisodeSeason:2,lastEpisodeNumber:16,lastEpisodeReleased:'2026-10-25T22:00:00Z'};
 assert.deepEqual(episodeLabels(item),{episode:'2. SEZON · 16. BÖLÜM',date:'26 EKİM · PAZARTESİ'});
 assert.throws(()=>episodeLabels({...item,lastEpisodeNumber:0}));
 const picture=await sharp({create:{width:400,height:600,channels:3,background:'#123456'}}).jpeg().toBuffer();
 const result=await sharp(await renderEpisodePoster(picture,item,true)).metadata();
 assert.equal(result.width,600);assert.equal(result.height,900);
});
test('Turkish series artwork uses exact IMDb lookup and rejects ambiguous matches',async()=>{
 const fetcher=async(url,options)=>{assert.ok(String(url).includes('/find/tt123?'));assert.ok(String(url).includes('language=tr-TR'));assert.equal(options.headers.Authorization,'Bearer secret');return Response.json({tv_results:[{name:'Türkçe Başlık',poster_path:'/art.jpg'}]});};
 assert.equal((await seriesArtwork('tt123','secret',fetcher)).name,'Türkçe Başlık');
 assert.equal(await seriesArtwork('tt123','secret',async()=>Response.json({tv_results:[{id:1},{id:2}]})),null);
});
