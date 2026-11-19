import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {qualifyEverstageClient} from './nativeClientProfiles20261107.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/client-20261118.json.gz',import.meta.url))))
const legacy=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261116.json.gz',import.meta.url))))
const apply=fixture.pages.find(p=>p.url.endsWith('/apply')),appClient=fixture.pages.find(p=>p.url.includes('/apply-'))
const role=legacy.packets.find(p=>p.requestedURL.includes('/jobs/%5BjobId%5D-'))
test('current Everstage role and application clients qualify only within the coherent current declaration',()=>{
 assert.equal(qualifyEverstageClient(readNativeDocument(fixture.role),role.requestedURL,Buffer.from(role.bodyBase64,'base64').toString(),'role'),'2026-11-18')
 assert.equal(qualifyEverstageClient(readNativeDocument(apply.body),appClient.url,appClient.body,'apply'),'2026-11-18')
})
test('current Everstage executable leaf and declaration guards remain active',()=>{
 assert.throws(()=>qualifyEverstageClient(readNativeDocument(apply.body),appClient.url,appClient.body+'\n/*changed*/','apply'),/executable client/)
 assert.throws(()=>qualifyEverstageClient(readNativeDocument(fixture.role.replace('main-73465e06eee9a8f2.js','main-unreviewed.js')),role.requestedURL,Buffer.from(role.bodyBase64,'base64').toString(),'role'),/declaration context/)
})
