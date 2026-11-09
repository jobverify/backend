import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPublishingGapAtsScraper } from '../../scraper-support/utils/publishingGapAts.js'
import { fetchJsonWithRetry, composeAbortSignals } from '../../scraper-support/utils/fetch.js'
import { nativeLocationCountryName, nativeCountryName } from '../../scraper-support/shared/nativeJobPosting.js'
import { attachInventoryEvidence, readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { isIndiaJob } from '../../scraper-support/utils/indiaLocationFilter.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'aviatrixsystems'
export const COMPANY = 'Aviatrix Systems'
export const FIRST_PARTY_CAREERS_URL = 'https://aviatrix.ai/company/careers/'
export const JOBS_API_URL = 'https://boards-api.greenhouse.io/v1/boards/aviatrix/jobs?content=true'
export const OFFICES_API_URL = 'https://boards-api.greenhouse.io/v1/boards/aviatrix/offices?render_as=tree'

const requireInventory = (condition, reason) => {
  if (!condition) throw new Error(`Aviatrix official inventory: ${reason}`)
}

const officeCountries = payload => {
  requireInventory(payload && !payload.error && payload.success !== false && !payload.errors?.length
    && Array.isArray(payload.offices), 'invalid office response')
  const countries = new Map(), identities = new Map(), labels = new Map()
  const labelKey = value => typeof value === 'string' ? value.replace(/\s+/g,' ').trim() : null
  const rememberLabel = (value,country) => {
    const key=labelKey(value)
    if(!key || !country)return
    labels.set(key,labels.has(key) && labels.get(key)!==country ? null:country)
  }
  const walk = (office, parentCountry = null) => {
    requireInventory(office && Number.isSafeInteger(office.id) && !countries.has(office.id)
      && typeof office.name === 'string' && Array.isArray(office.children), 'invalid office tree')
    const physicalLocation=office.location==='Bengaluru, Karnataka, India (APAC)'
      ? 'Bengaluru, Karnataka, India':office.location
    const country = nativeLocationCountryName(physicalLocation) || nativeCountryName(office.name) || parentCountry
    countries.set(office.id, country)
    identities.set(office.id,{name:office.name,location:office.location})
    rememberLabel(office.name,country)
    rememberLabel(office.location,country)
    office.children.forEach(child => walk(child, country))
  }
  payload.offices.forEach(office => walk(office))
  return {countries,identities,labels}
}

const validateInventory = (payload, {countries,identities}) => {
  requireInventory(payload && !payload.error && payload.success !== false && Array.isArray(payload.jobs), 'invalid response')
  requireInventory(Number.isSafeInteger(payload.meta?.total) && payload.meta.total === payload.jobs.length
    && payload.hasMore !== true, 'incomplete native total')
  const ids = new Set()
  let scopeComplete = true
  for (const job of payload.jobs) {
    requireInventory(job && /^\d+$/.test(String(job.id)) && !ids.has(String(job.id)), 'missing or duplicate job identity')
    ids.add(String(job.id))
    requireInventory(typeof job.title === 'string' && job.title.trim() && job.company_name === 'Aviatrix', 'employer/title mismatch')
    requireInventory(typeof job.location?.name === 'string' && job.location.name.trim(), 'location missing')
    const url = new URL(job.absolute_url)
    requireInventory(url.protocol === 'https:' && !url.username && !url.password && !url.port && !url.hash
      && ['aviatrix.com', 'www.aviatrix.com', 'aviatrix.ai'].includes(url.hostname)
      && url.pathname.replace(/\/$/, '') === '/careers' && [...url.searchParams.keys()].join() === 'gh_jid'
      && url.searchParams.get('gh_jid') === String(job.id),
    'application identity mismatch')
    // The native office tree supplies country scope for labels such as Santa
    // Clara, CA. Unknown office bindings cannot prove a zero India inventory.
    const locations = job.location.name.split(';').map(value => value.trim().replace(/\s*\([^)]*\)\s*$/, ''))
    for(const office of Array.isArray(job.offices)?job.offices:[]){
      const native=identities.get(office?.id)
      if(native)for(const field of ['name','location']){
        if(office[field]!=null)requireInventory(office[field]===native[field],'embedded office identity conflicts with current office tree')
      }
    }
    const scopedOffices = Array.isArray(job.offices) && job.offices.length > 0
      && job.offices.every(office => countries.get(office?.id))
    if (!scopedOffices && locations.some(value => !nativeLocationCountryName(value))) scopeComplete = false
    if (scopedOffices && job.offices.some(office => countries.get(office.id) === 'India')
      && !locations.some(value => nativeLocationCountryName(value) === 'India')) scopeComplete = false
    if (scopedOffices && locations.some(value => nativeLocationCountryName(value) === 'India')
      && !job.offices.some(office => countries.get(office.id) === 'India')) scopeComplete = false
  }
  return scopeComplete
}

