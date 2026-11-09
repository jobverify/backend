import {createHash} from 'node:crypto'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {normalizeInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

export const CAREERS_URL = 'https://synup.com/careers'
export const HANDOFF_CTA = 'SEE OPEN POSITIONS'
export const LINKEDIN_HOST = 'www.linkedin.com'
export const EMPLOYER_URL = 'https://www.linkedin.com/company/synup/jobs/'
export const PROFILE_URL = 'https://www.linkedin.com/company/synup'
export const INDIA_SEARCH_URL = 'https://www.linkedin.com/jobs/search/?f_C=9322483&location=India'
export const INDIA_GUEST_URL = 'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?f_C=9322483&location=India&start=0'

// The public handoff establishes recruiting continuity, not an enumerable
// inventory. A transport error or a populated replacement must never become a
// successful empty run that could retire previously collected jobs.
export const run = async ({fetchImpl=globalThis.fetch,signal,timeoutMs=30000,now=()=>new Date().toISOString()}={}) => {
  signal?.throwIfAborted()
  const retainedResponses=[]
  let firstParty=false,delegatedEmployerUrl=null,linkedEmployerEvidence=null,timer,listener
  const gap=(reason,cause)=>Object.assign(new Error('Synup coverage gap: '+reason,{cause}),{
    code:'SYNUP_COVERAGE_GAP',reason,retainedResponses,delegatedEmployerUrl,linkedEmployerEvidence,
    sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,
    inventoryEvidence:normalizeInventoryEvidence({status:'coverage-gap',surface:CAREERS_URL,firstParty,
      listingComplete:false,pagesFetched:retainedResponses.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:now(),reason}),
  })
  if(!Number.isFinite(timeoutMs)||timeoutMs<1||timeoutMs>120000)throw gap('Invalid aggregate deadline')
  const controller=new AbortController(),combined=signal?AbortSignal.any([signal,controller.signal]):controller.signal
  const interrupted=new Promise((_,reject)=>{
    listener=()=>reject(combined.reason)
    combined.addEventListener('abort',listener,{once:true})
    timer=setTimeout(()=>controller.abort(gap('Official careers aggregate deadline exceeded')),timeoutMs)
  })
  const read=async url=>{
    combined.throwIfAborted()
    const response=await fetchImpl(url,{signal:combined,redirect:'manual',headers:{Accept:'text/html','User-Agent':'Mozilla/5.0'}})
    combined.throwIfAborted()
    if(response?.url!==url)throw gap('Native final URL identity changed')
    const body=await response.text()
    combined.throwIfAborted()
    if(typeof body!=='string'||Buffer.byteLength(body)>5000000)throw gap('Native response unavailable or oversized')
    retainedResponses.push({url,finalUrl:response.url,status:response.status,body,
      bodySHA256:createHash('sha256').update(body).digest('hex')})
    if(response.status!==200)throw gap('Native HTTP '+response.status)
    return body
  }
  const active=body=>{
    const doc=document(body)
    const prune=(node,inherited=false)=>{
      const style=(node.attrs?.style||'').replace(/\/\*[\s\S]*?\*\//g,'')
      node.inactive ||= inherited||/(?:^|;)\s*content-visibility\s*:\s*hidden\s*(?:!important\s*)?(?:;|$)/i.test(style)
      for(const child of node.children.filter(n=>typeof n!=='string'))prune(child,node.inactive)
    }
    prune(doc.root)
    return doc
  }
  const inspect=async()=>{
    const doc=active(await read(CAREERS_URL))
    const canonical=doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical')
    if(canonical.length!==1||canonical[0].attrs.href!==CAREERS_URL
      ||doc.nodes(n=>n.tag==='meta'&&n.attrs.property==='og:title'&&n.attrs.content==='Join Our Team: Synup Careers | Synup').length!==1
      ||doc.nodes(n=>n.tag==='h1'&&doc.text(n)==='Join us').length!==1
      ||doc.nodes(n=>n.tag==='h2'&&doc.text(n)==='Careers at Synup').length!==1)throw gap('Official careers identity changed')
    firstParty=true
    const handoffs=doc.nodes(n=>n.tag==='a'&&doc.text(n)===HANDOFF_CTA)
    if(handoffs.length!==2||handoffs.some(n=>n.attrs.href!==EMPLOYER_URL))throw gap('Official recruiting delegation changed')
    delegatedEmployerUrl=EMPLOYER_URL
    const company=active(await read(PROFILE_URL))
    if(company.nodes(n=>n.tag==='h1'&&company.text(n)==='Synup').length!==1
      ||company.nodes(n=>n.attrs['data-semaphore-content-urn']==='urn:li:organization:9322483').length!==1)throw gap('Delegated employer identity changed')
    const backlinks=company.nodes(n=>n.tag==='a'&&n.attrs['data-tracking-control-name']==='about_website').filter(n=>{
      try{const redirect=new URL(n.attrs.href),target=new URL(redirect.searchParams.get('url'))
        return redirect.origin==='https://www.linkedin.com'&&redirect.pathname==='/redir/redirect'
          &&['synup.com','www.synup.com'].includes(target.hostname)&&['http:','https:'].includes(target.protocol)&&!target.username&&!target.password
      }catch{return false}
    })
    if(backlinks.length!==1)throw gap('Delegated employer website changed')
    const listing=active(await read(INDIA_SEARCH_URL))
    if(listing.nodes(n=>n.tag==='input'&&n.attrs.name==='f_C'&&n.attrs.value==='9322483'&&Object.hasOwn(n.attrs,'checked')).length!==1
      ||listing.nodes(n=>n.tag==='h1'&&listing.text(n)==='We couldn\u2019t find a match for Jobs jobs in India').length!==1
      ||listing.nodes(n=>listing.hasClass(n,'job-search-card')).length)throw gap('Delegated India listing populated or changed; full inventory requires review')
    const guest=await read(INDIA_GUEST_URL)
    if(guest.replace(/<!doctype html\s*>/ig,'').replace(/<!--[\s\S]*?-->/g,'').trim()!=='')throw gap('Guest India listing disagrees with no-match search')
    linkedEmployerEvidence={organizationId:'9322483',observedIndiaSearchEmpty:true,scope:INDIA_SEARCH_URL,wholeCompanyInventoryVerified:false}
    throw gap('Current employer-filtered India search has no matches; whole-company inventory, country totals and historical post activity remain unverified')
  }
  try{return await Promise.race([inspect(),interrupted])}
  catch(error){
    if(signal?.aborted)throw signal.reason
    if(error?.code==='SYNUP_COVERAGE_GAP')throw error
    throw gap('Official recruiting transport or contract unavailable',error)
  }finally{
    clearTimeout(timer);combined.removeEventListener('abort',listener);controller.abort(Error('Synup inspection ended'))
  }
}
