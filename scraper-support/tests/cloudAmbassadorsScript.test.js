import * as capturedFs from 'node:fs'
import {gunzipSync as capturedGunzip} from 'node:zlib'
import * as actualSource from '../../scraper/cloudambassadors/script.js'
import {nativeFetch} from '../../scraper/cloudambassadors/native.js'
const legacyText=(url,init)=>nativeFetch(url,init),legacyAsset=(url,init)=>nativeFetch(url,{...init,metadata:true})
const nativeSource={...actualSource,run:options=>actualSource.run({fetchText:legacyText,fetchAsset:legacyAsset,...options}),runStandalone:options=>actualSource.runStandalone({fetchText:legacyText,...options})}
import {readInventoryEvidence as capturedInventory} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence as capturedObservations} from '../../scraper-support/utils/sourceObservationEvidence.js'
const nativePacket=JSON.parse(capturedGunzip(capturedFs.readFileSync(new URL('../../scraper/cloudambassadors/test-data/2026-10-31-native-packets.json.gz',import.meta.url))))
const nativePage=url=>{const row=nativePacket.requests.find(row=>row.url===url);assert.ok(row,'Unrecorded native URL '+url);return row.body}
const withCapturedNative=async(callback,alter=row=>row)=>{const original=globalThis.fetch,calls=[];globalThis.fetch=async(input,options={})=>{const url=String(input),method=options.method||'GET',body=String(options.body||''),recorded=nativePacket.requests.find(row=>row.url===url&&(row.method||'GET')===method&&(method==='GET'||row.requestBody===body));assert.ok(recorded,'Unrecorded native request '+url+' '+body);const row=alter({...recorded});calls.push({url,method,body});const response=new Response(Buffer.from(row.body,row.bodyEncoding),{status:row.status,headers:{'content-type':row.contentType}});Object.defineProperty(response,'url',{value:row.finalUrl});return response};try{return await callback(calls)}finally{globalThis.fetch=original}}
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'

const loadCloudAmbassadorsModule = async () => {
  try {
    return await import('../../scraper/cloudambassadors/script.js')
  } catch {
    return null
  }
}

const careersHtml = `
  <html>
    <head>
      <title>Careers | Cloud Ambassadors</title>
    </head>
    <body>
  <header>
    <button class="cursor-pointer">Menu</button>
  </header>
  <section>
    <p>Open Roles</p>
    <div>
      <button class="glass cursor-pointer">Cloud Consultant</button>
      <button class="glass cursor-pointer">Cloud Engineer</button>
      <button class="glass cursor-pointer">Data Engineer</button>
      <button class="glass cursor-pointer">AI / ML / GenAI Engineer</button>
      <button class="glass cursor-pointer">DevOps / MLOps Engineer</button>
    </div>
  </section>
  </body>
  </html>
`

const applyPageHtml = `
  <html>
    <head>
      <title>Cloud Ambassadors — Maximizing Cloud Impact</title>
    </head>
    <body>
      <main>
        <div>
          <span>1</span><span>Personal Details</span>
          <span>2</span><span>Role &amp; Experience</span>
          <span>3</span><span>Documents</span>
          <span>4</span><span>Review</span>
        </div>
        <label>Location</label>
        <label>Email</label>
      </main>
    </body>
  </html>
`

const capturedRoles = () => gunzipSync(readFileSync(new URL('./fixtures/cloudambassadors/native-role-data-20261029.js.gz', import.meta.url))).toString()

test("Cloud Ambassadors literal candidates retain all role descriptions without asserting visibility",async()=>{const jobs=nativeSource.extractCareerListings(nativePage(nativeSource.CAREERS_URL)),roles=nativeSource.extractStaticRoleDescriptions(capturedRoles(),jobs);assert.equal(roles.length,5);assert.match(roles[0].description,/lead discovery workshops/);assert.match(roles[1].description,/Proficiency in Terraform/);assert.equal(nativeSource.extractStaticRoleDescriptions(capturedRoles(),jobs.slice(1)),null)})

test('Cloud Ambassadors parses literals without executing application code and rejects ambiguous data', async () => {
  const module = await loadCloudAmbassadorsModule()
  const jobs = [{ title: 'Cloud Engineer' }]
  const literal = JSON.stringify([{ name: 'Cloud Engineer', title: 'Build reliable cloud services.',
    bio: 'A'.repeat(100), arr: ['Experience with Google Cloud Platform and Terraform.'] }])
  assert.equal(module.extractStaticRoleDescriptions('throw new Error("must never execute"); const roles=' + literal, jobs).length, 1)
  assert.equal(module.extractStaticRoleDescriptions('const first=' + literal + '; const second=' + literal, jobs), null)
  assert.equal(module.extractStaticRoleDescriptions('const roles=' + literal.replace(JSON.stringify('A'.repeat(100)), 'loadDescription()'), jobs), null)
  assert.deepEqual(module.linkedCareerAssets('<script src="https://foreign.example/_next/static/chunks/roles.js"></script>'), [])
})

test("Cloud Ambassadors binds legacy role descriptions to supported carriers without overall native qualification",async()=>{await withCapturedNative(async()=>{const jobs=await nativeSource.run();assert.equal(jobs.length,5);assert.ok(jobs.every(job=>!job.sourceDetailComplete&&job.sourceDescription.length>1000&&job.rawNativeRoleEvidence.nativeRendererQualified));const denied=await nativeSource.run({fetchAsset:async url=>({status:403,url,html:'Denied'})});assert.equal(denied.length,5);assert.ok(denied.every(job=>job.sourceDescription==null&&!job.sourceDetailComplete))})})

test("Cloud Ambassadors role labels remain partial without declared renderer or job-specific application proof",async()=>{const jobs=nativeSource.extractCareerListings(nativePage(nativeSource.CAREERS_URL));assert.equal(jobs.length,5);assert.equal(jobs[0].title,'Cloud Consultant');assert.ok(jobs.every(job=>job.country==null&&job.location==null&&job.jobId==null&&job.requisitionId==null&&job.jobDescription==null));assert.equal(jobs[0].rawNativeRoleEvidence.applicationRoleIdentityQualified,false)})

test("Cloud Ambassadors disabled enrichment leaves five explicitly unqualified role descriptions",async()=>{await withCapturedNative(async calls=>{const jobs=await nativeSource.run({detailEnrichmentBudgetMs:0});assert.equal(calls.length,2);assert.equal(jobs.length,5);assert.ok(jobs.every(job=>job.jobDescription==null&&!job.sourceDetailComplete&&job.country==null));assert.equal(capturedInventory(jobs).status,'coverage-gap');assert.equal(capturedInventory(jobs).reportedTotal,null)})})

test("Cloud Ambassadors dry-run writes native partial results without a database write",async()=>{await withCapturedNative(async()=>{const saved=[];let databaseWrites=0;const jobs=await nativeSource.runStandalone({argv:['node','script.js','--dry-run'],saveToFile:(rows,filePath)=>saved.push({rows,filePath}),saveToDB:async()=>{databaseWrites++}});assert.equal(jobs.length,5);assert.equal(saved.length,1);assert.equal(saved[0].rows,jobs);assert.match(saved[0].filePath,/jobs.json$/);assert.equal(databaseWrites,0)})})
