import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import net from 'node:net'
import tls from 'node:tls'
import {parse} from 'acorn'
import {buildScrapers} from '../scraper-support/providers/index.js'
import profile from '../scraper/hyperscience/currentFormSourceProfile20261121.js'
import {readHyperscienceFormClientContract} from '../scraper/hyperscience/currentFormContract.js'

const sha=value=>createHash('sha256').update(value).digest('hex')
const load=name=>JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/'+name,import.meta.url))))
const historical=load('hyperscience-server-programme-components-20261111.json.gz')
const current=load('hyperscience-current-selected-client-20261121.json.gz')
const old=kind=>historical.responses.find(row=>row.kind===kind)
const actual=kind=>current.responses.find(row=>row.kind===kind)
const request=Buffer.from(historical.request.bodyBase64,'base64')
function original(kind){
 const source=old(kind)
 return{body:Buffer.from(source.bodyBase64,'base64'),receipt:structuredClone(source.receipt)}
}
function delivery(kind){
 const source=actual(kind);let body=Buffer.from(source.bodyBase64,'base64')
 assert.equal(sha(body),source.origin.persistedSHA256)
 const reference=old(kind),receipt=structuredClone(reference.receipt)
 // Controlled historical HTTP/CSP metadata and a fixed valid TEST nonce.
 // O/H are nonce derivatives: no original security bytes are reconstructed.
 receipt.requestedURL=source.origin.requestedURL;receipt.finalURL=source.origin.finalURL
 receipt.status=source.origin.status
 if(kind==='H'||kind.startsWith('O-')){
  const before=/\bnonce="([^"]+)"/.exec(Buffer.from(reference.bodyBase64,'base64').toString())?.[1]
  const after=/\bnonce="([^"]+)"/.exec(body.toString())?.[1]
  assert.ok(before&&after,'Both controlled native nonce carriers required')
  const controlled='A'.repeat(43)
  body=Buffer.from(body.toString().split(after).join(controlled))
  assert.equal(sha(Buffer.from(body.toString().split(controlled).join(after))),source.origin.persistedSHA256)
  if(receipt.headers['content-security-policy'])receipt.headers['content-security-policy']=receipt.headers['content-security-policy'].split(before).join(controlled)
 }
 receipt.bodyBytes=body.length;receipt.bodySHA256=sha(body)
 if(Object.hasOwn(receipt.headers,'content-length'))receipt.headers['content-length']=String(body.length)
 if(Object.hasOwn(receipt,'headerEntries'))receipt.headerEntries=Object.entries(receipt.headers)
 if(Object.hasOwn(receipt,'responseHeaders'))receipt.responseHeaders=structuredClone(receipt.headers)
 return{body,receipt}
}
function currentInput(){return{shell:delivery('H'),client:{manifest:delivery('M'),entry:delivery('S'),requestBody:Buffer.from(request)}}}
function oldInput(){return{shell:original('H'),client:{manifest:original('M'),entry:original('S'),requestBody:Buffer.from(request)}}}
function limited(result){
 assert.equal(result.requestQualified,true)
 assert.equal(result.request.bodyBytes,1983)
 assert.equal(result.request.bodySHA256,'26301b880ec3355a303c0431fa61fdc78c804d4d3964711771061c44876e51a8')
 for(const key of ['currentTransactionQualified','wholeRendererQualified','UIOrApplicationEquivalent','sourceTimeSemanticsQualified','lifecycleCleanupAllowed'])assert.equal(result[key],false,key)
 assert.equal(result.QServerDefinitionCriteriaQualified,null)
 assert.equal(result.workCountry,null);assert.equal(result.applicantCountry,null)
}
test('exact retained current M/S qualifies the finite current client with explicitly controlled historical H metadata',t=>{
 t.mock.method(globalThis,'fetch',()=>assert.fail('NETWORK FORBIDDEN'))
 const value=currentInput()
 assert.equal(value.client.manifest.body.length,1562)
 assert.equal(sha(value.client.manifest.body),'2eee3f8008d155264c8d905ff0bd4c930998febbbd4bf85cc9b50c22836170d1')
 assert.equal(value.client.entry.body.length,4312980)
 assert.equal(sha(value.client.entry.body),'24fa348879202af242caa8763872c20f2f9edc8f60c197831216e47c437b9382')
 let result
 try{result=readHyperscienceFormClientContract(value)}catch(error){assert.fail('Current retained client held at '+error.gate+': '+error.message)}
 limited(result)
 assert.equal(result.currentQuery.compiledPublicQueryBinding,'Kke')
 assert.equal(result.currentQuery.targetedReferenceCount,127)
 assert.equal(result.currentQuery.completeRequiredASTNodes.length,28)
 assert.equal(result.currentQuery.consumerLimits[0],'render.id goes to ZF.formRenderId')
 assert.equal(result.currentQuery.sourceSHA256,sha(value.client.entry.body))
})
test('unchanged historical profile still qualifies its original hke query without widening scope',t=>{
 t.mock.method(globalThis,'fetch',()=>assert.fail('NETWORK FORBIDDEN'))
 const result=readHyperscienceFormClientContract(oldInput())
 limited(result)
 assert.equal(result.currentQuery.compiledPublicQueryBinding,'hke')
 assert.equal(result.currentQuery.sourceSHA256,'28d6655fbfcdbbf151c3cdf041d75ea08c37a8a6256cd2a62f79ea98eb79e62c')
})

