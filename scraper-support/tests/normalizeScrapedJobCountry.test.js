import test from 'node:test'
import assert from 'node:assert/strict'
import {normalizeScrapedJob} from '../utils/normalizeScrapedJob.js'
import {isJobInPublicLocationScope} from '../../src/utils/publicJobLocationScope.js'
import {generateFingerprint} from '../utils/saveToDB.js'
const provider={source:'country-truth-test',companyName:'Example',countryFilter:'India'}
for(const country of [null,undefined,''])test('an explicitly unknown country is not replaced by the provider filter: '+String(country),()=>{
 const job=normalizeScrapedJob({title:'Software Engineer',location:'Mumbai',country},provider)
 assert.equal(job.country,null)
 assert.equal(isJobInPublicLocationScope(job),true)
})
test('unknown-country London cannot become India because of provider metadata',()=>{
 const job=normalizeScrapedJob({title:'Software Engineer',location:'London',country:null},provider)
 assert.equal(job.country,null)
 assert.equal(isJobInPublicLocationScope(job),false)
})
test('explicit foreign country remains authoritative over a recognized India city',()=>{
 const job=normalizeScrapedJob({title:'Software Engineer',location:'Mumbai',country:'United States'},provider)
 assert.equal(job.country,'United States')
 assert.equal(isJobInPublicLocationScope(job),false)
})
test('legacy omitted country retains its existing provider default',()=>{
 assert.equal(normalizeScrapedJob({title:'Software Engineer',location:'Mumbai'},provider).country,'India')
})
test('correcting an unknown country preserves the existing job fingerprint',()=>{
 const raw={title:'Software Engineer',company:'Example',location:'Mumbai',applyUrl:'https://example.com/jobs/123'}
 const previous=normalizeScrapedJob(raw,provider),corrected=normalizeScrapedJob({...raw,country:null},provider)
 assert.equal(previous.country,'India');assert.equal(corrected.country,null)
 assert.equal(generateFingerprint(previous),generateFingerprint(corrected))
})
