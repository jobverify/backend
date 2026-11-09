import {document} from '../../scraper-support/shared/rmkNativePairHtml.js';
import {attachInventoryEvidence,normalizeInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js';
export const FIRST_PARTY_ROOT_URL='https://www.eternoinfo.com/';
export const PORTAL_URL='https://jobs.careerswith-us.com/eterno';
export const LISTING_URL=PORTAL_URL+'/search/?createNewAlert=false&q=&locationsearch=';
const active=html=>{
 const d=document(html),visit=(n,inherited=false)=>{n.inactive ||= inherited || /(?:^|;)\s*content-visibility\s*:\s*hidden\s*(?:!important\s*)?(?:;|$)/i.test((n.attrs?.style||'').replace(/\/\*[\s\S]*?\*\//g,''));for(const c of n.children.filter(c=>typeof c!=='string'))visit(c,n.inactive)};
 visit(d.root);return d;
};
const check=(ok,message)=>{if(!ok)throw Error(message)};
function validate(official,portal,listing){
 check(official.text(official.root).includes('Eterno Infotech Pvt. Ltd.')&&official.text(official.root).includes('Dailyhunt is India')&&official.nodes(n=>n.tag==='a'&&n.attrs.href===PORTAL_URL).length===1,'Official operator or active native recruiting handoff changed');
 check(portal.nodes(n=>n.tag==='h1'&&portal.text(n)==='Define your future at Eterno Infotech').length===1&&portal.nodes(n=>n.tag==='a'&&n.attrs.href===LISTING_URL).length===1,'Exact native employer or unfiltered all-openings handoff changed');
 check(portal.text(portal.root).includes('Eterno Infotech Pvt Ltd')&&listing.text(listing.root).includes('Eterno Infotech Pvt Ltd'),'Native employer footer missing');
 check(listing.nodes(n=>n.tag==='h1'&&listing.text(n)==='Search results for "".').length===1,'Native search is not unfiltered');
 const forms=listing.nodes(n=>n.tag==='form'&&n.attrs.name==='keywordsearch'&&n.attrs.action==='/eterno/search/'&&n.attrs.method==='get');
 check(forms.length===1,'Native unfiltered search form missing');
 // Hidden controls still submit. Visibility is only a condition for the empty
 // message, not a reason to omit filters from the request scope.
 const controls=[];const visit=n=>{if(n.tag==='template')return;if(['input','select','button','textarea'].includes(n.tag))controls.push(n);for(const c of n.children.filter(c=>typeof c!=='string'))visit(c)};visit(forms[0]);
 const inputs=controls.filter(n=>n.tag==='input');
 check(!forms[0].attrs.id&&inputs.length===4&&controls.length===4,'Native filter scope changed');
 for(const name of ['q','locationsearch'])check(inputs.filter(n=>n.attrs.name===name&&(n.attrs.value??'')==='').length===1,'Native query or location filter is nonempty');
 check(inputs.filter(n=>n.attrs.name==='createNewAlert'&&n.attrs.value==='false').length===1&&inputs.every(n=>!n.attrs.name||['q','locationsearch','createNewAlert'].includes(n.attrs.name)),'Unexpected native hidden filter');
 const empty=listing.nodes(n=>n.attrs.id==='noresults');
 check(empty.length===1&&listing.text(empty[0])==='There are currently no open positions matching " ". The 0 most recent jobs posted by Job Search - Find your next Job are listed below for your convenience.','Native empty inventory or fallback count changed');
 check(!listing.nodes(n=>n.tag==='a'&&/\/job\//i.test(n.attrs.href||'')||listing.hasClass(n,'jobTitle-link')||listing.hasClass(n,'data-row')).length,'Native roles now require validated extraction');
 check(!listing.nodes(n=>n.tag==='iframe'||n.tag==='script'&&n.attrs.type==='application/ld+json'&&/JobPosting/.test(n.raw||'')).length,'New native embedded inventory requires review');
}
export const createDailyhuntScraper=(defaults={})=>({async run(options={}){
 const {fetchImpl=globalThis.fetch,signal,timeoutMs=30000,now=()=>new Date().toISOString()}={...defaults,...options};
 signal?.throwIfAborted();const controller=new AbortController(),retainedResponses=[];let timer,onCallerAbort,onAbort;
 const gap=(reason,cause)=>Object.assign(new Error('Dailyhunt coverage gap: '+reason,{cause}),{code:'DAILYHUNT_COVERAGE_GAP',sourceListingComplete:false,lifecycleCleanupAllowed:false,inventoryEvidence:normalizeInventoryEvidence({status:'coverage-gap',surface:LISTING_URL,firstParty:true,listingComplete:false,pagesFetched:retainedResponses.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:now(),reason})});
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000)throw gap('Invalid aggregate source budget');
 const interrupted=new Promise((_,reject)=>{onAbort=()=>reject(controller.signal.reason);controller.signal.addEventListener('abort',onAbort,{once:true});onCallerAbort=()=>controller.abort(signal.reason);signal?.addEventListener('abort',onCallerAbort,{once:true});timer=setTimeout(()=>controller.abort(gap('Aggregate fetch/body deadline exceeded')),timeoutMs)});
 const read=async url=>{
  controller.signal.throwIfAborted();const r=await fetchImpl(url,{signal:controller.signal,redirect:'error',headers:{Accept:'text/html'}});
  if(controller.signal.aborted)void Promise.resolve().then(()=>r.body?.cancel?.(controller.signal.reason)).catch(()=>{});
  controller.signal.throwIfAborted();
  if(r.status!==200||r.url!==url){void r.body?.cancel?.().catch(()=>{});throw gap('Native HTTP failure or final URL changed')}
  let body;
  if(r.body?.getReader){const reader=r.body.getReader(),chunks=[];let bytes=0;const cancel=()=>{void Promise.resolve(reader.cancel(controller.signal.reason)).catch(()=>{})};controller.signal.addEventListener('abort',cancel,{once:true});try{for(;;){const p=await reader.read();controller.signal.throwIfAborted();if(p.done)break;bytes+=p.value.byteLength;if(bytes>3000000){cancel();throw gap('Native body exceeds byte bound')}chunks.push(Buffer.from(p.value))}body=Buffer.concat(chunks).toString('utf8')}finally{controller.signal.removeEventListener('abort',cancel);reader.releaseLock?.()}}
  else body=await r.text();
  controller.signal.throwIfAborted();if(typeof body!=='string'||!body.trim()||Buffer.byteLength(body)>3000000)throw gap('Native body unavailable or oversized');retainedResponses.push({url,finalUrl:r.url,status:r.status,body});return active(body);
 };
 try{return await Promise.race([interrupted,(async()=>{
  const official=await read(FIRST_PARTY_ROOT_URL),portal=await read(PORTAL_URL),listing=await read(LISTING_URL);validate(official,portal,listing);
  const jobs=attachInventoryEvidence([],{status:'verified-empty',surface:LISTING_URL,firstParty:true,listingComplete:true,pagesFetched:3,reportedTotal:0,indiaFacetCount:0,verifiedAt:now(),reason:'Fresh official Dailyhunt operator delegates this exact Eterno native board; blank keyword/location search and explicit zero fallback reconcile the current empty public board.'});
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:{retainedResponses,nativePublicJobCount:0,nativeIndiaJobCount:0,scope:'officially-linked-Eterno-public-board'}});return jobs;
 })()])}catch(e){if(signal?.aborted)throw signal.reason;if(e?.code==='DAILYHUNT_COVERAGE_GAP')throw e;throw gap('Native identity, scope or transport unavailable',e)}finally{clearTimeout(timer);signal?.removeEventListener('abort',onCallerAbort);controller.signal.removeEventListener('abort',onAbort);controller.abort()}
}});
