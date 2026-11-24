import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'
import test from 'node:test'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
const packets=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-client-20261121.json.gz',import.meta.url)))).packets
for(const p of packets){assert.equal(p.bodyOriginalUnmodified,true);assert.equal(createHash('sha256').update(p.html).digest('hex'),p.sha256)}
const BOARD='https://app.screenloop.com/careers/amicable',CLIENT=packets.find(p=>/\/application-[a-f0-9]+\.js$/.test(p.requestedUrl)).requestedUrl
const doc=readNativeDocument(packets.find(p=>p.requestedUrl===BOARD).html)
const props=JSON.parse(doc.nodes(n=>n.attrs['data-react-class']==='applicant_tracking/Careers/CareersPage')[0].attrs['data-react-props'])
const firstDetail=BOARD+'/job_posts/'+props.jobPosts[0].id+'?tab=overview'
const replay=(change=source=>source)=>{
 const calls=[],stop=Object.freeze({unacquired:'current full native role packet'}),controller=new AbortController()
 const run=()=>createCatalogScraper(getScraperCatalog().find(p=>p.source==='amicableai')).run({signal:controller.signal,fetchPage:async url=>{
  // Detail-health errors are retained as coverage gaps. An explicit caller
  // cancellation is the exact boundary for deliberately unacquired packets.
  calls.push(url);if(url===firstDetail){controller.abort(stop);throw stop}
  const p=packets.find(p=>p.requestedUrl===url);assert.ok(p,'Only exact original current advertised corporate/native dependencies')
  return {...p,html:url===CLIENT?change(p.html):p.html}
 }})
 return{calls,stop,run}
}
test('actual current declared public client reaches the first native detail without inventing an inventory',async()=>{
 const r=replay();await assert.rejects(r.run(),error=>error===r.stop)
 assert.equal(r.calls.length,7);assert.equal(r.calls.at(-2),CLIENT);assert.equal(r.calls.at(-1),firstDetail)
})
for(const name of ['getPageJobPosts','TalentPoolButton'])test('current '+name+' public dataflow must retain its complete reviewed AST',async()=>{
 const r=replay(source=>{const changed=source.replace(new RegExp('(function '+name+'\\([^)]*\\)\\{)'),'$1return [];');assert.notEqual(changed,source);return changed})
 await assert.rejects(r.run(),new RegExp('changed public '+name+' inventory/detail dataflow'))
 assert.ok(r.calls.includes(CLIENT));assert.equal(r.calls.includes(firstDetail),false)
})
test('current pagination constant cannot change while public function text remains identical',async()=>{
 const r=replay(source=>{const changed=source.replace('PAGE_SIZE3=10','PAGE_SIZE3=0');assert.notEqual(changed,source);return changed})
 await assert.rejects(r.run(),/changed public dependency PAGE_SIZE3/)
 assert.ok(r.calls.includes(CLIENT));assert.equal(r.calls.includes(firstDetail),false)
})
