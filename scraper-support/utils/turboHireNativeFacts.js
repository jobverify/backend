// Country and publication values must come from the current native vacancy.
// A city, company registration or observation clock cannot supply these facts.
const requireFact = (ok, message) => {
  if (!ok) throw Object.assign(Error('TurboHire native facts: ' + message), { abortRetries: true, incompleteScope: true })
}
const clean = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
const names = new Intl.DisplayNames(['en'], { type: 'region' })
const codes = 'AE AR AT AU BD BE BG BH BR CA CH CL CN CO CZ DE DK EG ES FI FR GB GR HK HU ID IE IL IN IT JP KE KR LK LT LU LV MA MX MY NG NL NO NP NZ OM PE PH PK PL PT QA RO RS RU SA SE SG SK TH TR TW UA US VN ZA'.split(' ')
const countries = new Map(codes.flatMap(code => [[code.toLowerCase(), code], [names.of(code).toLowerCase(), code]]))
for (const [label, code] of [['usa','US'],['united states of america','US'],['uk','GB'],['hong kong','HK'],['turkey','TR']]) countries.set(label, code)
const country = value => countries.get(clean(value).toLowerCase())

export const turboHireWorkplaces = value => {
  let places
  try { places = JSON.parse(value) } catch { /* rejected below */ }
  requireFact(Array.isArray(places) && places.length > 0, 'native workplace array unavailable')
  return places.map(place => {
    const address = clean(place?.Address), parts = address.split(',').map(clean), code = country(parts.at(-1))
    requireFact(address && parts.length >= 2 && parts.every(Boolean) && code
      && !/\b(?:global|worldwide|anywhere|unspecified)\b/i.test(address), 'explicit bounded native country unavailable')
    requireFact(parts.slice(0, -1).every(part => !country(part) || country(part) === code), 'conflicting native countries')
    const city = parts.length >= 3 ? parts.at(-3) : parts[0], state = parts.length >= 3 ? parts.at(-2) : null
    for (const key of ['Country','CountryCode','country','countryCode']) if (place[key] != null)
      requireFact(typeof place[key] === 'string' && country(place[key]) === code, 'native country conflicts with address')
    for (const key of ['City','city']) if (place[key] != null)
      requireFact(clean(place[key]).toLowerCase() === city.toLowerCase(), 'native city conflicts with address')
    for (const key of ['State','state']) if (place[key] != null)
      requireFact(state && clean(place[key]).toLowerCase() === state.toLowerCase(), 'native state conflicts with address')
    return { address, city, state, countryCode: code, country: names.of(code) }
  })
}

export const turboHireDate = (value, { now, publication = false } = {}) => {
  if (value == null || value === '') return null
  requireFact(typeof value === 'string', 'native date must be text')
  if (!publication && /^\d{4}-\d{2}-\d{2}T00:00:00$/.test(value)) {
    const day = value.slice(0, 10), time = Date.parse(day + 'T00:00:00Z')
    requireFact(Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === day, 'invalid closing calendar day')
    return day
  }
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})(?:\.(\d{1,7}))?Z$/.exec(value)
  requireFact(match, 'native date lacks explicit UTC precision')
  const canonical = `${match[1]}T${match[2]}.${(match[3] || '').padEnd(3, '0').slice(0, 3)}Z`, time = Date.parse(canonical)
  requireFact(Number.isFinite(time) && new Date(time).toISOString() === canonical, 'invalid native calendar date')
  if (publication) requireFact(Number.isFinite(Date.parse(now)) && time <= Date.parse(now), 'future publication or invalid verification time')
  return value
}

// Retain the original recruitment fields. Public contact/account administration
// data is unnecessary for a role's identity, publication or description proof.
export const turboHireRecruitmentRecord = record => Object.fromEntries([
  'JobId','JobIdObfuscated','JobCode','JobTitle','Location','PublishedDate','PublishedDates','ExpiryDates',
  'IsPublic','IsDraft','JobStatus','PublishedJobBoards','JobDescV2','JobDescription','JobDescriptionV2',
  'RolesAndResponsibilitiesV2','EligibilityV2','JobDescriptionBlobUrl','JobTypeV2','Experience','Skills',
].filter(key => Object.hasOwn(record, key)).map(key => [key, structuredClone(record[key])]).concat([
  ['OrgDetails', { OrgID: record.OrgDetails?.OrgID, OrgName: record.OrgDetails?.OrgName }],
]))
