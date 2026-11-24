import test from 'node:test'
import assert from 'node:assert/strict'
import {parse} from 'acorn'
import {createHash} from 'node:crypto'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {run} from './script.js'
import './currentOwnBoundary20261121.test.js'
import {fixture,replay} from './currentConfiguredBoard20261121.test.js'
const sha=b=>createHash('sha256').update(b).digest('hex')
const HOME=fixture.home,BOARD=fixture.nativePublicBase,FEED=fixture.feedURL,OTHER='https://other.example/apply'
const body=row=>Buffer.from(row.bodyBase64,'base64').toString('utf8')
let originalBytes=0
for(const row of fixture.responses){const b=Buffer.from(row.bodyBase64,'base64');assert.equal(b.length,row.bytes);assert.equal(sha(b),row.sha256);assert.equal(row.status,200);assert.equal(row.method,'GET');assert.equal(row.redirected,false);originalBytes+=b.length}
assert.equal(fixture.responses.length,16);assert.equal(originalBytes,4456980)
const originalFeed=JSON.parse(body(fixture.responses.find(row=>row.requestedUrl===FEED))),first=originalFeed.jobs[0],typed=originalFeed.jobs.find(row=>row.address?.postalAddress?.addressCountry==='United States'),australia=originalFeed.jobs.find(row=>/Australia/.test(row.title)&&/Asia-Pacific/.test(row.location))
const ROLE=HOME+'/'+australia.id
const program=fixture.responses.find(row=>/\/_next\/.+\.js(?:\?|$)/.test(row.requestedUrl)&&body(row).includes('ashby-embed-script'))
assert(program,'Actual original connected application programme')
const PROGRAM=program.requestedUrl
const walk=n=>[n,...n.children.filter(c=>typeof c!=='string').flatMap(walk)]
const exact=(s,old,value)=>{assert.equal(s.split(old).length,2,'Unique original carrier');assert.notEqual(old,value);return s.replace(old,()=>value)}
function element(html,predicate,change){const d=document(html),nodes=walk(d.root).filter(n=>predicate(n,d));assert.equal(nodes.length,1,'One original carrier');const n=nodes[0],old=d.outer(n),next=change(old,n,d);assert.notEqual(old,next);return html.slice(0,n.start)+next+html.slice(n.end)}
function jsonScript(html,predicate,change){return element(html,predicate,(s,n)=>{const model=JSON.parse(n.raw);change(model);return exact(s,n.raw,JSON.stringify(model).replaceAll('<','\\u003c'))})}
const closing=(url,change)=>(q,u,n)=>{if(u===url&&n===1)q.text=change(q.text)}
const feed=(change,id=first.id,both=false)=>(q,u,n)=>{if(u===FEED&&(both||n===1)){const m=JSON.parse(q.text),row=m.jobs.find(r=>r.id===id);assert(row);change(row,m);q.text=JSON.stringify(m)}}
const own=change=>closing(HOME,html=>jsonScript(html,n=>n.tag==='script'&&n.attrs.id==='__NEXT_DATA__',change))
const roleModel=change=>closing(ROLE,html=>jsonScript(html,n=>n.tag==='script'&&n.attrs.id==='__NEXT_DATA__',m=>change(m.props.pageProps.posting)))
const ownHTML=change=>closing(HOME,change)
function syntax(source){const tree=parse(source,{ecmaVersion:'latest'}),parents=new Map(),nodes=[];function visit(n,p){if(!n||typeof n!=='object'||typeof n.type!=='string')return;nodes.push(n);if(p)parents.set(n,p);for(const v of Object.values(n))for(const c of Array.isArray(v)?v:[v])if(c&&typeof c==='object'&&typeof c.type==='string')visit(c,n)}visit(tree);return{tree,parents,nodes}}
function ancestor(ast,node,predicate){for(let n=ast.parents.get(node);n;n=ast.parents.get(n))if(predicate(n))return n;assert.fail('Original connected ancestor absent')}
function programme(change){return closing(PROGRAM,source=>{const ast=syntax(source),updated=change(source,ast);assert.notEqual(updated,source);parse(updated,{ecmaVersion:'latest'});return updated})}
function range(source,node,value){return source.slice(0,node.start)+value+source.slice(node.end)}
function consumerReturn(source,ast,wrap){const marker=ast.nodes.filter(n=>n.type==='Literal'&&n.value==='ashby-embed-script');assert.equal(marker.length,1);const result=ancestor(ast,marker[0],n=>n.type==='ReturnStatement');return range(source,result.argument,'('+wrap(source.slice(result.argument.start,result.argument.end))+')')}
function settingAssignment(ast){const nodes=ast.nodes.filter(n=>n.type==='AssignmentExpression'&&n.left.type==='MemberExpression'&&(n.left.property.name??n.left.property.value)==='__Ashby');assert.equal(nodes.length,1);return nodes[0]}
const cases=[],add=(name,expected,change)=>cases.push({name,expected,change})
add('Original full source run preserves all16 responses and84 listed rows','configured-empty')
add('Current branded title wording is not pinned','configured-empty',ownHTML(html=>element(html,n=>n.tag==='title',(s,n)=>s.slice(0,n.openEnd-n.start)+'Explore Careers | Hightouch</title>')))
add('Unrelated SVG title cannot replace publisher title','configured-empty',ownHTML(html=>exact(html,'</body>','<svg><title>Team illustration</title></svg></body>')))
add('Unrelated current analytics remain separate','configured-empty',ownHTML(html=>exact(html,'</body>','<script>Object.assign(window,{independentAnalytics:{version:11}});</script></body>')))
add('Original resource release comments are unpinned','configured-empty',(q,u)=>{if(u===PROGRAM)q.text+='\n// independent release comment\n'})
add('Closing documented rows can reorder','configured-empty',feed((_r,m)=>m.jobs.reverse()))
add('Corporate typed India does not become a vacancy location','configured-empty',own(m=>{m.props.pageProps.country='India'}))
add('Coherent typed North America primary remains explicit','configured-empty',feed(r=>{r.address.postalAddress.addressCountry='United States'},first.id,true))
add('Coherent typed Australia agrees with original exclusive criteria','configured-empty',feed(r=>{r.address.postalAddress.addressCountry='Australia'},australia.id,true))
add('True connected fallback return remains valid','configured-empty',programme((s,a)=>consumerReturn(s,a,x=>'true&&('+x+')')))
add('Connected fallback sequence retains its actual result','configured-empty',programme((s,a)=>consumerReturn(s,a,x=>'(0,('+x+'))')))
for(const[name,code]of[
 ['false conjunction removes actual fallback','false&&'],
 ['false conditional removes actual fallback','false?']
])add(name,'hold',programme((s,a)=>consumerReturn(s,a,x=>code==='false?'?'false?('+x+'):null':'false&&('+x+')')))
add('Settings assignment behind false branch is unreachable','hold',programme((s,a)=>{const n=settingAssignment(a);return range(s,n,'false&&('+s.slice(n.start,n.end)+')')}))
add('Settings effect call behind false branch is unreachable','hold',programme((s,a)=>{const n=settingAssignment(a),callback=ancestor(a,n,v=>['FunctionExpression','ArrowFunctionExpression'].includes(v.type)),call=a.parents.get(callback);assert.equal(call.type,'CallExpression');return range(s,call,'(false&&('+s.slice(call.start,call.end)+'))')}))
add('Unknown hook owner cannot supply connected effect','hold',programme((s,a)=>{const n=settingAssignment(a),callback=ancestor(a,n,v=>['FunctionExpression','ArrowFunctionExpression'].includes(v.type)),call=a.parents.get(callback);const callee=call.callee.type==='SequenceExpression'?call.callee.expressions.at(-1):call.callee;assert.equal(callee.type,'MemberExpression');return range(s,callee.object,'unqualifiedHookOwner')}))
for(const[name,change]of[
 ['India secondary',r=>r.secondaryLocations.push({location:'India',address:{postalAddress:{addressCountry:'India'}}})],
 ['unresolved secondary',r=>r.secondaryLocations.push({location:'Remote (APAC)',address:{postalAddress:{}}})],
 ['contradictory typed primary India',r=>r.address.postalAddress.addressCountry='India'],
 ['contradictory typed Country code',r=>r.address.postalAddress.addressCountry={'@type':'Country',name:'United States',identifier:'IN'}],
 ['role country alias India',r=>r.workCountry='India'],
 ['typed extra India work location',r=>r.workLocations=[{'@type':'Place',address:{'@type':'PostalAddress',addressCountry:'India'}}]],
 ['native publication withdrawn',r=>r.isPublished=false],
 ['native role closed',r=>r.status='closed'],
 ['native expiry passed',r=>r.validThrough='2001-01-01'],
 ['native publication future',r=>r.datePosted='2099-01-01'],
 ['native application alias changed',r=>r.applicationURI=OTHER],
 ['native employer changed',r=>r.employerName='Other Employer'],
 ['native employer identity URI contradicts name',r=>r.hiringOrganization={'@type':'Organization',name:'Hightouch',url:'https://other.example/'}],
 ['native eligible India',r=>r.eligibleRegion={'@type':'Country',name:'India'}],
 ['native hidden role criteria',r=>{r.descriptionHtml+='<section hidden><p>Country: India</p></section>'}],
 ['native split semantic India',r=>{r.descriptionHtml+='<section><label>Country</label><span>India</span></section>'}],
 ['native multiword itemprop India',r=>{r.descriptionHtml+='<span itemprop="country workCountry">India</span>'}],
 ['native current place aliases India',r=>{r.address.postalAddress.countryCode='IN'}]
])add(name+' constrains advertised exclusion','hold',feed(change))
for(const line of['This role is open to applicants worldwide.','Candidates based in India may apply.','You may work remotely from India.','This position can be performed remotely from India.','Applicants may work from anywhere.','You can be based in India.','Location: Remote (APAC)','Workplace: Anywhere in the world','Based in Mumbai, India'])add('Authored scope: '+line,'hold',feed(r=>{r.descriptionHtml+='<p>'+line+'</p>'}))
for(const[name,change]of[
 ['inactive state',m=>{m.props.pageProps.isPublished=false}],
 ['changed employer',m=>{m.props.pageProps.employer='Other Employer'}],
 ['withdrawn row',m=>{m.props.pageProps.jobPostings.find(r=>r.id===first.id).isPublished=false}],
 ['row application alias',m=>{m.props.pageProps.jobPostings.find(r=>r.id===first.id).applicationUrl=OTHER}],
 ['row country contradiction',m=>{m.props.pageProps.jobPostings.find(r=>r.id===first.id).country='India'}]
])add('Own current '+name+' constrains authority','hold',own(change))
for(const[name,change]of[
 ['own role unpublished',p=>{p.isPublished=false}],
 ['own role expired',p=>{p.validThrough='2001-01-01'}],
 ['own role application alias',p=>{p.applicationURI=OTHER}],
 ['own role employer',p=>{p.company='Other Employer'}]
])add(name+' constrains paired criteria','hold',roleModel(change))
for(const[label,attribute]of[['hidden','hidden'],['disabled','aria-disabled="true"'],['country','data-country="India"'],['employer','data-employer="Other Employer"'],['application','data-application-url="'+OTHER+'"']])add('Actual own JSON carrier '+label+' is constrained','hold',ownHTML(html=>element(html,n=>n.tag==='script'&&n.attrs.id==='__NEXT_DATA__',(s,n)=>s.slice(0,n.openEnd-n.start-1)+' '+attribute+'>'+s.slice(n.openEnd-n.start))))
add('Typed USA cannot contradict Australia original criteria','hold',feed(r=>{r.address.postalAddress.addressCountry='United States'},australia.id,true))
add('Unknown all-country primary remains unresolved','hold',feed(r=>{r.address.postalAddress.addressCountry='Atlantis'}))
add('Native positive India without advertised foreign proof is held','hold',feed(r=>{r.location='Bengaluru, India';r.address.postalAddress.addressCountry='India'}))
assert(typed)
for(const item of cases)test('Root independent Hightouch: '+item.name,async()=>{if(item.expected==='hold'){await assert.rejects(replay(item.change,{},run),e=>e.nativeContradiction===true&&e.failureKind==='parser_or_contract_error');return}const result=await replay(item.change,{},run);assert.equal(result.jobs.length,0);assert.equal(result.calls.length,20);assert.equal(result.evidence.status,'complete-inventory');assert.equal(result.assessment.runnerOutcome.success,true);assert.equal(result.assessment.zeroJobEvidence,'fetched-zero');assert.equal(result.assessment.cleanupOptions.replaceExisting,false);for(const key of ['sourceScopeComplete','lifecycleCleanupAllowed'])assert.equal(result.audit[key],false);for(const key of ['companyIndiaTotal','companyGlobalTotal'])assert.equal(result.audit[key],null)})
