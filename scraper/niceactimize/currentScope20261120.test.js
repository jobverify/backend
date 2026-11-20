import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {isActimizeIndiaJob} from './script.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-scope-20261120.json.gz',import.meta.url)))),API='https://boards-api.greenhouse.io/v1/boards/nice/jobs?content=true',payload=JSON.parse(fixture.responses.find(p=>p.requestedUrl===API).text),product=payload.jobs.find(j=>j.id===5005786101),ownForeign=payload.jobs.find(j=>j.departments?.some(d=>d.name==='Actimize - Sales'))
test('fresh exact own scope originals are retained without reconstruction',()=>{assert.equal(fixture.responses.length,6);for(const p of fixture.responses){const b=Buffer.from(p.bodyBase64,'base64');assert.equal(createHash('sha256').update(b).digest('hex'),p.sha256);assert.equal(b.length,p.bodyBytes??b.length)}assert.ok(payload.jobs.length>=119)})
test('genuine India parent role mentioning Actimize only as a product skill is not target employer-unit proof',()=>{assert.equal(product.location.name,'India - Pune');assert.equal(product.departments[0].name,'VM - Compliance');assert.match(product.content,/Actimize development or capital market domain knowledge/);assert.equal(isActimizeIndiaJob(product),false)})
test('same own native India department independently identifies an Actimize candidate without needing criteria',()=>{const j=structuredClone(ownForeign);j.location.name='India - Pune';j.content='';assert.equal(isActimizeIndiaJob(j),true)})
test('title-only product mention does not replace an unknown native employer unit',()=>{const j=structuredClone(product);j.title='Actimize Developer';j.content='';j.metadata=[];assert.equal(isActimizeIndiaJob(j),false)})
test('same-current parent board fully retains unresolved unit scope and cannot supply an India-empty claim',()=>{const qualified=payload.jobs.filter(isActimizeIndiaJob);assert.equal(qualified.length,0);assert.ok(payload.jobs.some(j=>j.location.name==='India - Pune'));assert.ok(payload.jobs.some(j=>j.departments?.some(d=>d.name==='Actimize - Sales')))})
test('an actual same-record unit metadata field can identify Actimize without arbitrary metadata-keyword matching',()=>{const j=structuredClone(product);j.content='';j.metadata=[{name:'Business Unit',value:'NICE Actimize'}];assert.equal(isActimizeIndiaJob(j),true);j.metadata=[{name:'Preferred software experience',value:'NICE Actimize'}];assert.equal(isActimizeIndiaJob(j),false)})