function setPacketBody(row,bytes){
 row.body=Buffer.from(bytes);row.receipt.bodyBytes=row.body.length;row.receipt.bodySHA256=sha(row.body)
 if(Object.hasOwn(row.receipt.headers,'content-length'))row.receipt.headers['content-length']=String(row.body.length)
 if(Object.hasOwn(row.receipt,'headerEntries'))row.receipt.headerEntries=Object.entries(row.receipt.headers)
 if(Object.hasOwn(row.receipt,'responseHeaders'))row.receipt.responseHeaders=structuredClone(row.receipt.headers)
 return row
}
const sourceText=delivery('S').body.toString()
const spans=(()=>{
 const ast=parse(sourceText,{ecmaVersion:'latest',sourceType:'module'})
 return profile.contract.nodes.map(row=>{
  let node=ast
  for(const key of row.address.split('/').slice(1))node=node[key]
  return{label:row.label,start:node.start,end:node.end}
 })
})()
function nodeEdit(label,edit){
 const span=spans.find(row=>row.label===label);assert.ok(span,'Reviewed current target required')
 return text=>{
  const before=text.slice(span.start,span.end),after=edit(before)
  assert.notEqual(after,before,'Actual target mutation required: '+label)
  return text.slice(0,span.start)+after+text.slice(span.end)
 }
}
function changedClient(edit,updateIntegrity=true){
 const value=currentInput(),text=edit(sourceText)
 assert.notEqual(sha(text),sha(sourceText),'Actual source mutation required')
 setPacketBody(value.client.entry,text)
 if(updateIntegrity){
  const manifest=JSON.parse(value.client.manifest.body)
  manifest['index.html'].integrity='sha384-'+createHash('sha384').update(value.client.entry.body).digest('base64')
  setPacketBody(value.client.manifest,JSON.stringify(manifest))
 }
 return value
}
function held(value,gate){
 assert.throws(()=>readHyperscienceFormClientContract(value),error=>error.gate===gate,'Expected controlled hold at '+gate)
}
const bt=String.fromCharCode(96)
const mutations=[
 ['unreviewed appended byte despite manifest integrity',text=>text+'\n/* changed current release */\n'],
 ['alpha-only binding rename',text=>text.replace(/\bih\b/g,'reviewedUUIDAlias')],
 ['compiled full criteria selection',nodeEdit('Kke',text=>text.replace('descriptionHtml','changedDescription'))],
 ['native default POST',nodeEdit('zDe',text=>text.replace('method:'+bt+'POST'+bt,'method:'+bt+'GET'+bt))],
 ['effective public query URI',nodeEdit('_A',text=>text.replace('/api/non-user-graphql?op=','/api/changed-non-user?op='))],
 ['route ID versus slug variables',nodeEdit('CSt',text=>text.replace('{sourcingFormSlug:a}','{sourcingFormId:a}'))],
 ['actual query consumer',nodeEdit('CSt',text=>text.replace('hk(Kke,','hk(iA,'))],
 ['native sourcing form route',nodeEdit('Current sourcing-form route literal assignment',text=>text.replace('/form/','/changed-form/'))],
 ['additional selected-client reference',text=>text+'\nvoid _A;\n']
]
for(const [name,edit]of mutations)test('finite current profile holds '+name+' with controlled matching manifest integrity',t=>{
 t.mock.method(globalThis,'fetch',()=>assert.fail('NETWORK FORBIDDEN'))
 held(changedClient(edit),'source-contract')
})
test('current literal manifest integrity remains independently required',t=>{
 t.mock.method(globalThis,'fetch',()=>assert.fail('NETWORK FORBIDDEN'))
 held(changedClient(text=>text+'\n',false),'source-integrity')
})
test('current profile never accepts changed exact public request bytes',t=>{
 t.mock.method(globalThis,'fetch',()=>assert.fail('NETWORK FORBIDDEN'))
 const value=currentInput();value.client.requestBody[0]^=1
 held(value,'intake')
})
test('registered retained12 prefix reaches only locally blocked exact Q with zero sockets and no closing or inventory promotion',async t=>{
 let sockets=0
 t.mock.method(net.Socket.prototype,'connect',()=>{sockets++;throw Error('SOCKETS FORBIDDEN')})
 t.mock.method(tls,'connect',()=>{sockets++;throw Error('TLS SOCKETS FORBIDDEN')})
 t.mock.method(globalThis,'fetch',()=>{sockets++;throw Error('NETWORK FORBIDDEN')})
 const registered=buildScrapers().find(row=>row.name==='hyperscience')
 assert.ok(registered)
 const stop=Object.assign(Error('Controlled current Q not acquired'),{code:'CONTROLLED_CURRENT_Q_UNACQUIRED'})
 const primary=[],native=[],plan=['C0','C1','A','O-b18ed242','O-0ea8e9f0','O-617d4ed8','H','M','S']
 let delivered=0,error
 const primaryPage=kind=>{
  const row=actual('P-'+kind);primary.push(kind);delivered++
  return{url:row.origin.finalURL,status:row.origin.status,headers:original(kind).receipt.headers,html:Buffer.from(row.bodyBase64,'base64').toString()}
 }
 try{await registered.run({requestIntervalMs:0,
  fetchPage:async url=>{const kind=primary.length===0?'C0':'C1';assert.equal(url,actual('P-'+kind).origin.requestedURL);return primaryPage(kind)},
  fetchJson:async url=>{assert.equal(url,actual('P-A').origin.requestedURL);primary.push('A');delivered++;return JSON.parse(Buffer.from(actual('P-A').bodyBase64,'base64'))},
  fetchImpl:async(url,init)=>{
   const kind=plan[native.length]
   native.push({url,method:init.method})
   if(kind===undefined){
    assert.equal(native.length,10,'Only one unacquired Q may be attempted')
    assert.equal(url,'https://jobs.ashbyhq.com/api/non-user-graphql?op=ApiSourcingForm')
    assert.equal(init.method,'POST');assert.equal(sha(Buffer.from(init.body)),sha(request))
    throw stop
   }
   const row=delivery(kind);assert.equal(url,row.receipt.requestedURL);assert.equal(init.method,'GET')
   delivered++
   const response=new Response(row.body,{status:row.receipt.status,headers:row.receipt.headers})
   Object.defineProperty(response,'url',{value:row.receipt.finalURL});return response
  }
 })}catch(caught){error=caught}
 assert.equal(Boolean(error),true,'Explicit unacquired Q must hold')
 assert.equal(sockets,0);assert.equal(delivered,12)
 assert.equal(primary.join(','),'C0,C1,A');assert.equal(native.length,10)
 assert.equal(native.at(-1).url,'https://jobs.ashbyhq.com/api/non-user-graphql?op=ApiSourcingForm')
 const audit=Object.getOwnPropertyDescriptor(error,'nativeCollectionEvidence')?.value
 assert.equal(Boolean(audit),true,'Acquired prefix audit must survive exact Q hold')
 assert.equal(audit.nativePayload.jobs.length,3);assert.equal(audit.partialOwnPublications.length,3)
 for(const key of ['allChannelsClosed','currentTransactionQualified','currentDeclaredSourceProgramComplete','sourceScopeComplete','lifecycleCleanupAllowed'])assert.equal(audit[key],false,key)
 assert.equal(audit.nativeIndiaCount,null);assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.companyGlobalTotal,null)
})
