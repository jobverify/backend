import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'

const missing=error=>error.code==='ERR_MODULE_NOT_FOUND'?{}:Promise.reject(error)
const api={...await import('./currentPublisher20261120.js').catch(missing),...await import('./currentCollection20261120.js').catch(missing)}
const fixture=JSON.parse(gunzipSync(await fs.readFile(new URL('./fixtures/current-native-20261120.json.gz',import.meta.url))))
const HOME='https://www.redpanda.com/jobs',BOARD='https://jobs.ashbyhq.com/redpanda-data',FEED='https://api.ashbyhq.com/posting-api/job-board/redpanda-data'
const body=(url,phase=1)=>Buffer.from(fixture.responses.filter(row=>row.requestedUrl===url)[phase].bodyBase64,'base64').toString('utf8')
const html=body(HOME),walk=node=>[node,...node.children.filter(child=>typeof child!=='string').flatMap(walk)]
const exact=(source,old,value)=>{assert.equal(source.split(old).length,2,'Unique genuine Redpanda carrier');assert.notEqual(old,value);return source.replace(old,()=>value)}
function element(source,predicate,change){const d=document(source),nodes=walk(d.root).filter(node=>predicate(node,d));assert.equal(nodes.length,1,'One actual current Redpanda carrier');const node=nodes[0],old=d.outer(node),value=change(old,node,d);assert.notEqual(old,value);return source.slice(0,node.start)+value+source.slice(node.end)}
const attribute=(source,node,value)=>source.slice(0,node.openEnd-node.start-1)+' '+value+'>'+source.slice(node.openEnd-node.start)
const own=value=>{assert.equal(typeof api.currentAuthority,'function','Current own publisher and connected feed consumer required');return api.currentAuthority(value,fixture.observedAt)}
const held=value=>assert.throws(()=>own(value),error=>error.nativeContradiction===true&&error.failureKind==='parser_or_contract_error')
const program=(value,change)=>element(value,node=>node.tag==='script'&&!node.attrs.src&&(node.raw??'').includes("var ASHBY_BOARD = 'redpanda-data';"),(source,node)=>exact(source,node.raw,change(node.raw)))

