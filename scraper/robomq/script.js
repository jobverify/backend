import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { document, decode } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { attachInventoryEvidence, normalizeInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { nativeDate, nativeCountryName, nativeLocationCountryName } from '../../scraper-support/shared/nativeJobPosting.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'robomq'
export const COMPANY = 'RoboMQ'
export const FIRST_PARTY_ROOT_URL = 'https://www.robomq.io/'

export const CAREERS_URL = 'https://www.linkedin.com/jobs/robomq-jobs-worldwide?position=1&pageNum=0'
const EMPLOYER_URL = 'https://www.linkedin.com/company/robomq-io'
const activeDocument = html => {
  const doc=document(html)
  const prune=(n,inherited=false)=>{
    n.inactive ||= inherited || /(?:^|;)\s*content-visibility\s*:\s*hidden\s*(?:!important\s*)?(?:;|$)/i.test(n.attrs?.style||'')
    for(const c of n.children.filter(c=>typeof c!=='string'))prune(c,n.inactive)
  }
  prune(doc.root)
  return doc
}
const companyUrl = value => {
  try { const u=new URL(value);return u.origin+u.pathname.replace(/\/$/,'') } catch { return null }
}
const requireProof=(ok,message)=>{if(!ok)throw Error(message)}
const schemas = html => activeDocument(html).nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json').flatMap(n=>{
  const value=JSON.parse(n.raw)
  return Array.isArray(value)?value:[value]
})

