import {test} from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {posterLabels,renderPoster} from '../src/posters.mjs';
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
