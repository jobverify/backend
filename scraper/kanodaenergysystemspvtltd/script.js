import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { activeHead, decodeNativeEntities, readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { createFirstPartyDocumentReader } from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import { nativeCountryName } from '../../scraper-support/shared/nativeJobPosting.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence, readSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const SOURCE = 'kanodaenergysystemspvtltd'
export const COMPANY = 'Kanoda Energy Systems Pvt. Ltd.'
export const HOMEPAGE_URL = 'https://www.kanoda.com/'
export const CAREERS_URL = 'https://www.kanoda.com/careers.html'
const normalize = value => String(value ?? '').replace(/\s+/g, ' ').trim()
const slugify = value => normalize(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
const need = (value, message) => { if (!value) throw Object.assign(Error('Kanoda verified native careers: ' + message), {softFailure:true, lifecycleCleanupAllowed:false}) }
const excluded = new Set(['head','script','style','title','meta','svg','iframe','object','blockquote','q','code','pre','samp','cite','del','s'])
const surface = html => {
  const original = readNativeDocument(html), nodes = []
  const text = node => typeof node === 'string' ? decodeNativeEntities(node)
    : node.inert || excluded.has(node.tag) ? '' : normalize(node.children.map(text).join(' '))
  const walk = node => {
    if (typeof node === 'string' || node.inert || excluded.has(node.tag)) return
    nodes.push(node)
    node.children.forEach(walk)
  }
  walk(original.nodes(() => true)[0])
  return {nodes, text, hasClass:original.hasClass}
}
const within = (root, nodes) => {
  const retained = new Set(nodes), result = []
  const walk = node => { if (!retained.has(node)) return; result.push(node); node.children.filter(child => typeof child !== 'string').forEach(walk) }
  walk(root)
  return result
}
const heading = (node, text, label) => /^h[1-6]$/.test(node.tag) && text(node) === label
const ownCareersLink = node => {
  if (node.tag !== 'a' || !node.attrs.href) return false
  try { return new URL(node.attrs.href, HOMEPAGE_URL).href === CAREERS_URL } catch { return false }
}
export const hasOfficialHomepageSignal = html => {
  const {nodes,text} = surface(html), titles = activeHead(html).titles
  return !readNativeDocument(html).nodes(node=>node.tag==='base').length
    && titles.length === 1 && titles[0] === COMPANY
    && nodes.some(node => heading(node,text,'Mainstreaming Renewables.'))
    && nodes.some(node => heading(node,text,'Work With Us'))
    && nodes.some(ownCareersLink)
    && nodes.some(node => node.tag === 'p' && /careers@kanoda\.com/i.test(text(node)))
}
export const hasOfficialCareersSignal = html => {
  const {nodes,text,hasClass} = surface(html), titles = activeHead(html).titles
  return !readNativeDocument(html).nodes(node=>node.tag==='base').length
    && titles.length === 1 && titles[0] === 'Careers | ' + COMPANY
    && nodes.filter(node => heading(node,text,'Job Openings')).length === 1
    && nodes.filter(node => node.tag === 'div' && node.attrs.id === 'accordionExample' && hasClass(node,'accordion')).length === 1
}
const countryNames = new Set()
for (let a=65;a<=90;a++) for (let b=65;b<=90;b++) { const name=nativeCountryName(String.fromCharCode(a,b)); if(name)countryNames.add(name) }
const countryPatterns = [...countryNames].map(country => [country,new RegExp('(?:^|[^\\p{L}])'+country.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?=$|[^\\p{L}])','iu')])
const countries = value => countryPatterns.filter(([,pattern])=>pattern.test(value)).map(([country])=>country)
const scalarLabel = value => normalize(value).replace(/^\d+[.)]\s*/, '').replace(/\s*:\s*$/, '').toLowerCase()
const ownCountryAddress = ({nodes,text,hasClass}) => {
  const contacts = nodes.filter(node => node.tag === 'div' && hasClass(node,'block')
    && node.children.some(child => typeof child !== 'string' && heading(child,text,'Locate Us')))
  if (contacts.length !== 1) return null
  const label = text(contacts[0])
  // This is one literal native worksite/address pair, not a city dictionary or
  // a company headquarters country default applied to arbitrary workplaces.
  if (!/\bAhmedabad\s*-\s*380054\s+Gujarat\s*-\s*India$/.test(label)
    || JSON.stringify(countries(label)) !== '["India"]') return null
  return {city:'Ahmedabad',state:'Gujarat',country:'India',nativeText:label}
}
const roleLocation = (value,address) => {
  const raw=normalize(value), explicit=countries(raw)
  if (!raw || /\b(?:not|except|excluding|outside|without)\b/i.test(raw)) return {location:raw||null,city:null,country:null,nativeWorkCountryEvidence:null}
  if (explicit.length===1) return {location:raw,city:null,country:explicit[0],
    nativeWorkCountryEvidence:{kind:'own-explicit-written-country',nativeText:raw,country:explicit[0]}}
  if (!explicit.length && address && raw===address.city) return {location:raw+', '+address.state+', '+address.country,city:raw,country:address.country,
    nativeWorkCountryEvidence:{kind:'literal-role-city-to-own-published-address',...address}}
  return {location:raw,city:null,country:null,nativeWorkCountryEvidence:null}
}
const flowLines = root => {
  const walk = node => {
    if(typeof node==='string')return decodeNativeEntities(node)
    if(node.inert||excluded.has(node.tag))return ''
    const content=node.children.map(walk).join(' ')
    return /^(?:p|div|section|article|aside|main|address|li|ul|ol|dl|dd|dt|table|thead|tbody|tfoot|tr|td|th|caption|figure|figcaption|details|summary|fieldset|legend|form|header|footer|nav|hr|br|h[1-6])$/.test(node.tag)?'\n'+content+'\n':content
  }
  return walk(root).split('\n').map(normalize).filter(Boolean)
}
const employerKey = value => normalize(value).toLowerCase().replace(/[^a-z0-9]/g,'')
const ownEmployerKeys = new Set([COMPANY,COMPANY+' (KESPL)','Kanoda Energy Systems Private Limited','Kanoda Energy Systems Private Limited (KESPL)'].map(employerKey))
const ownDeclarations = (panel,fields,address) => {
  const employers=[],worksites=[]
  for(const [label,value]of fields){
    if(/^(?:legal |hiring |actual )?(?:company|employer|hiring organization)$/.test(label))employers.push(value)
    if(/^(?:(?:primary|additional|work|job|employment|office|duty|assigned) )*(?:location|country|workplace|worksite|place of work)$/.test(label))worksites.push({value,typedCountry:/country$/.test(label)})
  }
  const lines=flowLines(panel)
  for(let index=0;index<lines.length;index++){
    let line=lines[index]
    // Labels and their own following values may be published in separate
    // native blocks. Preserve the original block boundaries before pairing.
    if(/^(?:(?:(?:legal|hiring|actual)\s+)?(?:employer|company|hiring organization)|(?:(?:primary|additional|work|job|employment|office|duty|assigned)\s+)*(?:location|country|workplace|worksite|place of work))\s*:?$/i.test(line)){
      let next=index+1
      if(lines[next]===':')next++
      const value=lines[next]
      if(value)line=line.replace(/\s*:\s*$/,'')+': '+value
    }
    const employer=line.match(/^(?:(?:legal|hiring|actual)\s+)?(?:employer|company|hiring organization)\s*:\s*(.+)$/i)
      ||line.match(/\b(?:you\s+(?:are|will\s+be)\s+employed\s+by|your\s+(?:legal\s+)?employer\s+(?:is|will\s+be))\s+(.+)$/i)
    if(employer)employers.push(employer[1])
    const worksite=line.match(/^((?:(?:primary|additional|work|job|employment|office|duty|assigned)\s+)*(?:location|country|workplace|worksite|place of work))\s*:\s*(.+)$/i)
    if(worksite)worksites.push({value:worksite[2],typedCountry:/country$/i.test(worksite[1])})
    const assignment=line.match(/\b(?:you|this role|this position|the role)\s+(?:will be|are|is)\s+(?:based|located|assigned|working)\s+(?:in|at)\s+(.+)$/i)
    if(assignment)worksites.push({value:assignment[1],typedCountry:false})
  }
  const subject='(?:Kanoda\\s+Energy\\s+Systems\\s+(?:Pvt\\.?|Private)\\s+(?:Ltd\\.?|Limited)(?:\\s*\\(KESPL\\))?|KESPL|we|our company|this company)'
  const ownDenial=new RegExp('\\b'+subject+'\\s+(?:is|are|will be)\\s+not\\s+(?:(?:your|the)\\s+)?(?:legal\\s+)?employer\\b','i')
  const inverseDenial=new RegExp('\\byour\\s+(?:legal\\s+)?employer\\s+(?:is|will be)\\s+not\\s+'+subject+'\\b','i')
  const employmentDenial=new RegExp('\\byou\\s+(?:(?:will\\s+not|won[\u0027\u2019]t)\\s+be|are\\s+not)\\s+employed\\s+by\\s+'+subject+'\\b','i')
  const joined=lines.join(' ')
  return {employerConflict:ownDenial.test(joined)||inverseDenial.test(joined)||employmentDenial.test(joined)||employers.some(value=>!ownEmployerKeys.has(employerKey(value))),
    worksites:worksites.map(({value,typedCountry})=>({nativeText:value,country:typedCountry?nativeCountryName(value):roleLocation(value,address).country}))}
}
export const extractJobs = html => {
  need(hasOfficialCareersSignal(html),'current publisher or accordion contract changed')
  const page=surface(html),{nodes,text,hasClass}=page,address=ownCountryAddress(page)
  const accordion=nodes.find(node=>node.attrs.id==='accordionExample')
  const cards=accordion.children.filter(node=>typeof node!=='string'&&!node.inert&&hasClass(node,'card'))
  need(cards.length>0&&cards.length<=100,'bounded public job listings required')
  const jobs=[],seenTargets=new Set(),seenIds=new Set()
  for (const card of cards) {
    const own=within(card,nodes),headers=own.filter(node=>hasClass(node,'card-header'))
    need(headers.length===1,'one own native card header required')
    const links=within(headers[0],nodes).filter(node=>node.tag==='a'&&node.attrs['data-toggle']==='collapse')
    need(links.length===1,'one own native card handoff required')
    const target=links[0].attrs['data-target'],title=text(links[0])
    need(/^#[a-zA-Z][\w-]*$/.test(target||'')&&!seenTargets.has(target),'duplicate or invalid native panel binding')
    const panels=own.filter(node=>node.attrs.id===target.slice(1)&&hasClass(node,'collapse'))
    need(panels.length===1&&panels[0].attrs['aria-labelledby']===headers[0].attrs.id
      &&panels[0].attrs['data-parent']==='#accordionExample','own native card/panel binding changed')
    seenTargets.add(target)
    const panel=panels[0],content=within(panel,nodes),fields=new Map()
    for (const block of content.filter(node=>hasClass(node,'block-wrapper'))) {
      const blockNodes=within(block,nodes),labels=blockNodes.filter(node=>hasClass(node,'left')),values=blockNodes.filter(node=>hasClass(node,'right-side'))
      need(labels.length===1&&values.length===1,'own native field boundary changed')
      const label=scalarLabel(text(labels[0]))
      need(label&&!fields.has(label),'duplicate native role field')
      fields.set(label,text(values[0]))
    }
    const nativeCompany=fields.get('company'),location=roleLocation(fields.get('location'),address)
    const declarations=ownDeclarations(panel,fields,address)
    // Every source card is observed, including a card whose own company is not
    // the reviewed publisher. Such a card supplies no qualified company role.
    if (nativeCompany!==COMPANY+' (KESPL)'||declarations.employerConflict) continue
    if(declarations.worksites.some(worksite=>!worksite.country||worksite.country!==location.country)){
      location.country=null
      location.nativeWorkCountryEvidence=null
    }
    const criteria=content.filter(node=>node.tag==='li').map(text).filter(Boolean)
    const description=criteria.length?text(panel):null
    const id=SOURCE+'-'+slugify(title+'-'+(location.city||location.location||'unknown-location'))
    need(title&&id&&!seenIds.has(id),'duplicate or missing native role title')
    seenIds.add(id)
    jobs.push({title,company:COMPANY,department:fields.get('department')||null,...location,
      sourceCountryScopeUnresolved:location.country===null,jobId:id,requisitionId:null,
      sourceJobIdKind:'title-and-location-slug',sourceUrl:CAREERS_URL,applyUrl:CAREERS_URL,
      employmentType:null,experienceRequired:fields.get('minimum relevant experience')||null,
      minimumQualification:fields.get('educational qualification')||null,preferredQualification:null,
      requiredSkills:content.filter(node=>hasClass(node,'block-wrapper')).flatMap(block=>{
        const parts=within(block,nodes),label=parts.find(node=>hasClass(node,'left'))
        return label&&scalarLabel(text(label))==='technical skills required'?parts.filter(node=>node.tag==='li').map(text):[]
      }),postingDate:null,closingDate:null,jobDescription:description,nativeDesignation:fields.get('designation')||null,
      nativeEmployerLabel:nativeCompany,nativeLocationLabel:fields.get('location')||null,
      nativeWorkplaceDeclarations:declarations.worksites,
      sourceDetailComplete:false,sourceDetailFailureKind:description?'listing-and-role-identity-not-complete':'native-role-criteria-unpublished',
      sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,skipPublicExperienceEnrichment:true})
  }
  jobs.sort((a,b)=>a.title.localeCompare(b.title))
  return attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:cards.length,
    observedVacancyCount:cards.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
}
export const createKanodaEnergySystemsScraper = ({now=()=>new Date().toISOString()}={}) => ({
  async run(options={}) {
    const cap=options.maxJobs??null
    if(cap!==null&&(!Number.isSafeInteger(cap)||cap<0))throw new RangeError('Kanoda invalid result limit')
    const reader=createFirstPartyDocumentReader(options,{source:SOURCE,urls:[HOMEPAGE_URL,CAREERS_URL]})
    try {
      const home=await reader.read(HOMEPAGE_URL)
      need(hasOfficialHomepageSignal(home.body),'verified homepage no longer declares the current careers handoff')
      const careers=await reader.read(CAREERS_URL),observed=extractJobs(careers.body)
      const jobs=(cap===null?observed:observed.slice(0,cap)).map(job=>({...job,source:SOURCE,link:job.applyUrl,
        scrapedAt:(options.now||now)(),companyCareerPage:CAREERS_URL,companyDomain:'kanoda.com',atsPlatform:'official-company-careers'}))
      reader.check()
      attachSourceObservationEvidence(jobs,readSourceObservationEvidence(observed,SOURCE))
      return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CAREERS_URL,
        firstParty:!reader.stats().receipts.some(receipt=>receipt.legacyCallbackMetadataUnverified),
        pagesFetched:reader.stats().requests,listingComplete:false,lifecycleCleanupAllowed:false,
        reportedTotal:null,indiaFacetCount:null,verifiedAt:null,
        reason:'current-own-native-cards-and-complete-published-panels;source-company-and-role-identity-coverage-incomplete;cleanup-forbidden'})
    }finally{reader.close()}
  },
})
export const run = options => createKanodaEnergySystemsScraper().run(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js'),jobs=await run()
  if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(currentDir,'jobs.json'))
  else await saveToDB(jobs,SOURCE)
}
