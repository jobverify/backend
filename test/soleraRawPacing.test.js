import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {auditSoleraRawScope} from '../scraper/solera/nativeRawScope.js'
import {WorkdayRequestScheduler} from '../scraper-support/myworkday/requestScheduler.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('../scraper/solera/fixtures/native-20261029.json.gz',import.meta.url))))
const schema=JSON.parse(readFileSync(new URL('../scraper/solera/reviewedNativeScope.json',import.meta.url),'utf8'))
test('Solera supplemental detail audit shares native Workday request capacity',async t=>{
 const api='https://solera.wd5.myworkdayjobs.com/wday/cxs/solera/Global_Career_Site/jobs',rows=fixture.native.initial.records.slice(0,2);let active=0,peak=0
 t.mock.method(globalThis,'fetch',async(input,init)=>{const url=String(input);let value;if(url===api)value={total:2,jobPostings:rows,facets:fixture.native.initial.facets,userAuthenticated:false};else{active++;peak=Math.max(active,peak);await new Promise(resolve=>setTimeout(resolve,5));value=fixture.native.details.find(x=>url.endsWith(x.row.externalPath)).payload;active--}const r=new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});Object.defineProperty(r,'url',{value:url});return r})
 const result=await auditSoleraRawScope({apiUrl:api,boardUrl:'https://solera.wd5.myworkdayjobs.com/Global_Career_Site',schema,requestScheduler:new WorkdayRequestScheduler({minIntervalMs:0,maxConcurrent:1})});assert.equal(result.total,2);assert.equal(peak,1)
})