export const createRoboMQScraper = () => ({
  async run({fetchImpl=fetch,signal,timeoutMs=60000,now=()=>new Date().toISOString()}={}) {
    signal?.throwIfAborted()
    if(!Number.isFinite(timeoutMs)||timeoutMs<1||timeoutMs>180000)throw Error('Invalid RoboMQ deadline')
    const controller=new AbortController(),combined=signal?AbortSignal.any([signal,controller.signal]):controller.signal
    let timer,listener,pagesFetched=0,firstParty=false
    const evidence=()=>normalizeInventoryEvidence({status:'coverage-gap',surface:CAREERS_URL,firstParty,
      listingComplete:false,pagesFetched,reportedTotal:null,indiaFacetCount:null,verifiedAt:now(),
      reason:'Official careers links a mixed employer search; exhaustive employer inventory is unverified'})
    const gap=error=>Object.assign(new Error(`RoboMQ inventory coverage gap: ${error.message}`,{cause:error}),
      {code:'ROBOMQ_COVERAGE_GAP',inventoryEvidence:evidence()})
    const interrupted=new Promise((_,reject)=>{
      listener=()=>reject(combined.reason)
      combined.addEventListener('abort',listener,{once:true})
      timer=setTimeout(()=>controller.abort(Error('RoboMQ aggregate deadline exceeded')),timeoutMs)
    })
    const inspect=async()=>{
      const read=async url=>{
        combined.throwIfAborted()
        const r=await fetchImpl(url,{signal:combined,redirect:'manual',headers:{Accept:'text/html','User-Agent':'Mozilla/5.0'}})
        combined.throwIfAborted()
        requireProof(r.status===200&&r.url===url,'Native HTTP status or final identity changed')
        const body=await r.text();combined.throwIfAborted();pagesFetched++
        requireProof(typeof body==='string'&&body.length>0&&body.length<5000000,'Native body unavailable or exceeds bound')
        return body
      }
      const official=activeDocument(await read(FIRST_PARTY_ROOT_URL))
      requireProof(official.nodes(n=>n.tag==='a'&&n.attrs.href===CAREERS_URL&&/^careers$/i.test(official.text(n))).length===1,'Official careers handoff changed')
      firstParty=true
      const html=await read(CAREERS_URL),doc=activeDocument(html)
      requireProof(doc.nodes(n=>n.tag==='h1').some(n=>/Robomq Jobs in Worldwide/i.test(doc.text(n))),'Native recruiting search identity unavailable')
      const lists=schemas(html).filter(s=>s['@type']==='ItemList')
      requireProof(lists.length===1&&Array.isArray(lists[0].itemListElement)&&lists[0].itemListElement.length<=100,'Search result shape changed')
      const rows=lists[0].itemListElement.filter(r=>r.disambiguatingDescription===COMPANY)
      const jobs=[],seen=new Set()
      for(const row of rows){
        const u=new URL(row.url)
        requireProof(['in.linkedin.com','www.linkedin.com'].includes(u.hostname)&&u.protocol==='https:'&&!u.search&&!u.hash&&/^\/jobs\/view\/[a-z0-9-]+-\d+$/.test(u.pathname),'Unexpected native detail URL')
        const id=u.pathname.match(/-(\d+)$/)[1]
        requireProof(!seen.has(id),'Duplicate native requisition');seen.add(id)
        const detailHtml=await read(row.url),detailDoc=activeDocument(detailHtml)
        const posting=schemas(detailHtml).filter(s=>s['@type']==='JobPosting')
        requireProof(posting.length===1,'Expected one native JobPosting')
        const p=posting[0]
        requireProof(p.hiringOrganization?.name===COMPANY&&companyUrl(p.hiringOrganization.sameAs)===EMPLOYER_URL,'Native employer mismatch')
        requireProof(p.title===row.name&&detailDoc.nodes(n=>n.tag==='h1').some(n=>detailDoc.text(n)===p.title),'Native role title mismatch')
        requireProof(detailDoc.nodes(n=>n.tag==='a'&&companyUrl(n.attrs.href)===EMPLOYER_URL&&detailDoc.text(n)===COMPANY).length>0,'Native employer link missing')
        let locations=Array.isArray(p.jobLocation)?p.jobLocation:[p.jobLocation]
        requireProof(locations.length>0&&locations.every(l=>l?.address&&typeof l.address==='object'),'Native location shape changed')
        for(const l of locations){
          const country=nativeCountryName(l.address.addressCountry)
          const label=nativeLocationCountryName(l.address.addressLocality)
          requireProof(!label||!country||label===country,'Native country/locality conflict')
          requireProof(country!=='India'||! /^(?:California|Texas|New York|Florida|Washington|Ontario|British Columbia|New South Wales|CA|TX|NY|FL|WA|ON|BC|NSW)$/i.test(l.address.addressRegion||''),'Native country/region conflict')
        }
        if(!locations.every(l=>nativeCountryName(l.address.addressCountry)))continue
        locations=locations.filter(l=>nativeCountryName(l.address.addressCountry)==='India')
        if(!locations.length)continue
        const posted=nativeDate(p.datePosted),closing=nativeDate(p.validThrough)
        requireProof(!posted.iso||!closing.iso||closing.iso>=posted.iso,'Native expiry precedes publication')
        requireProof(Number.isFinite(Date.parse(now())),'Invalid RoboMQ reference date')
        if(posted.iso&&Date.parse(posted.iso)>Date.parse(now()))continue
        const descriptionDoc=activeDocument(decode(p.description||''))
        const activeText=descriptionDoc.text(descriptionDoc.root)
        const prose=n=>n.inactive||/^(?:h[1-6]|strong|b|script|style)$/.test(n.tag)?'':n.children.map(c=>typeof c==='string'?decode(c):prose(c)).join(' ')
        const substantive=prose(descriptionDoc.root).replace(/\s+/g,' ').trim()
        const description=substantive&&/[\p{L}\p{N}]/u.test(substantive)&&!/^(?:jd|job description|n\/a|tbd|apply now|placeholder)[.!: ]*$/i.test(substantive)?activeText:null
        jobs.push({id,jobId:id,source:SOURCE,company:COMPANY,title:p.title,country:'India',city:locations[0].address.addressLocality||null,
          location:locations.map(l=>[l.address.addressLocality,l.address.addressRegion,'India'].filter(Boolean).join(', ')).join('; '),
          sourceUrl:row.url,applyUrl:row.url,link:row.url,postingDate:posted.iso,postedAt:posted.iso,validThrough:closing.iso,closingDate:closing.iso,sourceClosingDateIsExact:closing.exact,
          employmentType:p.employmentType||null,sourceDescription:description,jobDescription:description,
          sourceDetailComplete:Boolean(description),sourceDetailStatus:description?'complete':'missing-description',
          sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,nativeJobPosting:p})
      }
      return attachInventoryEvidence(jobs,{...evidence(),status:'discovery-only'})
    }
    try{return await Promise.race([inspect(),interrupted])}
    catch(error){if(signal?.aborted)throw signal.reason;throw gap(error)}
    finally{clearTimeout(timer);combined.removeEventListener('abort',listener);controller.abort(Error('RoboMQ inspection ended'))}
  },
})

export const run = async (options = {}) => createRoboMQScraper().run(options)

const isDirectExecution = process.argv[1]
  ?.replaceAll('\\', '/')
  .endsWith('/scraper/robomq/script.js')

if (isDirectExecution) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
