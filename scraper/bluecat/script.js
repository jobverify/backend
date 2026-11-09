import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createPublishingGapAtsScraper } from '../../scraper-support/utils/publishingGapAts.js'
import { attachInventoryEvidence, readInventoryEvidence, isFreshCompleteInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'
import { toPlainText } from '../../scraper-support/detailExtractors/shared.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "bluecat"
export const COMPANY = "BlueCat"
export const CAREERS_URL = 'https://bluecatnetworks.com/careers/'
export const DISPOSITION = 'live-parser'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Exact official bluecatnetworks Lever binding; all primary and secondary native locations are validated before India selection.'
const API = 'https://api.lever.co/v0/postings/bluecatnetworks?mode=json'
const requireProof = (ok, message) => { if (!ok) throw new Error(`BlueCat: ${message}`) }
const clean = value => typeof value === 'string' ? value.trim().replace(/\s+/g,' ') : ''
const countryNames = new Intl.DisplayNames(['en'],{type:'region'})
const countryLabels = new Map([['USA','US'],['US','US'],['United States of America','US'],['UK','GB']])
const countries = new Set()
for (let a=65;a<=90;a++) for (let b=65;b<=90;b++) {
  const code=String.fromCharCode(a,b), name=countryNames.of(code)
  if(name!==code && !['ZZ','EU','UN','XA','XB','QO'].includes(code)){countries.add(code);countryLabels.set(name,code)}
}
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
const patterns=[...countryLabels].map(([label,code])=>({code,pattern:new RegExp(`(?:^|[^\\p{L}])${escape(label)}(?=$|[^\\p{L}])`,'iu')}))
const labelCountries = label => [...new Set(patterns.filter(({pattern})=>pattern.test(label)).map(({code})=>code))]
// A primary country cannot constrain an explicitly worldwide/distributed label.
// Check phrases anywhere in both primary and secondary labels, while preserving
// bounded native labels such as "USA - Remote" and "Toronto Office".
const broadScope = /(?:^|[^\p{L}\p{N}])(?:global(?:ly)?|world[\s_-]*wide|any[\s_-]*where|distributed|any[\s_-]+(?:location|country|office)s?|multiple[\s_-]+locations?|unspecified)(?=$|[^\p{L}\p{N}])/iu
const generic = label => /^remote$/i.test(label) || broadScope.test(label)
const activeContent = html => {
  const source=String(html||''), output=[], inert=[], raw=new Set(['script','style','textarea','title','xmp','iframe','noscript','noembed','noframes','plaintext'])
  const tags=/<!--[\s\S]*?(?:-->|$)|<\/?([a-z][a-z0-9:_-]*)\b((?:[^"'<>]|"[^"]*"|'[^']*')*)>/gi
  let cursor=0,m
  while((m=tags.exec(source))){
    if(!inert.length)output.push(source.slice(cursor,m.index))
    cursor=tags.lastIndex
    if(!m[1])continue
    const name=m[1].toLowerCase(),closing=m[0].startsWith('</')
    if(closing){if(name==='template'&&inert.at(-1)===name)inert.pop();else if(!inert.length)output.push(m[0]);continue}
    if(raw.has(name)){
      const end=name==='plaintext'?null:new RegExp(`</${name}\\s*>`,'ig');if(end)end.lastIndex=cursor
      const close=end?.exec(source);cursor=close?end.lastIndex:source.length;tags.lastIndex=cursor;continue
    }
    if(name==='template'){inert.push(name);continue}
    if(!inert.length)output.push(m[0])
  }
  if(!inert.length)output.push(source.slice(cursor))
  return output.join('')
}
const usable = value => typeof value==='string' && hasSourceDescription({sourceDescription:value}) && Boolean(toPlainText(activeContent(value)))
const validateInventory = (records, checkedAt) => {
  requireProof(Array.isArray(records),'Expected complete public postings array')
  const ids=new Set(), primaryCountries=new Map()
  for(const row of records){
    requireProof(row && typeof row==='object' && !Array.isArray(row) && typeof row.id==='string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(row.id)
      && clean(row.text) && !ids.has(row.id),'Missing or duplicate native identity')
    ids.add(row.id)
    requireProof(row.hostedUrl===`https://jobs.lever.co/bluecatnetworks/${row.id}` && row.applyUrl===`${row.hostedUrl}/apply`,'Native board/application identity changed')
    requireProof(typeof row.country==='string' && countries.has(row.country),'Unknown native primary country')
    const primary=clean(row.categories?.location)
    requireProof(primary && !generic(primary) && Array.isArray(row.categories?.allLocations) && row.categories.allLocations.length>0
      && row.categories.allLocations.every(v=>typeof v==='string' && clean(v)) && row.categories.allLocations.includes(row.categories.location),'Missing native primary/secondary location inventory')
    const explicit=labelCountries(primary)
    requireProof(explicit.length<=1 && (!explicit.length || explicit[0]===row.country),'Primary country/location contradiction')
    const key=primary.toLowerCase()
    requireProof(!primaryCountries.has(key)||primaryCountries.get(key)===row.country,'Conflicting native office country corroboration')
    primaryCountries.set(key,row.country)
    requireProof(Number.isSafeInteger(row.createdAt) && row.createdAt>0 && row.createdAt<=checkedAt,'Invalid or future native publication')
    for(const key of ['location','locations','secondaryLocations'])requireProof(row[key]==null,'Unsupported additional native geographic scope')
    for(const key of ['description','descriptionPlain','descriptionBody','descriptionBodyPlain','opening','openingPlain','additional','additionalPlain'])
      requireProof(row[key]==null||typeof row[key]==='string','Malformed native employer content')
    requireProof(Array.isArray(row.lists) && row.lists.every(item=>item && typeof item==='object' && typeof item.text==='string' && typeof item.content==='string'),'Malformed native content sections')
  }
  return records.map(row=>{
    const scope=row.categories.allLocations.map(location=>{
      const label=clean(location), explicit=labelCountries(label), corroborated=primaryCountries.get(label.toLowerCase())
      requireProof(!generic(label) && explicit.length<=1,'Unknown or contradictory secondary location')
      const country=explicit[0]||corroborated
      requireProof(country && (!corroborated||!explicit.length||country===corroborated),'Unresolved native secondary location country')
      return {location:label,country,evidence:explicit.length?'explicit-country-label':'same-inventory-primary-country'}
    })
    const india=scope.filter(s=>s.country==='IN').map(s=>s.location)
    const body=usable(row.descriptionBody)?row.descriptionBody:usable(row.descriptionBodyPlain)?row.descriptionBodyPlain:null
    const description=body?[row.opening||row.openingPlain||'',body,...row.lists.map(s=>`${s.text}\n${s.content}`),row.additional||row.additionalPlain||''].filter(Boolean).map(activeContent).join('\n\n'):null
    return {row,scope,india,description}
  })
}

export const run = async ({fetchJson,signal,now=()=>new Date().toISOString(),maxJobs=null}={}) => {
  signal?.throwIfAborted()
  const checkedAt=now()
  requireProof(Number.isFinite(Date.parse(checkedAt)) && (maxJobs===null || Number.isSafeInteger(maxJobs)&&maxJobs>=0),'Invalid runtime bounds')
  const payload=fetchJson?await fetchJson(API,{signal}):await (async()=>{
    const response=await fetch(API,{redirect:'error',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(30000)]):AbortSignal.timeout(30000)})
    requireProof(response.status===200&&response.url===API,`Native HTTP ${response.status}`)
    return response.json()
  })()
  signal?.throwIfAborted()
  const validated=validateInventory(payload,Date.parse(checkedAt))
  const byId=new Map(validated.map(item=>[item.row.id,item]))
  const projected=validated.map(item=>{
    const qualified=place=>labelCountries(place.location).includes(place.country)
      ? place.location:`${place.location}, ${countryNames.of(place.country)}`
    const primary=item.scope.find(place=>place.location===clean(item.row.categories.location))
    requireProof(primary,'Validated primary office is missing from native location scope')
    // This is the selected-location view consumed by the common mapper. Keep
    // the original primary country and all office labels below as native proof.
    return {...item.row,country:item.india.length?'IN':item.row.country,
      categories:{...item.row.categories,
        location:item.india.length?item.scope.filter(place=>place.country==='IN').map(qualified).join('; '):qualified(primary),
        allLocations:item.scope.map(qualified)},
      descriptionPlain:item.description||'',description:item.description||'',lists:[],additional:'',additionalPlain:''}
  })
  const mapped=await createPublishingGapAtsScraper({source:SOURCE,companyName:COMPANY,atsPlatform:'lever',boardToken:'bluecatnetworks',countryFilter:'India'}).run({signal,fetchJson:async()=>projected})
  const inner=readInventoryEvidence(mapped), selected=maxJobs===null?mapped:mapped.slice(0,maxJobs)
  const complete=isFreshCompleteInventoryEvidence(inner)&&selected.length===mapped.length
  const jobs=selected.map(job=>{
    const item=byId.get(job.jobId)
    requireProof(item?.india.length,'Mapped role lacks explicit native India location')
    return {...job,location:item.india.join('; '),locations:item.india,country:'India',postingDate:new Date(item.row.createdAt).toISOString(),
      jobDescription:item.description,sourceDescription:item.description,sourceDetailComplete:Boolean(item.description),sourceDetailFailureKind:item.description?null:'missing-content',
      sourceListingComplete:complete,nativePrimaryCountry:item.row.country,nativePrimaryLocation:item.row.categories.location,
      nativeAllLocations:[...item.row.categories.allLocations],nativeLocationEvidence:item.scope}
  })
  signal?.throwIfAborted()
  return attachInventoryEvidence(jobs,{status:complete?payload.length?'complete-inventory':'verified-empty':'discovery-only',surface:API,firstParty:true,
    listingComplete:complete,pagesFetched:1,reportedTotal:payload.length,indiaFacetCount:validated.filter(item=>item.india.length).length,verifiedAt:checkedAt,
    reason:complete?'Unfiltered public Lever all-postings response; every native primary and secondary country validated.':'Validated native listing with incomplete role content or output cap.'})
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
