import { nativeHTMLText } from '../declaredGreenhouse/nativeData.js'
import { countryName, unknownGeography } from '../jobPostingData.js'
export { nativeHTMLText as plain }
export const text = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
export const requireNative = (ok, message) => { if (!ok) throw Error('Declared public job feed: ' + message) }
const same = (a, b) => Boolean(text(a) && text(b) && text(a).toLowerCase() === text(b).toLowerCase())
export const roleURL = (profile, value, id, application = false) => {
  try {
    const url = new URL(value)
    return url.origin === new URL(profile.boardURL).origin && !url.username && !url.password && !url.search && !url.hash
      && url.pathname === '/' + profile.boardSlug + '/' + id + (application ? profile.platform === 'ashby' ? '/application' : '/apply' : '')
  } catch { return false }
}
// Preserve every human-readable compensation component, including numeric
// amounts/intervals whose summary may be absent. UUIDs stay in the raw models.
const payText = value => {
  if (Array.isArray(value)) return value.flatMap(payText)
  if (!value || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([key, part]) => {
    if (['id', '__typename'].includes(key) || part == null) return []
    if (typeof part === 'string') return [nativeHTMLText(part)]
    if (typeof part === 'number') return [String(part)]
    return typeof part === 'object' ? payText(part) : []
  })
}
export const criteria = (profile, record, posting) => {
  const pieces = [], append = value => { const content = nativeHTMLText(value);if (content && !pieces.includes(content)) pieces.push(content) }
  if (profile.platform === 'ashby') {
    append(record.descriptionHtml);append(record.descriptionPlain)
    for (const [key, value] of Object.entries(posting || {})) if (/html$/i.test(key) && typeof value === 'string') append(value)
    for (const value of payText(record.compensation)) append(value)
    for (const value of payText(Object.fromEntries(Object.entries(posting || {}).filter(([key]) => /compensation/i.test(key))))) append(value)
  } else {
    for (const name of ['opening', 'descriptionBody', 'description', 'openingPlain', 'descriptionBodyPlain', 'descriptionPlain']) append(record[name])
    for (const section of record.lists || []) { append(section.text);append(section.content) }
    for (const name of ['additional', 'additionalPlain', 'salaryDescription', 'salaryDescriptionPlain']) append(record[name])
    for (const value of payText(record.salaryRange)) append(value)
  }
  return pieces.join('\n\n') || null
}
const visibleCountry = value => {
  const label=text(value)
  return (label.length>3&&!/^(?:Georgia|Jersey)$/i.test(label)?countryName(label):null)
    || (/^(?:us|usa|u\.s\.|united states of america)$/i.test(label)?'United States':/^(?:uk|u\.k\.)$/i.test(label)?'United Kingdom':null)
}
const visibleCountries = value => [...new Set((visibleCountry(value)?[text(value)]:text(value).split(/\s*(?:,|;|\||\/|\s+-\s+|\s+and\s+|\s+or\s+)\s*/i)).flatMap(part => {
  const label = part.replace(/^remote\s+/i, '').replace(/\s*\((?:remote|hybrid|on[- ]site)\)\s*$/i, '').trim()
  const country = visibleCountry(label)
  return country ? [country] : []
}))]
export const geography = (profile, record, schema) => {
  let input = record
  if (profile.platform === 'lever') {
    const addresses = (Array.isArray(schema?.jobLocation) ? schema.jobLocation : schema?.jobLocation ? [schema.jobLocation] : []).map(place => place.address?.postalAddress || place.address || {})
    const location = text(record.categories?.location), all = record.categories?.allLocations || [location]
    const addressFor = label => addresses.find(address => same(address.addressLocality, label)) || addresses.find(address => {
      const city=text(address.addressLocality),value=text(label),country=countryName(address.addressCountry),visible=visibleCountries(value)
      return city && value.toLowerCase().startsWith(city.toLowerCase()+',') && (!country||!visible.length||visible.includes(country))
    }) || null
    const primary = addressFor(location)
    input = { location, address: { postalAddress: { ...(primary || {}), addressCountry: record.country ?? primary?.addressCountry ?? null } },
      secondaryLocations: all.filter(label => !same(label, location)).map(label => ({ location: label, address: addressFor(label) })) }
  }
  const conflicts = [], places = [{location:input.location,address:input.address},...(input.secondaryLocations||[])].map(place=>{
    const address=place.address?.postalAddress||place.address||{},typedCountry=countryName(address.addressCountry),visible=visibleCountries(place.location)
    if(typedCountry&&visible.length&&!visible.includes(typedCountry))conflicts.push('visible-native-location-vs-typed-country')
    return{originalLocation:place.location,originalAddress:place.address,typedCountry,visibleCountries:visible,
      country:typedCountry||(visible.length===1?visible[0]:null),city:text(address.addressLocality)||null,state:text(address.addressRegion)||null}
  })
  const schemaPlaces = (Array.isArray(schema?.jobLocation) ? schema.jobLocation : schema?.jobLocation ? [schema.jobLocation] : []).map(place => {
    const address = place.address?.postalAddress || place.address || {}
    return { city: text(address.addressLocality), state: text(address.addressRegion), country: countryName(address.addressCountry) }
  })
  if(schemaPlaces.length===1&&places[0]){
    const a=places[0],b=schemaPlaces[0]
    if(a.country&&b.country&&a.country!==b.country&&!a.visibleCountries.includes(b.country))conflicts.push('primary-schema-country-conflict')
    if(!a.country&&b.country&&!a.visibleCountries.length)a.country=b.country
    if(a.city&&b.city&&!same(a.city,b.city)||a.state&&b.state&&!same(a.state,b.state))conflicts.push('primary-schema-address-conflict')
  }
  const all = [...places, ...schemaPlaces]
  for (let index = 0; index < all.length; index++) for (const other of all.slice(index + 1)) {
    const place = all[index], matching = same(place.city, other.city) && (!place.state || !other.state || same(place.state, other.state))
    if (matching && place.country && other.country && place.country !== other.country) conflicts.push('same-worksite-country-conflict')
  }
  // Typed contradictions are distinct from a genuinely unknown secondary site.
  const countries=[...new Set(places.flatMap(place=>[place.country,...place.visibleCountries]).filter(Boolean))]
  for(const place of schemaPlaces)if(place.country&&!countries.includes(place.country))conflicts.push('unreconciled-schema-country')
  const applicants=schema?.applicantLocationRequirements==null?[]:Array.isArray(schema.applicantLocationRequirements)?schema.applicantLocationRequirements:[schema.applicantLocationRequirements]
  const applicantCountries=applicants.map(value=>countryName(value?.name))
  if(applicantCountries.some(Boolean)&&countries.some(country=>!applicantCountries.includes(country)))conflicts.push('native-schema-or-applicant-country-conflict')
  const conflict=conflicts.length>0,unresolved=places.some(place=>!place.country||place.visibleCountries.length>1)||applicantCountries.some(value=>!value)
  const country=conflict?null:countries.includes('India')?'India':countries.length===1&&!unresolved?countries[0]:null
  const selected=country?places.filter(place=>place.country===country||place.visibleCountries.includes(country)):[]
  const labels=selected.map(place=>[place.city,place.state,country].filter(Boolean).join(', '))
  const result={...unknownGeography(),country,city:selected.length===1?selected[0].city:null,state:selected.length===1?selected[0].state:null,
    location:country?labels.join('; '):null,locations:country?labels:[],countries,unresolved,originalPlaces:places,
    originalSchemaJobLocations:schema?.jobLocation??null,originalApplicantRequirements:schema?.applicantLocationRequirements??null,applicantCountries}
  return { country: result.country, city: result.country ? result.city : null, state: result.country ? result.state : null,
    location: result.country ? result.location : null, locations: result.country ? result.locations : [],
    sourceCountryScopeUnresolved: conflict || unresolved && country!=='India',
    sourceNativeCountryConflict: conflict, sourceNativeCountries: countries,
    sourceNativeCountryEvidence: { ...result, conflicts, inputOrigin: profile.platform === 'lever' ? 'labelled-projection-of-original-Lever-country-categories-and-schema' : 'original-native-Ashby-record' } }
}
export const literalFields = (profile, record, posting, schema) => {
  const hours = profile.platform === 'ashby' ? posting?.employmentType ?? record.employmentType : record.categories?.commitment
  const employmentType = /^full[ _-]?time$/i.test(hours || '') ? 'Full-time' : /^part[ _-]?time$/i.test(hours || '') ? 'Part-time'
    : /^(?:contract|temporary|fixed term)$/i.test(hours || '') ? 'Contract' : /^(?:intern|internship)$/i.test(hours || '') ? 'Internship' : null
  const nativeWorkplace = profile.platform === 'ashby' ? posting?.workplaceType ?? record.workplaceType : record.workplaceType
  const remoteStatus = /^remote$/i.test(nativeWorkplace || '') ? 'Remote' : /^hybrid$/i.test(nativeWorkplace || '') ? 'Hybrid' : /^on[- ]?site$/i.test(nativeWorkplace || '') ? 'On-site' : null
  const originalDate = profile.platform === 'ashby' ? record.publishedAt : record.createdAt
  const valid = profile.platform === 'ashby' ? typeof originalDate === 'string' && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d\d:\d\d)$/.test(originalDate)
    : Number.isSafeInteger(originalDate) && originalDate > 0
  const stamp = valid && Number.isFinite(new Date(originalDate).getTime()) ? new Date(originalDate).toISOString() : null
  const deadline = posting?.applicationDeadline ?? null
  return { sourceEmploymentType: hours ?? null, employmentType, sourceEmploymentTypeUnresolved: !employmentType || employmentType === 'Part-time',
    sourceNativeWorkplaceType: nativeWorkplace ?? null, remoteStatus, sourceRemoteStatusUnresolved: true,
    sourcePostingDate: originalDate ?? null, postingDate: stamp, sourcePostingDatePrecision: profile.platform === 'ashby' ? 'native-publishedAt-offset' : 'native-createdAt-milliseconds',
    sourceNativeStructuredDatePosted: schema?.datePosted ?? null, sourceClosingDate: deadline,
    closingDate: typeof deadline === 'string' && Number.isFinite(Date.parse(deadline)) ? deadline : null }
}
