import fs from'node:fs'
import{gunzipSync}from'node:zlib'
import test from'node:test'
import assert from'node:assert/strict'
const{readAccount,qualifyRole}=await import(process.env.FUTURISM_MODEL_UNDER_TEST??'./currentModels20261121.js')
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-originals-20261121.json.gz',import.meta.url))))
const body=p=>JSON.parse(Buffer.from(p.bodyBase64,'base64'))
const rows=body(fixture.packets.find(p=>p.requestedURL.endsWith('/reqlist/get'))).reqDetailsBOList
const account=readAccount(body(fixture.packets.find(p=>p.requestedURL.includes('/details_by_shortname/'))))
const envelope=id=>body(fixture.packets.find(p=>p.requestedURL.includes('/d17/')&&JSON.parse(p.requestBody).reqId===id))
test('actual68-response capture: inline markup preserves literal word boundaries for22 matching own India criteria',()=>{
 const qualified=[],held=[]
 for(const row of rows.filter(row=>row.location==='India')){
  try{const detail=envelope(row.reqId),job=qualifyRole(row,detail,account);assert.equal(job.jobDescription,detail.data.reqDetailsBO.jdDisplay);qualified.push(row.reqId)}
  catch(error){held.push({id:row.reqId,reason:error.message})}
 }
 assert.equal(qualified.length,22,JSON.stringify(held))
 assert.deepEqual(held.map(row=>row.id),[1125,1041])
})
for(const[title,from,to]of[
 ['changed internal word boundary','Python','Py thon'],
 ['changed authored requirement','Python','Ruby'],
])test('actual role keeps full criteria hold for '+title,()=>{
 const row=rows.find(row=>row.reqId===1142),detail=envelope(1142),original=detail.data.reqDetailsBO.jdDisplay
 assert.ok(original.includes(from));detail.data.reqDetailsBO.jdDisplay=original.replace(from,to)
 assert.throws(()=>qualifyRole(row,detail,account),/whole listing\/detail criteria disagree/)
})
test('actual inline-adjacent native B2B words remain exact instead of removing all whitespace',()=>{
 const row=rows.find(row=>row.reqId===1041),detail=envelope(1041)
 assert.ok(row.jdDisplay.includes('inB2B'))
 assert.ok(detail.data.reqDetailsBO.jdDisplay.includes('B2B'))
 detail.data.reqDetailsBO.jdDisplay=detail.data.reqDetailsBO.jdDisplay.replace('B2B','B 2B')
 assert.throws(()=>qualifyRole(row,detail,account),/whole listing\/detail criteria disagree/)
})
