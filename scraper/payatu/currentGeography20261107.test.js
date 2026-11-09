import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const capture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261107/current-native.json.gz',import.meta.url))))
const transport=(change=(_url,body)=>body)=>async url=>{
 const packet=capture.packets.find(row=>row.requestUrl===url)
 assert.ok(packet,'Only captured employer-declared URLs: '+url)
 assert.equal(packet.status,200)
 return change(url,packet.body)
}

test('Payatu retains all current employer-board roles with both observed Pune multi-city labels',async()=>{
 const jobs=await run({fetchText:transport()})
 assert.equal(jobs.length,10)
 const cloud=jobs.find(job=>job.jobId==='cloud-security-consultant')
 assert.deepEqual({location:cloud.location,city:cloud.city,country:cloud.country,remote:cloud.remoteStatus},
  {location:'Pune / Delhi / Bangalore, India',city:'Pune',country:'India',remote:'On-site'})
 const red=jobs.find(job=>job.jobId==='red-team')
 assert.deepEqual({location:red.location,city:red.city,country:red.country,remote:red.remoteStatus},
  {location:'Pune / Bangalore, India',city:'Pune',country:'India',remote:'On-site'})
 assert.ok(jobs.every(job=>job.jobDescription.length>500&&job.applyUrl===job.sourceUrl+'#apply'))
 assert.equal(readInventoryEvidence(jobs).listingComplete,true)
})

test('Payatu rejects a changed detail geography for the new multi-city listing',async()=>{
 await assert.rejects(run({fetchText:transport((url,body)=>url==='https://bandit.fit/cloud-security-consultant'
  ?body.replace('Pune/Delhi/BLR','Pune/Singapore/BLR'):body)}),/detail identity, location/i)
})

test('Payatu keeps new foreign and unqualified remote combinations unverified',async()=>{
 for(const value of ['Pune/Singapore/BLR','Pune/BLR/Unknown','Remote']){
  await assert.rejects(run({fetchText:transport((url,body)=>url==='https://bandit.fit/'
   ?body.replace('Pune/Delhi/BLR',value):body)}),/geography is unverified/)
 }
})
