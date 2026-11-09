import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {readNativeDocument} from '../../utils/activeNativeHtml.js'
export const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/actual-http-20261031.json.gz',import.meta.url))))
const entities=new Map(fixture.entities.map(row=>[row.receipt.url,row]))
export const replay=(mutate=(url,page)=>page,syntheticResponses=new Map())=>{
 const audits=[],records=[],requests=[],visits=new Map()
 const fetchPage=async url=>{
  requests.push(url);const entity=entities.get(url),synthetic=syntheticResponses.get(url);assert.ok(entity||synthetic,'No unretained network/application/alias GET: '+url)
  const visit=(visits.get(url)||0)+1;visits.set(url,visit)
  if(synthetic)return mutate(url,structuredClone(synthetic),visit)
  const body=Buffer.from(entity.bodyBase64,'base64').toString('utf8')
  return mutate(url,{url,finalUrl:url,status:entity.receipt.status,headers:entity.receipt.headers,bodyBase64:entity.bodyBase64,html:body,text:body},visit)
 }
 const fetchText=async url=>Buffer.from((await fetchPage(url)).bodyBase64,'base64').toString('utf8')
 const fetchJson=async url=>JSON.parse(await fetchText(url))
 const fetchImpl=async(url,init={})=>{
  assert.equal(init.method||'GET','GET');assert.equal(init.body,undefined)
  const page=await fetchPage(String(url)),bytes=Buffer.from(page.bodyBase64,'base64')
  const response=new Response(bytes.length?bytes:null,{status:page.status,headers:page.headers})
  Object.defineProperty(response,'url',{value:page.url});return response
 }
 return {audits,records,requests,options:{fetchPage,fetchText,fetchJson,fetchImpl,
  onAudit:async a=>audits.push(a),onRecords:async r=>records.push(r),now:()=> '2026-10-31T21:51:00.000Z'}}
}

// Deliberate mutations and explicit extra responses below are synthetic boundary
// controls. They are never original HTTP entities or current capture evidence.
export const editJSON=(page,change)=>{
 const value=JSON.parse(Buffer.from(page.bodyBase64,'base64'));change(value)
 const text=JSON.stringify(value);return {...page,bodyBase64:Buffer.from(text).toString('base64'),html:text,text}
}
export const editHTML=(page,change)=>{
 const text=change(Buffer.from(page.bodyBase64,'base64').toString('utf8'))
 return {...page,bodyBase64:Buffer.from(text).toString('base64'),html:text,text}
}
export const mutateNativePost=(source,id,change,changeSchema=()=>{})=>(url,page)=>{
 const post=fixture.oracle[source].records.find(row=>row.id===id),own=post.originalNative.hostedUrl
 if(url===own)return editHTML(page,html=>{
  const doc=readNativeDocument(html),script=doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json').find(n=>JSON.parse(n.raw)['@type']==='JobPosting')
  assert.ok(script);const schema=JSON.parse(script.raw);changeSchema(schema)
  return html.replace(script.raw,JSON.stringify(schema).replaceAll('</script','<\\/script'))
 })
 if(new URL(url).hostname!=='api.lever.co')return page
 return editJSON(page,model=>{
  const inspect=row=>{if(row?.id===id)change(row)}
  if(Array.isArray(model))for(const row of model){if(Array.isArray(row?.postings))row.postings.forEach(inspect);else inspect(row)}
  else inspect(model)
 })
}
