import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {runCurrentPublished,SEARCH} from './currentPublished20261120.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-publication-20261120.json.gz',import.meta.url)))),FIRST='https://bloomberg.avature.net/careers/JobDetail/Market-Specialist-Commodities/16486',ID='16486',TITLE='Market Specialist, Commodities'
function alter(html,predicate,attributes,raw=false){const d=document(html),all=n=>[n,...n.children.filter(c=>typeof c!=='string').flatMap(all)],nodes=(raw?all(d.root):d.nodes(()=>true)).filter(n=>predicate(n,d));assert.equal(nodes.length,1,'Actual unique native carrier');const n=nodes[0];return html.slice(0,n.openEnd-1)+' '+attributes+'>'+html.slice(n.openEnd)}
function location(html,value){const d=document(html),owners=d.nodes(n=>(n.attrs.class??'').split(/\s+/).includes('article__content__view__field')&&d.nodes(c=>(c.attrs.class??'').split(/\s+/).includes('article__content__view__field__label')&&d.text(c)==='Location',n).length===1);assert.equal(owners.length,1);const values=d.nodes(n=>(n.attrs.class??'').split(/\s+/).includes('article__content__view__field__value'),owners[0]);assert.equal(values.length,1);const n=values[0];return html.slice(0,n.openEnd)+value+html.slice(n.closeStart)}
function schema(html,model){const d=document(html),mains=d.nodes(n=>n.tag==='main'&&n.attrs.id==='main');assert.equal(mains.length,1);const n=mains[0];return html.slice(0,n.closeStart)+'<script type="application/ld+json">'+JSON.stringify({'@context':'https://schema.org','@type':'WebPage',url:FIRST,title:TITLE,...model}).replaceAll('<','\\u003c')+'</script>'+html.slice(n.closeStart)}
async function replay(change,options={}){const counts=new Map(),calls=[];let harness;try{const jobs=await runCurrentPublished({now:fixture.observedAt,requestIntervalMs:0,...options,fetchImpl:async(url,init)=>{try{assert.equal(new URL(url).origin,'https://bloomberg.avature.net');assert.ok(!new URL(url).pathname.startsWith('/careers/Login'));const key=init.method+' '+url,n=counts.get(key)??0;counts.set(key,n+1);const original=fixture.responses.filter(r=>r.method===init.method&&r.requestedUrl===url)[n];assert.ok(original,'Exact genuine method/URL/observation');if(init.method==='POST')assert.equal(init.body,original.originalRequestBody);const record={...original,text:Buffer.from(original.bodyBase64,'base64').toString()};change?.(record,url,n,init);calls.push({url,method:init.method,status:record.status});return Object.defineProperties(new Response(record.text,{status:record.status,headers:record.headers}),{url:{value:record.url},redirected:{value:record.redirected}})}catch(error){harness=error;throw error}}});if(harness)throw harness;return{jobs,calls}}catch(error){if(harness)throw harness;throw error}}
const closing=(url,edit)=>(record,current,n,init)=>{if(current===url&&n===1&&init.method==='GET')record.text=edit(record.text)}

for(const[name,edit]of[
 ['actual search title unpublished',html=>alter(html,n=>n.tag==='title','data-is-published="false"',true)],
 ['actual search canonical employer conflict',html=>alter(html,n=>n.tag==='link'&&n.attrs.rel==='canonical','data-employer="Other Employer"')]
])test('Bloomberg peer mandatory '+name+' holds the source',async()=>assert.rejects(replay(closing(SEARCH,edit))))

for(const[name,edit]of[
 ['actual role title unpublished',html=>alter(html,n=>n.tag==='title','data-is-published="false"',true)],
 ['actual role canonical application alias',html=>alter(html,n=>n.tag==='link'&&n.attrs.rel==='canonical','data-application-url="https://other.invalid/apply"')],
 ['actual publisher brand application URI alias',html=>alter(html,(n,d)=>n.tag==='h1'&&d.text(n)==='Bloomberg','data-application-uri="https://other.invalid/apply"')],
 ['same-country native labelled location differs',html=>location(html,'Chennai, Tamil Nadu, India')],
 ['same-role WebPage employer differs',html=>schema(html,{hiringOrganization:{'@type':'Organization',name:'Other Employer'}})],
 ['same-role WebPage country differs',html=>schema(html,{jobLocation:{'@type':'Place',address:{'@type':'PostalAddress',addressCountry:'CA'}}})]
])test('Bloomberg peer complete200 '+name+' holds only affected role',async()=>{const{jobs}=await replay(closing(FIRST,edit));assert.equal(jobs.length,4);assert.ok(!jobs.some(j=>j.nativePublicJobId===ID))})

test('Bloomberg peer caller zero cap performs no native acquisition and carries no first-party acquisition assertion',async()=>{const{jobs,calls}=await replay(null,{maxJobs:0});assert.equal(calls.length,0);assert.equal(jobs.length,0);assert.equal(jobs.nativeCollectionEvidence.sourceAcquisitionAttempted,false);assert.equal(readInventoryEvidence(jobs).firstParty,false)})
