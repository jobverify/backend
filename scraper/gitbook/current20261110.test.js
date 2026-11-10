import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {createCatalogScraper,getScraperCatalog} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'

const captured=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-http-20261110.json.gz',import.meta.url))))
const corporate='https://www.gitbook.com/careers',feed='https://api.ashbyhq.com/posting-api/job-board/GitBook'
const sha=value=>createHash('sha256').update(value).digest('hex')
async function replay({mutatePage,mutateProgram,mutateJSON}={}){
 const calls=[]
 const packet=async(url,kind)=>{
  calls.push({url,kind});const n=calls.filter(value=>value.url===url).length
  const rows=captured.responses.filter(row=>row.url===url),row=rows[n-1]
  assert.ok(row,'Unexpected or excess current native request: '+url)
  const value={status:row.status,url:row.finalUrl,html:row.body,contentType:row.contentType}
  return kind==='program'&&mutateProgram?mutateProgram(value,url,n):mutatePage?mutatePage(value,url,n):value
 }
 const scraper=createCatalogScraper(getScraperCatalog().find(row=>row.source==='gitbook'))
 const jobs=await scraper.run({now:()=>captured.completedAt,fetchPage:url=>packet(url,'page'),fetchProgram:url=>packet(url,'program'),fetchJson:async url=>{
  const value=JSON.parse((await packet(url,'json')).html);return mutateJSON?mutateJSON(value,calls.filter(row=>row.url===url).length):value
 }})
 return{jobs,calls,audit:jobs.nativeCollectionEvidence}
}

// Using only the older declaration snapshot loses genuine current native
// records even when the employer, handoff, programs and role models agree.
test('current GitBook deployment yields three reconciled native roles without assigning India or cleanup authority',async t=>{
 t.mock.method(globalThis,'fetch',()=>{throw Error('Unexpected live network in current GitBook replay')})
 assert.equal(captured.responses.length,30)
 for(const row of captured.responses){assert.equal(sha(row.body),row.sha256);assert.equal(Buffer.byteLength(row.body),row.bytes)}
 const{jobs,calls,audit}=await replay()
 assert.equal(jobs.length,3);assert.equal(calls.length,30)
 assert.equal(audit.employerScopeStable,true);assert.equal(audit.closingInventoryMatches,true)
 assert.equal(audit.employerOpening.declaredProgramProofs.length,10)
 assert.ok(jobs.every(job=>job.company==='GitBook'&&job.country===null&&job.sourceDetailComplete===true&&job.jobDescription.length>1000))
 assert.ok(jobs.every(job=>job.sourceScopeComplete===false&&job.lifecycleCleanupAllowed===false))
 assert.ok(audit.detailProofs.every(proof=>proof.complete&&proof.reasons.length===0))
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
for(const[name,mutate]of[
 ['changed declaration text',html=>html.replace('Open roles','Unreviewed open roles')],
 ['a new hiring channel',html=>html.replace('</body>','<a href="https://foreign.example/careers">Other jobs</a></body>')],
 ['hidden native handoffs',html=>html.replaceAll('href="https://jobs.ashbyhq.com/GitBook/','hidden href="https://jobs.ashbyhq.com/GitBook/')],
 ['an unreviewed stylesheet',html=>html.replace('</head>','<style>a{display:none}</style></head>')],
])test('current GitBook rejects '+name,async()=>{
 await assert.rejects(replay({mutatePage:(page,url)=>url===corporate?{...page,html:mutate(page.html)}:page}),/scope changed|binding unavailable|role handoff unavailable/)
})
test('current GitBook rejects changed declared renderer bytes',async()=>{
 await assert.rejects(replay({mutateProgram:page=>({...page,html:page.html+'\n;'})}),/program.*changed/)
})
test('current GitBook rejects changed closing native inventory',async()=>{
 await assert.rejects(replay({mutateJSON:(value,n)=>{if(n===2)value.jobs.pop();return value}}),/closing-inventory-changed/)
})
test('current GitBook does not qualify an altered native bootstrap',async()=>{
 const{jobs,audit}=await replay({mutatePage:(page,url)=>{
  if(!url.startsWith('https://jobs.ashbyhq.com/'))return page
  const script=readNativeDocument(page.html).nodes(node=>node.tag==='script'&&!node.attrs.src&&/window\.__appData\s*=/.test(node.raw||''))[0]
  assert.ok(script)
  return{...page,html:page.html.replace(script.raw,script.raw+'\nwindow.unreviewed = true;')}
 }})
 assert.equal(jobs.length,3);assert.equal(jobs.filter(job=>job.sourceDetailComplete).length,0)
 assert.ok(audit.detailProofs.every(proof=>proof.reasons.some(reason=>/reviewed-bootstrap/.test(reason))))
})
