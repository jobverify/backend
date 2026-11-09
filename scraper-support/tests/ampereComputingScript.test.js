import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createCatalogScraper,getScraperCatalog} from '../providers/index.js'
import {createAmpereComputingScraper,SEARCH_URL} from '../../scraper/amperecomputing/script.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../scraper/amperecomputing/test-data/native-talemetry-20261103.json.gz',import.meta.url))))
test('registered Ampere Computing runtime retains all complete public India roles while keeping private form fields separately unknown',async()=>{
 const provider=getScraperCatalog().find(p=>p.source==='amperecomputing')
 let audit
 const jobs=await createCatalogScraper(provider).run({fetchPage:async url=>{const p=fixture.responses[url];assert.ok(p,'Unexpected native URL');return {...p,url:p.finalUrl}},onNativeAudit:a=>{audit=a}})
 assert.equal(jobs.length,30)
 assert.equal(audit.publicObservations.length,30)
 assert.ok(audit.publicObservations.every(j=>j.country==='India'&&j.sourceDescription.length>500&&j.postingDate===null&&j.remoteStatus===null&&j.requisitionId===null))
 assert.ok(audit.publicObservations.every(j=>j.sourceNativeApplicationOptions.applyCompany==='amperecomputing'&&j.sourceDetailComplete===true&&j.sourcePrivateApplicationFieldsKnown===false))
})
test('Ampere Computing reports access denied instead of treating challenge HTML as India zero',async()=>{
 await assert.rejects(createAmpereComputingScraper().run({fetchPage:async url=>({url,status:403,html:'<title>Just a moment...</title>'})}),e=>e.failureKind==='blocked_or_access_denied'&&e.status===403)
})
