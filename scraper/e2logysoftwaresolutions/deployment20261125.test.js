import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {parse} from 'acorn'
import {run} from './script.js'
import {extractCurrentListings,extractCurrentDetail} from './currentNative.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/deployment-20261125.json.gz',import.meta.url))))
const text=packet=>Buffer.from(packet.bodyBase64,'base64').toString('utf8')
const listings=extractCurrentListings(text(fixture.packets[0])),native=text(fixture.packets[1])
const replay=(change=()=>{})=>{
 let reads=0
 return{get reads(){return reads},promise:run({now:()=>fixture.capturedAt,fetchImpl:async(url,init)=>{
  const original=fixture.packets[reads++];assert.ok(original,'Only actual current declared public requests')
  assert.equal(url,original.url);assert.equal(init.method,'GET')
  const packet={...original,text:text(original)};change(packet,reads)
  return Object.defineProperties(new Response(packet.text,{status:packet.status,headers:packet.headers}),{url:{value:packet.finalURL},redirected:{value:false}})
 }})}
}
function editData(html,binding,change){
 const d=readNativeDocument(html),carrier=d.nodes(node=>node.tag==='script'&&!node.attrs.src).at(-1)
 const ast=parse(carrier.raw,{ecmaVersion:'latest'}),node=binding==='jobs'?ast.body[3].declarations[0].init.arguments[0]:ast.body[8].declarations[0].init
 const literal=value=>{
  if(value.type==='Literal')return value.value
  if(value.type==='ArrayExpression')return value.elements.map(literal)
  assert.equal(value.type,'ObjectExpression')
  return Object.fromEntries(value.properties.map(property=>[property.key.name??property.key.value,literal(property.value)]))
 }
 const value=binding==='jobs'?JSON.parse(node.value):literal(node)
 change(value)
 const replacement=binding==='jobs'?JSON.stringify(JSON.stringify(value)):JSON.stringify(value)
 return html.replace(carrier.raw,carrier.raw.slice(0,node.start)+replacement+carrier.raw.slice(node.end))
}

test('E2logy current deployment fixture retains all six exact complete native response hashes',()=>{
 assert.equal(fixture.packets.length,6)
 for(const packet of fixture.packets){const bytes=Buffer.from(packet.bodyBase64,'base64');assert.equal(bytes.length,packet.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),packet.bodySHA256);assert.equal(packet.status,200)}
})

test('E2logy current Nov24 vendor deployment recovers both complete India role records through closing',async()=>{
 const io=replay(),jobs=await io.promise
 assert.deepEqual(jobs.map(job=>job.jobId),['424443000011711102','424443000011711171'])
 assert.ok(jobs.every(job=>job.country==='India'&&job.sourceDetailComplete===true&&job.sourceScopeComplete===false&&job.lifecycleCleanupAllowed===false))
 assert.equal(jobs.nativeCollectionEvidence.nativeOpeningClosingCriteriaMatch,true)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(io.reads,6)
})

for(const [name,change]of [
 ['mixed historical declaration',html=>html.replace('career-website-common.9fd02c455a4e51be503952e51dbd6dea.js','career-website-common.5d760a87446385b0a4896c0b55098b2c.js')],
 ['unreviewed CDN map',html=>html.replace('fingerPrintJSONForCDNPath = {','fingerPrintJSONForCDNPath = {"unreviewed.js":"unreviewed.js",')],
 ['additional authority program',html=>html.replace('</head>','<script>window.unreviewedCriteria=true</script></head>')],
])test('E2logy current deployment refuses '+name,()=>{
 const changed=change(native);assert.notEqual(changed,native)
 assert.throws(()=>extractCurrentDetail(changed,listings[0]),/program|declaration|authority|fragment|charset/)
})

test('E2logy current native country cannot borrow the India corporate location',()=>{
 const changed=editData(native,'jobs',rows=>{rows[0].Country='Canada'})
 assert.throws(()=>extractCurrentDetail(changed,listings[0]),/metadata|country/)
})

test('E2logy current full native employer cannot be replaced under a reviewed deployment',()=>{
 const changed=editData(native,'meta',meta=>{meta.org_info.company_name='Other Employer'})
 assert.throws(()=>extractCurrentDetail(changed,listings[0]),/employer/)
})

test('E2logy current full authored criteria retain contradictory country rejection',()=>{
 const changed=editData(native,'jobs',rows=>{rows[0].Job_Description+='<p>Work Country: Canada.</p>'})
 assert.throws(()=>extractCurrentDetail(changed,listings[0]),/country/)
})

test('E2logy current deployment cannot hide a changed full closing criterion',async()=>{
 await assert.rejects(replay((packet,read)=>{if(read===4)packet.text=editData(packet.text,'jobs',rows=>{rows[0].Job_Description+='<p>Additional mandatory native experience requirement.</p>'})}).promise,/Closing native role criteria/)
})

test('E2logy current deployment retains the complete carrier AST outside independently qualified literal data',()=>{
 const carrier=readNativeDocument(native).nodes(node=>node.tag==='script'&&!node.attrs.src).at(-1)
 const changed=native.replace(carrier.raw,carrier.raw+';jobs.length=0;')
 assert.throws(()=>extractCurrentDetail(changed,listings[0]),/carrier.*authority.*structure/)
})
