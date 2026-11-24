import test from 'node:test'
import assert from 'node:assert/strict'
import {run,script,page,append,insert,exact} from './currentIndependentBoundary20261121.test.js'

const replace=(old,value)=>script(source=>exact(source,old,value))
const before=code=>script(source=>code+'\n'+source)
const negatives=[
 ['publisher string retains employer constraint',page(model=>{model.publisher='Other Employer'})],
 ['publisher string array retains each employer constraint',page(model=>{model.publisher=['Other Employer']})],
 ['untyped publisher array retains each employer constraint',page(model=>{model.publisher=[{name:'Other Employer'}]})],
 ['untyped page identity array retains each identifier constraint',page(model=>{model.mainEntityOfPage=[{'@id':'https://other.example/jobs'}]})],
 ['global setter call alias retains fetch dependency',before('Reflect.set.call(null,window,"fetch",function(){});')],
 ['global setter apply alias retains fetch dependency',before('Reflect.set.apply(null,[window,"fetch",function(){}]);')],
 ['bound global setter retains fetch dependency',before('var set=Reflect.set.bind(Reflect);set(window,"fetch",function(){});')],
 ['global Object.assign call retains fetch dependency',before('Object.assign.call(null,window,{fetch:function(){}});')],
 ['later global setter call retains deferred fetch dependency',append('Reflect.set.call(null,window,"fetch",function(){});')],
 ['known global invocation array cannot replace its dependency key',before('var args=[window,"analytics",7];args[1]="fetch";Reflect.set(...args);')],
 ['native link setAttribute cannot overwrite original href',replace('        if (link) link.href = job.url;','        if (link) link.href = job.url;\n        link.setAttribute("href","https://other.example/apply");')],
 ['native title innerHTML cannot erase original title',replace('        if (title) title.textContent = job.title;','        if (title) title.textContent = job.title;\n        title.innerHTML="No current vacancies";')],
 ['actual job list cannot be cleared after append',replace('        list.appendChild(item);','        list.appendChild(item);\n        list.innerHTML="";')],
 ['actual native container cannot be cleared after append',replace('      container.appendChild(deptEl);','      container.appendChild(deptEl);\n      container.innerHTML="";')],
 ['native record collection member cannot escape before listing',replace('        ALL_JOBS = data.jobs.filter','        externalCollectionConsumer(data.jobs);\n        ALL_JOBS = data.jobs.filter')],
 ['department initialization cannot be placed behind false guard',replace('      if (!map[name]) map[name] = { name: name, jobs: [] };','      if (false) map[name] = { name: name, jobs: [] };')],
 ['reflected native link cannot overwrite original href',replace('        if (link) link.href = job.url;','        if (link) link.href = job.url;\n        Reflect.set(link,"href","https://other.example/apply");')],
 ['aliased native link cannot overwrite original href',replace('        if (link) link.href = job.url;','        if (link) link.href = job.url;\n        var alias=link;alias.href="https://other.example/apply";')],
 ['member call cannot receive original collection without qualification',insert('externalCollectionConsumer.rows(ALL_JOBS);')],
 ['configured original getter cannot mutate native records',replace('get: function (j) { return j.department; }','get: function (j) { j.title="Changed role"; return j.department; }')]
]
const positives=[
 ['publisher string matching brand remains qualified',page(model=>{model.publisher='Redpanda'})],
 ['publisher string array matching brand and homepage remains qualified',page(model=>{model.publisher=['Redpanda','https://www.redpanda.com/']})],
 ['coherent untyped publisher array remains qualified',page(model=>{model.publisher=[{name:'Redpanda',url:'https://www.redpanda.com/'}]})],
 ['coherent untyped page identity array remains qualified',page(model=>{model.mainEntityOfPage=[{'@id':'https://www.redpanda.com/jobs#careers'}]})],
 ['stable readonly invocation array remains qualified',insert('var args=[{},ALL_JOBS];Object.assign(...args);')],
 ['readonly local invocation array helper remains qualified',insert('function peek(values){return values[0];}var args=[{},ALL_JOBS];peek(args);Object.assign(...args);')],
 ['unused bound browser setter remains uninvoked',before('var unused=Reflect.set.bind(Reflect,window,"fetch",function(){});void unused;')],
 ['unrelated reflected global analytics remain qualified',before('Reflect.set.call(null,window,"independentAnalytics",{version:9});')],
 ['later reflected DOM registration method leaves existing registration intact',append('Reflect.set.call(null,document,"addEventListener",function(){});')],
 ['primitive collection length may be reported to unrelated analytics',insert('independentAnalytics(ALL_JOBS.length);')]
]
for(const[label,change]of negatives)test('Redpanda independent guard neighbor: '+label,async()=>{
 const result=await run(change,{})
 assert.equal(result.error?.nativeContradiction,true,JSON.stringify({error:result.error?.message,status:result.evidence?.status,zero:result.assessment?.zeroJobEvidence}))
 assert.equal(result.error?.failureKind,'parser_or_contract_error')
})
for(const[label,change]of positives)test('Redpanda coherent guard neighbor: '+label,async()=>{
 const result=await run(change,{})
 assert.equal(result.error,undefined,result.error?.message)
 assert.equal(result.calls.length,4);assert.equal(result.jobs.length,0)
 assert.equal(result.evidence.status,'complete-inventory');assert.equal(result.assessment.runnerOutcome.success,true)
 assert.equal(result.assessment.zeroJobEvidence,'fetched-zero');assert.equal(result.assessment.cleanupOptions.replaceExisting,false)
})
