import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {gzipSync} from 'node:zlib'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {extractionDetailHealth} from '../../scraper-support/utils/extractionDetailHealth.js'

const nativeFetch=globalThis.fetch,responses=[],startedAt=new Date().toISOString()
globalThis.fetch=async(url,options={})=>{
 if(new URL(String(url)).origin!=='https://tredence.ripplehire.com')throw Error('Only the delegated public Tredence native source may be requested')
 const requestedAt=new Date().toISOString(),response=await nativeFetch(url,options),bytes=Buffer.from(await response.clone().arrayBuffer())
 responses.push({requestedUrl:String(url),method:options.method||'GET',requestBody:options.body==null?null:String(options.body),
  requestedAt,completedAt:new Date().toISOString(),status:response.status,finalUrl:response.url,contentType:response.headers.get('content-type'),
  bodySha256:createHash('sha256').update(bytes).digest('hex'),body:bytes.toString('utf8')})
 return response
}
const jobs=await createCatalogScraper(getScraperCatalog().find(provider=>provider.source==='tredence')).run()
const capture={startedAt,completedAt:new Date().toISOString(),responses},bytes=gzipSync(JSON.stringify(capture))
const capturePath='scraper/tredence/test-data/registered-native-originals-20261112.json.gz'
fs.writeFileSync(capturePath,bytes)
const audit=jobs[0]?.nativeCollectionEvidence||jobs.nativeCollectionEvidence
const result={source:'tredence',startedAt,completedAt:capture.completedAt,capturePath,captureSha256:createHash('sha256').update(bytes).digest('hex'),
 nativeCandidateCount:audit?.candidateDetails,fullIndiaJobs:jobs.map(job=>({id:job.jobId,title:job.title,country:job.country,location:job.location})),
 inventoryEvidence:readInventoryEvidence(jobs),detailHealth:extractionDetailHealth(jobs),lifecycleCleanupForbidden:sourceLifecycleCleanupForbidden(jobs),audit}
const reportPath='../reports/partial-success-repairs-2026-11-12/tredence-registered-native-20261112.json'
fs.writeFileSync(reportPath,JSON.stringify(result,null,2)+'\n')
console.log(JSON.stringify({reportPath,capturePath,responses:responses.length,candidateCount:result.nativeCandidateCount,
 fullIndiaJobs:jobs.length,inventoryEvidence:result.inventoryEvidence,detailHealth:result.detailHealth,lifecycleCleanupForbidden:result.lifecycleCleanupForbidden}))
