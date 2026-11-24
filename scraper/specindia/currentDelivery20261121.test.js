import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run} from './script.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-data-20261121.json.gz',import.meta.url))))
const sha=value=>createHash('sha256').update(value).digest('hex')
const freshPacket=fixture.additionalOriginalPackets.find(row=>row.bodySHA256==='13ee97210d2f94fd9657ad4c7ff07272c4e5243c2620d6a27af963189f81e905')
assert(freshPacket)
const freshCareer=Buffer.from(freshPacket.bodyBase64,'base64').toString('utf8')
assert.equal(sha(freshCareer),freshPacket.bodySHA256)
function bodyNodes(html){
 const body=readNativeDocument(html,{sourceRanges:true}).nodes(node=>node.tag==='body')
 assert.equal(body.length,1)
 return body[0].children.filter(node=>typeof node!=='string')
}
function anotherValidBoardDelivery(html){
 const nodes=bodyNodes(html),header=nodes.find(node=>node.tag==='div'&&node.attrs.id==='S:1')
 const calls=nodes.filter(node=>node.tag==='script'&&/\$RC\("B:[0-3]","S:[0-3]"\)$/.test(node.raw??''))
 assert.equal(calls.length,4)
 const headerCall=calls.find(node=>node.raw==='$RC("B:1","S:1")')
 assert(headerCall);assert.equal(header.sourceEnd,headerCall.sourceStart)
 const pair=html.slice(header.sourceStart,headerCall.sourceEnd),first=html.slice(calls[0].sourceStart,calls[0].sourceEnd)
 assert.equal(html.split(pair).length,2);assert.equal(html.split(first).length,2)
 const result=html.replace(pair,'').replace(first,first+pair)
 assert.notEqual(result,html);return result
}
async function replay(change){
 const calls=[],seen=new Map()
 const fetchResponse=async(url,init)=>{
  assert.equal(init.method,'GET');assert.equal(init.body,null)
  const original=fixture.packets.find(row=>row.requestedURL===url);assert(original)
  const occurrence=(seen.get(url)??0)+1;seen.set(url,occurrence);calls.push({url,occurrence})
  const html=change(Buffer.from(original.bodyBase64,'base64').toString('utf8'),url,occurrence),bytes=Buffer.from(html),at=new Date().toISOString()
  return {...original,html,bytes,bodyBase64:bytes.toString('base64'),bodySHA256:sha(bytes),method:'GET',body:null,startedAt:at,completedAt:at}
 }
 let jobs,error
 try{jobs=await run({fetchResponse})}catch(value){error=value}
 return {jobs,error,calls}
}
function exactDataOnly(result){
 assert.ifError(result.error);assert.equal(result.calls.length,7);assert.equal(result.jobs.length,3)
 assert.deepEqual(result.jobs.map(row=>row.nativeSourceRecord.role),fixture.props.jobs)
 for(const row of result.jobs){
  assert.deepEqual(row.nativeSourceRecord,row.nativeClosingRecord);assert.equal(row.country,'India');assert.equal(row.sourceDetailComplete,true)
  assert.equal(row.postingDate,null);assert.equal(row.applyUrl,null);assert.equal(row.sourceRenderedDetailComplete,false);assert.equal(row.sourceClientQualified,false);assert.equal(row.sourceCSSQualified,false);assert.equal(row.sourceListingComplete,false);assert.equal(row.lifecycleCleanupAllowed,false)
 }
}

test('current SPEC third genuine career delivery preserves complete native DATA',async()=>{
 exactDataOnly(await replay((html,url)=>url===freshPacket.requestedURL?freshCareer:html))
})
test('current SPEC complete exact header and reveal pair may follow the first initialized reveal',async()=>{
 exactDataOnly(await replay((html,url)=>url===fixture.boardURL?anotherValidBoardDelivery(html):html))
})
test('current SPEC distinct valid opening and closing deliveries preserve original criteria and raw receipts',async()=>{
 const r=await replay((html,url,n)=>url===freshPacket.requestedURL&&n===2?freshCareer:url===fixture.boardURL&&n===1?anotherValidBoardDelivery(html):html)
 exactDataOnly(r);assert(r.jobs.every(row=>row.sourceRawNativeRoleSHA256!==row.sourceRawClosingNativeRoleSHA256))
})

for(const[name,change]of[
 ['header attributes',html=>html.replace('<div hidden id="S:1">','<div hidden data-other="1" id="S:1">')],
 ['header publisher identity',html=>html.replace('SPEC India, 40th Year Anniversary','Other firm, 40th Year Anniversary')],
 ['reveal initializer executable',html=>html.replace('$RT=performance.now()','$RT=Date.now()')],
 ['reveal target identity',html=>html.replace('$RC("B:1","S:1")','$RC("B:1","S:9")')],
 ['duplicate reveal call',html=>html.replace('</body>','<script>$RC("B:1","S:1")</script></body>')],
 ['unreviewed body programme',html=>html.replace('</body>','<script>globalThis.unreviewedHiringPolicy=true</script></body>')],
 ['additional authored criterion',html=>html.replace('Spring Boot','Mandatory changed licence with Spring Boot')],
 ['changed own work country',html=>html.replaceAll('Ahmedabad, India','Toronto, Canada')],
 ['initializer after another reveal',html=>{
  const calls=bodyNodes(html).filter(node=>node.tag==='script'&&/\$RC\("B:[0-3]","S:[0-3]"\)$/.test(node.raw??''))
  const first=calls[0],last=calls.at(-1),prefix=first.raw.slice(0,first.raw.lastIndexOf('$RC('))
  assert(prefix);const a=html.slice(first.sourceStart,first.sourceEnd),b=html.slice(last.sourceStart,last.sourceEnd)
  return html.replace(a,'<script>'+first.raw.slice(prefix.length)+'</script>').replace(b,'<script>'+prefix+last.raw+'</script>')
 }],
])test('current SPEC delivery projection holds '+name,async()=>{
 let changed=false
 const r=await replay((html,url)=>{
  if(url!==fixture.boardURL)return html
  const moved=anotherValidBoardDelivery(html),next=change(moved);changed||=next!==moved;return next
 })
 assert(changed);assert(r.error);assert.equal(r.jobs,undefined)
})
