import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readCurrentBoard,readCurrentCorporate,normalizeCurrentDentalkartRecord} from './currentNative.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/deployment-20261114.json.gz',import.meta.url)))),board=fixture.responses[1].body,ids=['178824000004695061','178824000004738296','178824000004847952','178824000004871513','178824000004532005','178824000004534003','178824000004696459','178824000005977025','178824000006260157'],sha=value=>createHash('sha256').update(value).digest('hex')
const descriptions=['4464425fad95467ae1768013c3846fc312ee3eb7886395c2c099cbdbf0525d5f','de7f474082d166b95402180c3efa60455f6eaa3d48ced47865d16016db794e12','e40ca0c949abf0acc7fa7fcd2bf7e0a265b8ceed5f5f15c28dabfffa86d80adc','c791446ab1dc9e43906f717b195ebba12a5709fb26609ee1229b6fdd9d586af0','2b23631d3ec847aeac9dfe4ae4cdd2637f2b8dbfc145ac253518f7e06f8feccd','c4dfdf4ef3def452cf5c83db3195df057ed2437e5c8a5a36da722c75e41913e8','6acf58a65998669beaf690a46ae51e74e5abd480540c63667d15f0b95040544b','b7225ef5b51257e7162f954febe84009b44a7c762938a2e7dffa8cb058579b02','f2f74068a625cdd490b4dd2baee2b2e9ae83a323c39dbb8af8d40e5d2f802995']
// Historical HTML originals do not contain their external client entity. These
// checks retain original facts; current default/client/closing coverage uses
// the complete separately retained Nov20 originals, never a fabricated old JS.
test('historical deployment20261114.test.js retains nine full native India records without renewing native dates',()=>{
 for(const row of fixture.responses)assert.equal(sha(row.body),row.sha256)
 readCurrentCorporate(fixture.responses[0].body);const model=readCurrentBoard(board),jobs=model.records.filter(r=>r.Publish&&!r.Is_Locked).map(r=>normalizeCurrentDentalkartRecord(r))
 assert.deepEqual(jobs.map(j=>j.jobId),ids)
 assert.deepEqual(jobs.map(j=>sha(j.sourceDescriptionHTML)),descriptions)
 assert.ok(jobs.every(j=>j.country==='India'&&j.sourceDetailComplete&&j.jobDescription.length>1000&&j.legalEmployer==='VASA Denticity Limited'&&j.lifecycleCleanupAllowed===false))
 assert.ok(jobs.every(j=>j.postingDate===null&&j.nativeDateOpened===j.sourceNativeJobRecord.Date_Opened&&j.applicationVisited===false))
})
test('historical deployment20261114.test.js preserves employer, country and full hidden-criteria controls',()=>{
 assert.throws(()=>readCurrentBoard(board.replaceAll('VASA Denticity Limited','Unrelated Employer Limited')),/title|employer/)
 const row=readCurrentBoard(board).records.find(r=>r.id===ids[0]);assert.equal(normalizeCurrentDentalkartRecord({...row,Country:''}).country,null)
 assert.equal(normalizeCurrentDentalkartRecord({...row,Job_Description:'<div>NA</div>'}).sourceDetailComplete,false)
 assert.throws(()=>normalizeCurrentDentalkartRecord({...row,Job_Description:'<p hidden>Additional condition</p>'+row.Job_Description}),/hidden or incomplete/)
 assert.throws(()=>readCurrentBoard(board.replace('id="jobs"','hidden id="jobs"')),/hidden attributes/)
})
