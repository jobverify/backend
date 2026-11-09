import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createFordIndiaScraper} from './script.js'
import {createFordMotorPvtLtdScraper,extractSearchResults,extractPaginationSummary} from '../fordmotorpvtltd/script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
const capture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261107/first-role.json.gz',import.meta.url))))
const board=capture.packets[0],detail=capture.packets[1]
const options=(change=(_url,body)=>body)=>({fetchPage:async()=>({status:200,url:board.url,html:board.body}),fetchText:async url=>change(url,url===detail.requestUrl?detail.body:board.body)})
test('Ford India accepts only the current official locale redirect and preserves full native role criteria',async()=>{
 const jobs=await createFordIndiaScraper({maxJobs:1}).run(options());assert.equal(jobs.length,1);assert.equal(jobs[0].requisitionId,'68458')
 assert.equal(jobs[0].country,'India');assert.ok(jobs[0].jobDescription.includes('HS Classification'))
 assert.equal(jobs[0].lifecycleCleanupAllowed,false);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('Ford current locale family preserves caller cancellation and rejects changed country/detail identity',async()=>{
 const controller=new AbortController(),reason=Object.freeze({fordNativeAbort:true})
 await assert.rejects(createFordMotorPvtLtdScraper({maxJobs:1}).run({...options((url,body)=>{if(url===detail.requestUrl)controller.abort(reason);return body}),signal:controller.signal}),error=>error===reason)
 await assert.rejects(createFordIndiaScraper({maxJobs:1}).run(options((url,body)=>{
  if(url!==detail.requestUrl)return body
  const script=readNativeDocument(body).nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json')[0]
  const record=JSON.parse(script.raw);record.jobLocation[0].address.addressCountry='United States'
  const changed=body.replace(script.raw,JSON.stringify(record))
  assert.notEqual(changed,body,'Mutate the original native work-country field')
  return changed
 })),/country|India|native/i)
})
test('Ford locale wrapper rejects a dropped India filter and the base rejects a changed closing listing',async()=>{
 await assert.rejects(createFordIndiaScraper({maxJobs:1}).run({...options(),fetchPage:async()=>({status:200,url:board.url.replace(/alrpm=\d+&/,''),html:board.body})}),/verified|locale|surface/i)
 let reads=0
 await assert.rejects(createFordMotorPvtLtdScraper({maxJobs:1}).run({...options(),fetchText:async url=>url===detail.requestUrl?detail.body:++reads===1?board.body:board.body.replaceAll('Analyst - Customs &amp; Trade','Changed title')}),/closing|changed/i)
})
test('Ford country-wide native role is explicitly India while its city field remains unqualified',async()=>{
 const {packet}=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261107/country-wide-role.json.gz',import.meta.url))))
 const raw=readNativeDocument(packet.body).nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json')[0]
 const native=JSON.parse(raw.raw),jobId=new URL(packet.requestUrl).pathname.split('/').at(-1)
 // One genuine native role; this one-row listing is an explicit synthetic
 // control of the publisher's India-wide location shape, not the live total.
 const listing='<section id="search-results-list" data-ajax-post-url="/en/search-jobs/resultspost">Country: India<a href="'+packet.requestUrl+'" data-job-id="'+jobId+'"><h2>'+native.title.replaceAll('&','&amp;')+'</h2><span class="job-location">India</span></a><div data-current-page="1" data-total-pages="1" data-total-job-results="1"></div></section>'
 const jobs=await createFordMotorPvtLtdScraper().run({fetchText:async url=>url===packet.requestUrl?packet.body:listing})
 assert.equal(jobs.length,1);assert.equal(jobs[0].country,'India');assert.equal(jobs[0].city,null)
})

test('Ford mixed India and unbounded Remote locations remain a coverage gap and are closed again',async()=>{
 const {packet}=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261107/mixed-remote-role.json.gz',import.meta.url))))
 const raw=readNativeDocument(packet.body).nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json')[0]
 const native=JSON.parse(raw.raw),jobId=new URL(packet.requestUrl).pathname.split('/').at(-1)
 const listing='<section id="search-results-list" data-ajax-post-url="/en/search-jobs/resultspost">Country: India<a href="'+packet.requestUrl+'" data-job-id="'+jobId+'"><h2>'+native.title+'</h2><span class="job-location">India</span></a><div data-current-page="1" data-total-pages="1" data-total-job-results="1"></div></section>'
 const jobs=await createFordMotorPvtLtdScraper().run({fetchText:async url=>url===packet.requestUrl?packet.body:listing})
 assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 let reads=0
 await assert.rejects(createFordMotorPvtLtdScraper().run({fetchText:async url=>url===packet.requestUrl?++reads===1?packet.body:packet.body.replace(raw.raw,JSON.stringify({...native,title:'Changed native role'})):listing}),/closing|changed/i)
})
