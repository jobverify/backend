import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {run,LISTING_API_URL} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {extractActiveDescription} from './nativeContent.js'
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/native-current-20261020.json',import.meta.url)))
const execute=async mutate=>{const f=structuredClone(fixture);mutate?.(f);return run({now:()=> '2026-10-20T23:00:00.000Z',fetchJson:async url=>url===LISTING_API_URL?f.listing:f.detail})}
test('current native source identity and full detail remain eligible',async()=>{const jobs=await execute();assert.equal(jobs.length,1);assert.equal(jobs[0].jobId,'16543');assert.equal(jobs[0].postingDate,'2026-09-21');assert.equal(readInventoryEvidence(jobs).listingComplete,true)})
for(const [name,mutate]of[
 ['HTTP200 error envelope',f=>{f.listing.code=500}],
 ['country array',f=>{f.listing.data.data[0]._source.jobLocationRecord[0].country=['India']}],
 ['country object',f=>{f.listing.data.data[0]._source.country={name:'India'}}],
 ['future native posting',f=>{f.detail.createdDate=4070908800000}],
 ['impossible native calendar',f=>{f.detail.createdDate='30-Feb-2026'}],
 ['detail location conflict',f=>{f.detail.location='Bengaluru, Karnataka, India'}],
 ['native typed city conflict',f=>{f.listing.data.data[0]._source.jobLocationRecord[0].city='Seattle'}],
 ['private native detail',f=>{f.detail.privateJobShare='Y'}],
 ['listing array employer',f=>{f.listing.data.data[0]._source.companyId=[15578]}],
 ['detail array native ID',f=>{f.detail.id=[f.detail.id]}],
 ['detail array location',f=>{f.detail.location=['Noida']}],
])test(`rejects ${name}`,async()=>assert.rejects(execute(mutate)))
for(const tag of ['script','template','textarea','xmp','iframe'])test(`inert ${tag} cannot supply a full native JD`,async()=>{
 const jobs=await execute(f=>{f.detail.jobConfigurationData.Description=`<${tag}>${'Invented complete job description '.repeat(30)}</${tag}>`})
 assert.ok(jobs.length===0||jobs.every(j=>j.sourceDetailComplete===false&&!j.jobDescription));assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('genuine empty native detail remains explicit incomplete inventory',async()=>{
 const jobs=await execute(f=>{f.detail.jobConfigurationData.Description='JD'})
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(jobs.length,1);assert.equal(jobs[0].sourceDetailComplete,false);assert.equal(jobs[0].jobDescription,null)
})
test('native Word-export presentation attributes do not hide active role text',()=>{
 assert.equal(extractActiveDescription("<p style=''margin: 0in 0in 0.0001pt; font-size: 11pt; font-family: Calibri, sans-serif;''>GST knowledge is mandatory</p>"),'GST knowledge is mandatory')
})
