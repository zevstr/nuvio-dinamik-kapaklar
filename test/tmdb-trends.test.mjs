import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadTmdbTrends,trendLabel} from '../src/tmdb-trends.mjs';
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
