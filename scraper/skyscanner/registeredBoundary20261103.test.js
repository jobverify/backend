import test from 'node:test'
import assert from 'node:assert/strict'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
for(const source of['skyscanner','canva','atherenergy','bnpparibas']){
 test(source+' actual registered wrapper preserves supplied denial and performs no implicit HTTP',async()=>{
  const original=globalThis.fetch;globalThis.fetch=()=>{throw Error('Offline default HTTP tripwire')};let calls=0
  try{const provider=getScraperCatalog().find(p=>p.source===source),options=source==='bnpparibas'?{fetchText:async url=>{calls++;throw Object.assign(Error('HTTP 403 for '+url),{status:403})}}:{fetchPage:async url=>{calls++;return{url,status:403,headers:{},html:'Denied'}}};await assert.rejects(createCatalogScraper(provider).run(options),error=>error.status===403&&error.source===source&&error.abortRetries===true&&error.inventoryEvidence.listingComplete===false&&error.inventoryEvidence.reportedTotal===null&&error.inventoryEvidence.indiaFacetCount===null);assert.equal(calls,1)}finally{globalThis.fetch=original}
 })
 test(source+' actual registered wrapper preserves caller cancellation of an ignored reader',{timeout:1000},async()=>{
  const provider=getScraperCatalog().find(p=>p.source===source),controller=new AbortController(),reason={source,opaque:true};let receivedSignal
  const reader=async(url,context)=>{receivedSignal=context.signal;return new Promise(()=>{})},options=source==='bnpparibas'?{fetchText:reader}:{fetchPage:reader},pending=createCatalogScraper(provider).run({...options,signal:controller.signal});setTimeout(()=>controller.abort(reason),5);await assert.rejects(pending,error=>error===reason);assert.equal(receivedSignal,controller.signal)
 })
}
