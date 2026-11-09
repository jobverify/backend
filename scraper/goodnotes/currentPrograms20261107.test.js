import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {readCurrentGoodnotesBoard,readCurrentGoodnotesDetail,BOARD_URL} from './currentNative.js'

const capture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261107/current-native.json.gz',import.meta.url))))
const packet=url=>{
 const row=capture.packets.find(row=>row.requestUrl===url)
 assert.ok(row,'Only captured corporate-declared native URLs: '+url)
 return row
}
const boardHTML=packet(BOARD_URL).body

test('Goodnotes accepts the current reviewed native Greenhouse programs and reconciles original role details',async()=>{
 const jobs=await run({fetchPage:async url=>{
  const row=packet(url)
  return {status:row.status,url:row.url,finalUrl:row.url,headers:{'content-type':row.contentType},body:row.body,html:row.body}
 }})
 assert.equal(jobs.nativeCollectionEvidence.observedVacancyCount,5)
 assert.equal(jobs.nativeCollectionEvidence.closingReconciled,true)
 assert.equal(jobs.length,1)
 assert.equal(jobs[0].jobId,'6216615004')
 assert.equal(jobs[0].country,null)
 assert.equal(jobs[0].sourceCountryScopeUnresolved,true)
 assert.equal(jobs[0].sourceDetailComplete,true)
 assert.ok(jobs[0].jobDescription.includes('5 or more years as a software engineer'))
})

test('Goodnotes keeps unreviewed deployment programs and replacement native criteria closed',()=>{
 assert.throws(()=>readCurrentGoodnotesBoard(boardHTML.replace('window.ENV = {','window.ENV = {"UNREVIEWED":true,')),/supporting program/)
 assert.throws(()=>readCurrentGoodnotesBoard(boardHTML.replaceAll('manifest-02ecb345.js','manifest-unreviewed.js')),/renderer/)
 const board=readCurrentGoodnotesBoard(boardHTML),record=board.records.find(row=>row.id===6216615004),html=packet(record.absolute_url).body
 const changed=html.replace('Our Values','Replacement visible section')
 assert.notEqual(changed,html)
 assert.throws(()=>readCurrentGoodnotesDetail(changed,record),/criteria|data/i)
})

test('Goodnotes accepts the observed SRE placeholder metadata title only with its complete native role identity',()=>{
 const row=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261107/current-placeholder-sre.json.gz',import.meta.url))))
 const record=readCurrentGoodnotesBoard(boardHTML).records.find(record=>record.id===6234388004)
 const detail=readCurrentGoodnotesDetail(row.body,record)
 assert.equal(detail.post.company_name,'Goodnotes')
 assert.equal(detail.criteria.sourceDetailComplete,true)
 assert.throws(()=>readCurrentGoodnotesDetail(row.body,{...record,id:1234}),/identity|disagree/i)
})
