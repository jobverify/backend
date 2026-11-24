import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readCurrentBoard,readCurrentCorporate,normalizeCurrentDentalkartRecord} from './currentNative.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/deployment-20261116.json.gz',import.meta.url)))),board=fixture.responses[1].body,ids=['178824000004695061','178824000004738296','178824000004847952','178824000004871513','178824000004532005','178824000004534003','178824000004696459','178824000006205008','178824000006260157'],sha=value=>createHash('sha256').update(value).digest('hex')
// Historical HTML originals do not contain their external client entity. These
// checks retain original facts; current default/client/closing coverage uses
// the complete separately retained Nov20 originals, never a fabricated old JS.
test('historical deployment20261116.test.js retains nine full native India records without renewing native dates',()=>{
 for(const row of fixture.responses)assert.equal(sha(row.body),row.sha256)
 readCurrentCorporate(fixture.responses[0].body);const model=readCurrentBoard(board),jobs=model.records.filter(r=>r.Publish&&!r.Is_Locked).map(r=>normalizeCurrentDentalkartRecord(r))
 assert.deepEqual(jobs.map(j=>j.jobId),ids)

 assert.ok(jobs.every(j=>j.country==='India'&&j.sourceDetailComplete&&j.jobDescription.length>1000&&j.legalEmployer==='VASA Denticity Limited'&&j.lifecycleCleanupAllowed===false))
 assert.ok(jobs.every(j=>j.postingDate===null&&j.nativeDateOpened===j.sourceNativeJobRecord.Date_Opened&&j.applicationVisited===false))
})
test('historical deployment20261116.test.js preserves employer, country and full hidden-criteria controls',()=>{
 assert.throws(()=>readCurrentBoard(board.replaceAll('VASA Denticity Limited','Unrelated Employer Limited')),/title|employer/)
 const row=readCurrentBoard(board).records.find(r=>r.id===ids[0]);assert.equal(normalizeCurrentDentalkartRecord({...row,Country:''}).country,null)
 assert.equal(normalizeCurrentDentalkartRecord({...row,Job_Description:'<div>NA</div>'}).sourceDetailComplete,false)
 assert.throws(()=>normalizeCurrentDentalkartRecord({...row,Job_Description:'<p hidden>Additional condition</p>'+row.Job_Description}),/hidden or incomplete/)
 assert.throws(()=>readCurrentBoard(board.replace('id="jobs"','hidden id="jobs"')),/hidden attributes/)
})
