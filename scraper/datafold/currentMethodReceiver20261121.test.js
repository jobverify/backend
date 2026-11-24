import test from 'node:test'
import assert from 'node:assert/strict'
import './currentNativeBoundary20261121.test.js'
import {HOME,exact,programme,replay,closing} from './currentConfiguredProjection20261121.test.js'
const insert=code=>source=>exact(source,'          return {\n            title: job.title,','          '+code+'\n          return {\n            title: job.title,')
const original=change=>closing(HOME,html=>programme(html,change))
for(const[label,change]of[
 ...['filter','join','push'].map(name=>['unknown '+name+' receives actual role',insert('unqualifiedReceiver.'+name+'(job);')]),
 ['actual role this escapes',insert('job.unqualifiedMethod();')],
 ['actual collection this escapes',source=>exact(source,'    if (jobs.length) {','    jobs.unqualifiedMethod();\n    if (jobs.length) {')],
 ['actual mount this escapes',source=>exact(source,'    if (jobs.length) {','    root.unqualifiedMethod();\n    if (jobs.length) {')],
 ['actual response this escapes',source=>exact(source,'    return res.json();','    res.unqualifiedMethod();\n    return res.json();')],
 ['original role escapes through pushed container',insert('const holder=[]; holder.push(job); holder[0].id="other";')]
])test('Datafold method receiver rejects '+label,()=>assert.rejects(replay(original(change)),error=>error.nativeContradiction===true&&error.failureKind==='parser_or_contract_error'))

test('Datafold method receiver original baseline remains configured complete',async()=>assert.equal((await replay()).evidence.status,'complete-inventory'))
for(const[label,code]of[
 ['known literal-array primitive readers','const titles=[job.title]; void titles.filter(Boolean).join("");'],
 ['read-only original role copy','void Object.assign({},job);'],
 ['unused scoped method consumer','function notCalled(value){value.unqualifiedMethod();} void notCalled;']
])test('Datafold method receiver preserves '+label,async()=>assert.equal((await replay(original(insert(code)))).evidence.status,'complete-inventory'))
