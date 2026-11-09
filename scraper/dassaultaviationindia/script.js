import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {createHash} from 'node:crypto'
import {attachInventoryEvidence,normalizeInventoryEvidence,readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {activeIframeSources,readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {activeDocument,collectNative,ATS_ORIGIN,HANDOFF_URL,ENTRY_URL,LISTING_URL} from './native.js'
import candidate from './catalog-candidate.json' with {type:'json'}

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'dassaultaviationindia'
export const COMPANY = 'Dassault Aviation India'
export const FIRST_PARTY_ROOT_URL = 'https://www.dassault-aviation.com/en/group/careers/'
export const PROVIDER_METADATA={...candidate,modulePath:fileURLToPath(import.meta.url)}

const isObservedIncapsulaShell=body=>{
  const document=readNativeDocument(body)
  const resource=value=>{
    try{const url=new URL(value,FIRST_PARTY_ROOT_URL);return url.protocol==='https:'&&!url.username&&!url.password
      &&url.origin===new URL(FIRST_PARTY_ROOT_URL).origin&&url.pathname==='/_Incapsula_Resource'&&!url.hash}catch{return false}
  }
  const robots=document.nodes(n=>n.tag==='meta'&&n.attrs.name?.toLowerCase()==='robots')
  const directives=robots[0]?.attrs.content?.toLowerCase().split(/[\s,]+/).filter(Boolean)||[]
  const scripts=document.nodes(n=>n.tag==='script'),frames=activeIframeSources(body)
  return robots.length===1&&directives.length===2&&directives.includes('noindex')&&directives.includes('nofollow')
    &&scripts.length===1&&resource(scripts[0].attrs.src)&&frames.length===1&&resource(frames[0])
    &&document.nodes(n=>n.tag==='title').length===0&&!document.text(document.nodes(n=>n.tag==='root')[0])
}

export const createDassaultAviationIndiaScraper = (defaults={}) => ({
  async run(options={}) {
    const {fetchImpl=globalThis.fetch,signal,timeoutMs=240000,now=()=>new Date().toISOString()}={...defaults,...options}
    signal?.throwIfAborted()
    let firstParty=false,surface=FIRST_PARTY_ROOT_URL,timer,onAbort,onCallerAbort
    const controller=new AbortController(),retainedResponses=[]
    const gap=(reason,cause)=>Object.assign(new Error('Dassault Aviation India coverage gap: '+reason,{cause}),{
      code:'DASSAULTAVIATIONINDIA_COVERAGE_GAP',source:SOURCE,partial:true,abortRetries:true,
      sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,retainedResponses,
      inventoryEvidence:normalizeInventoryEvidence({status:'coverage-gap',surface,firstParty,listingComplete:false,pagesFetched:retainedResponses.length,
        reportedTotal:null,indiaFacetCount:null,verifiedAt:now(),reason}),
    })
    if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>300000)throw gap('Invalid aggregate native request budget')
    const interrupted=new Promise((_,reject)=>{
      onAbort=()=>reject(controller.signal.reason)
      controller.signal.addEventListener('abort',onAbort,{once:true})
      onCallerAbort=()=>controller.abort(signal.reason)
      signal?.addEventListener('abort',onCallerAbort,{once:true})
      timer=setTimeout(()=>controller.abort(gap('Aggregate native fetch/body deadline exceeded')),timeoutMs)
    })
    const collect=async()=>{
      const read=async(url,{allowedFinalUrl=url}={})=>{
        controller.signal.throwIfAborted();surface=url
        let requestUrl=url,response
        for(let hop=0;hop<4;hop++){
          response=await fetchImpl(requestUrl,{signal:controller.signal,redirect:'manual',headers:{Accept:'text/html','User-Agent':'Mozilla/5.0'}})
          controller.signal.throwIfAborted()
          if([301,302,303,307,308].includes(response.status)){
            const target=new URL(response.headers?.get('location'),requestUrl).href
            if(url!==HANDOFF_URL||![HANDOFF_URL,ENTRY_URL].includes(target))throw gap('Unreviewed corporate handoff redirect')
            retainedResponses.push({url:requestUrl,finalUrl:response.url,status:response.status,location:target,body:'',capturedAt:now()})
            void response.body?.cancel?.().catch(()=>{})
            requestUrl=target;continue
          }
          break
        }
        if(response.status!==200||response.url!==allowedFinalUrl)throw gap('Native HTTP failure or final URL changed')
        let body
        if(response.body?.getReader){
          const reader=response.body.getReader(),chunks=[];let bytes=0
          const cancel=()=>{void Promise.resolve(reader.cancel(controller.signal.reason)).catch(()=>{})}
          controller.signal.addEventListener('abort',cancel,{once:true})
          try{while(true){controller.signal.throwIfAborted();const p=await reader.read();controller.signal.throwIfAborted();if(p.done)break;bytes+=p.value.byteLength;if(bytes>3000000){cancel();throw gap('Native streamed body exceeds bound')}chunks.push(Buffer.from(p.value))}body=Buffer.concat(chunks).toString('utf8')}
          finally{controller.signal.removeEventListener('abort',cancel);reader.releaseLock?.()}
        }else body=await response.text()
        controller.signal.throwIfAborted()
        if(typeof body!=='string'||!body.trim()||Buffer.byteLength(body)>3000000)throw gap('Native body missing or oversized')
        retainedResponses.push({url:requestUrl,finalUrl:response.url,status:response.status,body,capturedAt:now(),bodySHA256:createHash('sha256').update(body).digest('hex')})
        if(url===FIRST_PARTY_ROOT_URL&&isObservedIncapsulaShell(body))throw Object.assign(gap('Corporate publisher returned an Incapsula challenge shell'),{
          softFailure:true,upstreamOutage:true,failureKind:'blocked_or_access_denied',stage:'corporate',
          status:response.status,statusCode:response.status,requestUrl,finalUrl:response.url,
        })
        return activeDocument(body)
      }
      const official=await read(FIRST_PARTY_ROOT_URL)
      if(!official.text(official.root).includes('Dassault Aviation'))throw gap('Corporate employer identity missing')
      firstParty=true
      const nativeCollectionEvidence=await collectNative({read,official})
      const jobs=attachInventoryEvidence([],{status:'discovery-only',surface:LISTING_URL,firstParty:true,listingComplete:false,pagesFetched:retainedResponses.length,
        reportedTotal:null,indiaFacetCount:null,verifiedAt:now(),reason:'Current native parent-board pages and explicit non-India primary countries reconciled. India references retain unresolved secondary scope; exact Dassault Aviation India subsidiary coverage remains unverified; cleanup disabled.'})
      Object.defineProperty(jobs,'nativeCollectionEvidence',{value:{...nativeCollectionEvidence,retainedResponses,exactSubsidiaryScopeComplete:false,lifecycleCleanupAllowed:false}})
      return jobs
    }
    try{return await Promise.race([collect(),interrupted])}
    catch(error){if(signal?.aborted)throw signal.reason;if(error?.code==='DASSAULTAVIATIONINDIA_COVERAGE_GAP')throw error;throw gap('Native recruiting inventory or transport contract unavailable',error)}
    finally{clearTimeout(timer);signal?.removeEventListener('abort',onCallerAbort);controller.signal.removeEventListener('abort',onAbort);controller.abort()}
  },
})

export const run = async (options = {}) => createDassaultAviationIndiaScraper(options).run(options)

const isDirectExecution = process.argv[1]
  ?.replaceAll('\\', '/')
  .endsWith('/scraper/dassaultaviationindia/script.js')

if (isDirectExecution) {
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if(readInventoryEvidence(jobs)?.listingComplete!==true){console.error(readInventoryEvidence(jobs)?.reason);process.exitCode=1}
  else {const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js');if(isDryRun)saveToFile(jobs,path.join(currentDir,'jobs.json'));else await saveToDB(jobs,SOURCE)}
}
