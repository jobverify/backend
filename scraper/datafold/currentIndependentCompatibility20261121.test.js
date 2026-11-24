import test from 'node:test'
import assert from 'node:assert/strict'
import {runCase,rowInsert,prepend,mount} from './currentIndependentWorkday20261121.test.js'

for(const [name,change] of [
 ['assigned role alias remains read-only',rowInsert('let alias; alias=job; void alias.id;')],
 ['fresh role container remains read-only',rowInsert('const holder={}; holder.role=job; void holder.role.title;')],
 ['local role receiver remains read-only',rowInsert('function read(){return this.id;} void read.call(job);')],
 ['local document receiver remains read-only',prepend('function read(){return this.title;} void read.call(document);')],
 ['local browser argument stays a read-only native keys call',prepend('function read(value){return Object.keys(value);} void read(JSON);')],
 ['hidden coherent publication facts are constraints, not visibility proof',mount('<section hidden><p>Employer</p><p>Datafold</p></section><section inert><p>Posting status</p><p>open</p></section><section style="display:none"><p>Application URL</p><p>https://jobs.ashbyhq.com/datafold</p></section>')]
])test('Datafold independent compatibility '+name,async()=>{const result=await runCase({name,expected:'complete',change,options:{}});assert.equal(result.actual,'complete',JSON.stringify({name,actual:result.actual,error:result.error}))})
