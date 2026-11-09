import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { document } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { normalizeInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'taxbuddy'
export const COMPANY = 'TaxBuddy'
export const FIRST_PARTY_ROOT_URL = 'https://www.taxbuddy.com/'
export const EMPLOYER_URL = 'https://www.linkedin.com/company/tax-buddy-india/'
export const LISTING_URL = 'https://www.linkedin.com/jobs/search/?f_C=14564264&location=India'

const active=html=>{
  const doc=document(html)
  const prune=(n,inherited=false)=>{
    const style=(n.attrs?.style||'').replace(/\/\*[\s\S]*?\*\//g,'')
    n.inactive ||= inherited||/(?:^|;)\s*content-visibility\s*:\s*hidden\s*(?:!important\s*)?(?:;|$)/i.test(style)
    for(const c of n.children.filter(c=>typeof c!=='string'))prune(c,n.inactive)
  }
  prune(doc.root);return doc
}
const check=(ok,why)=>{if(!ok)throw Error(why)}

export const createTaxBuddyScraper = () => ({
  async run({fetchImpl=fetch,signal,timeoutMs=45000,now=()=>new Date().toISOString()}={}) {
    signal?.throwIfAborted()
    check(Number.isFinite(timeoutMs)&&timeoutMs>=1&&timeoutMs<=180000,'Invalid TaxBuddy deadline')
    const controller=new AbortController(),combined=signal?AbortSignal.any([signal,controller.signal]):controller.signal
    const retainedResponses=[]
    let firstParty=false,linkedEmployerEvidence=null,timer,listener
    const gap=(reason,cause)=>Object.assign(new Error('TaxBuddy coverage gap: '+reason,{cause}),{
      code:'TAXBUDDY_COVERAGE_GAP',retainedResponses,linkedEmployerEvidence,
      sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,
      inventoryEvidence:normalizeInventoryEvidence({status:'coverage-gap',surface:LISTING_URL,firstParty,
        listingComplete:false,pagesFetched:retainedResponses.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:now(),reason}),
    })
    const interrupted=new Promise((_,reject)=>{
      listener=()=>reject(combined.reason);combined.addEventListener('abort',listener,{once:true})
      timer=setTimeout(()=>controller.abort(Error('TaxBuddy aggregate deadline exceeded')),timeoutMs)
    })
    const inspect=async()=>{
      const read=async url=>{
        combined.throwIfAborted()
        const r=await fetchImpl(url,{signal:combined,redirect:'manual',headers:{Accept:'text/html','User-Agent':'Mozilla/5.0'}})
        combined.throwIfAborted();check(r.status===200&&r.url===url,'Native HTTP status or final identity changed')
        const body=await r.text();combined.throwIfAborted()
        check(typeof body==='string'&&body.trim()&&Buffer.byteLength(body)<=5000000,'Native response unavailable or oversized')
        retainedResponses.push({url,finalUrl:r.url,status:r.status,body,bodySHA256:createHash('sha256').update(body).digest('hex')})
        return active(body)
      }
      const home=await read(FIRST_PARTY_ROOT_URL)
      check(home.text(home.root).includes('TaxBuddy')&&home.nodes(n=>n.tag==='a'&&n.attrs.href===EMPLOYER_URL).length===1,'Official employer delegation changed')
      firstParty=true
      const company=await read(EMPLOYER_URL)
      check(company.nodes(n=>n.tag==='h1'&&company.text(n)==='TaxBuddy.com').length===1,'Native employer name changed')
      check(company.nodes(n=>n.attrs['data-semaphore-content-urn']==='urn:li:organization:14564264').length===1,'Native employer organization changed')
      const backlinks=company.nodes(n=>n.tag==='a'&&n.attrs['data-tracking-control-name']==='about_website').filter(n=>{
        try{const redirect=new URL(n.attrs.href),target=new URL(redirect.searchParams.get('url'));return redirect.origin==='https://www.linkedin.com'&&redirect.pathname==='/redir/redirect'&&['taxbuddy.com','www.taxbuddy.com'].includes(target.hostname)&&['http:','https:'].includes(target.protocol)&&!target.username&&!target.password}catch{return false}
      })
      check(backlinks.length===1,'Native employer website identity changed')
      const listing=await read(LISTING_URL)
      check(listing.nodes(n=>n.tag==='h1'&&listing.text(n)==='We couldn\u2019t find a match for Jobs jobs in India').length===1
        &&listing.nodes(n=>n.tag==='input'&&n.attrs.name==='f_C'&&n.attrs.value==='14564264'&&Object.hasOwn(n.attrs,'checked')).length===1,'Native employer-filtered search identity changed')
      check(listing.nodes(n=>listing.hasClass(n,'job-search-card')).length===0&&/We couldn[’']t find a match/.test(listing.text(listing.root)),'Native populated or changed search requires reviewed listing contract')
      linkedEmployerEvidence={organizationId:'14564264',observedIndiaSearchEmpty:true,scope:LISTING_URL,wholeCompanyInventoryVerified:false}
      throw gap('Linked employer India search has no matches; whole-company recruiting inventory remains unverified')
    }
    try{return await Promise.race([inspect(),interrupted])}
    catch(error){if(signal?.aborted)throw signal.reason;if(error?.code==='TAXBUDDY_COVERAGE_GAP')throw error;throw gap('Native recruiting transport or contract unavailable',error)}
    finally{clearTimeout(timer);combined.removeEventListener('abort',listener);controller.abort(Error('TaxBuddy inspection ended'))}
  },
})

export const run = async (options = {}) => createTaxBuddyScraper().run(options)

const isDirectExecution = process.argv[1]
  ?.replaceAll('\\', '/')
  .endsWith('/scraper/taxbuddy/script.js')

if (isDirectExecution) {
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
