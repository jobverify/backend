import test from 'node:test'
import assert from 'node:assert/strict'
import {HOME,BOARD,exact,element,attribute,programme,replay,closing} from './currentConfiguredProjection20261121.test.js'
const mutate=code=>closing(HOME,html=>programme(html,source=>code+'\n'+source)),later=code=>closing(HOME,html=>exact(html,'</body>','<script>'+code+'</script></body>'))
const held=async change=>assert.rejects(replay(change),error=>error.nativeContradiction===true&&error.failureKind==='parser_or_contract_error')
for(const[label,code]of[
 ['bound global Object.assign','var write=Object.assign.bind(Object); write(window,{fetch:function(){}});'],
 ['prebound global Object.assign','var write=Object.assign.bind(Object,window); write({fetch:function(){}});'],
 ['bound Reflect.set','var write=Reflect.set.bind(Reflect); write(window,"fetch",function(){});'],
 ['Object.assign call','Object.assign.call(null,window,{fetch:function(){}});'],
 ['Object.assign apply','Object.assign.apply(null,[window,{fetch:function(){}}]);'],
 ['Object.assign spread','Object.assign(...[window,{fetch:function(){}}]);'],
 ['Reflect.apply Object.assign','Reflect.apply(Object.assign,null,[window,{fetch:function(){}}]);'],
 ['mutated invocation tuple','var args=[{}, {fetch:function(){}}]; args[0]=window; Object.assign(...args);'],
 ['method-mutated invocation tuple','var args=[{}, {fetch:function(){}}]; args.splice(0,1,window); Object.assign(...args);'],
 ['escaped invocation tuple','var args=[{}, {fetch:function(){}}]; unknownTupleConsumer(args); Object.assign(...args);'],
 ['reflected mount selector','Object.assign(document,{getElementById:function(){}});'],
 ['reflected JSON serializer','Reflect.set(JSON,"stringify",function(){return "{}";});']
])test('Datafold actual full collector rejects own '+label,()=>held(mutate(code)))
for(const[label,code]of[
 ['future fetch global','window.fetch=function(){};'],
 ['future serializer method','JSON.stringify=function(){return "{}";};'],
 ['future Promise aggregation','Promise.all=function(){return Promise.resolve([]);};']
])test('Datafold actual full collector rejects later '+label,()=>held(later(code)))
for(const[label,code]of[
 ['already captured mount selector','document.getElementById=function(){};'],
 ['unused unrelated reflected analytics','Object.assign(window,{unrelatedDatafoldAnalytics:{version:9}});'],
 ['scoped local serializer shadow','function unused(JSON){JSON.stringify=function(){return "{}";};}']
])test('Datafold actual full collector accepts coherent later '+label,async()=>assert.equal((await replay(later(code))).evidence.status,'complete-inventory'))
for(const[label,code]of[
 ['critical job object bound mutation','var write=Object.assign.bind(Object); write(job,{id:"other"});'],
 ['critical local helper mutation','function clearJob(value){value.id="other";} clearJob(job);']
])test('Datafold actual full collector rejects '+label,()=>held(closing(HOME,html=>programme(html,source=>exact(source,'          return {\n            title: job.title,','          '+code+'\n          return {\n            title: job.title,')))))
test('Datafold unused bound critical-record method is not invocation',async()=>{const result=await replay(closing(HOME,html=>programme(html,source=>exact(source,'          return {\n            title: job.title,','          var unused=Object.assign.bind(Object,job); void unused;\n          return {\n            title: job.title,'))));assert.equal(result.evidence.status,'complete-inventory')})
const schema=model=>closing(HOME,html=>exact(html,'</body>','<script type="application/ld+json">'+JSON.stringify(model)+'</script></body>'))
for(const[label,model]of[
 ['nested untyped publisher',{'@context':'https://schema.org','@type':'WebPage',url:HOME,publisher:{name:'Other Employer'}}],
 ['array publisher',{'@context':'https://schema.org','@type':'WebPage',url:HOME,publisher:[{name:'Datafold'},{name:'Other Employer'}]}],
 ['nested untyped mainEntityOfPage',{'@context':'https://schema.org','@type':'WebPage',url:HOME,mainEntityOfPage:{'@id':'https://other.example/jobs'}}],
 ['array mainEntityOfPage',{'@context':'https://schema.org','@type':'WebPage',url:HOME,mainEntityOfPage:[{'@id':HOME},{'@id':'https://www.datafold.com/other-jobs'}]}]
])test('Datafold actual full collector rejects own '+label,()=>held(schema(model)))
test('Datafold coherent optional publisher arrays remain accepted',async()=>{const result=await replay(schema({'@context':'https://schema.org','@type':'WebPage',url:HOME,name:'Careers at Datafold',publisher:[{name:'Datafold',url:'https://www.datafold.com/'}],mainEntityOfPage:[{'@id':HOME+'#page'}]}));assert.equal(result.evidence.status,'complete-inventory')})
test('Datafold plain-string optional publisher cannot name another employer',()=>held(schema({'@context':'https://schema.org','@type':'WebPage',url:HOME,publisher:'Other Employer'})))
test('Datafold coherent plain-string optional publisher remains accepted',async()=>assert.equal((await replay(schema({'@context':'https://schema.org','@type':'WebPage',url:HOME,publisher:'Datafold'}))).evidence.status,'complete-inventory'))
test('Datafold actual head-title employer attributes constrain authority',()=>held(closing(HOME,html=>element(html,node=>node.tag==='title',(source,node)=>attribute(source,node,'data-employer="Other Employer"')))))
test('Datafold semantically reordered HTML escape character set stays accepted',async()=>{const result=await replay(closing(HOME,html=>programme(html,source=>exact(source,'/[&<>"\']/g','/[<>"\'&]/g'))));assert.equal(result.evidence.status,'complete-inventory')})
test('Datafold own native card cannot add a conflicting application link',()=>held(closing(HOME,html=>programme(html,source=>exact(source,'`<div class="careers-job-card" role="listitem">`','`<div class="careers-job-card" role="listitem"><a href="https://other.example/apply">Apply</a>`')))))
test('Datafold caller cancellation during final cleanup remains exact',async()=>{const caller=new AbortController(),reason=Object.freeze({kind:'final-cleanup-owner-cancellation'});let lastSignal
 await assert.rejects(replay(null,{signal:caller.signal,onAudit:()=>lastSignal.addEventListener('abort',()=>caller.abort(reason),{once:true}),captureSignal:signal=>{lastSignal=signal}}),error=>error===reason)
})
test('Datafold native boot comments are not renderer/body pins',async()=>{const result=await replay(closing(BOARD,text=>element(text,node=>node.tag==='script'&&(node.raw??'').includes('window.__appData ='),(source,node)=>exact(source,node.raw,node.raw+'\n// independent native bootstrap release\n'))));assert.equal(result.evidence.status,'complete-inventory')})
