import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readJasperCorporate} from './currentProgrammeData.js'
import {BOARD} from './currentProgrammeRenderer.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-corporate-20261121.json.gz',import.meta.url))))
const original=Buffer.from(fixture.bodyBase64,'base64'),sha=b=>createHash('sha256').update(b).digest('hex')
const read=edit=>{const body=Buffer.from(edit?edit(original.toString()):original);return readJasperCorporate({...structuredClone(fixture.receipt),body,bodyBytes:body.length,bodySHA256:sha(body),consumedBodyBytes:body.length})}
const insert=markup=>html=>html.replace('</body>',markup+'</body>')
test('actual retained Jasper corporate derivative remains explicitly qualified against separate original hashes',()=>{assert.equal(sha(original),fixture.originalEntity.persistedSHA256);assert.equal(fixture.originalEntity.bodyOriginalUnmodified,false);assert.notEqual(fixture.originalEntity.sha256,sha(original));assert.match(fixture.qualification,/not retained\/reconstructed/);assert.equal(fixture.originalFailure.code,'JASPER_PROGRAMME_HOLD')})
test('current retained Jasper hiring declarations pass without whole corporate HTML pin',()=>{const model=read();assert.equal(model.declaredBoardURL,BOARD);assert.equal(model.ordinaryHandoffs.length,2);assert.equal(model.originalHTML,original.toString());assert.equal(model.sourceScopeComplete,false);assert.equal(model.lifecycleCleanupAllowed,false);assert.equal(model.browserExecutionQualified,false)})
for(const[name,edit]of[['unrelated comment',insert('<!-- Public marketing telemetry note -->')],['unrelated prose',insert('<p>Read our latest marketing research.</p>')]])test('Jasper unrelated corporate '+name+' preserves declared native authority',()=>assert.equal(read(edit).ordinaryHandoffs.length,2))
for(const[name,edit]of[
 ['employer title',html=>html.replaceAll('Careers at Jasper | Shape the future of marketing','Careers at Other Company | Shape the future of marketing')],
 ['canonical employer',html=>html.replace('href="https://www.jasper.ai/careers" rel="canonical"','href="https://other.example/careers" rel="canonical"')],
 ['active foreign board',insert('<a href="https://jobs.ashbyhq.com/Other">Explore Open Roles</a>')],
 ['hidden foreign board',insert('<a hidden href="https://jobs.ashbyhq.com/Other">Explore Open Roles</a>')],
 ['extra hidden own board',insert('<a hidden href="'+BOARD+'">Explore Open Roles</a>')],
 ['original handoff hidden',html=>html.replace('href="'+BOARD+'"','hidden href="'+BOARD+'"')],
 ['original handoff inert',html=>html.replace('href="'+BOARD+'"','inert href="'+BOARD+'"')],
 ['original handoff styled hidden',html=>html.replace('href="'+BOARD+'"','style="display:none" href="'+BOARD+'"')],
 ['original label',html=>html.replace('Explore Open Roles','Explore Other Company Roles')],
 ['native account handler',html=>html.replace('href="'+BOARD+'"','onclick="location.href=\'https://jobs.ashbyhq.com/Other\';return false" href="'+BOARD+'"')],
 ['duplicate handoff href',html=>html.replace('href="'+BOARD+'"','href="https://jobs.ashbyhq.com/Other" href="'+BOARD+'"')],
 ['foreign native iframe',insert('<iframe src="https://jobs.ashbyhq.com/Other"></iframe>')],
 ['foreign hiring form',insert('<form action="https://jobs.ashbyhq.com/Other"><button>Apply now</button></form>')],
 ['foreign native script declaration',insert('<script>window.careersBoard="https://jobs.ashbyhq.com/Other"</script>')],
 ['relative careers iframe',insert('<iframe src="/careers/india"></iframe>')],
 ['relative job link',insert('<a href="/jobs/india">Explore opportunities</a>')],
 ['absolute own careers iframe',insert('<iframe src="https://www.jasper.ai/careers/india"></iframe>')],
 ['native search country form',insert('<form action="/careers/search"><select name="country"><option>India</option></select></form>')],
 ['hidden relative vacancy',insert('<a hidden href="/vacancies/india">Explore opportunities</a>')],
 ['direct role schema',insert('<script type="application/ld+json">{"@type":"JobPosting","title":"A newly authored role"}</script>')],
 ['nested role schema',insert('<script type="application/ld+json">{"@graph":[{"@type":["https://schema.org/JobPosting"]}]}</script>')]
])test('Jasper corporate holds changed '+name,()=>{const next=edit(original.toString());assert.notEqual(next,original.toString());assert.throws(()=>read(()=>next),e=>e.code==='JASPER_PROGRAMME_HOLD')})

for(const[name,edit]of[
 ['bare openings label',insert('<a href="https://new-provider.example/team">India engineering openings</a>')],
 ['hidden bare openings label',insert('<a hidden href="https://new-provider.example/team">India engineering openings</a>')],
 ['inline background frame criteria',html=>{assert.ok(html.includes('title="Background"'));return html.replace('title="Background"','title="Background" srcdoc="India job"')}]
])test('retained historical corporate control holds '+name,()=>{const next=edit(original.toString());assert.notEqual(next,original.toString());assert.throws(()=>read(()=>next),error=>error.code==='JASPER_PROGRAMME_HOLD'&&error.reason==='corporate-programme')})
