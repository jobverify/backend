import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {parse} from 'acorn'
import {readJasperCorporate,readJasperBoard,readJasperApi,readJasperOwn,reconcileJasperServerProgramme} from './currentProgrammeData.js'
import {readCurrentJasperProgramme} from './currentProgramme.js'
globalThis.fetch=()=>assert.fail('Authored criteria tests forbid publisher HTTP')
const load=name=>JSON.parse(gunzipSync(fs.readFileSync(new URL(name,import.meta.url))))
const history=load('../../test/fixtures/jasper-server-programme-originals-20261111.json.gz')
const current=load('./test-data/current-api-20261121.json.gz')
const currentAPI=JSON.parse(Buffer.from(current.bodyBase64,'base64'))
const currentBoard=JSON.parse(fs.readFileSync(new URL('./test-data/current-board-projection-20261121.json',import.meta.url)))
const currentOrganization=JSON.parse(fs.readFileSync(new URL('./test-data/current-organization-20261121.json',import.meta.url))).organization
const oldAPI=JSON.parse(Buffer.from(history.responses[2].bodyBase64,'base64'))
const sha=body=>createHash('sha256').update(body).digest('hex')
const originals=()=>history.responses.map(row=>({...structuredClone(row.originalReceipt),body:Buffer.from(row.bodyBase64,'base64')}))
function changed(page,text){
 const body=Buffer.from(text)
 return{...page,body,bodyBytes:body.length,bodySHA256:sha(body),consumedBodyBytes:body.length,
  controlledEvidence:'Mixed-date historical HTML with actual current API/public board projection, altered to exercise parser/closing contracts. No current own HTML or closing acquisition is claimed.'}
}
function boot(page,edit){
 const html=page.body.toString(),match=/<script nonce="[^"]+">([\s\S]*?window\.__appData[\s\S]*?)<\/script>/.exec(html);assert.ok(match)
 const source=match[1],expression=parse(source,{ecmaVersion:'latest'}).body[0].expression
 const value=JSON.parse(source.slice(expression.right.start,expression.right.end));edit(value)
 return changed(page,html.replace(source,source.slice(0,expression.right.start)+JSON.stringify(value)+source.slice(expression.right.end)))
}
function ld(page,edit){
 const html=page.body.toString(),match=/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html);assert.ok(match)
 const value=JSON.parse(match[1]);edit(value)
 return changed(page,html.replace(match[0],'<script type="application/ld+json">'+JSON.stringify(value)+'</script>'))
}
function currentPackets(){
 const rows=originals(),apiBody=Buffer.from(current.bodyBase64,'base64')
 const board=boot(rows[1],value=>{value.organization=structuredClone(currentOrganization);value.jobBoard=structuredClone(currentBoard.jobBoard)})
 const api={...structuredClone(current.receipt),body:apiBody,bodyBytes:apiBody.length,bodySHA256:sha(apiBody),consumedBodyBytes:apiBody.length}
 const own=currentAPI.jobs.map(now=>{
  const index=oldAPI.jobs.findIndex(old=>old.title===now.title);assert.notEqual(index,-1)
  const old=oldAPI.jobs[index]
  let row=boot(rows[index+3],value=>{value.organization=structuredClone(currentOrganization);value.posting.id=now.id;value.posting.descriptionHtml=now.descriptionHtml})
  row=ld(row,value=>{value.description=now.descriptionHtml;value.identifier.value=now.id;value.datePosted=now.publishedAt.slice(0,10)})
  let html=row.body.toString().replaceAll(old.id,now.id).replaceAll('U.S., Australia, and France.','U.S. and France.')
  // Only observed exact publisher changes update the CONTROLLED historical head.
  if(now.title==='Senior Accountant')html=html.replaceAll('101,250','101,000').replaceAll('118,750','119,000')
  if(now.title==='Senior Director, Product Marketing')html=html.replaceAll('198,000','220,000').replaceAll('247,000','275,000')
  return{...changed(row,html),requestedURL:now.jobUrl,finalURL:now.jobUrl}
 })
 return[rows[0],board,api,...own]
}
const reconcile=rows=>reconcileJasperServerProgramme({corporate:readJasperCorporate(rows[0]),board:readJasperBoard(rows[1]),api:readJasperApi(rows[2]),roles:rows.slice(3).map(readJasperOwn)})
function editOwnText(page,from,to){assert.ok(page.body.toString().includes(from));return changed(page,page.body.toString().replaceAll(from,to))}
function editApiText(page,from,to){const model=JSON.parse(page.body);for(const row of model.jobs)for(const field of ['descriptionHtml','descriptionPlain'])row[field]=row[field].replaceAll(from,to);return changed(page,JSON.stringify(model))}

