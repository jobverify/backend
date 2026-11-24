import fs from 'node:fs'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {gunzipSync} from 'node:zlib'
import http from 'node:http'
import https from 'node:https'
import test,{before,after} from 'node:test'
import {createSearsITManagementServicesIndiaScraper} from './script.js'

// Exact six payloads/oracles from the independently frozen root helper; the
// four negatives are selected alone for the genuine pre-fix RED.
const sha=body=>createHash('sha256').update(body).digest('hex')
const packetFile=new URL('../../reports/scraper-20261118-soft-failures/continuation-20261119/native-sears-executable-qualifier-diagnosis-20261121/current-api-research/current-original-responses.json.gz',import.meta.url)
const packetBytes=fs.readFileSync(packetFile)
assert.equal(sha(packetBytes),'f008f14ec6fd2a9b1d1d82b4deee2b652f6eff9ff1872dac62298ca125d50c6b')
const rows=JSON.parse(gunzipSync(packetBytes)).responses
assert.equal(rows.length,3)
assert.deepEqual(rows.map(row=>row.status),[200,200,404])
for(const row of rows){const body=Buffer.from(row.bodyBase64,'base64');assert.equal(body.length,row.bytes);assert.equal(sha(body),row.sha256)}
const replace=(from,to)=>text=>{assert.equal(text.split(from).length,2,'Exactly one genuine mutation carrier: '+from);return text.replace(from,to)}
const cases=[
 {name:'current-original-native-chain-reaches-actual-404',expected:'api404',mutate:text=>text},
 {name:'coherent-state-identifier-and-unrelated-telemetry',expected:'api404',mutate:text=>{assert(text.includes('allOpenings'));return text.replaceAll('allOpenings','rootReviewedOpenings').replace('</body>',"<script>window.rootTelemetryNote='coherent';</script></body>")}},
 {name:'async-card-returns-promise-instead-of-dom-card',expected:'held',mutate:replace('  function renderJobCard(job) {','  async function renderJobCard(job) {')},
 {name:'unconditional-return-makes-nonempty-result-renderer-unreachable',expected:'held',mutate:replace("    statusEl.textContent = '';\n    jobs.forEach",'    return;\n    jobs.forEach')},
 {name:'inert-card-content-cannot-prove-rendered-title-and-application',expected:'held',mutate:replace('    card.innerHTML =\n','    if (false) card.innerHTML =\n')},
 {name:'reflective-array-primitive-replacement-is-held',expected:'held',mutate:replace('</head>',"<script>Object.defineProperty(Array,'isArray',{value:function(){return true;}});</script></head>")},
]
const coherentCases=[
 {name:'async-fetch-pipeline-still-returns-the-same-response-promise',expected:'api404',mutate:replace('  function fetchActiveOpenings() {','  async function fetchActiveOpenings() {')},
 {name:'reflective-unrelated-telemetry-does-not-replace-a-critical-owner',expected:'api404',mutate:replace('</head>',"<script>Object.defineProperty(window,'rootReviewedTelemetry',{value:'coherent'});</script></head>")},
]
const fences={fetch:0,httpRequest:0,httpGet:0,httpsRequest:0,httpsGet:0}
const original={fetch:globalThis.fetch,httpRequest:http.request,httpGet:http.get,httpsRequest:https.request,httpsGet:https.get}
before(()=>{const deny=key=>(..._args)=>{fences[key]++;throw Object.assign(Error('No network in Sears independent guard regressions: '+key),{harnessFence:true})};globalThis.fetch=deny('fetch');http.request=deny('httpRequest');http.get=deny('httpGet');https.request=deny('httpsRequest');https.get=deny('httpsGet')})
after(()=>{globalThis.fetch=original.fetch;http.request=original.httpRequest;http.get=original.httpGet;https.request=original.httpsRequest;https.get=original.httpsGet;assert(Object.values(fences).every(count=>count===0),'All five real-network fences stay unused')})
async function observe(spec){
 const reads=[];let failure=null
 try{await createSearsITManagementServicesIndiaScraper().run({requestIntervalMs:0,fetchImpl:async(input,init)=>{
  const index=reads.length,row=rows[index],url=String(input);assert(row,'Only the three genuine saved current responses are allowed');assert.equal(url,row.requestedUrl);assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');assert.equal(init.body,undefined)
  const originalBody=Buffer.from(row.bodyBase64,'base64'),body=index===1?Buffer.from(spec.mutate(new TextDecoder('utf8',{fatal:true}).decode(originalBody))):originalBody,headers={...row.headers}
  if(index===1&&spec.expected==='held')assert(!body.equals(originalBody),'Actual negative carrier must change')
  if(!body.equals(originalBody))for(const key of Object.keys(headers))if(key.toLowerCase()==='content-length')headers[key]=String(body.length)
  reads.push({url,status:row.status});return Object.defineProperties(new Response(body,{status:row.status,statusText:row.statusText,headers}),{url:{value:row.url},redirected:{value:row.redirected}})
 }})}catch(error){if(error.code==='ERR_ASSERTION'||error.harnessFence)throw error;failure={failureKind:error.failureKind,httpStatus:error.httpStatus,message:error.message}}
 const actual=failure?.failureKind==='source_inventory_unavailable'&&failure.httpStatus===404&&reads.length===3?'api404':failure?.failureKind==='parser_or_contract_error'&&reads.length===2?'held':'unexpected'
 return{actual,reads,failure}
}
for(const spec of [...cases,...coherentCases])test(spec.name,async context=>{const observed=await observe(spec);context.diagnostic(JSON.stringify(observed));assert.equal(observed.actual,spec.expected,'Actual original-response public factory must respect the semantic guard')})
