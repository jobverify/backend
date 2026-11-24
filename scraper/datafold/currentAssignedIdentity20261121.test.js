import test from 'node:test'
import assert from 'node:assert/strict'
import './currentIndependentCompatibility20261121.test.js'
import {runCase,rowInsert,prepend} from './currentIndependentWorkday20261121.test.js'

for(const [name,expected,change] of [
 ['shared fresh container alias retains role identity','hold',rowInsert('const holder={}; const alias=holder; alias.role=job; holder.role.id="other";')],
 ['reassigned container cannot hide original role identity','hold',rowInsert('let holder={}; holder={}; holder.role=job; holder.role.id="other";')],
 ['literal container retains original serializer namespace','hold',prepend('const holder={serializer:JSON}; holder.serializer.stringify=()=>"{}";')],
 ['assigned container retains original serializer namespace','hold',prepend('const holder={}; holder.serializer=JSON; holder.serializer.stringify=()=>"{}";')],
 ['shared fresh role container remains read-only','complete',rowInsert('const holder={}; const alias=holder; alias.role=job; void holder.role.id;')],
 ['copied namespace metadata remains read-only','complete',prepend('const copy={...JSON}; void copy.stringify;')]
])test('Datafold assigned identity '+name,async()=>{const result=await runCase({name,expected,change,options:{}});assert.equal(result.actual,expected,JSON.stringify({name,expected,actual:result.actual,error:result.error,mutations:result.mutations}))})
