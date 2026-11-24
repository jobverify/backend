import test from 'node:test'
import assert from 'node:assert/strict'
import {replay,fixture,HOME,BOARD,FEED,close,element,exact,attr} from './currentConfiguredBoard20261120.test.js'
const ROOT='https://www.contrastsecurity.com/',other='https://other.example/',schema=()=>({'@context':'https://schema.org','@graph':[{'@type':'Organization','@id':ROOT+'#organization',name:'Contrast Security',url:ROOT},{'@type':'WebSite','@id':ROOT+'#website',name:'Contrast Security',url:ROOT},{'@type':'WebPage','@id':HOME+'#webpage',name:'Current careers at Contrast Security',url:HOME}]}),type=(graph,name)=>{const model=graph['@graph'].find(value=>value['@type']===name);assert(model);return model}
const structured=change=>close(HOME,html=>{const model=schema();change?.(model);return exact(html,'</head>','<script type="application/ld+json">'+JSON.stringify(model).replaceAll('<','\\u003c')+'</script></head>')})
async function qualified(change){const result=await replay(change);assert.equal(result.jobs.length,0);assert.equal(result.assessment.zeroJobEvidence,'fetched-zero');assert.equal(result.assessment.runnerOutcome.success,true);assert.equal(result.audit.companyIndiaTotal,null);assert.equal(result.audit.sourceScopeComplete,false);assert.equal(result.assessment.cleanupOptions.replaceExisting,false);return result}
async function held(change){await assert.rejects(replay(change),error=>error.nativeContradiction===true&&error.failureKind==='parser_or_contract_error')}

test('Contrast exact current two unfiltered declarations remain distinct from three filtered navigation links',async()=>{const result=await qualified(),authority=result.audit.observations[0].authority;assert.equal(authority.publisher,'Contrast Security');assert.equal(authority.originalDeclarations.length,2);assert.equal(authority.originalFilteredNavigation.length,3);assert(authority.originalDeclarations.every(link=>link.attributes.href===BOARD));assert(authority.originalFilteredNavigation.every(link=>new URL(link.attributes.href).searchParams.has('departmentId')));assert.equal(authority.legalEmployer,null)})

test('Contrast catalog source key and public native slug retain their actual distinct identities',async()=>{const result=await qualified();assert.equal(result.audit.source,'contrastsecurity');assert.equal(result.audit.observations[0].board.organizationBinding.slug,'contrast-security');assert.equal(result.audit.nativeOpeningInventory.length,1);assert.equal(result.calls.filter(call=>call.url===FEED).length,2);assert.equal(fixture.source,'contrastsecurity')})

test('Contrast filtered department navigation alone cannot prove an unfiltered current handoff',async()=>{await held(close(HOME,html=>{assert.equal(html.split('href="'+BOARD+'"').length,3);return html.replaceAll('href="'+BOARD+'"','href="#unavailable-current-board"')}))})

test('Contrast an actual unfiltered declaration cannot silently bind another employer account',async()=>{await held(close(HOME,html=>element(html,node=>node.tag==='a'&&node.attrs.href===BOARD,value=>exact(value,BOARD,'https://jobs.ashbyhq.com/other-employer'),{first:true})))})

test('Contrast current filtered account navigation cannot contradict the unfiltered publisher account',async()=>{await held(close(HOME,html=>element(html,node=>node.tag==='a'&&node.attrs.href?.startsWith(BOARD+'?departmentId='),value=>exact(value,BOARD,'https://jobs.ashbyhq.com/other-employer'),{first:true})))})

test('Contrast department navigation identifiers are not roster or build pins',async()=>{await qualified(close(HOME,html=>element(html,node=>node.tag==='a'&&node.attrs.href?.startsWith(BOARD+'?departmentId='),(value,node)=>{const url=new URL(node.attrs.href);url.searchParams.set('departmentId','11111111-2222-3333-4444-555555555555');return exact(value,node.attrs.href,url.href)},{first:true})))})

test('Contrast talent community prose does not supply vacancy workplace geography',async()=>{await qualified(close(HOME,html=>element(html,node=>node.tag==='a'&&node.attrs.href===BOARD+'/form/talent-community-sign-up',value=>value.replace(/>[^<]*</,'>India talent community<'),{first:true})))})

test('Contrast actual branded title cannot change to another publisher',async()=>{await held(close(HOME,html=>element(html,node=>node.tag==='title',(value,node)=>exact(value,node.raw,'Careers at Other Employer'))))})

test('Contrast actual own OpenGraph publisher title cannot name another employer',async()=>{await held(close(HOME,html=>element(html,node=>node.tag==='meta'&&node.attrs.property==='og:title',(value,node)=>exact(value,node.attrs.content,'Careers at Other Employer'))))})

test('Contrast actual own OpenGraph publisher title can change coherently without release pins',async()=>{await qualified(close(HOME,html=>element(html,node=>node.tag==='meta'&&node.attrs.property==='og:title',(value,node)=>exact(value,node.attrs.content,'Explore careers at Contrast Security'))))})

test('Contrast coherent optional own Organization WebSite and WebPage metadata remains current data',async()=>{const result=await qualified(structured());assert.equal(result.audit.observations[1].authority.originalPublisherModels.length,3)})

for(const[label,change]of[
 ['Organization name',graph=>type(graph,'Organization').name='Other Employer'],
 ['WebSite name',graph=>type(graph,'WebSite').name='Other Employer'],
 ['WebPage name',graph=>type(graph,'WebPage').name='Careers at Other Employer'],
 ['Organization homepage',graph=>type(graph,'Organization').url=other],
 ['WebSite homepage',graph=>type(graph,'WebSite').url=other],
 ['WebPage careers page',graph=>type(graph,'WebPage').url=other],
 ['schema context',graph=>graph['@context']='https://other.example/schema'],
 ['WebPage employer',graph=>type(graph,'WebPage').hiringOrganization={'@type':'Organization',name:'Other Employer'}],
 ['WebPage publication',graph=>type(graph,'WebPage').isPublished=false],
 ['WebPage application alias',graph=>type(graph,'WebPage').applicationUrl=other]
])test('Contrast optional current '+label+' cannot contradict the known publisher',async()=>{await held(structured(change))})

test('Contrast publisher HQ country does not replace the role explicit United States workplace',async()=>{const result=await qualified(structured(graph=>{type(graph,'Organization').country='India';type(graph,'WebPage').country='India'}));assert(result.audit.foreignObservations.every(row=>row.countries.includes('United States')));assert.equal(result.audit.companyGlobalTotal,null)})

test('Contrast optional publisher property order is not a current release pin',async()=>{await qualified(structured(graph=>graph['@graph']=graph['@graph'].map(value=>Object.fromEntries(Object.entries(value).reverse()))))})

test('Contrast optional current publisher schema qualifies its actual executable-data carrier',async()=>{await held((q,url,visit)=>{if(url!==HOME||visit!==1)return;const html=exact(q.text,'</head>','<script type="application/ld+json">'+JSON.stringify(schema())+'</script></head>');q.text=element(html,node=>node.tag==='script'&&node.attrs.type==='application/ld+json',(value,node)=>attr(value,node,'data-is-published="false"'))})})