test('retained exact current API/public board rows reconcile only through explicitly controlled historical own representations',()=>{
 assert.equal(sha(Buffer.from(current.bodyBase64,'base64')),current.originalEntity.sha256)
 assert.equal(currentBoard.bodyOriginalUnmodified,false)
 const rows=currentPackets(),result=reconcile(rows)
 assert.equal(result.nativeRecords.length,7)
 assert.deepEqual(result.nativePayload,currentAPI)
 assert.equal(result.nativeRecords.find(row=>row.originalAPI.title==='Senior Accountant').originalAPI.descriptionPlain.includes('$101,000'),true)
 assert.equal(result.nativeRecords.find(row=>row.originalAPI.title==='Senior Director, Product Marketing').originalAPI.descriptionPlain.includes('$220,000-$275,000'),true)
 for(let i=0;i<result.nativeRecords.length;i++){
  const row=result.nativeRecords[i]
  assert.equal(row.originalAPI.descriptionHtml,currentAPI.jobs[i].descriptionHtml)
  assert.equal(row.originalFullHTML,currentAPI.jobs[i].descriptionHtml)
  assert.equal(row.originalPublishedAt,currentAPI.jobs[i].publishedAt)
  assert.equal(row.primaryWorkCountry,'USA')
 }
 assert.equal(result.currentnessQualified,false);assert.equal(result.lifecycleCleanupAllowed,false)
 assert.equal(result.applicationVisited,false);assert.equal(result.companyGlobalScopeQualified,false)
})

test('an unknown fully aligned salary change remains outside the reviewed authored class',()=>{
 const rows=currentPackets(),index=currentAPI.jobs.findIndex(row=>row.title==='Senior Accountant')
 rows[2]=editApiText(rows[2],'101,000','101,001')
 rows[index+3]=editOwnText(rows[index+3],'101,000','101,001')
 assert.throws(()=>reconcile(rows),error=>error.code==='JASPER_PROGRAMME_HOLD'&&error.reason==='criteria-family')
})

for(const [name,from,to]of[
 ['corporate country scope changed to eligibility','team members across the U.S. and France.','applicants may work across the U.S. and France.'],
 ['unknown corporate country','team members across the U.S. and France.','team members across the U.S. and India.'],
 ['role-country change outside corporate paragraph','within the continental US','from any country'],
])test('current intro does not conceal '+name,()=>{
 const rows=currentPackets()
 rows[2]=editApiText(rows[2],from,to)
 rows[3]=editOwnText(rows[3],from,to)
 assert.throws(()=>reconcile(rows),error=>error.code==='JASPER_PROGRAMME_HOLD'&&['geography','criteria-family'].includes(error.reason))
})

test('controlled current-criteria full closing retains pay/raw dates while company and application scope stay held',async()=>{
 const rows=currentPackets(),map=new Map(rows.map(row=>[row.requestedURL,row]))
 const result=await readCurrentJasperProgramme({readPage:async url=>{const row=map.get(url);assert.ok(row);return{...structuredClone(row),body:Buffer.from(row.body)}}})
 const audit=result.nativeCollectionEvidence
 assert.equal(audit.requests,20);assert.equal(audit.currentTransactionQualified,true)
 assert.deepEqual(audit.nativePayload,currentAPI)
 assert.equal(audit.nativeRecords.length,7);assert.equal(audit.lifecycleCleanupAllowed,false)
 assert.equal(audit.companyGlobalScopeQualified,false)
})

test('closing-only authored pay drift holds with both complete native versions retained',async()=>{
 const rows=currentPackets(),map=new Map(rows.map(row=>[row.requestedURL,row])),seen=new Map()
 const now=currentAPI.jobs.find(row=>row.title==='Senior Accountant')
 let failure
 try{await readCurrentJasperProgramme({readPage:async url=>{
  const occurrence=(seen.get(url)??0)+1;seen.set(url,occurrence)
  const source=map.get(url);assert.ok(source)
  const row={...structuredClone(source),body:Buffer.from(source.body)}
  return url===now.jobUrl&&occurrence===2?editOwnText(row,'101,000','101,001'):row
 }})}catch(error){failure=error}
 assert.equal(failure?.reason,'closing')
 const audit=failure.nativeCollectionEvidence,opening=audit.rawPages.find(row=>row.phase==='opening-O'&&row.requestedURL===now.jobUrl),closing=audit.rawPages.at(-1)
 assert.equal(closing.requestedURL,now.jobUrl)
 assert.notEqual(opening.bodySHA256,closing.bodySHA256)
 assert.equal(audit.currentTransactionQualified,false);assert.equal(audit.lifecycleCleanupAllowed,false)
})
