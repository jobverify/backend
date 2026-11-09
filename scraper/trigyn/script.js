import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {ENDPOINT,careersContract,verifyClient,regionUniverse,parsePage,detailContent} from './native.js'

export const SOURCE='trigyn'
export const COMPANY='Trigyn'
export const CAREERS_URL='https://www.trigyn.com/careers'
export const BLOCKED_LISTING_CONTRACT='Without a current native contract there is no enumerable first-party jobs response; never enumerate unlinked /job/ detail pages.'

export const createTrigynScraper=()=>({
  async run({fetch:fetcher=globalThis.fetch,signal:callerSignal,timeoutMs=120000,maxPages=100,maxJobs=5000,now=()=>new Date().toISOString()}={}) {
    callerSignal?.throwIfAborted()
    if(!Number.isFinite(timeoutMs)||timeoutMs<1||timeoutMs>300000||!Number.isSafeInteger(maxPages)||maxPages<1||maxPages>500
      ||!Number.isSafeInteger(maxJobs)||maxJobs<1||maxJobs>10000)throw Error('Trigyn invalid aggregate inventory bounds')
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(Error('Trigyn aggregate deadline timeout')),timeoutMs)
    const signal=callerSignal?AbortSignal.any([callerSignal,controller.signal]):controller.signal
    let onAbort
    try {
      const aborted=new Promise((_,reject)=>{
        onAbort=()=>reject(signal.reason);signal.addEventListener('abort',onAbort,{once:true});if(signal.aborted)onAbort()
      })
      return await Promise.race([aborted,(async()=>{
        let pagesFetched=0
        async function request(url,param) {
          signal.throwIfAborted()
          const headers={accept:param?'application/json':'text/html','user-agent':'Mozilla/5.0'}
          const init={signal,redirect:'error',headers}
          if(param){init.method='POST';headers['content-type']='application/x-www-form-urlencoded; charset=UTF-8';headers.referer=CAREERS_URL;init.body=new URLSearchParams({param:JSON.stringify(param)}).toString()}
          const response=await fetcher(url,init);signal.throwIfAborted()
          if(response?.status!==200)throw Object.assign(Error(`Trigyn native HTTP ${response?.status}`),{code:'TRIGYN_NATIVE_HTTP'})
          if(response.url!==url)throw Object.assign(Error('Trigyn native identity redirect mismatch'),{code:'TRIGYN_NATIVE_IDENTITY'})
          const body=await response.text();signal.throwIfAborted()
          if(typeof body!=='string'||!body.trim()||Buffer.byteLength(body)>5000000)throw Error('Trigyn malformed listing response')
          return body
        }
        const {regions:formRegions,clientUrl}=careersContract(await request(CAREERS_URL))
        verifyClient(await request(clientUrl))
        const bootstrap=JSON.parse(await request(ENDPOINT,{region:'54',current_page:'0'}));pagesFetched++
        const regions=regionUniverse(bootstrap)
        if(formRegions.length&&JSON.stringify(formRegions)!==JSON.stringify(regions))throw Error('Trigyn region inventory form/native mismatch')
        parsePage(bootstrap,{regions,page:0})
        async function collect() {
          const jobs=[],ids=new Set(),requisitions=new Set(),aliases=new Set(),indiaIds=new Set()
          let listingPages=0
          async function scope(region,country) {
            const found=[],seen=new Set();let total=null,countries=null
            for(let page=0;total===null||page*20<total;page++) {
              if(++listingPages>maxPages)throw Error('Trigyn inventory page cap exceeded')
              const param={region,...(country?{country}:{}),current_page:String(page)}
              const payload=JSON.parse(await request(ENDPOINT,param));pagesFetched++
              const parsed=parsePage(payload,{regions,page,country})
              if(total!==null&&(parsed.total!==total||JSON.stringify(parsed.countries)!==JSON.stringify(countries)))throw Error('Trigyn inventory total/country facet drift')
              total=parsed.total;countries=parsed.countries
              for(const job of parsed.jobs){if(seen.has(job.jobId))throw Error('Trigyn inventory repeated page identity');seen.add(job.jobId);found.push(job)}
              if(found.length>maxJobs)throw Error('Trigyn inventory job cap exceeded')
            }
            if(found.length!==total)throw Error('Trigyn incomplete scope inventory')
            return {jobs:found,countries,total}
          }
          for(const region of regions) {
            const global=await scope(region.id)
            for(const job of global.jobs) {
              if(ids.has(job.jobId)||requisitions.has(job.requisitionId)||aliases.has(job.sourceUrl))throw Error('Trigyn inventory duplicate global identity')
              ids.add(job.jobId);requisitions.add(job.requisitionId);aliases.add(job.sourceUrl)
              jobs.push({...job,region:region.name,regionId:region.id})
            }
            if(jobs.length>maxJobs)throw Error('Trigyn inventory global job cap exceeded')
            for(const india of global.countries.filter(c=>c.name==='India')) {
              const facet=await scope(region.id,india.id)
              const expected=global.jobs.filter(job=>job.country==='India').map(job=>job.jobId).sort()
              if(JSON.stringify(facet.jobs.map(job=>job.jobId).sort())!==JSON.stringify(expected))throw Error('Trigyn India facet inventory identity mismatch')
              for(const job of facet.jobs)indiaIds.add(job.jobId)
            }
          }
          const india=jobs.filter(job=>job.country==='India')
          if(india.length!==indiaIds.size||india.some(job=>!indiaIds.has(job.jobId)))throw Error('Trigyn India facet inventory coverage mismatch')
          return {jobs,indiaFacetCount:indiaIds.size}
        }
        const first=await collect(),last=await collect()
        if(JSON.stringify(first)!==JSON.stringify(last))throw Error('Trigyn complete current inventory changed during validation')
        const scrapedAt=now()
        const jobs=first.jobs.map(job=>({...job,source:SOURCE,company:COMPANY,location:`${job.nativeLocation}, ${job.country}`,
          city:/^(?:none|remote)$/i.test(job.nativeLocation)?null:job.nativeLocation,link:job.applyUrl,
          postingDate:null,jobDescription:null,sourceDetailComplete:false,sourceDetailFailureKind:'upstream',scrapedAt}))
        let next=0
        await Promise.all(Array.from({length:Math.min(4,jobs.length)},async()=>{
          while(next<jobs.length) {
            signal.throwIfAborted();const index=next++,job=jobs[index]
            try {
              const description=detailContent(await request(job.sourceUrl),job)
              if(description){job.jobDescription=description;job.sourceDetailComplete=true;delete job.sourceDetailFailureKind}
              else job.sourceDetailFailureKind='missing-content'
            }catch(error){signal.throwIfAborted();if(error.code==='TRIGYN_DETAIL_IDENTITY'){controller.abort(error);throw error}job.sourceDetailFailureKind='upstream'}
            if(!job.sourceDetailComplete)job.sourceListingComplete=false
          }
        }))
        signal.throwIfAborted()
        return attachInventoryEvidence(jobs,{status:jobs.length?'complete-inventory':'verified-empty',surface:ENDPOINT,
          firstParty:true,listingComplete:true,pagesFetched,reportedTotal:jobs.length,indiaFacetCount:first.indiaFacetCount,verifiedAt:scrapedAt,
          reason:'All official region options, complete native 20-row pagination, unique identities and independent India facets reconciled across two stable snapshots; detail health is separate.'})
      })()])
    }finally{clearTimeout(timer);signal.removeEventListener('abort',onAbort);if(!controller.signal.aborted)controller.abort(Error('Trigyn collection settled'))}
  },
})

export const run=async(options={})=>createTrigynScraper().run(options)

if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js')
  const jobs=await run()
  if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'))
  else await saveToDB(jobs,SOURCE)
}
