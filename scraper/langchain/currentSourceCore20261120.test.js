import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {qualifyV1Consumer} from './currentV1Consumer20261120.js'
const missing=e=>e.code==='ERR_MODULE_NOT_FOUND'?{}:Promise.reject(e)
const api={...await import('./currentPublisher20261120.js').catch(missing),...await import('./currentCollection20261120.js').catch(missing)}
const fixture=JSON.parse(gunzipSync(await fs.readFile(new URL('./fixtures/current-native-20261120.json.gz',import.meta.url))))
const HOME='https://www.langchain.com/careers',BOARD='https://jobs.ashbyhq.com/langchain',CLIENT=BOARD+'/embed',EMBED=BOARD+'?embed=js',FEED='https://api.ashbyhq.com/posting-api/job-board/langchain',body=url=>Buffer.from(fixture.responses.filter(r=>r.requestedUrl===url)[1].bodyBase64,'base64').toString(),html=body(HOME),walk=n=>[n,...n.children.filter(c=>typeof c!=='string').flatMap(walk)]
const exact=(source,old,next)=>{assert.equal(source.split(old).length,2,'Unique genuine LangChain source carrier');assert.notEqual(old,next);return source.replace(old,()=>next)}
function element(source,predicate,change){const d=document(source),nodes=walk(d.root).filter(n=>predicate(n,d));assert.equal(nodes.length,1,'Exactly one actual current LangChain carrier');const n=nodes[0],old=d.outer(n),next=change(old,n,d);assert.notEqual(next,old);return source.slice(0,n.start)+next+source.slice(n.end)}
const attribute=(source,n,value)=>source.slice(0,n.openEnd-n.start-1)+' '+value+'>'+source.slice(n.openEnd-n.start)
const own=value=>{assert.equal(typeof api.currentAuthority,'function','Current source-specific own publisher reader required');return api.currentAuthority(value,fixture.observedAt)}
const held=value=>assert.throws(()=>own(value),e=>e.nativeContradiction===true&&e.failureKind==='parser_or_contract_error')
const schema=(change=()=>{})=>{const value={'@context':'https://schema.org','@type':'WebPage',name:'LangChain Careers',url:HOME,publisher:{'@type':'Organization',name:'LangChain'}};change(value);return exact(html,'</head>','<script type="application/ld+json">'+JSON.stringify(value).replaceAll('<','\\u003c')+'</script></head>')}
const declared=n=>n.tag==='script'&&n.attrs.src===CLIENT

