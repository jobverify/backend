import test from 'node:test'
import assert from 'node:assert/strict'
import {fixture,HOME,BOARD,EMBED,CLIENT,FEED,element,exact} from './currentConfiguredBoard20261120.test.js'
const collection=await import('./currentCollection20261120.js').catch(error=>error.code==='ERR_MODULE_NOT_FOUND'?{}:Promise.reject(error)),own=fixture.responses.filter(p=>p.requestedUrl===HOME)[1],html=Buffer.from(own.bodyBase64,'base64').toString('utf8'),other='https://other.example/'
const read=body=>{assert.equal(typeof collection.currentAuthority,'function','Source-specific current publisher reader required');return collection.currentAuthority(body,fixture.observedAt)}
const ldEdit=change=>element(html,n=>n.tag==='script'&&n.attrs.type==='application/ld+json',(source,node)=>{const model=JSON.parse(node.raw);change(model);return exact(source,node.raw,JSON.stringify(model).replaceAll('<','\\u003c'))})
const model=(graph,type)=>{const found=graph['@graph']?.filter(value=>value['@type']===type);assert.equal(found?.length,1,'Actual current '+type+' model');return found[0]}
const held=body=>assert.throws(()=>read(body),error=>error.nativeContradiction===true&&error.failureKind==='parser_or_contract_error')
test('Influx own actual Organization, homepage WebSite and careers WebPage bind generic Careers title to the declared client',()=>{const current=read(html);assert.equal(current.publisher,'InfluxData');assert.equal(current.home,HOME);assert.equal(current.board,BOARD);assert.equal(current.client,CLIENT);assert.equal(current.legalEmployer,null);assert.equal(current.originalDeclarations.length,1);assert.equal(current.originalContainer.attributes.id,'ashby_embed');assert.equal(current.originalPublisherModels.length,3)})
for(const[label,change]of[
 ['Organization name',graph=>model(graph,'Organization').name='Other Employer'],
 ['WebSite name',graph=>model(graph,'WebSite').name='Other Employer'],
 ['Organization URL',graph=>model(graph,'Organization').url=other],
 ['WebSite homepage URL',graph=>model(graph,'WebSite').url=other],
 ['WebPage careers URL',graph=>model(graph,'WebPage').url=other],
 ['graph context',graph=>graph['@context']='https://other.example/schema'],
 ['WebPage nested employer',graph=>model(graph,'WebPage').hiringOrganization={'@type':'Organization',name:'Other Employer'}],
 ['WebPage application alias',graph=>model(graph,'WebPage').applicationUrl=other]
])test('Influx current source-specific '+label+' contradiction is qualified',()=>held(ldEdit(change)))
test('Influx actual og:site_name cannot name a different publisher',()=>held(element(html,n=>n.tag==='meta'&&n.attrs.property==='og:site_name',(source)=>exact(source,'content="InfluxData"','content="Other Employer"'))))
test('Influx publisher country metadata does not replace explicit foreign vacancy countries',()=>{const current=read(ldEdit(graph=>{model(graph,'Organization').country='India';model(graph,'WebPage').country='India'}));assert.equal(current.publisher,'InfluxData');assert.equal(current.legalEmployer,null)})
test('Influx generic publisher page title may change while actual named publisher models remain coherent',()=>{const changed=element(html,n=>n.tag==='title',(source,node)=>exact(source,node.raw,'Current career opportunities'));assert.equal(read(changed).publisher,'InfluxData')})
test('Influx coherent publisher graph property order is retained without build pins',()=>{const current=read(ldEdit(graph=>graph['@graph']=graph['@graph'].map(value=>Object.fromEntries(Object.entries(value).reverse()))));assert.equal(current.originalPublisherModels.length,3)})
test('Influx actual og publisher can qualify current own authority when optional structured metadata is absent',()=>{const changed=element(html,n=>n.tag==='script'&&n.attrs.type==='application/ld+json',()=>'<script type="application/ld+json">{}</script>');assert.equal(read(changed).publisher,'InfluxData')})
test('Influx actual named publisher graph can qualify own authority when optional OG site name is absent',()=>{const changed=element(html,n=>n.tag==='meta'&&n.attrs.property==='og:site_name',()=>'<meta name="description" content="Current careers">');assert.equal(read(changed).publisher,'InfluxData')})
test('Influx generic title alone cannot qualify unnamed publisher authority',()=>{let changed=element(html,n=>n.tag==='script'&&n.attrs.type==='application/ld+json',()=>'<script type="application/ld+json">{}</script>');changed=element(changed,n=>n.tag==='meta'&&n.attrs.property==='og:site_name',()=>'<meta name="description" content="Current careers">');held(changed)})
const body=url=>Buffer.from(fixture.responses.filter(response=>response.requestedUrl===url)[1].bodyBase64,'base64').toString('utf8'),readBoard=()=>{assert.equal(typeof collection.currentBoard,'function','Current native board reader required');return collection.currentBoard(body(EMBED),EMBED,fixture.observedAt)}
test('Influx actual embed consumer retains the case-sensitive public account and eight native roles',()=>{const current=readBoard();assert.equal(current.model.organization.hostedJobsPageSlug,'Influxdata');assert.equal(current.rows.length,8);assert.equal(current.organizationBinding.name,'InfluxData');assert.equal(current.organizationBinding.slug,'Influxdata')})
test('Influx actual documented feed binds every listed identity and foreign workplace to the embed collection',()=>{assert.equal(typeof collection.currentFeed,'function','Current native feed reader required');const current=collection.currentFeed(body(FEED),readBoard(),fixture.observedAt);assert.equal(current.rows.length,8);assert(current.rows.every(row=>row.countries.length&&row.countries.every(country=>country!=='India')));assert.deepEqual(current.rows.map(row=>row.id).sort(),current.model.jobs.filter(row=>row.isListed).map(row=>row.id).sort())})
