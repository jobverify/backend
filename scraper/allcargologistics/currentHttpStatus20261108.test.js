import test from 'node:test'
import assert from 'node:assert/strict'
import {runCurrentAllcargoInventory} from './nativeInventory.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const origin='https://allcargologistics.darwinbox.in',home=origin+'/ms/candidatev2/main/careers/home',seed=origin+'/ms/candidatev2/main/careers/allJobs',api=origin+'/ms/candidateapi/job/alljobs?companyId=main'
const native='<title>Allcargo Logistics Ltd.</title><meta property="og:title" content="Allcargo Logistics Ltd.">'
const response=(url,body,status=200,headers={})=>{const r=new Response(body,{status,headers});Object.defineProperty(r,'url',{value:url});return r}
const denied=status=>async(url)=>url===api?response(url,'Unavailable',status,{'content-type':'text/html'}):response(url,url===home||url===seed?native:'<title>Allcargo Careers</title><a href="'+home+'">Join our team</a>',200,{'content-type':'text/html','set-cookie':'public_session=fixture; Secure; HttpOnly'})
for(const status of [401,403,429,451])test('native HTTP '+status+' remains denied with unknown inventory rather than a parser defect',async()=>{
 await assert.rejects(runCurrentAllcargoInventory({fetchImpl:denied(status)}),e=>{
  assert.equal(e.status,status);assert.equal(e.failureKind,'public_access_denied');assert.equal(e.softFailure,true);assert.equal(e.upstreamOutage,true);assert.equal(e.abortRetries,true)
  assert.equal(e.inventoryEvidence.listingComplete,false);assert.equal(e.inventoryEvidence.reportedTotal,null);assert.equal(e.inventoryEvidence.indiaFacetCount,null)
  assert.equal(e.retainedNativeResponses.at(-1).status,status);assert.ok(!JSON.stringify(e.retainedNativeResponses).includes('public_session'));return true
 })
})
for(const status of [408,500,502,503,504])test('native HTTP '+status+' permits a new bounded fresh-session attempt without certifying zero',async()=>{
 await assert.rejects(runCurrentAllcargoInventory({fetchImpl:denied(status)}),e=>{assert.equal(e.status,status);assert.equal(e.failureKind,'network_or_timeout');assert.equal(e.abortRetries,false);assert.equal(e.inventoryEvidence.listingComplete,false);return true})
})
test('a foreign response URL remains a nonretryable native identity failure',async()=>{
 await assert.rejects(runCurrentAllcargoInventory({fetchImpl:async url=>response('https://foreign.example/',native)}),e=>e.failureKind==='parser_or_contract_error'&&e.abortRetries===true)
})
