import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {gzipSync} from 'node:zlib'
import {createCatalogScraper,getScraperCatalog} from '../scraper-support/providers/index.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../scraper-support/utils/inventoryEvidence.js'
import {extractionDetailHealth} from '../scraper-support/utils/extractionDetailHealth.js'

const nativeFetch=globalThis.fetch,packets=[]
globalThis.fetch=async(url,options={})=>{
 const requestedUrl=String(url)
 if(new URL(requestedUrl).origin!=='https://www.botminds.ai')throw Error('Only the delegated public Botminds source may be requested')
 const requestedAt=new Date().toISOString(),response=await nativeFetch(url,options),bytes=Buffer.from(await response.clone().arrayBuffer())
 packets.push({url:requestedUrl,requestedAt,completedAt:new Date().toISOString(),status:response.status,
  finalUrl:response.url,responseUrl:response.url,contentType:response.headers.get('content-type'),redirectLocation:response.headers.get('location'),
  bodySHA256:createHash('sha256').update(bytes).digest('hex'),bodyBase64:bytes.toString('base64')})
 return response
}
let audit
const jobs=await createCatalogScraper(getScraperCatalog().find(provider=>provider.source==='botminds')).run({onAudit:value=>{audit=value}})
for(const url of ['https://www.botminds.ai/','https://www.botminds.ai/robots.txt']){
 const response=await globalThis.fetch(url,{redirect:'manual',signal:AbortSignal.timeout(20000)})
 await response.arrayBuffer()
}
const capture={capturedAt:new Date().toISOString(),packets},bytes=gzipSync(JSON.stringify(capture))
const phase=process.argv.includes('--verify')?'verified':'originals'
const fixturePath='scraper/botminds/test-data/public-scope-'+phase+'-20261112.json.gz'
fs.writeFileSync(fixturePath,bytes)
const report={source:'botminds',observedAt:capture.capturedAt,capturePath:fixturePath,captureSha256:createHash('sha256').update(bytes).digest('hex'),
 inventoryEvidence:readInventoryEvidence(jobs),detailHealth:extractionDetailHealth(jobs),lifecycleCleanupForbidden:sourceLifecycleCleanupForbidden(jobs),audit}
const reportPath='../reports/partial-success-repairs-2026-11-12/botminds-public-scope-'+(phase==='verified'?'verified':'evidence')+'-20261112.json'
fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify({fixturePath,reportPath,responses:packets.length,jobs:jobs.length,inventoryEvidence:report.inventoryEvidence,
 detailHealth:report.detailHealth,lifecycleCleanupForbidden:report.lifecycleCleanupForbidden}))