test('LangChain current eight genuine original Responses preserve all3104984bytes',()=>{assert.equal(fixture.responses.length,8);let bytes=0;for(const r of fixture.responses){const b=Buffer.from(r.bodyBase64,'base64');assert.equal(b.length,r.bytes);assert.equal(createHash('sha256').update(b).digest('hex'),r.sha256);assert.equal(r.status,200);assert.equal(r.method,'GET');assert.equal(r.redirected,false);bytes+=b.length}assert.equal(bytes,3104984);assert.equal(fixture.documentationURL,'https://developers.ashbyhq.com/docs/public-job-posting-api')})
for(const phase of [0,1])test('LangChain actual '+(phase===0?'opening':'closing')+' v1 client reaches its connected unfiltered consumer',()=>{const observed=url=>Buffer.from(fixture.responses.filter(r=>r.requestedUrl===url)[phase].bodyBase64,'base64').toString();const r=qualifyV1Consumer({homeHTML:observed(HOME),program:observed(CLIENT),homeURL:HOME,boardURL:BOARD,clientURL:CLIENT});assert.equal(r.baseURL,BOARD);assert.equal(r.consumerURL,EMBED)})
test('LangChain genuine branded title and OG bind the generic heading to its own declared v1 client',()=>{const r=own(html);assert.equal(r.publisher,'LangChain');assert.equal(r.home,HOME);assert.equal(r.board,BOARD);assert.equal(r.client,CLIENT);assert.equal(r.legalEmployer,null);assert.equal(r.originalDeclarations.length,1);assert.equal(r.originalContainer.attributes.id,'ashby_embed');assert.equal(r.originalPublisherModels.length,0)})
test('LangChain current native embed collection retains its exact publisher and103listed identities',()=>{assert.equal(typeof api.currentBoard,'function','Current native board reader required');const r=api.currentBoard(body(EMBED),EMBED,fixture.observedAt);assert.equal(r.organizationBinding.name,'LangChain');assert.equal(r.organizationBinding.slug,'langchain');assert.equal(r.rows.length,103)})
test('LangChain typed foreign countries do not override its genuine wider onsite EMEA workplace scope',()=>{assert.equal(typeof api.currentFeed,'function','Current documented feed reader required');const raw=JSON.parse(body(FEED));assert.equal(raw.jobs.length,103);const wider=raw.jobs.filter(r=>(r.descriptionPlain??'').includes('Open to other EMEA locations'));assert.equal(wider.length,1);assert.equal(wider[0].address.postalAddress.addressCountry,'UK');assert.equal(wider[0].workplaceType,'OnSite');assert.throws(()=>api.currentFeed(body(FEED),api.currentBoard(body(EMBED),EMBED,fixture.observedAt),fixture.observedAt),e=>e.nativeContradiction===true&&e.failureKind==='parser_or_contract_error'&&/workplace.*unresolved/.test(e.message))})
for(const[label,predicate,value]of[
 ['actual declared client withdrawal',declared,'data-is-published="false"'],
 ['actual declared client data-only type',declared,'type="application/json"'],
 ['actual declared client application contradiction',declared,'data-application-url="https://other.example/apply"'],
 ['actual embed container inert',n=>n.attrs.id==='ashby_embed','inert'],
 ['actual own generic h1 employer contradiction',n=>n.tag==='h1','data-employer="Other Employer"']
])test('LangChain '+label+' constrains current authority',()=>held(element(html,predicate,(s,n)=>attribute(s,n,value))))
test('LangChain actual own canonical cannot identify another publisher',()=>held(element(html,n=>n.tag==='link'&&n.attrs.rel==='canonical',(s,n)=>exact(s,n.attrs.href,'https://other.example/careers'))))
test('LangChain actual OG title cannot name another employer',()=>held(element(html,n=>n.tag==='meta'&&n.attrs.property==='og:title',(s,n)=>exact(s,n.attrs.content,'Careers at Other Employer'))))
test('LangChain actual declared client cannot change native account',()=>held(element(html,declared,s=>exact(s,CLIENT,'https://jobs.ashbyhq.com/other/embed'))))
test('LangChain uppercase declared JavaScript MIME remains executable',()=>{assert.equal(own(element(html,declared,(s,n)=>attribute(s,n,'type="Text/JavaScript"'))).publisher,'LangChain')})
test('LangChain generic head title remains qualified by its actual branded OG title',()=>{assert.equal(own(element(html,n=>n.tag==='title',(s,n)=>exact(s,n.raw,'Current career opportunities'))).publisher,'LangChain')})
test('LangChain unnamed generic title and unnamed OG cannot supply publisher brand',()=>{let changed=element(html,n=>n.tag==='title',(s,n)=>exact(s,n.raw,'Current career opportunities'));changed=element(changed,n=>n.tag==='meta'&&n.attrs.property==='og:title',(s,n)=>exact(s,n.attrs.content,'Current career opportunities'));held(changed)})
test('LangChain unrelated SVG title does not become another head publisher title',()=>{assert.equal(own(exact(html,'</body>','<svg role="img"><title>Team illustration</title><path d="M0 0"></path></svg></body>')).publisher,'LangChain')})
test('LangChain optional same-source WebPage stays compatible',()=>{assert.equal(own(schema()).publisher,'LangChain')})
test('LangChain optional same-page WebPage fragment stays compatible',()=>{assert.equal(own(schema(m=>m['@id']=HOME+'#webpage')).publisher,'LangChain')})
for(const[label,change]of[
 ['same-origin different page identifier',m=>m['@id']=HOME+'/other-source'],
 ['different same-source page publisher',m=>m.publisher.name='Other Employer'],
 ['same-source page publication withdrawal',m=>m.isPublished=false],
 ['same-source page context replacement',m=>m['@context']='https://other.example/schema'],
 ['same-source Article publication withdrawal',m=>{m['@type']='Article';m.isPublished=false}],
 ['same-source Article nested page identity',m=>{m['@type']='Article';m.mainEntityOfPage={'@type':'WebPage','@id':HOME+'/other-source'}}]
])test('LangChain optional '+label+' constrains source',()=>held(schema(change)))
test('LangChain optional publisher country metadata remains separate from vacancy countries',()=>{assert.equal(own(schema(m=>{m.country='India';m.publisher.country='India'})).publisher,'LangChain')})
export{fixture,HOME,BOARD,CLIENT,EMBED,FEED,body,html,element,exact}

for(const[label,code,positive]of [['unrelated spread','Math.max(...[,1]);',true],['unrelated apply','Math.max.apply(null,[,1]);',true],['critical global overwrite','Object.assign(...[window,,{__ashbyBaseJobBoardUrl:\'https://jobs.ashbyhq.com/other\'}]);',false]])test('LangChain v1 sparse: '+label,()=>{const args={homeHTML:exact(html,'</body>','<script>'+code+'</script></body>'),program:body(CLIENT),homeURL:HOME,boardURL:BOARD,clientURL:CLIENT};if(positive){const r=qualifyV1Consumer(args);assert.equal(r.consumerURL,EMBED)}else assert.throws(()=>qualifyV1Consumer(args),e=>e.nativeContradiction===true&&e.failureKind==='parser_or_contract_error')})
