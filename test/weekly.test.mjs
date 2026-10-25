import {test} from 'node:test';
import assert from 'node:assert/strict';
import {lastAiredEpisode,weeklyEntry,weeklyManifest} from '../src/weekly.mjs';
const now=new Date('2026-10-25T12:00:00Z');
test('weekly window uses episode dates, excludes future episodes and specials, and expires old episodes',()=>{
 const videos=[{season:1,episode:7,released:'2026-10-13T17:00:00Z'},{season:1,episode:8,released:'2026-10-20T17:00:00Z'},{season:1,episode:9,released:'2026-10-27T17:00:00Z'},{season:0,episode:1,released:'2026-10-25T10:00:00Z'}];
 assert.equal(lastAiredEpisode(videos,now).episode,8);
 assert.equal(lastAiredEpisode(videos,new Date('2026-11-04T12:00:00Z')),null);
 assert.equal(lastAiredEpisode([{season:1,episode:1,released:'invalid'}],now),null);
});
test('weekly metadata distinguishes country, shows the exact aired episode, and never exposes unsafe artwork',()=>{
 const m={name:'Tuzlu Kahve',country:'Turkey',poster:'https://evil.invalid/token',videos:[{season:1,episode:8,released:'2026-10-20T17:00:00Z'}]};
 const entry=weeklyEntry({id:'tt43644041'},m,now);
 assert.equal(entry.local,true);assert.equal(entry.item.releaseInfo,'S1 · B8 · 20.10.2026');assert.equal(entry.item.poster,undefined);
 assert.equal(weeklyEntry({id:'tt1'},{...m,country:'France'},now).local,false);
 assert.equal(weeklyEntry({id:'tt1'},{...m,country:''},now),null);
 assert.equal(weeklyEntry({id:'tt1'},{...m,genres:['Reality']},now),null);
 assert.deepEqual(weeklyManifest().resources,['catalog']);
});
