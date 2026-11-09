import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {reviewNativeWorkCountry} from './countryProof.js'
const fixture=source=>JSON.parse(gunzipSync(fs.readFileSync(new URL('../'+source+'/test-data/native-country-20261103.json.gz',import.meta.url))))
const snapshot=source=>{const f=fixture(source),base='https://boards-api.greenhouse.io/v1/boards/'+source;return{source,feed:JSON.parse(f.responses.find(r=>r.url===base+'/jobs?content=true').body),offices:JSON.parse(f.responses.find(r=>r.url===base+'/offices').body)}}
test('Buildkite exact same-role based/location country statements resolve two exclusions without expanding ANZ or PST',()=>{
 const f=snapshot('buildkite'),rows=f.feed.jobs.map(r=>({id:r.id,...reviewNativeWorkCountry(r,f.offices,f.source)}))
 assert.deepEqual(rows.filter(r=>r.proof).map(r=>r.id).sort(),[5399250008,5415583008]);assert.equal(rows.filter(r=>r.indiaScope==='unknown').length,3)
 assert.equal(rows.find(r=>r.id===5399250008).proof.countries.join('|'),'Australia|New Zealand|United States')
 assert.equal(rows.find(r=>r.id===5419114008).indiaScope,'unknown');assert.ok(rows.every(r=>r.indiaScope!=='india'))
})
test('Tripadvisor own labelled workplaces, exact office memberships and country/city groups recover seven real job gaps',()=>{
 const f=snapshot('tripadvisor'),before=JSON.stringify(f.feed),rows=f.feed.jobs.map(r=>({id:r.id,...reviewNativeWorkCountry(r,f.offices,f.source)}))
 assert.equal(rows.filter(r=>r.kind==='job').length,81);assert.equal(rows.filter(r=>r.kind==='prospect').length,1);assert.equal(rows.filter(r=>r.proof).length,7);assert.equal(rows.filter(r=>r.kind==='job'&&r.indiaScope!=='foreign').length,0);assert.equal(JSON.stringify(f.feed),before)
 assert.deepEqual(rows.find(r=>r.id===8083515).proof.countries,['Poland','United Kingdom'])
 assert.equal(rows.find(r=>r.id===4936629).indiaScope,'not-vacancy')
})
test('office country alone and generic company copy cannot fill a missing role workplace',()=>{
 const f=snapshot('tripadvisor'),record=f.feed.jobs.find(r=>r.id===7964563);record.content='<p>About our company. We have a London office.</p><p>This is a great opportunity.</p>'
 assert.equal(reviewNativeWorkCountry(record,f.offices,f.source).indiaScope,'unknown')
})
test('same-role office ID/address and directory membership are required for office-mode projection',()=>{
 for(const [mutate,expected] of[
  [f=>{for(const office of f.offices.offices)for(const d of office.departments||[])d.jobs=d.jobs.filter(r=>r.id!==7964563)},'unknown'],
  [f=>{f.offices.offices.find(o=>o.id===2765).location='London, England, India'},'conflict'],
 ]){const f=snapshot('tripadvisor');mutate(f);assert.equal(reviewNativeWorkCountry(f.feed.jobs.find(r=>r.id===7964563),f.offices,f.source).indiaScope,expected)}
})
test('native typed-country conflicts, unreviewed geographic fields and unqualified remote alternatives are never suppressed',()=>{
 for(const mutate of[
  r=>{r.metadata=[{name:'Country',value:'India'}]},
  r=>{r.countryCode='IN'},
  r=>{r.location.name+=' / Global Remote'},
 ]){const f=snapshot('buildkite'),r=f.feed.jobs.find(r=>r.id===5399250008);mutate(r);assert.notEqual(reviewNativeWorkCountry(r,f.offices,f.source).indiaScope,'foreign')}
})
test('city groups retain unresolved alternatives not explicitly bound by their own labelled country/city statement',()=>{
 const f=snapshot('tripadvisor'),r=f.feed.jobs.find(r=>r.id===8083515);r.location.name+=' / Campus 42';assert.equal(reviewNativeWorkCountry(r,f.offices,f.source).indiaScope,'unknown')
})
test('a third or malformed public country alternative cannot be ignored as a prefix match',()=>{
 for(const suffix of[' or India (Delhi)',' / Global Remote',' or Unknown Country (Campus 42)']){const f=snapshot('tripadvisor'),r=f.feed.jobs.find(r=>r.id===8083515);r.content=r.content.replace('UK (London/Oxford) or Poland (Krakow)','UK (London/Oxford) or Poland (Krakow)'+suffix);assert.notEqual(reviewNativeWorkCountry(r,f.offices,f.source).indiaScope,'foreign')}
})
test('every published whole-role country restriction is retained and conflicting or malformed later restrictions hold the role',()=>{
 for(const[id,append]of[[5415583008,'This is a fully remote role, open to candidates based in India.'],[5399250008,'This role is remote and requires someone to be located in India.'],[5399250008,'This role is remote and requires someone to be located in India or an unqualified other region.'],[5415583008,'This role is remote and requires someone to be located in']]){const f=snapshot('buildkite'),r=f.feed.jobs.find(r=>r.id===id);r.content+='<p>'+append+'</p>';assert.notEqual(reviewNativeWorkCountry(r,f.offices,f.source).indiaScope,'foreign')}
})
