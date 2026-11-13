import assert from 'node:assert/strict'
import test from 'node:test'
import * as licious from '../../scraper/licious/script.js'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

test('Licious exports the current corporate and MyNextHire endpoints', () => {
  assert.equal(licious.SOURCE, 'licious')
  assert.equal(licious.COMPANY, 'Licious')
  assert.equal(licious.VERIFIED_ON, '2026-10-26')
  assert.equal(licious.CAREERS_URL, 'https://www.licious.in/careers')
  assert.equal(licious.CURRENT_JOBS_URL, 'https://www.licious.in/careers/jobs')
  assert.equal(licious.PUBLIC_PORTAL_URL, 'https://licious.mynexthire.com/employer/jobs/careers')
  assert.equal(licious.LISTING_API_URL, 'https://licious.mynexthire.com/employer/careers/reqlist/get')
  assert.equal(licious.DETAIL_URL, 'https://licious.prod.in1.mynexthire.io/d17/careers/requisition/object')
})

test('Licious run wrapper forwards cancellation and native transport options', async () => {
  const capture=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../scraper/licious/test-inputs/current-app-router-default-20261107.json.gz',import.meta.url))))
  let index=0,detailReads=0
  const options={now:()=>capture.collectionStartedAt,fetchPage:async(url,init)=>{
    init.signal.throwIfAborted();const packet=capture.packets[index++];assert.equal(url,packet.requestedUrl)
    let body=Buffer.from(packet.bodyBase64,'base64').toString('utf8')
    // Explicitly labelled synthetic country control: original current rows
    // publish no country and therefore cannot exercise the positive cap branch.
    if(url.endsWith('/reqlist/get')||url.endsWith('/requisition/object')){
      const value=JSON.parse(body),rows=value.reqDetailsBOList||[value.data.reqDetailsBO]
      for(const row of rows)row.countryCode='IN'
      body=JSON.stringify(value)
    }
    if(url.endsWith('/requisition/object'))detailReads++
    return{url:packet.finalUrl,status:packet.status,contentType:packet.contentType,body}
  }}
  const jobs = await licious.run({ ...options, maxJobs: 2 })
  assert.equal(jobs.length, 2)
  assert.equal(detailReads,32);assert.equal(index,44)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Licious rejects a changed corporate handoff before requesting native inventory', async () => {
  await assert.rejects(licious.run({ fetchPage: async url => ({ status: 200, url, body: '<html><body>Unavailable</body></html>' }) }), /corporate careers handoff/i)
})
