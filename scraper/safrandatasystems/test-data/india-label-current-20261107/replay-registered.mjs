import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {getScraperCatalog,createCatalogScraper} from '../../../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../../../scraper-support/utils/inventoryEvidence.js'
import {extractJobCards} from '../../script.js'
const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
export async function replayActualRegisteredSafran(){
 const root=new URL('./',import.meta.url),manifest=JSON.parse(readFileSync(new URL('manifest.json',root))),record=manifest.actualRegisteredFullWorkflow,compressed=readFileSync(new URL(record.file,root)),raw=gunzipSync(compressed)
 assert.equal(compressed.length,record.gzipBytes);assert.equal(sha(compressed),record.gzipSHA256);assert.equal(raw.length,record.bytes);assert.equal(sha(raw),record.sha256)
 const fixture=JSON.parse(raw),packets=fixture.responses.map(row=>{const bytes=Buffer.from(row.bodyBase64,'base64');assert.equal(bytes.length,row.bodyBytes);assert.equal(sha(bytes),row.bodySHA256);return{...row,bytes}})
 assert.equal(packets.length,215);assert.ok(packets.every(row=>row.status===200));assert.equal(Buffer.byteLength(fixture.fullOutputUTF8),fixture.fullOutputBytes);assert.equal(sha(fixture.fullOutputUTF8),fixture.fullOutputSHA256)
 const original=JSON.parse(fixture.fullOutputUTF8),priorFetch=globalThis.fetch,calls=[]
 globalThis.fetch=async(input,init={})=>{
  assert.ok(init.signal instanceof AbortSignal);init.signal.throwIfAborted();const row=packets[calls.length];assert.ok(row,'No unrecorded216th request')
  const actual={url:String(input),method:init.method??'GET',methodExplicit:init.method??null,redirect:init.redirect,credentialsExplicit:init.credentials??null,requestHeaders:Object.fromEntries(new Headers(init.headers))}
  assert.deepEqual(actual,Object.fromEntries(Object.keys(actual).map(key=>[key,row[key]])));assert.equal(init.body,undefined);calls.push(actual)
  const response=new Response(row.bytes,{status:row.status,headers:row.responseHeaders});Object.defineProperty(response,'url',{value:row.finalURL});return response
 }
 let jobs
 try{const provider=getScraperCatalog().find(row=>row.source==='safrandatasystems');jobs=await createCatalogScraper(provider).run()}
 finally{globalThis.fetch=priorFetch}
 assert.equal(calls.length,215)
 const replay=JSON.parse(JSON.stringify({jobs,inventory:readInventoryEvidence(jobs)})),ignoredRuntimeFields=[]
 function normalize(value){const result=structuredClone(value);for(let i=0;i<result.jobs.length;i++){assert.ok(Number.isFinite(Date.parse(result.jobs[i].scrapedAt)));result.jobs[i].scrapedAt='<execution clock>';const path=`jobs[${i}].scrapedAt`;if(!ignoredRuntimeFields.includes(path))ignoredRuntimeFields.push(path)}assert.ok(Number.isFinite(Date.parse(result.inventory.verifiedAt)));result.inventory.verifiedAt='<execution clock>';if(!ignoredRuntimeFields.includes('inventory.verifiedAt'))ignoredRuntimeFields.push('inventory.verifiedAt');return result}
 assert.deepEqual(normalize(replay),normalize(original));assert.deepEqual(jobs.map(job=>job.jobId).sort(),['151613','151615','151616','151631','179211','186333']);assert.ok(jobs.every(job=>job.country==='India'&&job.sourceListingComplete===false&&job.employerLegalName.startsWith('Safran Data Systems India')))
 assert.equal(replay.inventory.status,'coverage-gap');assert.equal(replay.inventory.reportedTotal,null);assert.equal(replay.inventory.indiaFacetCount,null);assert.equal(replay.inventory.listingComplete,false)
 const listingRows=packets.filter(row=>new URL(row.url).pathname.endsWith('liste-offres.aspx'));assert.equal(listingRows.length,12)
 const opening=listingRows.slice(0,11).flatMap(row=>extractJobCards(row.bytes.toString('utf8')));assert.equal(opening.length,203);assert.equal(new Set(opening.map(row=>row.jobId)).size,203)
 const fields=['jobId','requisitionId','title','sourceUrl','postingDate','department','employmentType','location'],fingerprint=body=>extractJobCards(body).map(row=>Object.fromEntries(fields.map(key=>[key,row[key]])))
 assert.deepEqual(fingerprint(listingRows[0].bytes.toString('utf8')),fingerprint(listingRows[11].bytes.toString('utf8')))
 return{source:'safrandatasystems',mode:'offline original215 exact response hash/request-init replay through registered source',networkRequests:0,allOriginalResponseHashesAndBytesVerified:true,allRequestIdentityAndInitExact:true,requests:215,originalResponseBytes:packets.reduce((n,row)=>n+row.bodyBytes,0),originalFullOutputBytes:fixture.fullOutputBytes,originalFullOutputSHA256:fixture.fullOutputSHA256,entireOutputDeepEqualExceptNamedClocks:true,ignoredRuntimeFields,ignoredRoleOrBusinessFields:[],nativeGroupListingCount:203,nativeGroupListingPages:11,detailResponses:203,closingPage1ConsumedIdentityFieldsMatch:true,closingAll11PagesRevisited:false,returnedDataSystemsIndiaJobs:6,sourcePublicationDates:jobs.map(job=>({id:job.jobId,date:job.postingDate})),publicationDatesNotReplacedByCaptureDate:true,sourceScopeComplete:false,companyIndiaTotal:null,companyIndiaZeroProven:false,lifecycleCleanupAllowed:false,applicationsVisited:false,actualCaptureCallerBoundMs:45000,sourceRequestTimeoutMs:20000,sourceDetailConcurrency:6,replayIsFreshAcquisition:false}
}
