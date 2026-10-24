import {test} from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {catalogUrl, imageUrl, normalizeCatalog, titleScore, rankedCandidates, selectWinner, pictureScore, xml, renderCover, download} from '../src/core.mjs';

test('catalog URL keeps private base/query but never changes origin',()=>{
  const u=catalogUrl('https://xperience-app.com/private-example/manifest.json?key=example', {catalogType:'movie',catalogId:'world_hi_latest_movies'});
  assert.equal(u.pathname,'/private-example/catalog/movie/world_hi_latest_movies.json');
  assert.equal(u.search,'?key=example');
  assert.throws(()=>catalogUrl('https://evil.invalid/manifest.json',{}));
});
test('artwork URLs reject keys, redirects to arbitrary hosts and local networks',()=>{
  for(const v of ['http://image.tmdb.org/a.jpg','https://image.tmdb.org/a?api_key=secret','https://127.0.0.1/a','https://evil.invalid/a','https://u:p@image.tmdb.org/a']) assert.equal(imageUrl(v),null);
  assert.equal(imageUrl('https://image.tmdb.org/t/p/original/a.jpg').hostname,'image.tmdb.org');
});
test('ranking contains only current titles and is stable across days',()=>{
  const metas=normalizeCatalog({metas:[{id:'a',name:'A'},{id:'b',name:'B'},{id:'a',name:'A'},null]});
  assert.equal(metas.length,2);
  const a=rankedCandidates(metas,{policy:'evergreen'},'2026-10-24');
  const b=rankedCandidates(metas,{policy:'evergreen'},'2026-10-25');
  assert.equal(a[0].meta.id,b[0].meta.id);
  assert.deepEqual(new Set(a.map(x=>x.meta.id)),new Set(['a','b']));
  assert.throws(()=>normalizeCatalog({error:'no catalog'}));
});
test('recognizable well-supported titles beat obscure short films without filtering catalog contents',()=>{
  const items=[{id:'small',name:'Short',type:'movie',runtime:8,imdbRating:7,_sourceRank:0},{id:'tt123',name:'Feature',type:'movie',runtime:120,imdbRating:8,vote_count:10000,popularity:200,_sourceRank:8}];
  assert.equal(rankedCandidates(items,{policy:'latest'},'2026-10-24')[0].meta.id,'tt123');
  assert.equal(items.length,2);
});
test('a small score change preserves a good existing image; a clear improvement replaces it',()=>{
  const old={meta:{id:'old'},score:100},near={meta:{id:'new'},score:108},better={meta:{id:'new'},score:120};
  const previous={contentId:'old',selectionPolicy:2};
  assert.equal(selectWinner([old,near],previous).meta.id,'old');
  assert.equal(selectWinner([old,better],previous).meta.id,'new');
  assert.equal(selectWinner([better],previous).meta.id,'new');
});
test('general category photography favors live-action without removing animation from the catalog',()=>{
  const metas=[{id:'cartoon',name:'Animation',imdbRating:9.5,genres:['Animation'],_sourceRank:0},{id:'film',name:'Live action',imdbRating:8.5,genres:['Action'],_sourceRank:3}];
  const ranked=rankedCandidates(metas,{policy:'evergreen'},'2026-10-24');
  assert.equal(ranked[0].meta.id,'film');
  assert.equal(ranked.length,2);
});
test('daily source shuffling alone cannot cross the replacement threshold',()=>{
  const meta={id:'tt100',name:'Stable',imdbRating:8.5};
  const delta=titleScore({...meta,_sourceRank:0},{policy:'evergreen'},'2026-10-24')-titleScore({...meta,_sourceRank:100},{policy:'evergreen'},'2026-10-24');
  assert.ok(delta<12);
});
test('portrait and featureless images cannot win a landscape cover',async()=>{
  const portrait=await sharp({create:{width:1200,height:1800,channels:3,background:'#abcdef'}}).jpeg().toBuffer();
  const blank=await sharp({create:{width:1920,height:1080,channels:3,background:'#112233'}}).jpeg().toBuffer();
  assert.equal(await pictureScore(portrait),null);
  assert.equal(await pictureScore(blank),null);
});
test('stream size is bounded even without content-length',async()=>{
  await assert.rejects(download(new URL('https://image.tmdb.org/a'),2,async()=>new Response('123')));
});
test('Turkish title rasterizes to a real 16:9 JPEG; XML cannot inject markup',async()=>{
  assert.equal(xml('<>&'),'&lt;&gt;&amp;');
  const {cover,hero}=await renderCover(null,{heading:['YENİ HİNT','FİLMLERİ'],subtitle:'TÜM DİLLER'},'',true);
  for(const b of [cover,hero]) {
    const m=await sharp(b).metadata();
    assert.equal(m.width,1600);assert.equal(m.height,900);assert.equal(m.format,'jpeg');
  }
});
