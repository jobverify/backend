import assert from 'node:assert/strict'
import test from 'node:test'
import {run} from '../../scraper/rinextechnologies/script.js'
test('legacy body-only rinextechnologies publication cannot bypass current metadata/fullcriteria/country guards',async()=>{let reads=0;await assert.rejects(run({fetchText:async()=>{reads++;return 'Careers Bengaluru India'},fetchJson:async()=>{reads++;return [{title:'Brief only',location:'Bengaluru'}]}}),/metadata-free legacy callback/);assert.equal(reads,0)})
