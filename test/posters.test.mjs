import {test} from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {posterLabels,renderPoster,posterCatalogMeta,posterManifest} from '../src/posters.mjs';
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
