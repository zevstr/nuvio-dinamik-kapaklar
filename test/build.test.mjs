import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,copyFile,writeFile,readFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import sharp from 'sharp';

test('multi-source build handles an empty catalog and preserves the last successful output on failure',async()=>{
  const root=fileURLToPath(new URL('../',import.meta.url));
  const temp=await mkdtemp(join(tmpdir(),'nuvio-cover-test-'));
  try {
    await mkdir(join(temp,'src'));
    await writeFile(join(temp,'package.json'),'{"type":"module"}');
    await symlink(join(root,'node_modules'),join(temp,'node_modules'));
    for(const name of ['build.mjs','core.mjs','weekly.mjs'])await copyFile(join(root,'src',name),join(temp,'src',name));
    const pixels=Buffer.alloc(1280*720*3);
    for(let y=0;y<720;y++)for(let x=0;x<1280;x++){
      const v=((x>>4)+(y>>4))%2?200:30;
      pixels.fill(v,(y*1280+x)*3,(y*1280+x)*3+3);
    }
    await sharp(pixels,{raw:{width:1280,height:720,channels:3}}).jpeg().toFile(join(temp,'fixture.jpg'));
    await writeFile(join(temp,'preload.mjs'),`
      import {readFile} from 'node:fs/promises';
      const picture=await readFile(new URL('./fixture.jpg',import.meta.url));
      globalThis.fetch=async input=>{
        const url=new URL(input);
        if(url.hostname==='image.tmdb.org')return new Response(picture);
        if(url.pathname.endsWith('status.json'))return Response.json({covers:[]});
        if(url.pathname.includes('unavailable'))return new Response('unavailable',{status:503});
        if(url.pathname.includes('empty'))return Response.json({metas:[]});
        return Response.json({metas:[{id:'tt111',type:'movie',name:'A & B',imdbRating:'8.1',background:'https://image.tmdb.org/t/p/original/fixture.jpg'}]});
      };
    `);
    const source=id=>({catalogType:'movie',catalogId:id});
    const populated={slug:'filled',section:'Deneme',heading:['TÜRKÇE'],subtitle:'SEÇKİ',sources:[source('unavailable'),source('valid')],policy:'evergreen'};
    const empty={...populated,slug:'empty',sources:[source('empty')]};
    await mkdir(join(temp,'fallbacks'));
    await copyFile(join(temp,'fixture.jpg'),join(temp,'fallbacks','recover.jpg'));
    await writeFile(join(temp,'fallbacks','sources.json'),JSON.stringify([{slug:'recover',contentId:'tt123',contentName:'Önceki Görsel'}]));
    const recover={...empty,slug:'recover'};
    await writeFile(join(temp,'covers.json'),JSON.stringify([populated,empty,recover]));
    const run=()=>promisify(execFile)(process.execPath,['--import','./preload.mjs','src/build.mjs'],{cwd:temp,env:{...process.env,XPERIENCE_MANIFEST_URL:'https://xperience-app.com/test-private-secret/manifest.json'}});
    await run();
    const stateBytes=await readFile(join(temp,'dist','status.json'));
    const state=JSON.parse(stateBytes);
    assert.equal(state.covers.length,3);
    assert.equal(state.covers[0].empty,false);
    assert.equal(state.covers[1].empty,true);
    assert.equal(state.covers[2].empty,false);
    assert.equal(state.covers[2].artworkFallback,true);
    assert.equal(state.covers[2].catalogEmpty,true);
    assert.equal(state.covers[2].contentId,'tt123');
    const html=await readFile(join(temp,'dist','index.html'),'utf8');
    assert.ok(html.includes('A &amp; B'));
    assert.ok(!html.includes('test-private-secret'));
    await writeFile(join(temp,'covers.json'),JSON.stringify([{...populated,sources:[source('unavailable')]}]));
    await assert.rejects(run());
    assert.deepEqual(await readFile(join(temp,'dist','status.json')),stateBytes);
  } finally {
    await rm(temp,{recursive:true,force:true});
  }
});
