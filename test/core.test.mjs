import {test} from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {catalogUrl, imageUrl, normalizeCatalog, orderedCandidates, xml, renderCover, download} from '../src/core.mjs';

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
test('rotation contains only deduplicated current titles and changes each day',()=>{
  const metas=normalizeCatalog({metas:[{id:'a',name:'A'},{id:'b',name:'B'},{id:'a',name:'A'},null]});
  assert.equal(metas.length,2);
  const a=orderedCandidates(metas,'2026-10-24');
  const b=orderedCandidates(metas,'2026-10-25');
  assert.notEqual(a[0].id,b[0].id);
  assert.deepEqual(new Set(a.map(x=>x.id)),new Set(['a','b']));
  assert.throws(()=>normalizeCatalog({error:'no catalog'}));
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
