import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {parse} from 'acorn'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {run} from './script.js'

const legacy=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-20261117.json.gz',import.meta.url))))
const read=name=>gunzipSync(readFileSync(new URL('./test-data/current-'+name+'-20261118.gz',import.meta.url))).toString()
const currentDetail=gunzipSync(readFileSync(new URL('./test-data/current-detail-marketing-20261119.gz',import.meta.url))).toString()
const board='https://genworx.zohorecruit.com/jobs/Careers'
const marketing='/jobs/Careers/802719000002492042/'
const client='https://static.zohocdn.com/recruit/javascript/career-website-common.5d760a87446385b0a4896c0b55098b2c.js'
// This component replay combines the original Nov19 detail with already retained
// genuine Nov18 board/form originals. A separate live default verifies the full
// current source; these fixtures never invent a role or an application response.
const replay=(mutate=(url,body)=>body)=>{
 const counts=new Map()
 return {requestIntervalMs:0,fetchImpl:async(url,init)=>{
  url=String(url);assert.equal(init.method,'GET');assert.equal(init.redirect,'manual')
  let packet=legacy.responses.find(packet=>packet.requestedURL===url),body
  if(url===client){packet=legacy.responses.find(packet=>packet.requestedURL.includes('/career-website-common.'));body=read('client')}
  else{assert.ok(packet,'Only captured native publication or declared application '+url);body=Buffer.from(packet.bodyBase64,'base64').toString()}
  if(url===board)body=read('board')
  if(url.includes(marketing))body=currentDetail
  if(url.includes('/jobs/Careers/802719000000585025/'))body=read('detail-software')
  const count=(counts.get(url)??0)+1;counts.set(url,count)
  return Object.defineProperty(new Response(mutate(url,body,count),{status:packet.status,headers:packet.headers}),'url',{value:url})
 }}
}
const encode=value=>value.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
const literalValue=node=>node.type==='Literal'?node.value:node.type==='ArrayExpression'?node.elements.map(literalValue):Object.fromEntries(node.properties.map(property=>[property.key.name??property.key.value,literalValue(property.value)]))
function editBoardCountry(html,country){return html.replace(/<input\b[^>]*>/gi,tag=>{
 if(!/\bid=["']jobs["']/.test(tag))return tag
 const node=readNativeDocument(tag).nodes(node=>node.tag==='input')[0],rows=JSON.parse(node.attrs.value)
 rows.find(row=>row.id==='802719000002492042').Country=country
 return tag.replace(/\bvalue=(["'])([\s\S]*?)\1/,(_m,quote)=>'value='+quote+encode(JSON.stringify(rows))+quote)
})}
function editDetailModel(html,name,edit){return html.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi,(_all,open,source,close)=>{
 if(!source.includes('var jobs ='))return open+source+close
 const ast=parse(source,{ecmaVersion:'latest'}),declaration=ast.body.flatMap(node=>node.type==='VariableDeclaration'?node.declarations:[]).find(node=>node.id?.name===name)
 const value=declaration.init.type==='CallExpression'?JSON.parse(declaration.init.arguments[0].value):literalValue(declaration.init)
 edit(value)
 const literal=declaration.init.type==='CallExpression'?'JSON.parse('+JSON.stringify(JSON.stringify(value))+')':JSON.stringify(value)
 return open+source.slice(0,declaration.init.start)+literal+source.slice(declaration.init.end)+close
})}

test('GENWORX original current phone default IN preserves independently qualified native India criteria and forms',async()=>{
 assert.ok(currentDetail.includes("var country = 'IN';"))
 const jobs=await run(replay())
 assert.equal(jobs.length,1);assert.equal(jobs[0].jobId,'802719000002492042');assert.equal(jobs[0].country,'India')
 assert.match(jobs[0].jobDescription,/Five to eight years in B2B marketing/)
 assert.equal(jobs[0].nativeApplicationModel.webforms[0].sections.length,8)
 assert.equal(jobs.nativeCollectionEvidence.closingFullNativeInventoryMatch,true)
 assert.equal(jobs.nativeCollectionEvidence.observedListingCount,2)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

for(const country of [null,'United States'])test('GENWORX phone default IN cannot supply native workplace country '+country,async()=>{
 const jobs=await run(replay((url,body)=>url===board?editBoardCountry(body,country):url.includes(marketing)?editDetailModel(body,'jobs',rows=>{rows[0].Country=country}):body))
 assert.equal(jobs.length,0)
 assert.equal(jobs.nativeCollectionEvidence.observedListingCount,2)
 assert.ok(jobs.nativeCollectionEvidence.failures.some(row=>row.id==='802719000002492042'&&row.reason===(country?'native-explicit-foreign-country':'native-country-unknown')))
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

test('GENWORX current phone variant still rejects contradictory native employer',async()=>{
 await assert.rejects(()=>run(replay((url,body)=>url.includes(marketing)?editDetailModel(body,'meta',meta=>{meta.org_info.company_name='Another employer'}):body)),/native legal employer/)
})

test('GENWORX phone variant is confined to the exact captured top-level dialing default',async()=>{
 for(const edit of [body=>body.replace("var country = 'IN';","var country = 'ZZ';"),
  body=>body.replace("var country = 'IN';","var otherCountry = 'IN';"),
  body=>body.replace("var country = 'IN';","var country = 'IN';window.extra=true;")]){
  const changed=edit(currentDetail);assert.notEqual(changed,currentDetail)
  await assert.rejects(()=>run(replay((url,body)=>url.includes(marketing)?edit(body):body)),/program profile changed/)
 }
})

test('GENWORX phone variant still rejects closing application question drift',async()=>{
 await assert.rejects(()=>run(replay((url,body,count)=>{
  if(!url.includes('/802719000002492042/apply/')||count!==2)return body
  const value=JSON.parse(body);value.webforms[0].sections[0].fields[0].required=!value.webforms[0].sections[0].fields[0].required
  return JSON.stringify(value)
 })),/whole closing native/)
})
