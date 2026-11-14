import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createCatalogScraper,getScraperCatalog} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readCurrentGoodnotesBoard,readCurrentGoodnotesDetail,BOARD_URL} from './currentNative.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/deployment-20261114.json.gz',import.meta.url))))
const board=fixture.responses.find(row=>row.url===BOARD_URL).body
const scraper=()=>createCatalogScraper(getScraperCatalog().find(row=>row.source==='goodnotes'))
const replay=()=>async url=>{const row=fixture.responses.find(row=>row.url===url);assert.ok(row,'Undeclared request '+url);return {...row}}

test('Goodnotes Nov14 environment and renderer tuple reconciles all five original roles while retaining unresolved country',async()=>{
 const jobs=await scraper().run({fetchPage:replay()})
 assert.equal(jobs.nativeCollectionEvidence.observedVacancyCount,5)
 assert.equal(jobs.nativeCollectionEvidence.closingReconciled,true)
 assert.equal(jobs.length,1);assert.equal(jobs[0].jobId,'6216615004')
 assert.equal(jobs[0].country,null);assert.equal(jobs[0].sourceCountryScopeUnresolved,true)
 assert.equal(jobs[0].sourceDetailComplete,true);assert.ok(jobs[0].jobDescription.includes('5 or more years as a software engineer'))
 assert.equal(jobs[0].lifecycleCleanupAllowed,false)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
})

for(const[name,edit]of[
 ['an unreviewed environment flag',html=>html.replace('window.ENV = {','window.ENV = {"UNREVIEWED":true,')],
 ['a renderer from another deployment',html=>html.replaceAll('manifest-8f9a546d.js','manifest-02ecb345.js')],
 ['an extra active program',html=>html+'</body><script>window.extra=true</script>'],
])test('Goodnotes current profile rejects '+name,()=>{
 const changed=edit(board);assert.notEqual(changed,board)
 assert.throws(()=>readCurrentGoodnotesBoard(changed),/program|renderer/)
})

test('Goodnotes current role criteria and native employer controls remain mandatory',()=>{
 const record=readCurrentGoodnotesBoard(board).records.find(row=>row.id===6216615004)
 const html=fixture.responses.find(row=>row.url===record.absolute_url).body
 const changed=html.replace('Our Values','Replacement visible section');assert.notEqual(changed,html)
 assert.throws(()=>readCurrentGoodnotesDetail(changed,record),/criteria|data/)
 assert.throws(()=>readCurrentGoodnotesDetail(html,{...record,id:1234}),/identity|disagree/)
})
