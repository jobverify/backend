import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {readCurrentJobsPage,readCurrentConsumer,CLIENT} from './currentProtocol20261120.js'
import {qualifyCurrentRecord} from './currentPublished20261120.js'

const f=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-publication-20261120.json.gz',import.meta.url)))),body=url=>Buffer.from(f.responses.find(p=>p.requestedUrl===url).bodyBase64,'base64').toString(),html=body('https://www.salesforce.com/company/careers/jobs/?bc=DB'),client=body(CLIENT),page=()=>readCurrentJobsPage(html),record=()=>JSON.parse(body('https://a.sfdcstatic.com/digital/xsf/careers/prod/jobs_2.json')).Report_Entry.find(r=>r.Countries?.includes('India')),replace=(s,a,b)=>{assert.equal(s.split(a).length,2,'Unique genuine native mutation '+a);return s.replace(a,b)}
function attr(html,predicate,key,value){const d=document(html),rows=d.nodes(predicate);assert.equal(rows.length,1);const n=rows[0];return html.slice(0,n.start)+html.slice(n.start,n.openEnd).replace(/^<[^\s>]+/,m=>m+' '+key+'="'+value+'"')+html.slice(n.openEnd)}

test('Salesforce supplied same-role typed foreign Place cannot borrow original Countries India',()=>{const r=record();r.jobLocation={'@type':'Place',name:'Toronto Canada',address:{'@type':'PostalAddress',addressCountry:'CA',addressLocality:'Toronto'}};assert.throws(()=>qualifyCurrentRecord(r,f.observedAt),e=>e.failureKind==='parser_or_contract_error')})
test('Salesforce supplied typed India Place still checks complete Place.name and address country alternatives',()=>{const r=record();r.jobLocation=[{'@type':'Place',name:'Toronto Canada',address:{'@type':'PostalAddress',addressCountry:'IN',addressLocality:'Bangalore'}}];assert.throws(()=>qualifyCurrentRecord(r,f.observedAt),e=>e.failureKind==='parser_or_contract_error')})
test('Salesforce coherent typed India and Canada alternatives preserve their original typed objects',()=>{const r=record();r.Countries=['India','Canada'];r.Job_Requisition_Additional_Locations='Canada - Toronto; India - Pune';r.jobLocation=[{'@type':'Place',name:'Bangalore India',address:{'@type':'PostalAddress',addressCountry:'IN',addressLocality:'Bangalore'}},{'@type':'Place',name:'Toronto Canada',address:{'@type':'PostalAddress',addressCountry:'CA',addressLocality:'Toronto'}}];const result=qualifyCurrentRecord(r,f.observedAt);assert.equal(result.country,'India');assert.equal(result.originalTypedPlaces.length,2)})
for(const[label,a,b]of[
 ['actual Provider context tag','return d.jsx(dt.Provider,{value:{jobsData:t','return d.jsx("div",{value:{jobsData:t'],
 ['actual route component','component:ha','component:()=>null'],
 ['actual same-role state lookup','const n=Jr(t.jobs,e);if(n){const e=on([n]);i(e[0])}','const n=Jr([],e);if(n){const e=on([n]);i(e[0])}'],
 ['actual feed effect early return','g.useEffect(()=>{if(m.current)return;m.current=!0;','g.useEffect(()=>{if(true)return;m.current=!0;'],
 ['actual render execution argument','t.render(d.jsx(g.StrictMode,{children:d.jsx(bt,{children:d.jsx(xa,{})})}))','t.render(false&&d.jsx(g.StrictMode,{children:d.jsx(bt,{children:d.jsx(xa,{})})}))'],
 ['actual native Apply expiry','id:"js-apply-external",href:','id:"js-apply-external","data-valid-through":"2020-01-01",href:']
])test('Salesforce actual native publication semantic graph rejects '+label,()=>assert.throws(()=>readCurrentConsumer(replace(client,a,b),page(),f.observedAt),e=>e.failureKind==='parser_or_contract_error'))
for(const[label,predicate]of[['current HTML main root',n=>n.attrs.id==='main-content'],['current declared client',n=>n.tag==='script'&&n.attrs.src===CLIENT]])test('Salesforce native '+label+' current publication attributes cannot be ignored',()=>assert.throws(()=>readCurrentJobsPage(attr(html,predicate,'data-is-published','false')),e=>e.failureKind==='parser_or_contract_error'))
test('Salesforce actual Apply future literal deadline and earlier original date remain explicit consumer carriers',()=>{const changed=replace(client,'id:"js-apply-external",href:','id:"js-apply-external","data-valid-through":"2026-12-01","data-date-posted":"2020-01-01",href:'),model=readCurrentConsumer(changed,page(),f.observedAt);assert.equal(model.publications[0].calendar,'2020-01-01');assert.equal(model.deadlines[0].calendar,'2026-12-01')})
test('Salesforce malformed native Apply literal date is complete200 contract failure',()=>assert.throws(()=>readCurrentConsumer(replace(client,'id:"js-apply-external",href:','id:"js-apply-external","data-valid-through":1234,href:'),page(),f.observedAt),e=>e.failureKind==='parser_or_contract_error'))
