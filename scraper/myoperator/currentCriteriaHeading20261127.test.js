import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readMyOperatorPortal,readMyOperatorList,readMyOperatorDetail,BOARD,API} from './currentNative.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-seo-role-20261127.json.gz',import.meta.url))))
const id='163599000036869172',heading='What you will own'
const detailURL='https://careers.myoperator.com/recruit/v2/public/Job_Openings/'+id+'?source=CareerSite&pagename=Careers'
const saved=url=>fixture.responses.find(row=>row.url===url).body
function currentRole(){
 const portal=readMyOperatorPortal(saved(BOARD)),rows=readMyOperatorList(saved(API),portal.rows)
 assert.equal(rows.length,18)
 const row=rows.find(row=>row.id===id),detail=JSON.parse(saved(detailURL))
 assert.ok(row);assert.equal(detail.data.length,1)
 return {row,detail}
}
const read=({row,detail})=>readMyOperatorDetail(JSON.stringify(detail),row)
function replaceHeading(role,value){
 for(const record of [role.row,role.detail.data[0]]){
  assert.equal(record.Job_Description.split(heading).length,2,'The mutation must replace one actual current heading')
  const before=record.Job_Description;record.Job_Description=before.replace(heading,value)
  assert.notEqual(record.Job_Description,before)
 }
 return role
}

test('MyOperator reads the genuine current SEO listing and full detail with the expanded ownership heading',()=>{
 assert.equal(fixture.responses.length,4)
 for(const response of fixture.responses){assert.equal(response.status,200);assert.equal(createHash('sha256').update(response.body).digest('hex'),response.sha256)}
 const role=currentRole(),{record,criteria}=read(role)
 assert.equal(record.id,id);assert.equal(record.Posting_Title,'SEO Specialist');assert.equal(record.Country,'India')
 assert.equal(record.Publish,true);assert.equal(record.Is_Locked,false);assert.equal(record.Date_Opened,'2026-11-20')
 assert.equal(record.$appy_url,'https://careers.myoperator.com/jobs/Careers/'+id+'/SEO-Specialist?$apply=true&source=CareerSite')
 assert.deepEqual(record,role.detail.data[0]);assert.equal(criteria.sourceDescriptionHTML,record.Job_Description)
 assert.equal(criteria.sourceDetailComplete,true);assert.ok(criteria.sourceDescription.includes(heading))
 assert.match(criteria.sourceDescription,/quarterly/i);assert.match(criteria.sourceDescription,/24 months/i)
 assert.match(criteria.sourceDescription,/Must have/);assert.match(criteria.sourceDescription,/Not a fit/)
})

for(const heading of ["What you'll own",'What you\u2019ll own'])test('MyOperator retains supported contracted criteria heading '+heading,()=>{
 const role=replaceHeading(currentRole(),heading),result=read(role)
 assert.equal(result.criteria.sourceDetailComplete,true);assert.ok(result.criteria.sourceDescription.includes(heading))
})

test('MyOperator rejects an unsupported ownership phrase even when the full criteria carriers agree',()=>{
 const role=replaceHeading(currentRole(),'What you might own')
 assert.throws(()=>read(role),/Role-owned candidate criteria unavailable/)
})

test('MyOperator rejects absent criteria in both genuine current carriers',()=>{
 const role=currentRole();assert.ok(role.row.Job_Description.length>2000);assert.ok(role.detail.data[0].Job_Description.length>4000)
 role.row.Job_Description='';role.detail.data[0].Job_Description=''
 assert.throws(()=>read(role),/Native full original criteria unavailable/)
})

test('MyOperator rejects consistent generic CV intake without role-owned criteria',()=>{
 const role=currentRole(),text='Send your CV to join our talent community and hear from us. '
 role.row.Job_Description=text.repeat(20);role.detail.data[0].Job_Description='<p>'+text.repeat(20)+'</p>'
 assert.throws(()=>read(role),/Role-owned candidate criteria unavailable/)
})

for(const carrier of ['listing','detail'])test('MyOperator rejects a changed current '+carrier+' criteria body despite the supported heading',()=>{
 const role=currentRole(),extra=' Additional mandatory professional registration.'
 if(carrier==='listing')role.row.Job_Description+=extra
 else role.detail.data[0].Job_Description+='<p>'+extra+'</p>'
 assert.ok(role.row.Job_Description.includes(heading));assert.ok(role.detail.data[0].Job_Description.includes(heading))
 assert.throws(()=>read(role),error=>error.code==='MYOPERATOR_CRITERIA_DISAGREEMENT')
})

test('MyOperator rejects a consistent closed-role notice even with the expanded ownership heading',()=>{
 const role=currentRole(),notice='This position is closed. We are no longer accepting applications.'
 role.row.Job_Description=notice+'\n'+role.row.Job_Description
 role.detail.data[0].Job_Description='<p>'+notice+'</p>'+role.detail.data[0].Job_Description
 assert.equal(role.row.Publish,true);assert.equal(role.detail.data[0].Publish,true)
 assert.throws(()=>read(role),/Explicit native closed or inactive role notice/)
})

for(const [name,key,value,reason] of [
 ['native identity','id','163599000036869173',/listing\/detail id mismatch/],
 ['country','Country','Singapore',/listing\/detail Country mismatch/],
 ['publication','Publish',false,/listing\/detail Publish mismatch/],
 ['locked state','Is_Locked',true,/listing\/detail Is_Locked mismatch/],
 ['application','$appy_url','https://other.example/apply',/Foreign native role\/application identity/],
 ['publication date','Date_Opened','2026-11-21',/listing\/detail Date_Opened mismatch/],
])test('MyOperator retains current '+name+' binding with expanded criteria heading',()=>{
 const role=currentRole();assert.notEqual(role.detail.data[0][key],value);role.detail.data[0][key]=value
 assert.throws(()=>read(role),reason)
})
