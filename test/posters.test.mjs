import {test} from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {posterLabels,renderPoster,posterCatalogMeta,posterManifest,buildPosters,comparePosterTrends} from '../src/posters.mjs';
test('Daily ranks precede weekly ranks, unranked retain source order',()=>{
 const entry=(id,period,rank)=>({id,tmdbTrend:period?{source:'TMDB',period,rank}:null});
 const items=[entry('unknown1'),entry('week1','week',1),entry('day13','day',13),entry('unknown2'),entry('day3','day',3)];
 assert.deepEqual(items.sort(comparePosterTrends).map(e=>e.id),['day3','day13','week1','unknown1','unknown2']);
});
test('Only explicit valid IMDb ratings are labeled, never composite or TMDB',()=>{
  assert.deepEqual(posterLabels({genres:['Thriller'],imdbRating:'8.2'}),{genre:'Gerilim',rating:'IMDB 8,2'});
  for(const v of [undefined,'82','N/A','-1','8.2fake',0])assert.equal(posterLabels({rating:8.2,vote_average:8.2,imdbRating:v}).rating,'');
  assert.equal(posterLabels({genres:['Unknown']}).genre,'');
});
test('Poster render has standard 2:3 geometry and valid JPEG',async()=>{
 const bytes=await sharp({create:{width:400,height:600,channels:3,background:'#345678'}}).png().toBuffer();
 const rendered=await renderPoster(bytes,{genres:['Sci-Fi'],imdbRating:'8.6'});
 const info=await sharp(rendered).metadata();
 assert.equal(info.width,600);assert.equal(info.height,900);assert.equal(info.format,'jpeg');
});

test('Public poster catalog preserves IMDb identity and never copies private provider URLs',()=>{
 const m=posterCatalogMeta({id:'tt123',name:'Örnek',releaseInfo:'2026',poster:'https://private.invalid/secret',background:'https://private.invalid/secret',secret:'never publish',rating:9.9},{imdbRating:'8.1',genres:['Thriller']},123);
 assert.equal(m.id,'tt123');assert.equal(m.type,'movie');assert.equal(m.genres[0],'Gerilim');assert.equal(m.imdbRating,'8.1');
 assert.equal(m.poster,'https://zevstr.github.io/nuvio-dinamik-kapaklar/posters/movie/tt123.jpg?v=123');
 assert.equal(m.releaseInfo,'2026');assert.equal(m.background,undefined);assert.ok(!JSON.stringify(m).includes('secret'));
 assert.equal(posterCatalogMeta({id:'tt123',name:'No rating',rating:9.9},null,123).imdbRating,undefined);
 assert.throws(()=>posterCatalogMeta({id:'../bad',name:'bad'},null,123));
 assert.deepEqual(posterManifest().resources,['catalog']);
});

test('TMDB ranks are never renumbered when another artwork fails',async()=>{
 const {mkdtemp,readFile,rm}=await import('node:fs/promises');
 const {tmpdir}=await import('node:os');const {join}=await import('node:path');
 const dir=await mkdtemp(join(tmpdir(),'ozan-poster-ranks-'));
 const savedFetch=globalThis.fetch;
 const image=await sharp({create:{width:400,height:600,channels:3,background:'#345678'}}).jpeg().toBuffer();
 globalThis.fetch=async input=>{
   const u=new URL(input);
   if(u.hostname==='v3-cinemeta.strem.io'){const id=u.pathname.split('/').pop().replace('.json','');return Response.json({meta:{id,imdbRating:'8.1',genres:['Drama'],poster:`https://image.tmdb.org/t/p/original/${id}.jpg`}});}
   return u.pathname.includes('tt2.jpg')?new Response('',{status:404}):new Response(image);
 };
 try{
   const result=await buildPosters('unused',async()=>[3,2,1].map(n=>({id:`tt${n}`,name:`Film ${n}`})),dir,{trends:{byImdb:new Map([['tt1',{source:'TMDB',period:'day',rank:7}],['tt3',{source:'TMDB',period:'week',rank:23}]])}});
   const catalog=JSON.parse(await readFile(join(dir,'posters/catalog/movie/ozan-trending.json'),'utf8'));
   assert.deepEqual(result.entries.map(e=>[e.id,e.tmdbTrend.rank]),[['tt1',7],['tt3',23]]);
   assert.deepEqual(catalog.metas.map(e=>e.id),['tt1','tt3']);assert.equal(result.failed,1);
   assert.equal(result.ranking,'tmdb_global_trending');
 }finally{globalThis.fetch=savedFetch;await rm(dir,{recursive:true,force:true});}
});
