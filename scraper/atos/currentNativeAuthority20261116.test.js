import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {replayCurrentAtos} from './currentNative20261115.test.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261115.json.gz',import.meta.url))))
const target=fixture.passes[0].rows[0].url
const insert=(packet,url,text)=>{if(url===target){assert.ok(packet.body.includes('<span class="jobdescription">'));packet.body=packet.body.replace('<span class="jobdescription">','<span class="jobdescription"><p>'+text+'</p>')}}
for(const text of[
 'Applications must be received by 1 November 2026.',
 'Applications will be accepted until 1 November 2026.',
 'Applications should reach us by 1 November 2026.',
 'Apply before 1 November 2026.',
 'Submit your CV by 1 November 2026.',
 'Please send your CV no later than 1 November 2026.',
 'The hiring entity for this position is Acme Corporation.',
 'Your employing company is Acme Corporation.',
 'Your employing entity is Acme Corporation.',
 'You will be working for Acme Corporation.',
 'You will work for Acme Corporation.',
 'Your duty station is New York, United States.',
 'You are assigned to New York, United States.',
 'You will be stationed in New York, United States.',
])test('new complete native authority paragraph holds without value inference: '+text,async()=>{
 const result=await replayCurrentAtos((packet,url)=>insert(packet,url,text))
 assert.ok(result.mutations.length>0,'actual native criterion carrier changed')
 assert.ok(result.error,'unreviewed full authority block must hold')
 assert.equal(result.jobs.length,0)
})
test('new complete ordinary qualification before applying remains publishable',async()=>{
 const text='Applicants must hold an additional cryptography certification before applying.'
 const result=await replayCurrentAtos((packet,url)=>insert(packet,url,text))
 assert.ifError(result.error);assert.equal(result.jobs.length,25);assert.equal(result.mutations.length,2)
 const job=result.jobs.find(job=>job.sourceUrl===target)
 for(const content of[job.sourceNativeFullCriteria,job.sourceDescription,job.sourceNativeClosingRecord.criteria])assert.ok(content.includes(text))
})
for(const text of[
 'Please send your résumé by 1 November 2026.',
 'All curricula vitae should reach us by 1 November 2026.',
 'Cover letters must be received by 1 November 2026.',
])test('extra native submission topic requires review: '+text,async()=>{
 const result=await replayCurrentAtos((packet,url)=>insert(packet,url,text))
 assert.ok(result.mutations.length>0);assert.ok(result.error);assert.equal(result.jobs.length,0)
})
