import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import sharp from 'sharp';
import {posterIdentity,posterSources,trustedDetail,buildLibraryPosters} from '../src/library-posters.mjs';

test('Shared artwork uses typed IMDb identities and rejects mismatched metadata or credential URLs',()=>{
  assert.equal(posterIdentity({id:'../tt1',type:'movie'}),null);
  assert.equal(posterIdentity({id:'tmdb:1',type:'movie'}),null);
  assert.deepEqual(posterIdentity({id:'tt1'},'series'),{id:'tt1',type:'series'});
  assert.equal(trustedDetail({meta:{id:'tt2',imdbRating:9}}, {id:'tt1',type:'movie'}),null);
  assert.equal(trustedDetail({meta:{id:'tt1',type:'series'}}, {id:'tt1',type:'movie'}),null);
  const detail=trustedDetail({meta:{id:'tt1',vote_average:9,rating:95,poster:'https://private.invalid/key',secret:'secret'}},{id:'tt1',type:'movie'});
  assert.equal(detail.imdbRating,undefined);assert.equal(detail.poster,null);
  assert.equal(trustedDetail({meta:{id:'tt1',poster:'https://images.metahub.space/poster/small/tt1/img'}},{id:'tt1',type:'movie'}).poster,'https://images.metahub.space/poster/medium/tt1/img');
  assert.ok(!JSON.stringify(detail).includes('secret'));
  assert.equal(posterSources([{sources:[{catalogType:'movie',catalogId:'a'}]}],{catalogs:[{type:'movie',id:'a'},{type:'series',id:'b'}]}).length,2);
});

test('All configured sources share cached posters; stale successful art survives a metadata outage',async()=>{
  const root=await mkdtemp(join(tmpdir(),'ozan-library-'));
  const image=await sharp({create:{width:400,height:600,channels:3,background:'#345678'}}).jpeg().toBuffer();
  const saved=globalThis.fetch;let outage=false,images=0;
  const fetcher=async input=>{
    const url=new URL(input);
    if(url.pathname.endsWith('/manifest.json'))return Response.json({catalogs:[{type:'movie',id:'new-copy'}]});
    if(url.hostname==='v3-cinemeta.strem.io'){
      if(outage)return new Response('',{status:503});
      return Response.json({meta:{id:url.pathname.split('/').pop().replace('.json',''),genres:['Thriller'],imdbRating:'8.3',poster:'https://image.tmdb.org/t/p/w780/test.jpg'}});
    }
    images++;return new Response(image);
  };
  globalThis.fetch=fetcher;
  const sources=[];
  const readSource=async (_,s)=>{sources.push(s.catalogId);return [{id:'tt100',type:'movie',name:'Film',imdbRating:97,poster:'https://private.invalid/secret'}];};
  const specs=[{sources:[{catalogType:'movie',catalogId:'existing'}]}];
  const run=async (out,now)=>{await mkdir(join(root,out));return buildLibraryPosters('https://xperience-app.com/private/manifest.json',readSource,specs,join(root,out),{cacheDir:join(root,'cache'),fetcher,now});};
  try{
    const first=await run('one',100000000);assert.equal(first.available,5);assert.equal(first.generated,5);
    assert.deepEqual(sources,['existing','new-copy']);
    const initial=await readFile(join(root,'one/art/movie/tt100.jpg'));
    const fresh=await run('two',100000001);assert.equal(fresh.reused,5);assert.equal(images,5);
    outage=true;
    const stale=await run('three',200000000);assert.equal(stale.retained,5);assert.equal(stale.failed,0);
    assert.deepEqual(await readFile(join(root,'three/art/movie/tt100.jpg')),initial);
    const status=await readFile(join(root,'three/art/status.json'),'utf8');
    assert.ok(!status.includes('/private/'));assert.ok(!status.includes('secret'));
  }finally{globalThis.fetch=saved;await rm(root,{recursive:true,force:true});}
});

test('Exact TMDB artwork recovers missing Cinemeta titles without inventing an IMDb rating',async()=>{
  const root=await mkdtemp(join(tmpdir(),'ozan-library-tmdb-'));
  const image=await sharp({create:{width:500,height:750,channels:3,background:'#345678'}}).jpeg().toBuffer();
  const saved=globalThis.fetch;let authenticated=0;
  const fetcher=async (input,options)=>{
    const u=new URL(input);assert.ok(!u.href.includes('test-private-token'));
    if(u.pathname.endsWith('manifest.json'))return Response.json({catalogs:[]});
    if(u.hostname==='v3-cinemeta.strem.io')return new Response('',{status:503});
    if(u.hostname==='api.themoviedb.org'){
      assert.equal(options.headers.Authorization,'Bearer test-private-token');authenticated++;
      const item={id:123,title:'Türkçe Başlık',poster_path:'/real.jpg',genre_ids:[28],vote_average:9.9};
      return Response.json(u.pathname.includes('tt0903747')?{tv_results:[item],movie_results:[]}:{movie_results:[item],tv_results:[]});
    }
    return new Response(image);
  };
  globalThis.fetch=fetcher;
  try{
    const result=await buildLibraryPosters('https://xperience-app.com/private/manifest.json',async()=>[],[],root,{cacheDir:join(root,'cache'),fetcher,tmdbToken:'test-private-token'});
    assert.equal(result.available,4);assert.equal(authenticated,4);
    const entry=JSON.parse(await readFile(join(root,'cache/movie-tt0133093.json')));
    assert.equal(entry.genre,'Aksiyon');assert.equal(entry.rating,'');assert.equal(entry.artworkSource,'TMDB exact IMDb lookup');
    assert.ok(!(await readFile(join(root,'art/status.json'),'utf8')).includes('test-private-token'));
  }finally{globalThis.fetch=saved;await rm(root,{recursive:true,force:true});}
});
