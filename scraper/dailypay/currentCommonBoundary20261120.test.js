import './currentPeerBoundary20261120.test.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {replay,feed,BOARD} from './currentConfiguredBoard20261120.test.js'

const exact=(s,a,b)=>{assert.equal(s.split(a).length,2,'Unique genuine native byte target');assert.notEqual(a,b);return s.replace(a,()=>b)}
const append=source=>(q,u,n)=>{if(u===BOARD&&n===1)q.text=exact(q.text,'</body>','<script>'+source+'</script></body>')}
async function held(change){let changed=false,error;try{await replay((q,u,n)=>{const old=JSON.stringify(q);change(q,u,n);changed ||= old!==JSON.stringify(q)})}catch(e){error=e}assert(changed,'Common boundary mutation actually reached original bytes');assert(error,'Known contradiction cannot qualify configured zero');assert.equal(error.nativeContradiction,true);assert.equal(error.failureKind,'parser_or_contract_error')}
async function retained(change){const r=await replay(change);assert.equal(r.evidence.status,'complete-inventory');assert.equal(r.audit.companyIndiaTotal,null);assert.equal(r.audit.sourceScopeComplete,false);return r}

for(const tag of['label','span'])for(const[label,value]of[['Country','India'],['Employer','Other Employer'],['Posting status','withdrawn'],['Application URL','https://other.example/apply'],['Location','Bengaluru, India']])test('Common Ashby actual criteria '+tag+' leaf '+label+' cannot be dropped',()=>held(feed(r=>r.descriptionHtml='<section><'+tag+'>'+label+'</'+tag+'><span>'+value+'</span></section>')))

for(const[label,fact]of[['publication',{isPublished:false}],['country',{country:'India'}],['employer',{hiringOrganization:{'@type':'Organization',name:'Other Employer'}}],['application',{applicationUrl:'https://other.example/apply'}]])test('Common Ashby same-role typed WebPage '+label+' constrains configured zero',()=>held(feed(r=>r.descriptionHtml='<script type="application/ld+json">'+JSON.stringify({'@context':'https://schema.org','@type':'WebPage',url:r.jobUrl,...fact})+'</script>')))

for(const[label,source]of[['bound Object.assign','const independentNativeReplace=Object.assign.bind(Object);independentNativeReplace(window,{__appData:{}});'],['bound Reflect.set','const independentNativeReplace=Reflect.set.bind(Reflect);independentNativeReplace(window,"__appData",{});'],['prebound global target','const independentNativeReplace=Object.assign.bind(Object,window);independentNativeReplace({__appData:{}});']])test('Common Ashby '+label+' replacement changes actual state',()=>held(append(source)))

test('Common Ashby coherent adjacent semantic employer remains qualified',()=>retained(feed(r=>r.descriptionHtml='<section><label>Employer</label><span>DailyPay</span></section>')))
test('Common Ashby coherent same-role typed WebPage remains retained',async()=>{const r=await retained(feed(r=>r.descriptionHtml='<script type="application/ld+json">'+JSON.stringify({'@context':'https://schema.org','@type':'WebPage',url:r.jobUrl,isPublished:true,country:r.address.postalAddress.addressCountry,applicationUrl:r.applyUrl})+'</script>'));assert.match(JSON.stringify(r.audit.observations),/WebPage/)})
test('Common Ashby bound unrelated analytics remains compatible',()=>retained(append('const recordNativeAnalytics=Object.assign.bind(Object,window);recordNativeAnalytics({ordinaryCurrentAnalytics:{version:2}});')))
test('Common Ashby an unused bound method is not a mutation',()=>retained(append('const unusedNativeReplace=Object.assign.bind(Object,window);')))
