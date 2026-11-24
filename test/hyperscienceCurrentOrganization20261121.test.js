import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readNativePacket} from '../scraper/hyperscience/currentProgrammeRenderer.js'
import {readCurrentHyperscienceProgramme} from '../scraper/hyperscience/currentProgramme.js'

const sha=value=>createHash('sha256').update(value).digest('hex')
const load=name=>JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/'+name,import.meta.url))))
const current=load('hyperscience-current-own-prefix-20261121.json.gz')
const historical=load('hyperscience-server-programme-components-20261111.json.gz')
const actual=kind=>current.responses.find(row=>row.kind===kind)
const old=kind=>historical.responses.find(row=>row.kind===kind)
const priorPrefix=load('hyperscience-current-prefix-20261120.json.gz')
function packet(source){
 const body=Buffer.from(source.bodyBase64,'base64'),receipt=structuredClone(source.receipt),at=new Date().toISOString()
 assert.equal(sha(body),receipt.bodySHA256)
 if(current.responses.includes(source)){
  // Saved security headers are privacy derivatives, so this is a controlled
  // policy delivery of current bodies, never an exact original HTTP replay.
  if(source.kind==='O1'){
   const reference=old('O-b18ed242'),oldBody=Buffer.from(reference.bodyBase64,'base64').toString()
   const before=/<script nonce="([^"]+)"/.exec(oldBody)[1],after=/<script nonce="([^"]+)"/.exec(body.toString())[1]
   receipt.headers=structuredClone(reference.receipt.headers)
   receipt.headers['content-security-policy']=receipt.headers['content-security-policy'].replace(before,after)
  }else receipt.headers=structuredClone(priorPrefix.responses.find(row=>row.kind===source.kind).receipt.headers)
 }
 Object.assign(receipt,{headerEntries:Object.entries(receipt.headers),requestedAt:at,responseAt:at,completedAt:at,
  bodyComplete:true,streamDone:true,decodedPrefixOnly:false,error:null,consumedBodyBytes:body.length,discardedOverflowBytes:0,overflowBytes:0,
  evidenceKind:'controlled-delivery; current O1 nonce-derived; no physical closing established'})
 return{body,receipt}
}
function replaceBody(row,text){
 row.body=Buffer.from(text);Object.assign(row.receipt,{bodyBytes:row.body.length,bodySHA256:sha(row.body),consumedBodyBytes:row.body.length})
 if(Object.hasOwn(row.receipt.headers,'content-length'))row.receipt.headers['content-length']=String(row.body.length)
 row.receipt.headerEntries=Object.entries(row.receipt.headers);return row
}
function boot(row,change){
 const html=row.body.toString(),match=/window\.__appData\s*=\s*/.exec(html);assert.ok(match)
 const start=match.index+match[0].length
 let end,depth=0,quoted=false,escaped=false
 for(let i=start;i<html.length;i++){
  const c=html[i]
  if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue}
  if(c==='"')quoted=true;else if(c==='{'||c==='[')depth++;else if((c==='}'||c===']')&&!--depth){end=i+1;break}
 }
 assert.ok(end);const model=JSON.parse(html.slice(start,end))
 if(change){change(model);return replaceBody(row,html.slice(0,start)+JSON.stringify(model)+html.slice(end))}
 return model
}
const currentOrg=boot(packet(actual('O1'))).organization
const oldOrg=boot(packet(old('O-b18ed242'))).organization
const currentOrgHash='6ceaebf8d27f26f4df046d04947c334f38a2e9928ba2cde3e368dcafa817b4cc'
const beforeOrgHash='8e49702fcf1c3446fbed4c0f60142bb1ee117fe492c5160222653dd85f055d3e'
function held(operation,gate){assert.throws(operation,error=>error.gate===gate)}

