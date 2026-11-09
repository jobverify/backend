import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'
import {CAREERS_URL, buildListingApiUrl, createCenturyPlyboardsScraper, hasOfficialCareersSignal} from '../../scraper/centuryplyboards/script.js'
const html=await fs.readFile(new URL('./fixtures/centuryplyboards/current-careers.html',import.meta.url),'utf8')
test('current official CenturyPly careers still pins the failing X0PA tenant',()=>{
 assert.match(html, /<title>Life at CenturyPly \| Careers \| CenturyPly<\/title>/)
 const handoffs=[...html.matchAll(/href=["'](https:\/\/[^"']+)["']/g)].map(m=>m[1]).filter(url=>/x0pa|lever|greenhouse|workday|ashby|recruit|hire/i.test(url))
 assert.deepEqual(handoffs,['https://centuryply.x0pa.ai/public/microsites/centuryplycareers'])
})
test('CenturyPly upstream DNS failure propagates without claiming an empty inventory',async()=>{
 const reason=new Error('getaddrinfo ENOTFOUND centuryply.x0pa.ai')
 reason.code='ENOTFOUND'
 const calls=[]
 const guardedFixture=html+'<p>Explore opportunities with CenturyPly.</p>'
 assert.equal(hasOfficialCareersSignal(guardedFixture),true)
 await assert.rejects(createCenturyPlyboardsScraper().run({
  fetchText:async url=>{calls.push(url);assert.equal(url,CAREERS_URL);return guardedFixture},
  fetchJson:async url=>{calls.push(url);throw reason},
 }),error=>error===reason)
 assert.deepEqual(calls,[CAREERS_URL,buildListingApiUrl()])
})