const projectOfficeScope = (payload,scope) => {
  const broad=/\b(?:remote|worldwide|global|anywhere|APAC|EMEA|AMER|LATAM)\b/i
  const qualified=(value,assignedCountry=null)=>{
    const label=typeof value==='string'?value.replace(/\s+/g,' ').trim():value
    const country=assignedCountry||scope.labels.get(label)
    requireInventory(country || !scope.labels.has(label) || scope.labels.get(label)!==null,
      'ambiguous native office country scope')
    // This exact captured label identifies a physical India office in the
    // native office tree. Its APAC suffix is retained in the raw evidence.
    if(label==='Bengaluru, Karnataka, India (APAC)' && country==='India')return'Bengaluru, Karnataka, India'
    if(!country || broad.test(label) || nativeLocationCountryName(label))return label
    return`${label}, ${country}`
  }
  return {...payload,jobs:payload.jobs.map(job=>{
    const assigned=Array.isArray(job.offices)?job.offices:[]
    const primaryCountry=label=>{
      const values=[...new Set(assigned.filter(office=>[office.name,office.location].includes(label))
        .map(office=>scope.countries.get(office.id)).filter(Boolean))]
      if(values.length===1)return values[0]
      const assignedCountries=[...new Set(assigned.map(office=>scope.countries.get(office.id)).filter(Boolean))]
      if(assignedCountries.length===1)return assignedCountries[0]
      requireInventory(!(assignedCountries.length>1 && !assignedCountries.includes('India')
        && !/\bindia\b/i.test(label) && !broad.test(label) && isIndiaJob({location:label})),
      'assigned foreign office countries conflict with inferred India location scope')
      return null
    }
    return {...job,
      location:{...job.location,name:job.location.name.split(';').map(label=>{
        const trimmed=label.trim()
        return qualified(trimmed,primaryCountry(trimmed))
      }).join('; ')},
      ...(Array.isArray(job.offices)?{offices:job.offices.map(office=>({...office,
        location:qualified(office.location||office.name,scope.countries.get(office.id))}))}:{}),
    }
  })}
}

export const createAviatrixSystemsScraper = () => ({
  async run({ fetchJson = fetchJsonWithRetry, signal, timeoutMs = 45000 } = {}) {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 120000) throw new Error('Invalid Aviatrix timeout')
    signal?.throwIfAborted()
    const deadline = new AbortController()
    const combinedSignal = composeAbortSignals(signal, deadline.signal)
    const timer = setTimeout(() => deadline.abort(new Error('Aviatrix source timed out')), timeoutMs)
    let onAbort
    const aborted = new Promise((_, reject) => {
      onAbort = () => reject(combinedSignal.reason)
      combinedSignal.addEventListener('abort', onAbort, { once: true })
    })
    try {
      const collect = async () => {
        const payload = await fetchJson(JOBS_API_URL, { signal: combinedSignal, timeoutMs: Math.min(timeoutMs, 20000), attempts: 1 })
        combinedSignal.throwIfAborted()
        const offices = await fetchJson(OFFICES_API_URL, { signal: combinedSignal, timeoutMs: Math.min(timeoutMs, 20000), attempts: 1 })
        combinedSignal.throwIfAborted()
        const scope=officeCountries(offices)
        const sourceScopeComplete = validateInventory(payload,scope)
        const projected=projectOfficeScope(payload,scope)
        const jobs=await createPublishingGapAtsScraper({ source: SOURCE, companyName: COMPANY,
          atsPlatform: 'greenhouse', boardToken: 'aviatrix', companyDomain: 'aviatrix.ai',
          companyCareerPage: FIRST_PARTY_CAREERS_URL, sourceScopeComplete,
        }).run({ fetchJson: async () => projected, signal: combinedSignal })
        const byId=new Map(payload.jobs.map(job=>[String(job.id),job]))
        return attachInventoryEvidence(jobs.map(job=>{
          const native=byId.get(String(job.jobId))
          return {...job,sourceNativeLocationEvidence:{primary:native.location.name,
            offices:native.offices==null?null:structuredClone(native.offices)}}
        }),readInventoryEvidence(jobs))
      }
      return await Promise.race([collect(), aborted])
    } finally {
      clearTimeout(timer)
      combinedSignal.removeEventListener('abort', onAbort)
    }
  },
})

export const run = async (options = {}) => createAviatrixSystemsScraper().run(options)

const isDirectExecution = process.argv[1]
  ?.replaceAll('\\', '/')
  .endsWith('/scraper/aviatrixsystems/script.js')

if (isDirectExecution) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
