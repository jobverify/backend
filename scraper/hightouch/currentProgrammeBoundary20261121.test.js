import test from 'node:test'
import assert from 'node:assert/strict'
import {replay,empty,held,fixture,HOME,BOARD,AUPAGE,SGPAGE,FEED,AU,SG,close,element,exact,attr} from './currentConfiguredBoard20261121.test.js'
const programmes=fixture.responses.filter(p=>p.phase==='opening'&&p.kind==='actual-own-declared-role-programme'),PAGE=programmes.find(p=>p.bytes<10000).requestedUrl,APPLICATION=programmes.find(p=>p.bytes>10000).requestedUrl,MANIFEST=fixture.responses.find(p=>p.kind==='actual-own-role-declared-next-build-manifest').requestedUrl
for(const[label,url,from,to]of[
 ['route registration owner',PAGE,'/careers/[slug]','/about/[slug]'],
 ['route callback is disconnected',PAGE,'()=>t.r(283088)','()=>null'],
 ['actual page module exits before export',PAGE,'283088,t=>{"use strict";','283088,t=>{"use strict";return;'],
 ['page own posting identity is discarded',PAGE,'jobPostingId:t.id','jobPostingId:"other-role"'],
 ['page own application value is discarded',PAGE,'applyLink:t.applyLink','applyLink:"https://other.invalid/job"'],
 ['page application module identity is disconnected',PAGE,'n=t.i(100094)','n=t.i(999999999)'],
 ['actual application component exits before rendering',APPLICATION,'function({jobPostingId:e,applyLink:A}){','function({jobPostingId:e,applyLink:A}){return null;'],
 ['same actual public fallback application differs',APPLICATION,'href:A,target:"_blank"','href:"https://other.invalid/job",target:"_blank"'],
 ['same current native account base differs',APPLICATION,'h=`${d}/hightouch-inc`','h=`${d}/other`'],
 ['declared form mode differs',APPLICATION,'displayMode:"application-form-only"','displayMode:"job-board"'],
 ['actual same-role settings identity differs',APPLICATION,'displayMode:"application-form-only",jobPostingId:e','displayMode:"application-form-only",jobPostingId:"other-role"'],
 ['actual same-role container identity differs',APPLICATION,'"data-jid":e','"data-jid":"other-role"'],
 ['actual same-base embed script differs',APPLICATION,'src:`${h}/embed?version=2`','src:"https://other.invalid/embed"']
])test('Actual connected own '+label+' cannot qualify same native account',async()=>{await held(close(url,s=>exact(s,from,to)))})
test('Current module and nested own posting aliases are not source pins',async()=>{await empty(close(PAGE,s=>{const next=s.replace(/\bt\b/g,'currentOwnAlias');assert.notEqual(next,s);return next}))})
test('Current active role programme withdrawal is qualified at its actual HTML carrier',async()=>{await held(close(AUPAGE,s=>element(s,n=>n.tag==='script'&&n.attrs.src&&new URL(n.attrs.src,AUPAGE).href===PAGE,(raw,node)=>attr(raw,node,'data-is-published="false"'))))})
test('Current role programme data-block carrier cannot invoke current module',async()=>{await held(close(AUPAGE,s=>element(s,n=>n.tag==='script'&&n.attrs.src&&new URL(n.attrs.src,AUPAGE).href===PAGE,(raw,node)=>attr(raw,node,'type="application/json"'))))})
test('Current own Next data authority cannot be withdrawn and reused',async()=>{await held(close(HOME,s=>element(s,n=>n.tag==='script'&&n.attrs.id==='__NEXT_DATA__',(raw,node)=>attr(raw,node,'data-is-published="false"'))))})
test('Current own role complete criteria cannot be replaced by unrelated hidden text',async()=>{await held(close(AUPAGE,s=>s.replaceAll('Located in Australia','Located in Australia<span hidden>or India</span>')))})
for(const[tag,url,from,to]of[['Australia',AUPAGE,'Located in Australia','Current technical skills'],['Singapore',SGPAGE,'based in Singapore','working remotely']])test('Coherent own and native '+tag+' country requirement removal leaves APAC unresolved',async()=>{await held((q,u,n)=>{if(n!==1)return;if(u===url){assert(q.text.includes(from));q.text=q.text.replaceAll(from,to)}if(u===FEED){const m=JSON.parse(q.text),r=m.jobs.find(r=>r.id===(url===AUPAGE?AU.id:SG.id));assert(r.descriptionHtml.includes(from)&&r.descriptionPlain.includes(from));r.descriptionHtml=r.descriptionHtml.replaceAll(from,to);r.descriptionPlain=r.descriptionPlain.replaceAll(from,to);q.text=JSON.stringify(m)}})})
test('Current route bootstrap cannot be replaced with disconnected module IDs',async()=>{await held(close(MANIFEST,s=>{const from='"runtimeModuleIds":[179716,890920]';assert(s.includes(from));return s.replace(from,'"runtimeModuleIds":[179716,999999999]')}))})
test('Disconnected matching route text in comments is not actual route registration',async()=>{await held(close(PAGE,s=>exact(s,'/careers/[slug]','/about/[slug]')+'\n// /careers/[slug] same historical text\n'))})
test('Current filtered application programme is retained as form-only metadata and never inventory',async()=>{const r=await empty();for(const o of r.audit.observations){assert.equal(o.ownHandoff.displayMode,'application-form-only');assert.equal(o.ownHandoff.unfilteredInventory,false);assert.equal(o.ownHandoff.programmesExecuted,false);assert.equal(o.ownHandoff.publicJobBase,BOARD)}assert(r.calls.every(c=>!c.url.includes('/embed?version=2')&&!c.url.includes('/application')))})
function ownHeadTitle(html,value){const start=html.search(/<head\b[^>]*>/i),end=html.toLowerCase().indexOf('</head>',start);assert(start>=0&&end>start);return element(html,n=>n.tag==='title'&&n.start>=start&&n.start<end,(raw,n)=>raw.slice(0,n.openEnd-n.start)+value+raw.slice(raw.toLowerCase().lastIndexOf('</title')))}
test('Actual own HEAD cannot name a foreign employer despite matching other publisher metadata',async()=>{await held(close(HOME,s=>ownHeadTitle(s,'Careers at Other Employer')))})
test('Flexible actual own branded career HEAD wording is not a complete title pin',async()=>{await empty(close(HOME,s=>ownHeadTitle(s,'Explore careers at Hightouch')))})
test('Actual generic OG career wording is qualified as generic rather than skipped',async()=>{await empty(close(HOME,s=>element(s,n=>n.tag==='meta'&&n.attrs.property==='og:title',raw=>exact(raw,'content="Careers"','content="Current job openings"'))))})
test('Actual generic own OG title cannot name another employer',async()=>{await held(close(HOME,s=>element(s,n=>n.tag==='meta'&&n.attrs.property==='og:title',raw=>exact(raw,'content="Careers"','content="Careers at Other Employer"'))))})
test('Actual own OG title cannot be unrelated advertising despite current branded HEAD',async()=>{await held(close(HOME,s=>element(s,n=>n.tag==='meta'&&n.attrs.property==='og:title',raw=>exact(raw,'content="Careers"','content="Other Employer news and events"'))))})
test('A coherent additional typed primary workplace does not invent the missing original country',async()=>{const r=await empty((q,u,n)=>{if(u!==FEED||n!==1)return;const m=JSON.parse(q.text),row=m.jobs.find(r=>r.location==='Remote (North America)'&&Object.keys(r.address.postalAddress).length===0);assert(row);row.workLocation={'@type':'Place',address:{'@type':'PostalAddress',addressCountry:'United States'}};q.text=JSON.stringify(m)});assert.equal(r.audit.observations[1].rows.find(row=>row.originalRecord.workLocation).primaryCountry,null)})
export{PAGE,APPLICATION,MANIFEST}
