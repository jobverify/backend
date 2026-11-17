import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {createHash} from 'node:crypto'
import {HOME,CAREERS,SEARCH,CLIENT,CORE,parseCargillSearch,parseCargillPage,buildCargillSearchURL} from './nativeContract.js'
const {originals}=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-query-20261116.json.gz',import.meta.url))))
const text=p=>Buffer.from(p.bodyBase64,'base64').toString(),get=url=>text(originals.find(p=>p.url===url)),search=()=>parseCargillSearch(get(HOME),get(CAREERS),get(SEARCH),get(CLIENT),get(CORE))

test('current declared Cargill query assets bind the genuine India facet and exact core deployment',()=>{
 for(const p of originals){assert.equal(p.status,200);assert.equal(createHash('sha256').update(Buffer.from(p.bodyBase64,'base64')).digest('hex'),p.sha256)}
 assert.equal(createHash('sha256').update(get(CLIENT)).digest('hex'),'f58913158b9aa603a2a21969c4533ae9023d26ff6699d5ac505ef9d469bd85dd')
 assert.equal(createHash('sha256').update(get(CORE)).digest('hex'),'679b3cbd2d0f1c7c867f2a1c3a2b5394042ce544acb547a791a0c1ce0199f669')
 assert.deepEqual(search(),{total:80,globalDisplayedTotal:1355})
})

test('all six original India pages retain strict totals/ranges and enumerate80 unique published row identities',()=>{
 const rows=[]
 for(let page=1;page<=6;page++){
  const packet=originals.find(p=>p.url===buildCargillSearchURL(page,80));assert.ok(packet)
  const parsed=parseCargillPage(JSON.parse(text(packet)),page,80)
  assert.equal(parsed.jobs.length,page===6?5:15);rows.push(...parsed.jobs)
 }
 assert.equal(rows.length,80);assert.equal(new Set(rows.map(r=>r.publicJobId)).size,80)
 assert.ok(rows.every(r=>r.sourceUrl.startsWith('https://careers.cargill.com/en/job/')))
})

test('the finite current asset does not authorize any unknown core, search program, employer link or India facet',()=>{
 for(const args of [
  [get(HOME),get(CAREERS),get(SEARCH),get(CLIENT),get(CORE)+'\n/*unknown deployment*/'],
  [get(HOME),get(CAREERS),get(SEARCH),get(CLIENT)+'\n/*unknown program*/',get(CORE)],
  [get(HOME).replaceAll('https://careers.cargill.com/','https://example.com/'),get(CAREERS),get(SEARCH),get(CLIENT),get(CORE)],
  [get(HOME),get(CAREERS),get(SEARCH).replaceAll('data-id="1269750"','data-id="9999999"'),get(CLIENT),get(CORE)],
 ])assert.throws(()=>parseCargillSearch(...args),/Cargill/)
})

test('current original pages still reject count, page range, country filter and duplicate identity drift',()=>{
 const packet=originals.find(p=>p.url===buildCargillSearchURL(1,80)),raw=text(packet)
 for(const mutate of [
  p=>{p.results=p.results.replaceAll('data-total-results="80"','data-total-results="81"')},
  p=>{p.results=p.results.replaceAll('data-current-page="1"','data-current-page="2"')},
  p=>{p.results=p.results.replaceAll('data-total-pages="6"','data-total-pages="5"')},
  p=>{p.filters=p.filters.replaceAll('data-display="India"','data-display="Other"')},
  p=>{p.results=p.results.replaceAll('103389064096','103389066176')},
 ]){const payload=JSON.parse(raw);mutate(payload);assert.throws(()=>parseCargillPage(payload,1,80),/Cargill/)}
 assert.throws(()=>parseCargillPage(JSON.parse(raw),1,81),/Native pagination totals\/range drift/)
})
