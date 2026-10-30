import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadTmdbTrends,trendLabel} from '../src/tmdb-trends.mjs';
test('A missing IMDb ID skips only that title and preserves global ranks',async()=>{
 const fetcher=async url=>{
  if(/\/(day|week)$/.test(url.pathname))return Response.json({results:Array.from({length:20},(_,i)=>({id:i+1})),total_pages:1});
  const id=Number(url.pathname.split('/')[3]);return Response.json({id,imdb_id:id===2?null:`tt${id}`});
 };
 const data=await loadTmdbTrends('test',{fetcher});
 assert.equal(data.dailyCandidates.length,19);assert.equal(data.skippedDaily,1);
 assert.equal(data.dailyCandidates[1].id,'tt3');assert.equal(data.byImdb.get('tt3').rank,3);
});
test('Transient TMDB errors retry, while widespread missing IDs stop publication',async()=>{
 let attempts=0;
 const fetcher=async url=>{
  if(url.pathname.endsWith('/day')&&++attempts===1)return new Response('',{status:503});
  if(/\/(day|week)$/.test(url.pathname))return Response.json({results:Array.from({length:20},(_,i)=>({id:i+1})),total_pages:1});
  const id=Number(url.pathname.split('/')[3]);return Response.json({id,imdb_id:`tt${id}`});
 };
 assert.equal((await loadTmdbTrends('test',{fetcher})).dailyCandidates.length,20);assert.equal(attempts,2);
 await assert.rejects(loadTmdbTrends('test',{fetcher:async url=>{
  if(/\/(day|week)$/.test(url.pathname))return Response.json({results:Array.from({length:20},(_,i)=>({id:i+1})),total_pages:1});
  const id=Number(url.pathname.split('/')[3]);return Response.json({id,imdb_id:id<=5?null:`tt${id}`});
 }}),/kapsamı yetersiz/);
});
test('TMDB rank labels require verified source, window and positive integer rank',()=>{
 assert.equal(trendLabel({source:'TMDB',period:'day',rank:7}),'TMDB · BUGÜN #7');
 assert.equal(trendLabel({source:'TMDB',period:'week',rank:23}),'TMDB · BU HAFTA #23');
 for(const t of [null,{rank:1},{source:'IMDB',period:'day',rank:1},{source:'TMDB',period:'day',rank:0},{source:'TMDB',period:'year',rank:1}])assert.equal(trendLabel(t),'');
});
test('Exact external identifiers preserve source ranks and daily priority without leaking token into URLs',async()=>{
 const token='test-private-token';const paths=[];
 const fetcher=async(url,options)=>{
  assert.equal(options.headers.Authorization,`Bearer ${token}`);assert.ok(!String(url).includes(token));paths.push(url.pathname);
  if(url.pathname.endsWith('/day'))return Response.json({results:[{id:100},{id:200},{id:300}],total_pages:1});
  if(url.pathname.endsWith('/week'))return Response.json({results:[{id:300},{id:400},{id:100}],total_pages:1});
  const id=Number(url.pathname.split('/')[3]);
  return Response.json({id,imdb_id:`tt${id}`});
 };
 const data=await loadTmdbTrends(token,{fetcher,now:new Date('2026-10-26T06:00Z')});
 assert.equal(data.byImdb.get('tt200').rank,2);
 assert.equal(data.byImdb.get('tt300').rank,3);assert.equal(data.byImdb.get('tt300').period,'day');
 assert.equal(data.byImdb.get('tt400').rank,2);assert.equal(data.byImdb.get('tt400').period,'week');
 assert.equal(data.dailyCandidates[0].id,'tt100');assert.equal(data.byImdb.get('tt100').rank,1);assert.equal(paths.filter(p=>p.endsWith('/external_ids')).length,4);
});
test('Missing credentials and failed trending fetch stop publication without echoing external errors',async()=>{
 await assert.rejects(loadTmdbTrends(''),/TMDB_READ_ACCESS_TOKEN/);
 await assert.rejects(loadTmdbTrends('private',{fetcher:async()=>{throw Error('private external error')}}),e=>!e.message.includes('private')&&/TMDB/.test(e.message));
});

