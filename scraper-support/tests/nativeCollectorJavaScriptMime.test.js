import assert from 'node:assert/strict'
import test from 'node:test'
import { createFirstPartyHTMLScraper } from '../shared/firstPartyHtmlJobs.js'
for(const mime of ['text/javascript','application/javascript','application/octet-stream'])test('static public client text MIME: '+mime,async()=>{
 const asset='https://example.invalid/client.js',board='https://example.invalid/jobs',calls=[]
 const config={source:'synthetic-mime-test',companyName:'Synthetic',boardURL:board,
  validateURL:url=>assert.ok([asset,board].includes(url)),sameReadIdentity:(a,b)=>a===b,
  expectedContentType:url=>url===asset?mime:'application/json',
  handoffs:[{url:asset,verify:raw=>assert.equal(raw,'throw new Error("must never execute public client text");')}],
  parseListing:()=>({pageNumber:1,lastPage:1,reportedTotal:0,observedRows:0,records:[],nextURL:null,terminationKnown:true}),
  pageFingerprint:()=> 'empty',candidateForIndia:()=>true}
 const result=await createFirstPartyHTMLScraper(config).collect({transport:async url=>{
  calls.push(url);return{url,status:200,headers:{'content-type':url===asset?mime:'application/json'},body:Buffer.from(url===asset?'throw new Error("must never execute public client text");':'{"jobs":[]}'),bodyComplete:true}
 }})
 if(mime==='application/octet-stream'){assert.equal(result.handoffVerified,undefined);assert.equal(calls.length,1);assert.equal(result.failures.length,1)}
 else{assert.equal(result.handoffVerified,true);assert.equal(result.listingPaginationComplete,true);assert.equal(result.retainedResponses.length,3);assert.equal(result.failures.length,0)}
})
