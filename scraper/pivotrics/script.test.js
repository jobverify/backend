import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import * as source from './script.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-20261117.json.gz',import.meta.url)))),html=i=>Buffer.from(fixture.originals[i].bodyBase64,'base64').toString()
test('Pivotrics current complete publisher advertises corporate contact rather than a vacancy inventory',()=>{assert.equal(source.SOURCE,'pivotrics');assert.ok(html(0).includes('mailto:contact@pivotrics.com'));assert.ok(html(0).includes('Software Product Engineering'));assert.ok(html(0).includes('class="lead-form"'))})
test('Pivotrics old metadata-free homepage/missing-path callbacks cannot certify zero',async()=>{let calls=0;await assert.rejects(source.run({fetchPage:async()=>{calls++;return{status:200,html:html(0)}}}),/metadata|unsupported/);assert.equal(calls,0)})
test('Pivotrics current transport error stays exact without fourteen guessed career paths',async()=>{const reason=Object.freeze({owner:'pivotrics-network'});let calls=0;await assert.rejects(source.run({requestIntervalMs:0,fetchImpl:async()=>{calls++;throw reason}}),error=>error===reason);assert.equal(calls,1)})
