import assert from 'node:assert/strict'
import test from 'node:test'
import {createFirstPartyHTMLScraper} from '../shared/firstPartyHtmlJobs.js'
const MiB=1024*1024,board='https://example.invalid/jobs'
function fixture(options={}){
 const calls=[],body=Buffer.alloc(MiB,120)
 const config={source:'aggregate-byte-fixture',companyName:'Synthetic',boardURL:board,handoffs:[],
  validateURL:url=>assert.ok(url===board||/^https:\/\/example\.invalid\/job\/\d+$/.test(url)),sameReadIdentity:(a,b)=>a===b,
  expectedContentType:()=> 'text/html',candidateForIndia:()=>true,
  parseListing:()=>({pageNumber:1,lastPage:1,reportedTotal:65,observedRows:65,
   records:Array.from({length:65},(_,i)=>({id:String(i),url:'https://example.invalid/job/'+i})),nextURL:null,terminationKnown:true}),
  pageFingerprint:()=> 'stable',parseDetail:(_,row)=>({id:row.id}),...options}
 return{config,calls,transport:async url=>{calls.push(url);return{url,status:200,headers:{'content-type':'text/html'},body,bodyComplete:true}}}
}
test('explicit native aggregate byte allowance completes large public role pages while defaults keep64MiB',async()=>{
 const configured=fixture({maxAggregateBytes:128*MiB}),all=await createFirstPartyHTMLScraper(configured.config).collect({transport:configured.transport})
 assert.equal(all.jobs.length,65);assert.equal(all.failures.length,0);assert.equal(all.retainedResponses.length,67)
 assert.equal(all.collectionLimits.maxAggregateBytes,128*MiB);assert.equal(all.closingInventoryMatches,true)
 const defaults=fixture(),limited=await createFirstPartyHTMLScraper(defaults.config).collect({transport:defaults.transport})
 assert.equal(limited.jobs.length,63);assert.ok(limited.failures.length>0);assert.equal(limited.closingInventoryMatches,false)
 assert.equal(Object.hasOwn(limited,'collectionLimits'),false);assert.equal(limited.cleanupAllowed,false)
})
test('native aggregate byte allowances are bounded integers validated before any read',async()=>{
 for(const maxAggregateBytes of [0,-1,256*MiB+1,1.5,'134217728',Infinity,NaN]){
  const f=fixture({maxAggregateBytes});await assert.rejects(createFirstPartyHTMLScraper(f.config).collect({transport:f.transport}))
  assert.equal(f.calls.length,0)
 }
})
