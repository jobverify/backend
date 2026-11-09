import {BOARD,OFFICIAL_BINDING,parseCheckmarxBoard,parseCheckmarxRole} from './nativeContract.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {createHash} from 'node:crypto'
const check=(ok,message)=>{if(!ok)throw Error('Checkmarx native run: '+message)}
const USER_AGENT='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
export async function runNativeCheckmarx(options={}){
  check(options.maxJobs==null,'Native truncation is not permitted')
  const now=typeof options.now==='function'?options.now():options.now??new Date().toISOString(),timeoutMs=options.timeoutMs??180000,concurrency=options.detailConcurrency??2
  check(Number.isFinite(Date.parse(now))&&Number.isInteger(timeoutMs)&&timeoutMs>0&&timeoutMs<=300000&&Number.isInteger(concurrency)&&concurrency>=1&&concurrency<=3,'Invalid bounded native options')
  const c=new AbortController(),timer=setTimeout(()=>c.abort(Error('Checkmarx source deadline')),timeoutMs),signal=options.signal?AbortSignal.any([options.signal,c.signal]):c.signal,abort=()=>signal.throwIfAborted(),fetchImpl=options.fetchImpl??globalThis.fetch,originalResponses=[]
  async function bounded(fn){abort();let listener;try{return await Promise.race([Promise.resolve().then(fn),new Promise((_,reject)=>{listener=()=>reject(signal.reason);signal.addEventListener('abort',listener,{once:true})})])}finally{signal.removeEventListener('abort',listener);abort()}}
  async function get(url){
    const startedAt=new Date().toISOString()
    const r=await bounded(()=>fetchImpl(url,{signal,headers:{'User-Agent':USER_AGENT,Accept:'text/html,application/xhtml+xml'}}))
    if(r.status!==200){const e=Error('Checkmarx native HTTP unavailable: '+r.status);e.httpStatus=r.status;e.failureKind=r.status===403?'upstream_blocked':'upstream_http_failure';throw e}
    check(r.url===url,'Current native public final URL changed')
    const originalBytes=typeof r.arrayBuffer==='function',bytes=originalBytes?Buffer.from(await bounded(()=>r.arrayBuffer())):Buffer.from(await bounded(()=>r.text()),'utf8')
    check(bytes.length<=3000000,'Native body invalid or over bound')
    const html=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes)
    originalResponses.push({requestedURL:url,finalURL:r.url,method:'GET',status:r.status,contentType:r.headers?.get('content-type')??null,startedAt,completedAt:new Date().toISOString(),bodyReadKind:originalBytes?'original-bytes':'decoded-text-only',bodyBytes:bytes.length,bodySHA256:createHash('sha256').update(bytes).digest('hex'),bodyBase64:bytes.toString('base64')})
    return html
  }
  try{
    const board=parseCheckmarxBoard(await get(BOARD),{now,maxNativeRecords:options.maxNativeRecords??300})
    const selected=board.rows.filter(r=>r.location.country==='IN'&&r.is_internal===false)
    const jobs=[]
    for(let i=0;i<selected.length;i+=concurrency)jobs.push(...await Promise.all(selected.slice(i,i+concurrency).map(async row=>parseCheckmarxRole(await get(row.url_comeet_hosted_page),row,{now}))))
    const final=parseCheckmarxBoard(await get(BOARD),{now,maxNativeRecords:options.maxNativeRecords??300})
    check(JSON.stringify(board.rows)===JSON.stringify(final.rows),'Native full public board changed during extraction')
    check(JSON.stringify(board.company.company_domain_set)===JSON.stringify(final.company.company_domain_set),'Native employer identity changed during extraction')
    abort()
    const countryCounts=board.rows.reduce((counts,row)=>(counts[row.location.country]=(counts[row.location.country]||0)+1,counts),{})
    for(const j of jobs){
      j.sourceObservedNativeBoardRecords=board.rows.length
      j.sourceObservedNativeIndiaRecords=board.rows.filter(r=>r.location.country==='IN').length
      j.sourceObservedPublicIndiaRecords=selected.length
      j.sourceNativeBoardCountryCounts=countryCounts
      j.sourceOfficialBinding={...OFFICIAL_BINDING}
      j.sourceNativeInventoryGrain='native position UID including separately advertised location variants'
    }
    abort()
    attachInventoryEvidence(jobs,{status:'coverage-gap',surface:BOARD,firstParty:true,listingComplete:false,pagesFetched:2,reportedTotal:null,indiaFacetCount:null,verifiedAt:now,reason:'current-native-public-board-enumerated-and-rechecked-company-wide-scope-unproven'})
    const observed={source:'checkmarx',recordKind:'vacancy-rows',observedRecordCount:board.rows.length,observedVacancyCount:board.rows.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null}
    attachSourceObservationEvidence(jobs,observed)
    const observations=board.rows.map((row,index)=>({uid:row.uid,nativeCountryCode:row.location.country||null,sourceCountryScopeUnresolved:row.location.country==='',nativeSourceRecord:structuredClone(row),nativeClosingRecord:structuredClone(final.rows[index])}))
    const heldNativeRows=board.heldNativeRows.map(row=>({...row,closingNativeRecord:structuredClone(final.rows.find(r=>r.uid===row.uid))}))
    Object.defineProperty(jobs,'nativeCollectionEvidence',{value:{...observed,observations,heldNativeRows,openingNativeRows:structuredClone(board.rows),closingNativeRows:structuredClone(final.rows),originalResponses,wholeNativeBoardClosingReconciled:true,lifecycleCleanupAllowed:false,observedNativeIndiaRows:board.rows.filter(r=>r.location.country==='IN').length,observedPublicIndiaRows:selected.length,applicationInteractions:0},configurable:true})
    return jobs
  }finally{clearTimeout(timer)}
}
