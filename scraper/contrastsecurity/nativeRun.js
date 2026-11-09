import {readNativeDocument} from './nativeHtml.js'
import {createPublishingGapAtsScraper} from '../../scraper-support/utils/publishingGapAts.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
export const HOME='https://www.contrastsecurity.com/',CAREERS=HOME+'contrast-careers',BOARD='https://jobs.ashbyhq.com/contrast-security',API='https://api.ashbyhq.com/posting-api/job-board/contrast-security'
const check=(ok,message)=>{if(!ok)throw Error('Contrast Security native contract: '+message)}
function handoff(body,target){const d=readNativeDocument(body);check(d.nodes(n=>n.tag==='title').some(n=>/Contrast Security/i.test(n.raw??'')),'Corporate title identity unavailable');check(d.nodes(n=>n.tag==='a'&&n.attrs.href).some(n=>{try{return new URL(n.attrs.href,HOME).href===target}catch{return false}}),'Current active official handoff unavailable')}
function envelope(value){check(value&&typeof value==='object'&&!Array.isArray(value),'Native envelope malformed');for(const[k,v]of Object.entries(value)){const key=k.toLowerCase().replace(/[_\s-]/g,'');if(['error','errors','errorcode','errormessage','exception','fault'].includes(key))check(false,'Native error envelope');if(['success','ok'].includes(key))check(v===true,'Native failure flag');if(['status','statuscode','code'].includes(key))check(v===200,'Native error status');if(['meta','metadata'].includes(key)&&v!=null)envelope(v)}}
function board(body){
 const d=readNativeDocument(body),scripts=d.nodes(n=>n.tag==='script'&&!n.attrs.src&&!Object.hasOwn(n.attrs,'nomodule')&&['','text/javascript','application/javascript'].includes(n.attrs.type??'')),matches=scripts.filter(n=>/^\s*window\.__appData\s*=\s*\{/.test(n.raw??''));check(matches.length===1,'Expected one unconditional active native preload')
 const text=matches[0].raw,start=text.indexOf('{');let depth=0,quoted=false,escaped=false,end=-1
 for(let i=start;i<text.length;i++){const c=text[i];if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false}else if(c==='"')quoted=true;else if(c==='{')depth++;else if(c==='}'&&--depth===0){end=i+1;break}}
 check(end>0&&/^\s*;/.test(text.slice(end))&&!/window\.__appData\s*=/.test(text.slice(end)),'Native preload expression changed')
 const data=JSON.parse(text.slice(start,end));envelope(data);const org=data.organization;envelope(org)
 check(org.name==='Contrast Security'&&org.hostedJobsPageSlug==='contrast-security'&&org.organizationId==='c341bcad-0048-4fb0-bb75-f046f716268f'&&org.publicWebsite===HOME&&org.isDemoOrg===false,'Native organization identity changed')
 envelope(data.jobBoard);check(Array.isArray(data.jobBoard.jobPostings)&&Array.isArray(data.jobBoard.teams),'Native public board shape unavailable')
 check(data.jobBoard.jobPostings.length===0,'New native roles require country and detail qualification; never infer zero')
 return{organizationId:org.organizationId,name:org.name,slug:org.hostedJobsPageSlug,jobPostings:data.jobBoard.jobPostings,teams:data.jobBoard.teams}
}
export async function runNative(options={}){
 const timeout=options.timeoutMs??60000,now=new Date(options.now??Date.now()).toISOString();check(options.maxJobs==null,'Truncation unsupported');check(Number.isSafeInteger(timeout)&&timeout>0&&timeout<=120000,'Invalid timeout')
 const c=new AbortController(),timer=setTimeout(()=>c.abort(Error('Contrast native deadline')),timeout),signal=options.signal?AbortSignal.any([options.signal,c.signal]):c.signal
 async function get(url){signal.throwIfAborted();let listener;try{return await Promise.race([(async()=>{const r=await fetch(url,{signal,redirect:'error'});signal.throwIfAborted();check(r.status===200&&r.url===url,'Native HTTP or final URL mismatch');const body=await r.text();signal.throwIfAborted();check(body.length<=2000000,'Native response exceeds bound');return body})(),new Promise((_,reject)=>{listener=()=>reject(signal.reason);signal.addEventListener('abort',listener,{once:true})})])}finally{signal.removeEventListener('abort',listener)}}
 async function api(){const p=JSON.parse(await get(API));envelope(p);check(p.apiVersion==='1'&&Array.isArray(p.jobs),'Current native API schema unavailable');check(p.jobs.length===0,'New native roles require full qualification; no inherited zero');return p}
 try{
  handoff(await get(HOME),CAREERS);handoff(await get(CAREERS),BOARD);const current=board(await get(BOARD)),payload=await api()
  const jobs=await createPublishingGapAtsScraper({source:'contrastsecurity',companyName:'Contrast Security',atsPlatform:'ashby',boardToken:'contrast-security'}).run({signal,fetchJson:async url=>{check(url===API,'Unexpected shared adapter URL');return payload}})
  check(JSON.stringify(await api())===JSON.stringify(payload),'Native inventory drift');check(JSON.stringify(board(await get(BOARD)))===JSON.stringify(current),'Native board drift');signal.throwIfAborted();check(jobs.length===0,'Unexpected mapped records')
  return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:BOARD,firstParty:true,listingComplete:false,pagesFetched:2,reportedTotal:null,indiaFacetCount:null,verifiedAt:now,reason:'Current official-bound public Ashby board and API both empty and rechecked; other hiring surfaces and whole-company India coverage unproven; nonempty future inventory requires qualification'})
 }finally{clearTimeout(timer);c.abort()}
}
