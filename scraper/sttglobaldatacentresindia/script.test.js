import assert from 'node:assert/strict'
import test from 'node:test'
import * as source from './script.js'
test('current source factory and direct entrypoint share the guarded native collector',()=>{assert.equal(source.SOURCE,'sttglobaldatacentresindia');assert.equal(source.createSttGlobalDataCentresIndiaScraper().run,source.run)})
test('metadata-free legacy callbacks are rejected before any caller-provided source IO',async()=>{let reads=0;await assert.rejects(source.createSttGlobalDataCentresIndiaScraper().run({fetchText:async()=>{reads++;return 'Careers India'}}),/metadata-free legacy callback/);assert.equal(reads,0)})
test('already-aborted caller is preserved exactly before native source work',async()=>{const controller=new AbortController(),reason=Object.freeze({owner:'sttglobaldatacentresindia-pre-abort'});controller.abort(reason);let reads=0;await assert.rejects(source.run({signal:controller.signal,fetchImpl:async()=>{reads++;throw Error('unexpected')}}),e=>e===reason);assert.equal(reads,0)})
