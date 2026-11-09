import baselines from './native.scope.json' with {type:'json'}
import {createCurrentSourceScope,hasLiteralActiveKekaConfiguration,unhandledKekaGeography,finishCurrentKekaInventory} from '../../scraper-support/shared/kekaCurrentSourceScope.js'
import {createHash} from 'node:crypto'
import {createVerifiedFirstPartyKekaScraper} from '../../scraper-support/shared/verifiedFirstPartyKeka.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readNativeDocument,activeScripts} from '../../scraper-support/utils/activeNativeHtml.js'
const root='https://achiralabs.keka.com/careers/'
const identifier='cb843558-f2a1-40ac-8f36-6f76990f5364'
const active=`${root}api/embedjobs/default/active/${identifier}`
const hash=value=>createHash('sha256').update(value).digest('hex')
const decode=value=>String(value??'').replace(/&#x([\da-f]+);/gi,(_,v)=>String.fromCodePoint(parseInt(v,16))).replace(/&#(\d+);/g,(_,v)=>String.fromCodePoint(Number(v))).replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&apos;|&#39;|&rsquo;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>')
const text=value=>decode(decode(value)).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim()
const fail=message=>{throw new Error(`Achira native inventory: ${message}`)}
const config={source:'axiralabs',companyName:'Achira Labs',officialUrl:'https://achiralabs.com/careers',handoffType:'embedded-script',handoffUrl:`${root}api/embedjobs/js/${identifier}`,kekaRootUrl:root,identifier,portalName:'default',portalIdentity:{name:'Achira Labs',shortName:'Achira Labs',domain:'achiralabs.keka.com'}}
const hasActiveConfiguration=body=>hasLiteralActiveKekaConfiguration(body,{identifier,kekaRootUrl:root})
export async function runNativeInventory({fetchImpl=fetch,signal,maxJobs,maxPages,fetchText,fetchPage}={}){
 if(fetchText||fetchPage)fail('unsupported legacy transport; fetchImpl with observed status and final URL is required')
 if(maxJobs!=null||maxPages!=null)fail('inventory caps are unsupported')
 const scope=createCurrentSourceScope({baselines,kekaRootUrl:root})
 const request=async url=>{signal?.throwIfAborted();const timeout=AbortSignal.timeout(20000);const r=await fetchImpl(url,{signal:signal?AbortSignal.any([signal,timeout]):timeout,headers:{Accept:'application/json,text/html,application/javascript','User-Agent':'JobverifyScraper/1.0'}});if(r.status!==200||r.url!==url)fail(`HTTP or redirect identity for ${url}`);const body=await r.text();if(url===config.handoffUrl)scope.observeRenderer(url,body);if(Object.hasOwn(baselines,url)||url.includes('/careerportal/'))scope.observe(url,body);signal?.throwIfAborted();timeout.throwIfAborted();return body}
 let raw,rawBody,unknown=[]
 const jobs=await createVerifiedFirstPartyKekaScraper(config).run({signal,fetchImpl:async url=>{const body=await request(url);if(url===config.officialUrl){const doc=readNativeDocument(body);if(!hasActiveConfiguration(body)||doc.nodes(n=>n.tag==='script'&&n.attrs.src===config.handoffUrl).length!==1)fail('missing active embedded configuration and renderer')}if(url===active){rawBody=body;raw=JSON.parse(body);if(!Array.isArray(raw))fail('unexpected active inventory envelope');const seen=new Set();for(const row of raw){const id=String(row?.id??'');if(!/^[1-9]\d*$/.test(id)||!Number.isSafeInteger(Number(id))||seen.has(id))fail('invalid or duplicate raw identity');seen.add(id)}unknown=raw.filter(row=>unhandledKekaGeography(row).length);return new Response(JSON.stringify(raw.filter(row=>!unknown.includes(row))),{status:200})}return new Response(body,{status:200})}})
 for(const url of [`${root}api/embedjobs/grouplinkstatus/${identifier}`,`${root}api/organization/grouplinkstatus`])if(JSON.parse(await request(url))?.isGroupLinked!==false)fail('unresolved grouped employer scope')
 const board=JSON.parse(await request(`${root}api/jobs/default/active`));if(!Array.isArray(board)||JSON.stringify(board)!==JSON.stringify(raw))fail('board and embedded inventories disagree')
 for(const native of raw){const id=String(native.id);const doc=readNativeDocument(await request(`${root}jobdetails/${id}`));const ids=doc.nodes(n=>Object.hasOwn(n.attrs,'selectedjobid')).map(n=>n.attrs.selectedjobid);const titles=doc.nodes(n=>n.tag==='h1'&&Object.hasOwn(n.attrs,'title'));const descriptions=doc.nodes(n=>doc.hasClass(n,'job-description-container'));if(!ids.length||ids.some(value=>value!==id)||titles.length!==1||descriptions.length!==1||text(doc.text(titles[0]))!==text(native.title)||text(doc.text(descriptions[0]))!==text(native.description))fail(`detail identity or full description disagreement for ${id}`);const job=jobs.find(j=>j.jobId===id);if(job){job.sourceNativePayload=native;job.sourceNativeInventorySha256=hash(rawBody);job.sourceNativeDescriptionSha256=hash(native.description);job.sourceDetailComplete=text(native.description).length>=80;if(!job.sourceDetailComplete)job.sourceDetailFailureKind='limited-source-content'}}
 await request(config.officialUrl)
 const closing=JSON.parse(await request(active));const closingBoard=JSON.parse(await request(`${root}api/jobs/default/active`));if(JSON.stringify(closing)!==JSON.stringify(raw)||JSON.stringify(closingBoard)!==JSON.stringify(raw))fail('current full inventory changed during detail hydration')
 return finishCurrentKekaInventory(jobs,{raw,unknown,scope,evidence:{surface:active,firstParty:true,pagesFetched:1,verifiedAt:new Date().toISOString(),reason:'official-embedded-keka-full-array-both-group-APIs-board-closing-and-active-source-scope-reconciliation-native-details'}})
}
