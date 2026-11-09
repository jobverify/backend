import {readReviewedTensorGoChunks} from './currentChunks.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const API_BASE = 'https://api.humains.one'
const ORIGIN = 'https://tensorgo.com'
const indiaCities = /^(?:Hyderabad|Delhi|New Delhi|Bengaluru|Bangalore|Mumbai|Pune|Chennai)(?:,\s*India)?$/i
const foreignLocations = /\b(?:United States|USA|New York|United Kingdom|London|Dubai|UAE|Saudi Arabia|Singapore)\b/i

const validate = (row) => {
  if (!row || typeof row.id !== 'string' || !row.id || typeof row.slug !== 'string' || !/^[a-z0-9-]+$/.test(row.slug) || typeof row.title !== 'string' || !row.title.trim() || !Array.isArray(row.locations) || !row.locations.length || row.locations.some(location => typeof location !== 'string' || !location.trim())) throw new Error('TensorGo invalid job identity or country scope')
  if (row.datePosted && (!/^\d{4}-\d{2}-\d{2}$/.test(row.datePosted) || !Number.isFinite(Date.parse(row.datePosted)) || new Date(row.datePosted).toISOString().slice(0,10) !== row.datePosted)) throw new Error('TensorGo invalid posting date')
}

export const readCurrentCareers = async ({ html, readText, readJson, maxJobs, now }) => {
  const src = String(html).match(/<script\b[^>]*src=["']([^"']*\/static\/js\/main\.[^"']+\.js)["']/i)?.[1]
  if (!src) throw new Error('TensorGo current job inventory bundle is missing')
  const asset = new URL(src, ORIGIN)
  if (asset.origin !== ORIGIN) throw new Error('TensorGo job bundle has an unverified origin')
  const bundle = await readText(asset.href)
  const reviewedChunks = await readReviewedTensorGoChunks({html,asset,bundle,readText})
  const payload = await readJson(API_BASE + '/api/jobs')
  if (!payload || !Array.isArray(payload.items)) throw new Error('TensorGo invalid current public job inventory')
  if (payload.nextCursor || payload.next || payload.hasMore || payload.more_records || (payload.total != null && payload.total !== payload.items.length)) throw new Error('TensorGo incomplete pagination contract')
  if (payload.items.length === 0) {
    throw Object.assign(
      new Error('TensorGo public job inventory is unavailable: current API does not prove zero openings'),
      {
        code: 'TENSORGO_INVENTORY_UNAVAILABLE',
        softFailure: true,
        failureKind: 'upstream_inventory_unavailable',
        abortRetries: true,
      },
    )
  }
  const ids = new Set(), slugs = new Set()
  for (const row of payload.items) {
    validate(row)
    if (ids.has(row.id) || slugs.has(row.slug)) throw new Error('TensorGo duplicate job identity')
    ids.add(row.id); slugs.add(row.slug)
  }
  let unknown = false
  const indian = payload.items.filter(row => {
    if (row.locations.every(location => indiaCities.test(location))) return true
    if (!row.locations.every(location => foreignLocations.test(location))) unknown = true
    return false
  })
  if (unknown && !indian.length) throw new Error('TensorGo job country scope is unverified')
  const selected = Number.isInteger(maxJobs) && maxJobs > 0 ? indian.slice(0,maxJobs) : indian
  const jobs = []
  for (const row of selected) {
    const detail = await readJson(API_BASE + '/api/jobs/' + encodeURIComponent(row.slug))
    validate(detail)
    if (detail.id !== row.id || detail.slug !== row.slug || detail.title !== row.title || JSON.stringify(detail.locations) !== JSON.stringify(row.locations) || typeof detail.description !== 'string' || detail.description.trim().length < 40) throw new Error('TensorGo incomplete or mismatched job detail')
    if (reviewedChunks && (detail.description.trim().length < 300 || detail.description.trim() === detail.short?.trim()
      || ['department','type','yearsRange','workMode','datePosted','short'].some(field=>detail[field]!==row[field]))) throw new Error('TensorGo incomplete native criteria or mismatched job detail')
    const sourceUrl = ORIGIN + '/careers/' + row.slug
    jobs.push({title:row.title, company:'TensorGo Software Pvt Ltd', department:row.department || null, location:row.locations.join(', ') + ', India', locations:row.locations, city:row.locations.length === 1 ? row.locations[0] : null, country:'India', jobId:row.id, requisitionId:row.id, sourceUrl, applyUrl:sourceUrl, employmentType:row.type || null, experienceRequired:row.yearsRange || null, jobDescription:detail.description.trim(), postingDate:row.datePosted || null, closingDate:null, remoteStatus:row.workMode === 'WFH' ? 'Remote' : row.workMode === 'WFO' ? 'On-site' : null, source:'tensorgosoftwarepvtltd', link:sourceUrl, scrapedAt:now(), ...(unknown || selected.length < indian.length ? {sourceListingComplete:false} : {})})
  }
  if (reviewedChunks) {
    const closing=await readJson(API_BASE+'/api/jobs')
    if(!closing||!Array.isArray(closing.items)||closing.nextCursor||closing.next||closing.hasMore||closing.more_records
      ||closing.total!=null&&closing.total!==closing.items.length)throw Error('TensorGo closing inventory pagination changed')
    const snapshot=rows=>JSON.stringify(rows.map(row=>{
      validate(row)
      return ['id','slug','title','locations','department','type','yearsRange','workMode','datePosted','short'].map(field=>row[field]??null)
    }).sort((left,right)=>left[0].localeCompare(right[0])))
    if(snapshot(closing.items)!==snapshot(payload.items))throw Error('TensorGo closing native inventory changed')
    const complete=!unknown&&selected.length===indian.length
    for(const job of jobs)Object.assign(job,{sourceDetailComplete:true,sourceListingComplete:complete,sourceScopeComplete:false,lifecycleCleanupAllowed:false})
    return attachInventoryEvidence(jobs,{status:complete?'complete-inventory':'coverage-gap',surface:ORIGIN+'/careers',firstParty:true,
      listingComplete:complete,pagesFetched:2,reportedTotal:payload.items.length,indiaFacetCount:unknown?null:indian.length,
      verifiedAt:now(),reason:complete?'reviewed-current-native-api-and-closing-inventory':'unresolved-native-country-or-requested-sample'})
  }
  return jobs
}
