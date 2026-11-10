import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {getScraperCatalog} from '../scraper-support/providers/index.js'
import {recruitmentEmployerMatches} from '../scraper-support/utils/verifiedRecruitment.js'
import {recoverSoftFailedRecruitment} from '../scraper-support/utils/softFailureRecruitmentRecovery.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'

const packet=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/flywireNativeRole20261110.json.gz',import.meta.url))))
const native=JSON.parse(packet.body),info=native.jobPostingInfo
const provider=getScraperCatalog().find(row=>row.source==='flywire')
const board='https://flywire.wd108.myworkdayjobs.com/flywirecareers'
const api='https://flywire.wd108.myworkdayjobs.com/wday/cxs/flywire/flywirecareers'
const externalPath=new URL(info.externalUrl).pathname.slice('/flywirecareers'.length)

test('the exact currently advertised India employer matches the reviewed Flywire subsidiary',()=>{
 assert.equal(recruitmentEmployerMatches(provider,native.hiringOrganization.name),true)
 assert.equal(recruitmentEmployerMatches(provider,'Another Employer India LLP'),false)
 assert.ok(provider.nativeEmployerEvidence.source.includes('ir.flywire.com/'))
})

test('recovery preserves the actual native employer, typed country and full original criteria',async t=>{
 t.mock.method(globalThis,'fetch',()=>assert.fail('Only retained native fixture requests are permitted'))
 const error=Object.assign(Error('Flywire native: current corporate handoff changed'),{softFailure:true,failureKind:'surface_drift_or_fail_closed'})
 const jobs=await recoverSoftFailedRecruitment(error,provider,{softFailureRecovery:{now:()=>packet.capturedAt,
  fetchPage:async url=>({status:200,url,html:'<title>Flywire Careers</title><h1>Flywire</h1><a href="'+board+'">Current Job Openings</a>'}),
  fetchJson:async url=>{
   if(url===api+'/jobs')return{total:1,facets:[],jobPostings:[{title:info.title,externalPath,bulletFields:[info.jobReqId],locationsText:info.location}]}
   assert.equal(url,api+externalPath)
   return structuredClone(native)
  }}})
 assert.equal(jobs.length,1)
 assert.equal(jobs[0].country,'India')
 assert.equal(jobs[0].nativeHiringOrganization.name,'FW Solutions India LLP [India]')
 assert.deepEqual(jobs[0].nativeSourceRecord,native)
 assert.equal(jobs[0].sourceDescription,info.jobDescription)
 assert.equal(jobs[0].lifecycleCleanupAllowed,false)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
