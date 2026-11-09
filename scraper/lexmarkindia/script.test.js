import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {createLexmarkIndiaScraper} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {resolveZeroJobOutcome} from '../../scraper-support/runner.js'
const careers=fs.readFileSync(new URL('./fixtures/current-careers.html',import.meta.url),'utf8')
const board=fs.readFileSync(new URL('./fixtures/workday-board.html',import.meta.url),'utf8')
const fetchText=async url=>url==='https://origin-www.lexmark.com/en_in/careers.html'?careers:url==='https://lexmark.wd1.myworkdayjobs.com/Lexmark'?board: (()=>{throw Error('Unexpected legacy route '+url)})()
test('Lexmark follows official Workday handoff and accepts verified globally-empty inventory',async()=>{
 const jobs=await createLexmarkIndiaScraper().run({fetchText,fetchJson:async()=>({total:0,jobPostings:[],facets:[],userAuthenticated:false})})
 assert.deepEqual(jobs,[])
 assert.equal(readInventoryEvidence(jobs)?.reportedTotal,0)
 assert.equal(resolveZeroJobOutcome({provider:{zeroResultPolicy:'evidence-required'}},jobs,[]),'verified-empty')
})
test('Lexmark rejects changed tenant identity and contradictory zero data',async()=>{
 await assert.rejects(createLexmarkIndiaScraper().run({fetchText:async url=>(await fetchText(url)).replace('tenant: "lexmark"','tenant: "other"'),fetchJson:async()=>({total:0,jobPostings:[],facets:[]})}),/identity|verified|Workday/i)
 await assert.rejects(createLexmarkIndiaScraper().run({fetchText,fetchJson:async()=>({total:0,jobPostings:[{title:'Unexpected role'}],facets:[]})}),/payload|inventory/i)
})

test('Lexmark nonempty current inventory delegates India pagination and enrichment to the native Workday engine',async()=>{
 let options
 const expected=[{jobId:'r1',country:'India',jobDescription:'Complete native description'}]
 const jobs=await createLexmarkIndiaScraper({workdayScraper:async input=>{options=input;return expected}}).run({fetchText,fetchJson:async()=>({total:1,jobPostings:[{title:'Engineer',externalPath:'/job/India/Engineer_r1'}],facets:[]})})
 assert.equal(jobs,expected)
 assert.equal(options.company,'Lexmark India')
 assert.equal(options.source,'lexmarkindia')
 assert.equal(options.baseUrl,'https://lexmark.wd1.myworkdayjobs.com/Lexmark')
 assert.equal(options.boardIdentityVerified,true)
})
