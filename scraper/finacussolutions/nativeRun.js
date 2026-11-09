import {HOME,CAREERS,parseFinacusSurface,validateFinacusClients,validateFinacusDetail,detailUrl} from './nativeContract.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const check=(ok,message)=>{if(!ok)throw new Error('Finacus native run: '+message)}
export async function runNativeFinacus(options={}){
 const fetchImpl=options.fetchImpl??globalThis.fetch,timeoutMs=options.timeoutMs??120000,cap=options.maxJobs??Infinity,now=typeof options.now==='function'?options.now():options.now??new Date().toISOString()
 check(Number.isInteger(timeoutMs)&&timeoutMs>0&&timeoutMs<=180000,'Invalid deadline');check(cap===Infinity||Number.isInteger(cap)&&cap>=0,'Invalid cap');check(Number.isFinite(Date.parse(now)),'Invalid time')
 const c=new AbortController(),timer=setTimeout(()=>c.abort(new Error('Finacus source deadline')),timeoutMs),signal=options.signal?AbortSignal.any([options.signal,c.signal]):c.signal,abort=()=>{if(signal.aborted)throw signal.reason||new Error('Caller aborted')}
 async function bounded(fn){abort();let listener;try{return await Promise.race([Promise.resolve().then(fn),new Promise((_,reject)=>{listener=()=>reject(signal.reason||new Error('Caller aborted'));signal.addEventListener('abort',listener,{once:true})})])}finally{signal.removeEventListener('abort',listener);abort()}}
 async function get(url){const r=await bounded(()=>fetchImpl(url,{signal,headers:{Accept:'text/html,application/javascript'},redirect:'follow'}));check(r.status===200&&r.url===url,'Native HTTP status/URL changed');const body=await bounded(()=>r.text());check(typeof body==='string'&&body.length<=2000000,'Native body invalid');return body}
 try{
  const home=await get(HOME),surface=parseFinacusSurface(home,await get(CAREERS));validateFinacusClients(await get(surface.ajaxClient),await get(surface.mainClient),await get(surface.loaderClient))
  const jobs=[];for(let i=0;i<surface.cards.length;i+=2)jobs.push(...await Promise.all(surface.cards.slice(i,i+2).map(async card=>validateFinacusDetail(await get(detailUrl(card.jobId)),card,{now}))))
  const final=parseFinacusSurface(home,await get(CAREERS));check(JSON.stringify(final)===JSON.stringify(surface),'Native visible inventory drift');abort()
  return attachInventoryEvidence(jobs.slice(0,cap),{status:'coverage-gap',surface:CAREERS,firstParty:true,listingComplete:false,pagesFetched:2,reportedTotal:null,indiaFacetCount:null,verifiedAt:now,reason:cap<jobs.length?'caller-cap-with-unproven-global-inventory':jobs.some(j=>!j.sourceDetailComplete)?'native-country-or-full-description-unresolved-and-global-inventory-unproven':'observed-cards-stable-no-native-global-total-or-pagination-proof'})
 }finally{clearTimeout(timer)}
}
