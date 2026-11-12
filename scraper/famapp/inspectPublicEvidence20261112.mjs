import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {decodeHTML} from 'entities'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {composeLeverDescription} from '../../scraper-support/utils/leverDescription.js'
import {famNativeExecutionDigest} from './publicScope20261112.js'
const capture=JSON.parse(gunzipSync(fs.readFileSync('scraper/famapp/test-data-20261112/public-contract-originals.json.gz')))
const digest=value=>createHash('sha256').update(value).digest('hex')
if(process.argv[2]==='--write-profiles'){
 const documents=Object.fromEntries(capture.responses.filter(response=>['https://www.famapp.in/','https://www.famapp.in/careers/','https://www.famapp.in/jobs/','https://www.famapp.in/fam-hq/'].includes(response.requestedUrl)).map(response=>{
  const doc=readNativeDocument(response.body),attributes=node=>Object.fromEntries(Object.entries(node.attrs).sort(([a],[b])=>a.localeCompare(b)))
  return[response.requestedUrl,{bodySha256:response.bodySha256,navigationSha256:digest(JSON.stringify(doc.nodes(n=>['a','area','form','object','embed','link'].includes(n.tag)).map(n=>({tag:n.tag,attributes:attributes(n),label:doc.text(n)})))),
   executionSha256:digest(JSON.stringify(doc.nodes(n=>n.tag==='script'&&n.attrs.type!=='application/ld+json').map(n=>({attributes:attributes(n),inlineSha256:digest(n.raw||'')}))))}]
 }))
 const programmes=Object.fromEntries(capture.responses.filter(response=>response.requestedUrl.startsWith('https://www.famapp.in/_next/')&&/javascript/.test(response.contentType)).map(response=>[response.requestedUrl,response.bodySha256]))
 const general=capture.responses.find(response=>response.requestedUrl==='https://jobs.lever.co/fampay/e78e59db-fc28-4643-b389-03e75e19bf39'),doc=readNativeDocument(general.body)
 const schema=doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json').map(n=>JSON.parse(n.raw))
 const generalApplication={schemaSha256:digest(JSON.stringify(schema)),visibleBodySha256:digest(doc.text(doc.nodes(n=>n.tag==='body')[0])),executionSha256:famNativeExecutionDigest(doc),
  navigationSha256:digest(JSON.stringify(doc.nodes(n=>['a','area','form','object','embed','link'].includes(n.tag)).map(n=>({tag:n.tag,attributes:Object.fromEntries(Object.entries(n.attrs).sort(([a],[b])=>a.localeCompare(b))),label:doc.text(n)}))))}
 const board=capture.responses.find(response=>response.requestedUrl==='https://jobs.lever.co/fampay'),nativeBoard={executionSha256:famNativeExecutionDigest(readNativeDocument(board.body))}
 fs.writeFileSync('scraper/famapp/publicScopeProfiles20261112.js','// Profiles derived from the retained genuine public-contract-originals.json.gz responses.\nexport const famPublicProfiles='+JSON.stringify({documents,programmes,generalApplication,nativeBoard},null,2)+'\n')
 console.log(JSON.stringify({documents:Object.keys(documents).length,programmes:Object.keys(programmes).length,generalApplication}))
 process.exit(0)
}
for(const response of capture.responses){
 if(!response.body)continue
 if(digest(response.body)!==response.bodySha256)throw Error('Receipt hash mismatch')
 if(process.argv[2]==='--criteria'){
  if(response.requestedUrl!=='https://api.lever.co/v0/postings/fampay?mode=json')continue
  const text=value=>{const doc=readNativeDocument(value);return decodeHTML(doc.text(doc.nodes(n=>n.tag==='root')[0])).replace(/\s+/g,'')}
  for(const row of JSON.parse(response.body)){
   const composed=composeLeverDescription(row),combined=text(composed)
   const fields=['description','descriptionPlain','opening','openingPlain','descriptionBody','descriptionBodyPlain','additional','additionalPlain'].filter(key=>!combined.includes(text(row[key]))).map(key=>{
    const native=text(row[key]);let first=0;while(first<native.length&&native[first]===combined[first])first++
    return{key,bytes:row[key]?.length,firstDifference:first,nativeContext:native.slice(Math.max(0,first-30),first+100),combinedContext:combined.slice(Math.max(0,first-30),first+100)}
   })
   if(fields.length)console.log(JSON.stringify({id:row.id,title:row.text,composedBytes:composed?.length,fields}))
  }
 }else if(process.argv[2]==='--profiles'){
  if(!/html/.test(response.contentType))continue
  const doc=readNativeDocument(response.body),attributes=node=>Object.fromEntries(Object.entries(node.attrs).sort(([a],[b])=>a.localeCompare(b)))
  console.log(JSON.stringify({url:response.requestedUrl,navigationSha256:digest(JSON.stringify(doc.nodes(n=>['a','area','form','object','embed','link'].includes(n.tag)).map(n=>({tag:n.tag,attributes:attributes(n),label:doc.text(n)})))),
   executionSha256:digest(JSON.stringify(doc.nodes(n=>n.tag==='script'&&n.attrs.type!=='application/ld+json').map(n=>({attributes:attributes(n),inlineSha256:digest(n.raw||'')})))),
   schemas:doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json').map(n=>{const data=JSON.parse(n.raw);return{...data,description:data.description?{bytes:data.description.length,sha256:digest(data.description)}:null}}),
   headings:doc.nodes(n=>/^h[1-6]$/.test(n.tag)).map(n=>({tag:n.tag,attrs:n.attrs,text:doc.text(n)}))}))
 }else if(process.argv[2]==='--controller'){
  if(!/javascript/.test(response.contentType))continue
  const matches=[...response.body.matchAll(/(?:fetch|59764|initFamHq|\.js(?=["'])|LEVER_CONFIG|postingsUrl)/g)].map(m=>response.body.slice(Math.max(0,m.index-180),m.index+400))
  if(matches.length)console.log(JSON.stringify({url:response.requestedUrl,matches:matches.slice(0,25)}))
 }else if(process.argv[2]==='--jobs'){
  if(!['https://www.famapp.in/jobs/','https://www.famapp.in/fam-hq/','https://jobs.lever.co/fampay/e78e59db-fc28-4643-b389-03e75e19bf39'].includes(response.requestedUrl))continue
  const doc=readNativeDocument(response.body)
  console.log(JSON.stringify({url:response.requestedUrl,title:doc.nodes(n=>n.tag==='title').map(n=>n.raw),text:doc.nodes(n=>n.tag==='body').map(n=>doc.text(n).slice(0,1500)),navigation:doc.nodes(n=>['a','iframe','form','object'].includes(n.tag)).map(n=>({tag:n.tag,attrs:n.attrs,text:doc.text(n)})),scripts:doc.nodes(n=>n.tag==='script').map(n=>({attrs:n.attrs,raw:n.raw?.slice(0,300)}))}))
 }else if(process.argv[2]==='--board'){
  if(response.requestedUrl!=='https://jobs.lever.co/fampay')continue
  const doc=readNativeDocument(response.body)
  console.log(JSON.stringify({url:response.requestedUrl,navigation:doc.nodes(n=>['a','form'].includes(n.tag)).map(n=>({tag:n.tag,attrs:n.attrs,label:doc.text(n)})),
   notableNodes:doc.nodes(n=>n.attrs.class?.includes('posting')||n.attrs.id).map(n=>({tag:n.tag,attrs:n.attrs,text:doc.text(n).slice(0,150)})),
   inline:doc.nodes(n=>n.tag==='script'&&!n.attrs.src).map(n=>({attrs:n.attrs,bytes:n.raw?.length,raw:n.raw?.length<5000?n.raw:n.raw?.slice(0,1000)}))}))
 }else if(process.argv[2]==='--programmes'){
  if(!/javascript/.test(response.contentType))continue
  console.log(JSON.stringify({url:response.requestedUrl,bytes:response.bodyBytes,sha256:response.bodySha256,
   matches:[...response.body.matchAll(/(?:https?:[^\s"'<>]{5,200}|.{0,80}(?:recruit|lever|greenhouse|careers|postings|\/api\/apply).{0,180})/gi)].map(m=>m[0]).slice(0,100)}))
 }else if(/json/.test(response.contentType)){
  const rows=JSON.parse(response.body)
  console.log(JSON.stringify({url:response.requestedUrl,count:rows.length,roles:rows.map(row=>({id:row.id,title:row.text,country:row.country,location:row.categories?.location,allLocations:row.categories?.allLocations,workplace:row.workplaceType,createdAt:row.createdAt,keys:Object.keys(row)}))}))
 }else if(/html/.test(response.contentType)){
  const doc=readNativeDocument(response.body)
  console.log(JSON.stringify({url:response.requestedUrl,title:doc.nodes(n=>n.tag==='title').map(n=>n.raw),
   navigation:doc.nodes(n=>['a','area','form','object','embed','link'].includes(n.tag)).map(n=>({tag:n.tag,attrs:n.attrs,label:doc.text(n).slice(0,250)})),
   scriptDeclarations:doc.nodes(n=>n.tag==='script').map(n=>({attrs:n.attrs,rawSha256:digest(n.raw||''),bytes:n.raw?.length,sample:n.raw?.slice(0,200)})),
   frames:doc.nodes(n=>n.children.some(c=>typeof c!=='string'&&c.activeFrame)).map(n=>n.children.filter(c=>typeof c!=='string'&&c.activeFrame).map(c=>c.attrs))}))
 }else{
  console.log(JSON.stringify({url:response.requestedUrl,matchedContracts:[...response.body.matchAll(/(?:leverSite|postingsUrl|applyEndpoint|generalPostingId|fetch\(|hostedUrl|skip|limit|allLocations|posting\.id|jobs\.lever\.co|api\.lever\.co)/g)].map(match=>response.body.slice(Math.max(0,match.index-150),match.index+250))}))
 }
}
