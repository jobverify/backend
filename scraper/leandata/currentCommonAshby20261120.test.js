import './currentPeerBoundary20261120.test.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {replay,feed,BOARD} from './currentConfiguredBoard20261120.test.js'

const exact=(text,before,after)=>{assert.equal(text.split(before).length,2,'Unique genuine current native target');assert.notEqual(before,after);return text.replace(before,()=>after)}
const append=code=>(packet,url,observation)=>{if(url===BOARD&&observation===1)packet.text=exact(packet.text,'</body>','<script>'+code+'</script></body>')}
async function held(change){let changed=false,error;try{await replay((packet,url,observation)=>{const before=JSON.stringify(packet);change(packet,url,observation);changed ||= before!==JSON.stringify(packet)})}catch(e){error=e}assert(changed,'Common boundary mutation changed original native bytes');assert(error,'Contradictory current role or state cannot supply a configured zero');assert.equal(error.nativeContradiction,true);assert.equal(error.failureKind,'parser_or_contract_error')}

for(const[label,value]of[
 ['Country','India'],
 ['Employer','Other Employer'],
 ['Posting status','Closed'],
 ['Application URL','https://other.invalid/apply'],
 ['Location','Bengaluru India']
])test('Common Ashby adjacent semantic criteria '+label+' constrains configured zero',()=>held(feed(row=>row.descriptionHtml='<section><p>'+label+'</p><p>'+value+'</p></section>')))

for(const[label,value]of[
 ['Country','India'],
 ['Employer','Other Employer'],
 ['Posting status','withdrawn'],
 ['Application URL','https://other.example/apply'],
 ['Location','Bengaluru, India']
])test('Exact shared review semantic label/value '+label+' constrains configured zero',()=>held(feed(row=>row.descriptionHtml='<section><label>'+label+'</label><span>'+value+'</span></section>')))

for(const tag of['div','section'])for(const[label,value]of[
 ['Country','India'],
 ['Employer','Other Employer'],
 ['Posting status','withdrawn'],
 ['Application URL','https://other.example/apply'],
 ['Location','Bengaluru, India']
])test('Scoped '+tag+' semantic leaf pair '+label+' constrains configured zero',()=>held(feed(row=>row.descriptionHtml='<section><'+tag+'>'+label+'</'+tag+'><'+tag+'>'+value+'</'+tag+'></section>')))

for(const owner of['root','article'])for(const[label,value]of[
 ['Country','India'],
 ['Employer','Other Employer'],
 ['Posting status','withdrawn'],
 ['Application URL','https://other.example/apply'],
 ['Location','Bengaluru, India']
])test('Current criteria '+owner+' owner semantic '+label+' constrains configured zero',()=>held(feed(row=>{const pair='<label>'+label+'</label><span>'+value+'</span>';row.descriptionHtml=owner==='root'?pair:'<article>'+pair+'</article>'})))

for(const[label,properties]of[
 ['publication',{isPublished:false}],
 ['country',{country:'India'}],
 ['employer',{hiringOrganization:{'@type':'Organization',name:'Other Employer'}}],
 ['application',{applicationUrl:'https://other.invalid/apply'}]
])test('Common Ashby same-role typed WebPage '+label+' constrains configured zero',()=>held(feed(row=>row.descriptionHtml='<script type="application/ld+json">'+JSON.stringify({'@context':'https://schema.org','@type':'WebPage',url:row.jobUrl,...properties})+'</script>')))

for(const[label,code]of[
 ['Object.assign bound receiver','const replaceCurrentNativeState=Object.assign.bind(Object);replaceCurrentNativeState(window,{__appData:{}});'],
 ['Reflect.set bound receiver','const replaceCurrentNativeState=Reflect.set.bind(Reflect);replaceCurrentNativeState(window,"__appData",{});'],
 ['Object.assign bound target','const replaceCurrentNativeState=Object.assign.bind(Object,window);replaceCurrentNativeState({__appData:{}});']
])test('Common Ashby '+label+' cannot borrow the earlier literal',()=>held(append(code)))

test('Coherent semantic label/value criteria retain all original foreign role observations',async()=>{const result=await replay(feed(row=>row.descriptionHtml='<section><label>Country</label><span>USA</span></section><section><label>Employer</label><span>LeanData</span></section><section><label>Posting status</label><span>Published</span></section><section><label>Application URL</label><span>'+row.applyUrl+'</span></section><section><label>Location</label><span>Santa Clara, USA</span></section>'));assert.equal(result.evidence.status,'complete-inventory');assert.match(JSON.stringify(result.audit.observations),/<label>Country<\/label><span>USA/);assert.equal(result.audit.companyIndiaTotal,null)})

test('Coherent typed same-role WebPage criteria remain compatible',async()=>{const result=await replay(feed(row=>row.descriptionHtml='<script type="application/ld+json">'+JSON.stringify({'@context':'https://schema.org','@type':'WebPage',url:row.jobUrl,isPublished:true,country:'USA',hiringOrganization:{'@type':'Organization',name:'LeanData'},applicationUrl:row.applyUrl})+'</script>'));assert.equal(result.evidence.status,'complete-inventory');assert.equal(result.audit.companyIndiaTotal,null)})

for(const[label,code]of[
 ['Object.assign','const updateCurrentAnalytics=Object.assign.bind(Object,window);updateCurrentAnalytics({independentLeanDataAnalytics:{version:3}});'],
 ['Reflect.set','const updateCurrentAnalytics=Reflect.set.bind(Reflect);updateCurrentAnalytics(window,"independentLeanDataAnalytics",{version:3});']
])test('Coherent unrelated bound '+label+' mutation remains compatible',async()=>{const result=await replay(append(code));assert.equal(result.evidence.status,'complete-inventory');assert.equal(result.audit.companyIndiaTotal,null)})

for(const tag of['p','div','section'])test('Coherent scoped '+tag+' semantic leaf pair remains compatible and retained',async()=>{const result=await replay(feed(row=>row.descriptionHtml='<section><'+tag+'>Country</'+tag+'><'+tag+'>USA</'+tag+'></section>'));assert.equal(result.evidence.status,'complete-inventory');assert.match(JSON.stringify(result.audit.observations),new RegExp('<'+tag+'>Country</'+tag+'><'+tag+'>USA'));assert.equal(result.audit.companyIndiaTotal,null)})

for(const owner of['root','article'])test('Coherent current criteria '+owner+' semantic owner remains compatible',async()=>{const result=await replay(feed(row=>{const pair='<label>Country</label><span>USA</span>';row.descriptionHtml=owner==='root'?pair:'<article>'+pair+'</article>'}));assert.equal(result.evidence.status,'complete-inventory');assert.match(JSON.stringify(result.audit.observations),/<label>Country<\/label><span>USA/);assert.equal(result.audit.companyIndiaTotal,null)})