test('current O1 privacy derivative retains exact original public organization and posting, with only three reviewed flag changes',()=>{
 assert.equal(actual('O1').bodyOriginalUnmodified,false)
 assert.notEqual(actual('O1').originalBodySHA256,actual('O1').persistedBodySHA256)
 assert.equal(sha(JSON.stringify(currentOrg)),currentOrgHash)
 assert.equal(sha(JSON.stringify(oldOrg)),beforeOrgHash)
 const restored={...currentOrg,activeFeatureFlags:oldOrg.activeFeatureFlags}
 assert.equal(sha(JSON.stringify(restored)),beforeOrgHash)
 assert.deepEqual(currentOrg.activeFeatureFlags.filter(x=>!oldOrg.activeFeatureFlags.includes(x)),['AiInterviewer'])
 assert.deepEqual(oldOrg.activeFeatureFlags.filter(x=>!currentOrg.activeFeatureFlags.includes(x)),['CoreMultipleBrandsFeedFiltering','CoreMultipleBrandsLinkedInJobWrappingStreamingFix'])
 assert.equal(sha(JSON.stringify(boot(packet(actual('O1'))).posting)),sha(JSON.stringify(boot(packet(old('O-b18ed242'))).posting)))
 const parsed=readNativePacket(packet(actual('O1')))
 assert.equal(sha(JSON.stringify(parsed.originalAppData.organization)),currentOrgHash)
 assert.equal(sha(parsed.rawAppData),sha(JSON.stringify(boot(packet(actual('O1'))))))
 assert.equal(parsed.packet.original.bodySHA256,actual('O1').persistedBodySHA256)
 assert.equal(parsed.declaration.version,'e2ba418d6abc94bca6896d6cf9cbc036187124d1')
})

async function currentPrefix(t,mutate=row=>row){
 t.mock.method(globalThis,'fetch',()=>assert.fail('NETWORK FORBIDDEN'))
 const calls=[],stop=Object.assign(Error('Only current first own opening was captured'),{code:'CURRENT_SECOND_OWN_NOT_ACQUIRED'})
 let error
 try{await readCurrentHyperscienceProgramme({readPage:async(url)=>{
  calls.push(url);const source=current.responses.find(row=>row.receipt.requestedURL===url)
  if(source)return mutate(packet(source),source.kind)
  assert.equal(url,JSON.parse(Buffer.from(actual('A').bodyBase64,'base64')).jobs[1].jobUrl)
  throw stop
 }})}catch(caught){error=caught}
 return{calls,error,stop}
}
test('controlled metadata delivery of four current native bodies qualifies O1 before explicit uncaptured O2, without claiming intake/closing/company zero',async t=>{
 const {calls,error,stop}=await currentPrefix(t)
 assert.equal(error===stop,true,'Expected explicit uncaptured O2, got '+String(error?.gate));assert.equal(calls.length,5)
 const audit=error.nativeCollectionEvidence
 assert.equal(audit.partialOwnPublications.length,1)
 assert.equal(sha(JSON.stringify(audit.partialOwnPublications[0].originalAppData.organization)),currentOrgHash)
 assert.equal(audit.partialOwnPublications[0].closingReconciled,false)
 assert.equal(audit.nativePayload.jobs.length,3)
 for(const key of ['allChannelsClosed','currentTransactionQualified','currentDeclaredSourceProgramComplete','sourceScopeComplete','lifecycleCleanupAllowed'])assert.equal(audit[key],false,key)
 assert.equal(audit.nativeIndiaCount,null);assert.equal(audit.companyIndiaTotal,null)
})

for(const key of Object.keys(currentOrg).filter(key=>key!=='activeFeatureFlags'))test('current exact flag transition does not omit full organization field '+key,()=>{
 const row=boot(packet(actual('O1')),model=>{model.organization[key]=model.organization[key]===null?'new unreviewed value':null})
 held(()=>readNativePacket(row),'native-organization')
})
for(const key of Object.keys(currentOrg.theme))test('current exact flag transition retains theme field '+key,()=>{
 const row=boot(packet(actual('O1')),model=>{model.organization.theme[key]=model.organization.theme[key]===null?'new unreviewed value':null})
 held(()=>readNativePacket(row),'native-organization')
})
const flagChanges={
 additional:flags=>flags.push('UnreviewedFlag'),
 missing:flags=>flags.splice(10,1),
 duplicate:flags=>flags.push('AiInterviewer'),
 reordered:flags=>flags.reverse(),
 missingAi:flags=>flags.shift(),
 oldOne:flags=>flags.splice(7,0,'CoreMultipleBrandsFeedFiltering'),
 oldOther:flags=>flags.splice(7,0,'CoreMultipleBrandsLinkedInJobWrappingStreamingFix'),
 partialTransition:flags=>flags.splice(7,0,'CoreMultipleBrandsFeedFiltering','CoreMultipleBrandsLinkedInJobWrappingStreamingFix')
}
for(const [name,change]of Object.entries(flagChanges))test('only exact observed flag transition is admitted: '+name,()=>{
 held(()=>readNativePacket(boot(packet(actual('O1')),model=>change(model.organization.activeFeatureFlags))),'native-organization')
})
test('native complete criteria disagreement remains held under the current organization transition',async t=>{
 const {calls,error}=await currentPrefix(t,(row,kind)=>kind==='O1'?boot(row,model=>{model.posting.descriptionHtml+='<p>New mandatory requirement.</p>'}):row)
 assert.equal(calls.length,4);assert.equal(error.gate,'criteria');assert.equal(error.nativeCollectionEvidence.allChannelsClosed,false)
})
test('native JobPosting employer disagreement remains held under the current organization transition',async t=>{
 const {calls,error}=await currentPrefix(t,(row,kind)=>kind==='O1'?replaceBody(row,row.body.toString().replace('"name":"Hyperscience","sameAs"','"name":"Other employer","sameAs"')):row)
 assert.equal(calls.length,4);assert.equal(error.gate,'own-schema');assert.equal(error.nativeCollectionEvidence.allChannelsClosed,false)
})

