import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readJasperApi} from './currentProgrammeData.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-api-20261121.json.gz',import.meta.url))))
const original=Buffer.from(fixture.bodyBase64,'base64'),payload=JSON.parse(original),sha=b=>createHash('sha256').update(b).digest('hex')
const read=(edit)=>{const next=structuredClone(payload);edit?.(next);const body=edit?Buffer.from(JSON.stringify(next)):original;return readJasperApi({...structuredClone(fixture.receipt),body,bodyBytes:body.length,bodySHA256:sha(body),consumedBodyBytes:body.length})}
test('Jasper retained original API preserves all seven complete native records with controlled metadata qualification',()=>{assert.equal(sha(original),fixture.originalEntity.sha256);assert.equal(fixture.originalEntity.bodyOriginalUnmodified,true);assert.match(fixture.metadataQualification,/not captured/);const model=read();assert.deepEqual(model.nativePayload,payload);assert.equal(model.nativePayload.jobs.length,7);assert.equal(model.originalText,original.toString());assert.equal(model.sourceScopeComplete,false);assert.equal(model.lifecycleCleanupAllowed,false);for(const row of model.nativePayload.jobs){assert.equal(row.address.postalAddress.addressCountry,'USA');assert.equal(typeof row.descriptionHtml,'string');assert.equal(typeof row.publishedAt,'string')}})
for(const[name,edit]of[
 ['unlisted record',p=>{p.jobs[0].isListed=false}],
 ['missing raw country',p=>{p.jobs[0].address.postalAddress.addressCountry=null}],
 ['changed country',p=>{p.jobs[0].address.postalAddress.addressCountry='IN'}],
 ['foreign application account',p=>{p.jobs[0].applyUrl=p.jobs[0].applyUrl.replace('Jasper%20AI','Other')}],
 ['empty criteria',p=>{p.jobs[0].descriptionHtml=''}],
 ['new unreviewed eligibility field',p=>{p.jobs[0].additionalRequirements='Unreviewed native conditions'}],
 ['duplicate native identity',p=>{p.jobs[1].id=p.jobs[0].id}],
 ['invalid native date',p=>{p.jobs[0].publishedAt='not-a-date'}]
])test('Jasper current API holds '+name,()=>assert.throws(()=>read(edit),e=>e.code==='JASPER_PROGRAMME_HOLD'))
