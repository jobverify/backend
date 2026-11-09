import { createHash } from 'node:crypto'
import { parse } from 'acorn'
import { activeIframeSources } from '../../scraper-support/utils/activeNativeHtml.js'
import { clean, descendants, hasClass, readBrainvireDocument } from './nativeHtml.js'

export const CAREERS_URL = 'https://www.brainvire.com/careers/'
export const APPLICATION_CLIENT_SHA256 = '20e6e639e193937fa4745638b62358efb2c329c53a5433f9691cce3a4463b4a7'
const REVEAL_SHA256 = 'd0aa1622d70715bbbdfb01c9249c6c1bcd641e81eaca76e4af20c7128cb486fa'
const check = (ok, message) => { if (!ok) throw Error('Brainvire current native inventory: ' + message) }
export const sha256 = value => createHash('sha256').update(value).digest('hex')
export const canonical = value => JSON.stringify(value, (_key, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a],[b]) => a.localeCompare(b))) : v)
const one = (rows, label) => { check(rows.length === 1, 'expected one ' + label); return rows[0] }
const official = value => {
  try { const url = new URL(value); return url.protocol === 'https:' && url.hostname === 'www.brainvire.com' && !url.username && !url.password && !url.port && !url.search && !url.hash && url.pathname === '/' } catch { return false }
}
const sameSet = (a,b) => canonical([...new Set(a)].sort()) === canonical([...new Set(b)].sort())
const matchesExperience = (requirement, visible) => {
  if (typeof requirement === 'string') return clean(requirement) === visible
  if (!requirement || Array.isArray(requirement) || requirement['@type'] !== 'OccupationalExperienceRequirements'
    || !Number.isSafeInteger(requirement.monthsOfExperience) || requirement.monthsOfExperience < 0
    || Object.keys(requirement).some(key => !['@type','monthsOfExperience'].includes(key))) return false
  const years = /^(\d+)\+\s+Years?$/i.exec(visible)
  return Boolean(years) && Number(years[1]) * 12 === requirement.monthsOfExperience
}
const typedCountry = new Map(), display = new Intl.DisplayNames(['en'], {type:'region',fallback:'none'})
for (let a=65;a<=90;a++) for (let b=65;b<=90;b++) {
  const code=String.fromCharCode(a,b), name=display.of(code)
  if (name && !['ZZ','XA','XB','UN','EU','EZ','QO'].includes(code)) { typedCountry.set(code.toLowerCase(),code); typedCountry.set(name.toLowerCase(),code) }
}
for (const [name,code] of [['usa','US'],['united states of america','US'],['uae','AE'],['uk','GB']]) typedCountry.set(name,code)
const country = value => typedCountry.get(clean(typeof value === 'object' && value !== null ? value.name : value).toLowerCase()) || null
const suppliedCountry = (container,key) => {
  if (!Object.hasOwn(container,key)) return null
  const value=container[key],supported=typeof value === 'string' || value && !Array.isArray(value) && value['@type'] === 'Country' && typeof value.name === 'string'
  const code=supported ? country(value) : null
  check(Boolean(code),'supplied native country '+key+' is unrecognized or malformed')
  return code
}
const date = (value, label, now, future = false) => {
  if (value == null) return null
  check(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value) && Number.isFinite(Date.parse(value)), 'invalid native ' + label)
  const prefix=value.slice(0,10), day=new Date(prefix+'T00:00:00Z')
  check(day.toISOString().slice(0,10) === prefix && (future || Date.parse(value) <= Date.parse(now)), 'invalid or future native ' + label)
  return value
}
const scriptType = node => {
  const type=Object.hasOwn(node.attrs,'type') ? clean(node.attrs.type) : node.attrs.language ? 'text/'+clean(node.attrs.language) : ''
  return !type || /^(?:(?:text|application)\/javascript|module)$/i.test(type)
}
const reviewedClients = doc => {
  // This reviewed client relies on document.currentScript. Modern browsers
  // ignore nomodule scripts, and currentScript is null inside module scripts.
  const scripts = doc.nodes(node => node.tag === 'script' && !node.attrs.src && scriptType(node)
    && !Object.hasOwn(node.attrs,'nomodule') && clean(node.attrs.type).toLowerCase() !== 'module')
  let application = false, reveal = false
  for (const node of scripts) {
    const body=node.raw || ''
    if (!body.includes('function openApply(role)')) continue
    try { parse(body,{ecmaVersion:'latest'}) } catch { continue }
    application ||= sha256(body) === APPLICATION_CLIENT_SHA256
    const start=body.indexOf('try{ var io=new IntersectionObserver'), end=body.lastIndexOf('})();')
    reveal ||= start >= 0 && end > start && sha256(body.slice(start,end)) === REVEAL_SHA256
  }
  return {application,reveal}
}

