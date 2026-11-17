import assert from 'node:assert/strict'
import test from 'node:test'
import * as source from './script.js'
test('current factory uses the same guarded native acquisition as direct run',()=>{assert.equal(source.SOURCE,'rinextechnologies');assert.equal(source.createRinexTechnologiesScraper().run,source.run)})
test('metadata-free legacy source callback is refused before any IO',async()=>{let reads=0;await assert.rejects(source.run({fetchText:async()=>{reads++;return 'India Careers'}}),/metadata-free legacy callback/);assert.equal(reads,0)})
test('frozen already-aborted caller reason wins before acquisition',async()=>{const caller=new AbortController(),reason=Object.freeze({owner:'rinextechnologies-early'});caller.abort(reason);let reads=0;await assert.rejects(source.run({signal:caller.signal,fetchImpl:async()=>{reads++;throw Error('unexpected')}}),e=>e===reason);assert.equal(reads,0)})