// These controlled closings use historical complete components, not missing current entities.
async function controlledHistorical(t,{changeClosing=false}={}){
 t.mock.method(globalThis,'fetch',()=>assert.fail('NETWORK FORBIDDEN'))
 const byURL=new Map(historical.responses.filter(row=>!row.kind.startsWith('Q')).map(row=>[row.receipt.requestedURL,row]))
 const urls=['C0','C1','A','O-b18ed242','H','M','S'].map(kind=>old(kind).receipt.requestedURL)
 const [C0,C1,A,O,H,M,S]=urls,Q=old('Q-first').receipt.requestedURL
 const api=JSON.parse(Buffer.from(old('A').bodyBase64,'base64'));const removed=api.jobs.slice(1);api.jobs=api.jobs.slice(0,1)
 const plan=[...[C0,C1,A,O,H,M,S,Q].map(url=>({url,closing:false})),...[O,Q,S,M,H,A,C1,C0].map(url=>({url,closing:true}))]
 let count=0,error,result
 try{result=await readCurrentHyperscienceProgramme({readPage:async(url)=>{
  const step=plan[count++];assert.equal(url,step.url)
  const source=url===Q?old(step.closing?'Q-repeat':'Q-first'):byURL.get(url)
  let row=packet(source)
  if(url===A)row=replaceBody(row,JSON.stringify(api))
  if(url===C1){let text=row.body.toString();for(const job of removed)text=text.replace(new RegExp('<a href="https://jobs\\.ashbyhq\\.com/hyperscience/'+job.id+'"[\\s\\S]*?</a>'),'');row=replaceBody(row,text)}
  if(url===O||url===H)row=boot(row,model=>{model.organization.activeFeatureFlags=(changeClosing&&!step.closing&&url===O?oldOrg:currentOrg).activeFeatureFlags})
  return row
 }})}catch(caught){error=caught}
 return{count,error,result}
}
test('reviewed flags flow unchanged through all16 controlled historical native/intake/closing reads',async t=>{
 const {count,error,result}=await controlledHistorical(t)
 assert.equal(error===undefined,true,'Unexpected controlled hold '+String(error?.gate));assert.equal(count,16)
 const audit=result.nativeCollectionEvidence
 assert.equal(audit.allChannelsClosed,true);assert.equal(audit.currentTransactionQualified,true)
 assert.equal(audit.lifecycleCleanupAllowed,false);assert.equal(audit.sourceScopeComplete,false)
 assert.equal(audit.nativeRecords.length,1)
 assert.equal(sha(JSON.stringify(audit.nativeRecords[0].originalNativeModel.organization)),currentOrgHash)
})
test('historical-to-current reviewed organization change still fails full same-bound closing reconciliation',async t=>{
 const {count,error}=await controlledHistorical(t,{changeClosing:true})
 assert.equal(count,9);assert.equal(error.gate,'closing')
 assert.equal(error.nativeCollectionEvidence.allChannelsClosed,false)
 assert.equal(error.nativeCollectionEvidence.currentTransactionQualified,false)
 assert.equal(error.nativeCollectionEvidence.partialOwnPublications[0].closingReconciled,false)
})
