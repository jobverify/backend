import assert from 'node:assert/strict'
import test,{before,after} from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import http from 'node:http'
import https from 'node:https'
import {clientScriptDeclarations} from '../../scraper-support/utils/reviewedClientProgram.js'
import {run} from './script.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-declaration-20261121.json.gz',import.meta.url)))),careers='https://searsholdingsindia.in/careers/',api='https://searsholdingsindia.in/api/careers-openings'
const original={fetch:globalThis.fetch,httpRequest:http.request,httpGet:http.get,httpsRequest:https.request,httpsGet:https.get}
before(()=>{const denied=()=>{throw Error('No real network in Sears semantic declaration tests')};globalThis.fetch=denied;http.request=denied;http.get=denied;https.request=denied;https.get=denied})
after(()=>{globalThis.fetch=original.fetch;http.request=original.httpRequest;http.get=original.httpGet;https.request=original.httpsRequest;https.get=original.httpsGet})
async function observe(change=text=>text,expected='declared-api-request'){
 const reads=[],probe=Object.assign(Error('Sears declared API request reached; no API Response is fabricated'),{testRequestProbe:true})
 const options={requestIntervalMs:0,fetchImpl:async(url,init)=>{assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');assert.equal(init.body,undefined);reads.push(String(url));if(String(url)===api)throw probe;const row=fixture.responses[reads.length-1];assert(row,'Only two genuine opening responses then the declared API request');assert.equal(String(url),row.requestedUrl);const body=Buffer.from(row.bodyBase64,'base64').toString('utf8'),edited=String(url)===careers?change(body):body;return Object.defineProperties(new Response(edited,{status:row.status,headers:row.headers}),{url:{value:row.url},redirected:{value:false}})}}
 await assert.rejects(run(options),error=>expected==='declared-api-request'?error===probe:error!==probe&&error.failureKind==='parser_or_contract_error')
 assert.deepEqual(reads,fixture.responses.map(row=>row.requestedUrl).concat(expected==='declared-api-request'?[api]:[]))
}
const replace=(from,to)=>text=>{assert(text.includes(from),'Mutation is connected to the genuine carrier: '+from);return text.replace(from,to)}
const actualClient=text=>{const clients=clientScriptDeclarations(text).filter(node=>(node.raw??'').includes("fetch('/api/careers-openings')"));assert.equal(clients.length,1);return clients[0].raw}

test('genuine Nov19 Sears opening reaches its actually declared API despite changed unrelated telemetry',()=>observe())
test('unrelated telemetry deployment values do not qualify or suppress the openings client',()=>observe(replace("{'server':'d1b877e57fca'}","{'server':'coherent-telemetry-deployment'}")))
test('an unrelated active analytics script and a local fetch shadow do not suppress acquisition',()=>observe(replace('</body>',"<script>function noteOnly(fetch){fetch=null;}window.analyticsNote='current';</script></body>")))
test('coherent openings-state variable renaming remains semantic',()=>observe(text=>text.replaceAll('allOpenings','currentAdvertisedOpenings')))
test('the selected openings declaration cannot be missing',()=>observe(text=>text.replace(actualClient(text),''),'held'))
test('an openings client in an inert template is not a declared consumer',()=>observe(text=>{const raw=actualClient(text),tag='<script>'+raw+'</script>';assert(text.includes(tag));return text.replace(tag,'<template>'+tag+'</template>')},'held'))
test('a missing initial fetch invocation is held',()=>observe(replace('  fetchActiveOpenings()\n    .then','  Promise.resolve([])\n    .then'), 'held'))
test('a dead initial fetch cannot qualify a client',()=>observe(replace('  fetchActiveOpenings()\n    .then','  if(false)fetchActiveOpenings()\n    .then'),'held'))
test('an early return before initial fetch is held',()=>observe(replace('  fetchActiveOpenings()\n    .then','  return;\n  fetchActiveOpenings()\n    .then'),'held'))
test('a different own API endpoint is held',()=>observe(replace("fetch('/api/careers-openings')","fetch('/api/other-company')"),'held'))
test('a foreign API endpoint is held',()=>observe(replace("fetch('/api/careers-openings')","fetch('https://other.example/openings')"),'held'))
test('a changed response array property is held',()=>observe(text=>text.replaceAll('data.openings','data.otherOpenings'),'held'))
test('initial state replacement cannot retain a superficially connected call',()=>observe(replace('allOpenings = openings;','allOpenings = [];'),'held'))
test('a disconnected results consumer is held',()=>observe(replace('displayMatchingJobs(filtered);','displayMatchingJobs([]);'),'held'))
test('a result card using a foreign title instead of the same row is held',()=>observe(replace('escapeHtml(job.title)','escapeHtml("Other role")'),'held'))
test('a fixed foreign application handoff is held',()=>observe(replace('escapeHtml(job.applicationUrl)','escapeHtml("https://other.example/apply")'),'held'))
test('a missing owned results element is held',()=>observe(replace('id="openingsResults"','id="differentResults"'),'held'))
test('a duplicate owned form is held',()=>observe(replace('</body>','<form id="openingsSearchForm"></form></body>'),'held'))
test('an unknown DOM owner cannot replace the actual results binding',()=>observe(replace("document.getElementById('openingsResults')","document.getElementById('unknownResults')"),'held'))
test('an additional active same-endpoint job consumer is not silently skipped',()=>observe(replace('</body>',"<script>fetch('/api/careers-openings').then(r=>r.json()).then(rows=>window.otherJobs=rows);</script></body>"),'held'))
test('an active critical fetch replacement is held',()=>observe(replace('</head>',"<script>window.fetch=function(){return null;};</script></head>"),'held'))
test('compound writes cannot replace native array state initialization',()=>observe(replace('allOpenings = openings;','allOpenings += openings;'),'held'))
test('a response parameter cannot masquerade as the native Array primitive',()=>observe(replace('function(data){ return Array.isArray(data.openings) ? data.openings : []; }','function(Array){ return Array.isArray(Array.openings) ? Array.openings : []; }'),'held'))
test('a card parameter cannot masquerade as the native document owner',()=>observe(text=>{const start=text.indexOf('  function renderJobCard(job) {'),end=text.indexOf('  function displayMatchingJobs(jobs) {',start);assert(start>=0&&end>start);return text.slice(0,start)+text.slice(start,end).replaceAll('job','document')+text.slice(end)},'held'))
test('ignored inline text under an external src carrier cannot declare the endpoint',()=>observe(text=>{const raw=actualClient(text),tag='<script>'+raw+'</script>';assert(text.includes(tag));return text.replace(tag,'<script src="https://other.example/unused.js">'+raw+'</script>')},'held'))