test('Redpanda four genuine original responses retain all580228bytes',()=>{assert.equal(fixture.responses.length,4);let bytes=0;for(const row of fixture.responses){const data=Buffer.from(row.bodyBase64,'base64');assert.equal(createHash('sha256').update(data).digest('hex'),row.sha256);assert.equal(data.length,row.bytes);assert.equal(row.status,200);assert.equal(row.redirected,false);assert.equal(row.method,'GET');bytes+=data.length}assert.equal(bytes,580228)})
for(const phase of[0,1])test('Redpanda actual '+(phase===0?'opening':'closing')+' own publisher reaches its connected documented unfiltered feed',()=>{const authority=own(body(HOME,phase));assert.equal(authority.publisher,'Redpanda');assert.equal(authority.home,HOME);assert.equal(authority.board,BOARD);assert.equal(authority.feed,FEED);assert.equal(authority.legalEmployer,null);assert.equal(authority.originalPublisherModels.length,3);assert.ok(authority.consumerProof.connected);assert.equal(authority.consumerProof.nativeProgramsExecuted,false)})
for(const[label,old,value]of[
 ['native account replacement',"var ASHBY_BOARD = 'redpanda-data';","var ASHBY_BOARD = 'other';"],
 ['event disconnect',"document.addEventListener('DOMContentLoaded'","document.addEventListener('never-current-careers'"],
 ['initialization disconnect','  init();','  void init;'],
 ['fetch call disconnect','    fetchJobs();','    void fetchJobs;'],
 ['feed origin replacement',"fetch('https://api.ashbyhq.com/posting-api/job-board/'","fetch('https://other.example/posting-api/job-board/'"],
 ['parsed jobs disconnect','ALL_JOBS = data.jobs.filter','ALL_JOBS = otherData.jobs.filter'],
 ['listed publication inversion','return j.isListed !== false;','return j.isListed === false;'],
 ['filter state disconnect','var filtered = ALL_JOBS.filter','var filtered = otherJobs.filter'],
 ['render consumer disconnect','    render(groupByDepartment(filtered));','    void groupByDepartment(filtered);'],
 ['native URL model disconnect','url: job.jobUrl','url: job.otherUrl'],
 ['actual template link disconnect','link.href = job.url','link.href = job.otherUrl'],
 ['actual template title disconnect','title.textContent = job.title','title.textContent = job.otherTitle'],
 ['actual list effect disconnect','list.appendChild(item);','list.appendChild(otherItem);'],
 ['actual container effect disconnect','container.appendChild(deptEl);','container.appendChild(otherDepartment);'],
 ['unreachable initializer','  init();','  if (false) init();']
])test('Redpanda connected consumer constrains '+label,()=>held(program(html,source=>exact(source,old,value))))
for(const[label,code]of[
 ['mutable native account',"ASHBY_BOARD = 'other';"],
 ['mutable collection','ALL_JOBS = [];'],
 ['collection array mutation','ALL_JOBS.splice(0);'],
 ['collection property mutation','ALL_JOBS.length = 0;'],
 ['collection alias mutation','var changedJobs = ALL_JOBS; changedJobs.pop();']
])test('Redpanda actual closure state constrains '+label,()=>held(program(html,source=>exact(source,'  init();','  '+code+'\n  init();'))))
test('Redpanda unrelated analytics preserve actual connected publication',()=>{const changed=program(html,source=>exact(source,'  init();','  var unrelatedAnalytics={version:7}; void unrelatedAnalytics; Math.max(...[,1]);\n  init();'));assert.equal(own(changed).feed,FEED)})
test('Redpanda generic heading remains bound to its actual branded head publisher',()=>{assert.equal(own(element(html,node=>node.tag==='h1',(source,node)=>source.slice(0,node.openEnd-node.start)+'Current opportunities</h1>')).publisher,'Redpanda')})
test('Redpanda actual canonical cannot identify another publisher',()=>held(element(html,node=>node.tag==='link'&&node.attrs.rel==='canonical',(source,node)=>exact(source,node.attrs.href,'https://other.example/jobs'))))
test('Redpanda actual OG title cannot identify another publisher',()=>held(element(html,node=>node.tag==='meta'&&node.attrs.property==='og:title',source=>{const matches=[...source.matchAll(/\bcontent\s*=\s*(?:"[^"]*"|'[^']*')/g)];assert.equal(matches.length,1);return exact(source,matches[0][0],'content="Careers at Other Employer"')})))
test('Redpanda actual own heading employer conflict constrains collection',()=>held(element(html,node=>node.tag==='h1',(source,node)=>attribute(source,node,'data-employer="Other Employer"'))))
for(const type of['application/json','text/plain'])test('Redpanda actual consumer data-only '+type+' is inactive',()=>held(element(html,node=>node.tag==='script'&&(node.raw??'').includes("var ASHBY_BOARD = 'redpanda-data';"),(source,node)=>attribute(source,node,'type="'+type+'"'))))
test('Redpanda actual mixed-case classic JavaScript MIME remains active',()=>{const changed=element(html,node=>node.tag==='script'&&(node.raw??'').includes("var ASHBY_BOARD = 'redpanda-data';"),(source,node)=>attribute(source,node,'type="Text/JavaScript"'));assert.equal(own(changed).feed,FEED)})
test('Redpanda unrelated SVG title remains separate from its actual head title',()=>{assert.equal(own(exact(html,'</body>','<svg><title>Team illustration</title></svg></body>')).publisher,'Redpanda')})
for(const phase of[0,1])test('Redpanda current '+phase+' documented feed preserves12foreign listed identities and raw criteria',()=>{assert.equal(typeof api.currentFeed,'function','Current declared feed reader required');const current=api.currentFeed(body(FEED,phase),own(body(HOME,phase)),fixture.observedAt);assert.equal(current.rows.length,12);assert.ok(current.rows.every(row=>row.countries.length&&row.countries.every(country=>country!=='India')));assert.ok(current.rows.every(row=>row.originalRecord.descriptionHtml&&row.originalCriteria.originalPlain))})

export{fixture,HOME,BOARD,FEED,body,html,walk,exact,element,attribute,program}
