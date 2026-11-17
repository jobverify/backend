import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'

const capture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/careers-20261116.json.gz',import.meta.url))))
const replay=async mutate=>{
 const calls=[]
 const jobs=await run({fetchPage:async url=>{calls.push(url);const row=capture.packets.find(p=>p.requestedURL===url);assert.ok(row,'Unexpected GET '+url);const page={status:row.status,url:row.url,html:Buffer.from(row.bodyBase64,'base64').toString('utf8')};return mutate?.(page,url)||page},fetchBrowserPage:async()=>assert.fail('No browser fallback expected')})
 return{jobs,calls}
}
test('current eMudhra careers without a public inventory remains an explicit unknown-inventory hold',async()=>{
 const{jobs,calls}=await replay();assert.equal(jobs.length,0);assert.equal(calls.length,10)
 const evidence=readInventoryEvidence(jobs);assert.equal(evidence.status,'coverage-gap');assert.equal(evidence.reportedTotal,null);assert.equal(evidence.indiaFacetCount,null);assert.equal(evidence.listingComplete,false);assert.equal(sourceLifecycleCleanupForbidden(jobs),true);assert.match(evidence.reason,/no-public-role-inventory/)
})
for(const[label,mutate]of[
 ['new native handoff',(p,u)=>u.endsWith('/en-in/careers')?{...p,html:p.html.replace('</body>','<a href="https://jobs.example/jobs">Open positions</a></body>')}:p],
 ['changed employer',(p,u)=>u.endsWith('/en/careers')?{...p,html:p.html.replaceAll('eMudhra','Other Employer')}:p],
 ['India redirect',(p,u)=>u.endsWith('/en-in/careers')?{...p,url:'https://emudhra.com/en/careers'}:p],
 ['restored native openings',(p,u)=>u.endsWith('/en/careers-open-positions')?{...p,status:200}:p],
 ['new sitemap openings route',(p,u)=>u.endsWith('/sitemap-pages.xml')?{...p,html:p.html.replace('</urlset>','<url><loc>https://emudhra.com/en-in/careers-open-positions</loc></url></urlset>')}:p],
])test('current eMudhra rejects '+label,async()=>assert.rejects(replay(mutate)))
