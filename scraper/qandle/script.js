import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {createHash} from 'node:crypto'
import {attachInventoryEvidence,normalizeInventoryEvidence,readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import candidate from './catalog-candidate.json' with {type:'json'}
const currentDir=path.dirname(fileURLToPath(import.meta.url))
export const SOURCE='qandle', COMPANY='Qandle', FIRST_PARTY_ROOT_URL='https://www.qandle.com/'
export const PROVIDER_METADATA={...candidate,modulePath:fileURLToPath(import.meta.url)}
export const PORTAL_URL='https://hr.qandle.com/', HEADER_URL='https://www.qandle.com/header.html', MASTER_URL='https://www.qandle.com/js/master.js'
export const createQandleScraper=(defaults={})=>({async run(options={}){
 const {fetchImpl=globalThis.fetch,signal,timeoutMs=30000}={...defaults,...options}
    signal?.throwIfAborted()
    let pagesFetched = 0, surface = FIRST_PARTY_ROOT_URL
    const controller = new AbortController(), retainedResponses = []
    const gap = (reason, cause) => Object.assign(new Error('Qandle coverage gap: ' + reason, {cause}), {
      code:'QANDLE_COVERAGE_GAP', sourceListingComplete:false, lifecycleCleanupAllowed:false,
      retainedResponses,
      inventoryEvidence:normalizeInventoryEvidence({status:'coverage-gap', surface, firstParty:true,
        listingComplete:false, pagesFetched, reportedTotal:null, indiaFacetCount:null,
        verifiedAt:new Date().toISOString(), reason}),
    })
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) throw gap('Invalid aggregate request budget')
    let timer, onAbort
    const aborted = new Promise((_, reject) => {
      onAbort = () => {controller.abort(signal.reason); reject(signal.reason)}
      signal?.addEventListener('abort', onAbort, {once:true})
      timer = setTimeout(() => { const error = gap('Aggregate source deadline exceeded'); controller.abort(error); reject(error) }, timeoutMs)
    })
    const collect = async () => {
      const read = async url => {
        controller.signal.throwIfAborted(); surface = url
        const response = await fetchImpl(url, {signal:controller.signal, redirect:'error', headers:{Accept:'text/html'}})
        controller.signal.throwIfAborted()
        if (response.url !== url || response.status !== 200) throw gap('Source HTTP failure or final URL changed')
        let body
        if (response.body?.getReader) {
          const reader = response.body.getReader(), chunks = []
          let bytes = 0
          const cancel = () => {void reader.cancel(controller.signal.reason).catch(() => {})}
          controller.signal.addEventListener('abort', cancel, {once:true})
          try {
            while (true) {
              controller.signal.throwIfAborted()
              const {done, value} = await reader.read()
              controller.signal.throwIfAborted()
              if (done) break
              bytes += value.byteLength
              if (bytes > 5000000) {void reader.cancel().catch(() => {}); throw gap('Source body exceeds bound')}
              chunks.push(value)
            }
            body = Buffer.concat(chunks).toString('utf8')
          } finally {controller.signal.removeEventListener('abort', cancel); reader.releaseLock()}
        } else body = await response.text()
        controller.signal.throwIfAborted()
        if (typeof body !== 'string' || !body.trim() || Buffer.byteLength(body) > 5000000) throw gap('Source body missing or exceeds bound')
        pagesFetched++
        retainedResponses.push({url, status:response.status, body, bodySHA256:createHash('sha256').update(body).digest('hex')})
        return body
      }

 const requireProof=(ok,why)=>{if(!ok)throw gap(why)}
 const home=await read(FIRST_PARTY_ROOT_URL), homeDoc=document(home)
 requireProof(homeDoc.text(homeDoc.root).includes('Qandle now a part of') && homeDoc.nodes(n=>n.tag==='script' && n.attrs.src==='js/master.js').length,'Official Qandle identity or navigation loader changed')
 const master=await read(MASTER_URL)
 requireProof(master.includes('fetch("https://www.qandle.com/header.html")'),'Native header loading contract changed')
 const header=document(await read(HEADER_URL))
 requireProof(header.nodes(n=>n.tag==='a' && n.attrs.href===PORTAL_URL+'#/jobs' && header.text(n)==='Careers').length>0,'Active corporate careers handoff missing')
 const portal=await read(PORTAL_URL)
 requireProof(portal.includes('Qandle (Digital Ecom Techno Pvt. Ltd.)'),'Exact employer portal identity changed')
 const readJSON=async url=>{const p=JSON.parse(await read(url));requireProof(p.status==='success' && Object.keys(p).every(k=>['status','message','data'].includes(k)),'Native success envelope or secondary scope changed');return p.data}
 const pages=await readJSON(PORTAL_URL+'recruitment-frontend/external-company-job-page/2')
 requireProof(Array.isArray(pages) && pages.some(p=>p.slug==='banner' && p.visibility===true && p.content?.includes('hr.qandle.com')),'Native employer landing contract changed')
 const jobs=await readJSON(PORTAL_URL+'recruitment-frontend/open-jobs'), defaultJob=await readJSON(PORTAL_URL+'recruitment-frontend/default-job')
 requireProof(Array.isArray(jobs) && jobs.length===1 && defaultJob===null,'Native inventory changed; enumerate new jobs before certifying scope')
 const row=jobs[0], id='5f7b24f139473e585f0a38f7'
 requireProof(row._id===id && row.job_title?.visibility===true && row.job_title.value==='Drop your Resume for us !' && row.location==='Remote (Anywhere)' && row.internal_job_post===false && row.apply_url===PORTAL_URL+'#/jobs?jobId='+id+'&apply_now','Native generic resume pool identity or country scope changed')
 requireProof(Object.keys(row).every(k=>['_id','job_title','apply_url','internal_job_post','is_refer_someone','job_post_date','location','employment_type'].includes(k)) && row.job_post_date==='26-May-2022','Unreviewed native secondary scope or public date')
 const detail=await readJSON(PORTAL_URL+'recruitment-frontend/job-details/'+id)
 requireProof(detail?.head?._id===id && detail.head.job_title?.value===row.job_title.value && detail.head.location===row.location && detail.head.job_post_date==='26 May 2022' && detail.head.requisition_id?.value==='Q00031020','Native resume pool detail identity changed')
 const jd=detail.body?.find(b=>b.slug==='job_description')?.value
 requireProof(jd==='An open platform for you to concretely highlight your skills and areas of Interest in your CV !','Native generic talent pool purpose changed')
 const evidence={status:'discovery-only',surface:PORTAL_URL+'#/jobs',firstParty:true,listingComplete:false,pagesFetched,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason:'Officially linked native board has one generic talent-pool resume invitation, excluded as not a specific job; Remote (Anywhere) supplies no explicit India country. Native open-jobs one record; default-job null. Whole-company scope remains unverified; cleanup disabled.'}
 const result=attachInventoryEvidence([],evidence)
 Object.defineProperty(result,'nativeCollectionEvidence',{value:{retainedResponses,nativeRecordCount:1,exclusions:[{id,title:row.job_title.value,reason:'generic-talent-pool-not-a-specific-job',location:row.location,nativePostingDate:'2022-05-26'}],lifecycleCleanupAllowed:false}})
 return result
 }
 try{return await Promise.race([collect(),aborted])}catch(error){if(signal?.aborted)throw signal.reason;if(error?.code==='QANDLE_COVERAGE_GAP')throw error;throw gap('Qandle native source transport, body or inventory contract unavailable',error)}finally{clearTimeout(timer);signal?.removeEventListener('abort',onAbort);controller.abort()}
}})
export const run=async(options={})=>createQandleScraper(options).run(options)
const direct=process.argv[1]?.replaceAll('\\','/').endsWith('/scraper/qandle/script.js')
if(direct){const jobs=await run();const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js');if(readInventoryEvidence(jobs)?.listingComplete!==true){console.error(readInventoryEvidence(jobs)?.reason);process.exitCode=1}else if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(currentDir,'jobs.json'));else await saveToDB(jobs,SOURCE)}