export function inspectNativeInventory(html, {now = new Date().toISOString()} = {}) {
  const initial = readBrainvireDocument(html), clients = reviewedClients(initial)
  const doc = readBrainvireDocument(html,{reveal:clients.reveal}), {text,nodes} = doc
  const canonicalLink=one(nodes(n => n.tag === 'link' && (n.attrs.rel || '').split(/\s+/).includes('canonical')), 'official canonical')
  check(canonicalLink.attrs.href === CAREERS_URL,'official canonical employer changed')
  check(nodes(n => n.tag === 'title').some(n => clean(n.raw) === 'Elevate Your Career With Brainvire - Join Us'),'official careers title changed')
  const structured=nodes(n => n.tag === 'script' && n.attrs.type?.toLowerCase() === 'application/ld+json').flatMap(node => {
    let data; try { data=JSON.parse(node.raw) } catch { check(false,'invalid active structured data') }
    return Array.isArray(data['@graph']) ? data['@graph'] : [data]
  })
  check(structured.some(s => s['@type'] === 'Organization' && ['Brainvire Infotech Inc.','Brainvire Infotech','Brainvire'].includes(s.name) && official(s.url)),'official organization binding missing')
  const models=structured.filter(s => s['@type'] === 'JobPosting')
  const openings=one(nodes(n => n.attrs.id === 'openings'),'current openings section')
  const cards=descendants(openings,n => doc.visible(n) && hasClass(n,'role'))
  check(cards.length > 0 && cards.length === models.length,'active native card/schema cardinality mismatch; cannot certify zero')
  const usedModels=new Set(), usedKeys=new Set(), reasons=new Set(['native-role-summaries-only;full-criteria-unpublished','native-requisition-identifiers-unpublished'])
  const benefits=nodes(n => hasClass(n,'bcard')).map(text).filter(Boolean)
  const openDoc=readBrainvireDocument(html,{reveal:clients.reveal,modal:true})
  const forms=openDoc.nodes(n => n.tag === 'form' && n.attrs.action === '/careers/#wpcf7-f6127-o1' && n.attrs.method?.toLowerCase() === 'post')
  const form=forms.length === 1 ? forms[0] : null
  const position=form ? descendants(form,n => n.tag === 'input' && n.attrs.id === 'cv-position' && n.attrs.name === 'position' && Object.hasOwn(n.attrs,'readonly') && !Object.hasOwn(n.attrs,'disabled')) : []
  const activeSubmit=form && descendants(form,n => n.tag === 'input' && n.attrs.type === 'submit' && openDoc.visible(n) && !Object.hasOwn(n.attrs,'disabled')).length === 1
  const applicationBound=clients.application && Boolean(form) && position.length === 1 && activeSubmit
  if (!applicationBound) reasons.add('native-job-specific-application-binding-unverified')
  const externalClients=nodes(n => n.tag === 'script' && n.attrs.src && scriptType(n)).map(n => new URL(n.attrs.src,CAREERS_URL).toString()).sort()
  if (externalClients.length) reasons.add('unprocessed-native-page-clients')
  const additionalLinks=nodes(n => n.tag === 'a' && n.attrs.href).map(n => {
    try { const url=new URL(n.attrs.href,CAREERS_URL); return /(?:jobs|recruit|hiring|vacanc|career|openings)/i.test(url.pathname) && url.origin+url.pathname !== CAREERS_URL ? url.origin+url.pathname : null } catch { return null }
  }).filter(Boolean)
  const frames=activeIframeSources(html)
  const busy=nodes(n => n.attrs['aria-busy'] === 'true' || /(?:loading|load.more|next.page)/i.test(n.attrs['aria-label'] || '')).length
  if (frames.length || additionalLinks.length || busy || externalClients.some(u => /careers|jobs|recruit/i.test(new URL(u).pathname))) reasons.add('unprocessed-additional-hiring-surface')

  const records=cards.map(card => {
    const heading=one(descendants(card,n => n.tag === 'h3' && doc.visible(n)),'native role heading')
    const tag=one(descendants(heading,n => hasClass(n,'tag') && doc.visible(n)),'native role department')
    const department=text(tag), title=clean(heading.children.filter(child => child !== tag).map(child => typeof child === 'string' ? child : text(child)).join(' '))
    check(title && department,'native role title or department missing')
    const fieldBox=one(descendants(card,n => hasClass(n,'rmeta') && doc.visible(n)),'native role metadata')
    const fields={}
    for (const span of descendants(fieldBox,n => n.tag === 'span' && doc.visible(n))) {
      const value=one(descendants(span,n => n.tag === 'b' && doc.visible(n)),'native labeled value')
      const label=clean(span.children.filter(c => c !== value).map(c => typeof c === 'string' ? c : text(c)).join(' ')).toLowerCase()
      check(label && !Object.hasOwn(fields,label),'duplicate native role metadata')
      fields[label]=text(value)
    }
    check(fields.experience && fields.location && /^\d+$/.test(fields.openings),'native experience, location or opening count missing')
    const anchor=one(descendants(card,n => n.tag === 'a' && Object.hasOwn(n.attrs,'data-ms') && doc.visible(n)),'native application choice')
    const nativeLabel=clean(anchor.attrs['data-ms']), positionLabel=nativeLabel.replace(/^Application:\s*/i,'')
    check(anchor.attrs.href === '#' && /^Application:\s*/.test(nativeLabel) && (positionLabel === title || positionLabel.startsWith(title+' (')),'native application role choice mismatch')
    check(!usedKeys.has(nativeLabel),'duplicate native application identity'); usedKeys.add(nativeLabel)
    const cardCountries=fields.location.split(/[,;/]/).map(country).filter(Boolean)
    const locations=fields.location.replace(/\s*\/\s*Remote\s*$/i,'').split(/\s*[,;]\s*/).filter(label => !country(label))
    const matches=models.filter(model => !usedModels.has(model) && clean(model.title) === title && matchesExperience(model.experienceRequirements,fields.experience) && sameSet((Array.isArray(model.jobLocation) ? model.jobLocation : [model.jobLocation]).map(place => clean(place?.address?.addressLocality)),locations))
    const model=one(matches,'role-owned matching structured record'); usedModels.add(model)
    check(model.customFields == null,'unreviewed native custom fields scope')
    check(model.hiringOrganization && ['Brainvire Infotech','Brainvire Infotech Inc.','Brainvire'].includes(model.hiringOrganization.name) && official(model.hiringOrganization.sameAs || model.hiringOrganization.url),'native role employer/domain mismatch')
    const addresses=(Array.isArray(model.jobLocation) ? model.jobLocation : [model.jobLocation]).map(place => place.address)
    check(addresses.every(address => address && typeof address.addressLocality === 'string' && (address.addressCountry == null || typeof address.addressCountry === 'string' || address.addressCountry?.['@type'] === 'Country')),'invalid typed native role location')
    const countries=addresses.map(address => country(address.addressCountry)), knownCountries=[...new Set(countries.filter(Boolean))]
    check(knownCountries.length <= 1,'native record countries conflict')
    const countryCode=countries.every(Boolean) ? knownCountries[0] : null
    const additionalCountries=[suppliedCountry(fields,'country'),suppliedCountry(card.attrs,'data-country'),suppliedCountry(model,'country'),suppliedCountry(model,'jobCountry')]
    for (const supplied of [...cardCountries,...additionalCountries]) if (supplied !== null) check(knownCountries.every(code => supplied === code),'card/model countries conflict')
    for (const supplied of [fields.employer,fields.company,card.attrs['data-employer'],card.attrs['data-company'],model.companyName].filter(Boolean)) check(/^Brainvire(?: Infotech(?: Inc\.?)?)?$/i.test(clean(supplied)),'native custom employer conflict')
    if (!countryCode) reasons.add('unresolved-native-country')
    const remote=/\bRemote\b/i.test(fields.location)
    check(model.jobLocationType == null || model.jobLocationType === 'TELECOMMUTE' && remote,'native work mode contradicts displayed location')
    check(!remote || model.jobLocationType === 'TELECOMMUTE','displayed remote work mode lacks matching native model')
    check(model.employmentType === 'FULL_TIME','unreviewed native employment type')
    const nativeDate=date(model.datePosted,'reported posting date',now), closingDate=date(model.validThrough,'closing date',now,true)
    const expiry=closingDate && Date.parse(closingDate.length === 10 ? closingDate+'T23:59:59.999Z' : closingDate)
    const closed=/\b(?:closed|expired|position filled|no longer accepting)\b/i.test(text(card)) || model.closed === true || model.isActive === false || /^(?:closed|expired|filled)$/i.test(clean(model.status || model.jobStatus))
    const expired=Boolean(expiry && expiry < Date.parse(now))
    check(typeof model.description === 'string' && clean(model.description),'native role summary missing')
    return {
      title,company:'Brainvire',companyDomain:'brainvire.com',department,
      location:fields.location,locations,city:locations[0] || null,country:countryCode ? display.of(countryCode) : null,countryCode,
      jobId:nativeLabel,nativePostingKeyType:'native-application-label',nativePostingId:null,requisitionId:null,
      sourceUrl:CAREERS_URL,applyUrl:applicationBound ? CAREERS_URL : null,
      applicationMethod:applicationBound ? 'native-company-modal;role-position-bound' : null,applicationIsJobSpecific:applicationBound,
      nativeApplicationLabel:nativeLabel,nativeApplicationPosition:positionLabel,
      employmentType:'Full-time',experienceRequired:fields.experience,numberOfOpenings:Number(fields.openings),
      remoteStatus:remote ? 'Remote' : null,minimumQualification:null,preferredQualification:null,requiredSkills:[],
      postingDate:nativeDate,postedAt:nativeDate,nativeReportedPostingDate:nativeDate,
      postingDatePrecision:nativeDate?.length === 10 ? 'date' : nativeDate ? 'timestamp' : null,
      sourcePostingDateIsExact:!!nativeDate && nativeDate.length > 10,postingDateStatus:nativeDate ? 'native-role-jobposting-datePosted' : 'unpublished',
      closingDate,expired,closed,jobDescription:clean(model.description),sourceDescription:clean(model.description),
      sharedEmployerBenefits:benefits,sourceDetailComplete:false,sourceDetailStatus:'native-role-summary-only;full-criteria-unpublished',
      sourceListingComplete:false,lifecycleCleanupAllowed:false,sourceGlobalJobCount:null,
      nativeFields:fields,nativeStructuredRecord:model,
    }
  })
  check(usedModels.size === models.length,'unprocessed native structured roles')
  return {records,sharedEmployerBenefits:benefits,applicationBound,applicationClientSha256:clients.application ? APPLICATION_CLIENT_SHA256 : null,
    externalClients,additionalHiringLinks:[...new Set(additionalLinks)].sort(),frames:frames.sort(),busy:Boolean(busy),reasons:[...reasons].sort()}
}
