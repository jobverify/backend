import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { nativeCountryName, nativeLocationCountryName } from '../../scraper-support/shared/nativeJobPosting.js'

const text = value => typeof value === 'string' && value.trim().length > 0
const object = value => value && typeof value === 'object' && !Array.isArray(value)
const normalized = value => value.normalize('NFKC').replace(/[\u2018\u2019]/g, "'").replace(/\s+/g, ' ').trim()
const words = value => normalized(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
const requireValue = (value, message) => {
  if (!value) throw Object.assign(Error('[langchain] ' + message), {
    failureKind: 'coverage_gap', softFailure: true, upstreamOutage: false, abortRetries: true,
  })
}
const roleHeading = /^(?:about (?:the |this )?role|role overview|(?:key )?responsibilities|requirements|required experience|key attributes|strong signals|what (?:you(?:'ll| will)? (?:do|bring|own|need)|we(?:'re| are) looking for)|how to be successful in this role|nice to have(?:'s|s)?|bonus if you have)\s*:?$/i
const otherHeading = /^(?:about (?:us|the team)|(?:compensation|benefits)(?:.*)|what we offer|why join(?: us)?)\s*:?$/i
const directDuty = /^(?:you(?:'ll| will)|develop|build|design|maintain|test|implement|manage|lead|own|improve|deliver|support|write|drive|collaborate|proficiency|strong (?:experience|knowledge|communication))\b/i
const roleCriterion = value => directDuty.test(value)
  || /\b(?:you|your)\b.{0,100}\b(?:experience|skills|knowledge|ability|responsible|own|build|design|develop|lead|manage|maintain|test|write|drive|have|bring)\b/i.test(value)
  || /\b(?:\d+\+?\s*years?|proficiency|expertise|ability|knowledge|skills|familiarity|track record)\b/i.test(value)
  || /^experience (?:with|in|working|building|developing|managing|leading|selling|using|designing|supporting|implementing|operating)\b/i.test(value)

// Qualify active statements owned by a role section, rather than accepting a
// nonempty company paragraph, title, placeholder, or inert template as a JD.
// These are authored source statements; no experience/skill fields are inferred.
export function inspectNativeRoleCriteria(row, check) {
  check()
  requireValue(typeof row.descriptionHtml === 'string' && typeof row.descriptionPlain === 'string', 'Full native role description unavailable')
  const content = readNativeDocument(row.descriptionHtml)
  check()
  const blocks = content.nodes(node => /^h[1-6]$/.test(node.tag) || ['p', 'li'].includes(node.tag))
  const statements = [], ownedBlocks = [], seen = new Set()
  let roleSection = false, nonRoleSection = false
  for (const node of blocks) {
    check()
    const value = normalized(content.text(node))
    if (!value) continue
    if (value.length < 110 && roleHeading.test(value)) { roleSection = true; nonRoleSection = false; continue }
    if (value.length < 110 && otherHeading.test(value)) { roleSection = false; nonRoleSection = true; continue }
    // The title identifies the posting; it does not make subsequent company
    // boilerplate a duty or an applicant qualification.
    if (/^h[1-6]$/.test(node.tag)) continue
    if (nonRoleSection || !(roleSection || directDuty.test(value) || restriction(value))) continue
    if (!seen.has(value)) { seen.add(value); ownedBlocks.push(value) }
    if (value.length >= 35 && value.split(/\s+/).length >= 6 && roleCriterion(value)
      && !/^(?:coming soon|apply now|job description|placeholder)[\s.!]*$/i.test(value)) statements.push(value)
  }
  const plain = words(row.descriptionPlain)
  const retained = statements.filter(value => plain.includes(words(value)))
  requireValue(retained.length > 0, 'Substantive active role-owned description criteria unavailable')
  check()
  return { authoredCriteria: {
    sourceFields: ['descriptionHtml', 'descriptionPlain'],
    headings: content.nodes(node => /^h[1-6]$/.test(node.tag)).map(node => content.text(node)),
    listItems: content.nodes(node => node.tag === 'li').map(node => content.text(node)),
    roleOwnedStatements: retained, fullContentRetained: true, normalizedCriteriaInferred: false,
  }, ownedBlocks }
}

const writtenCountry = value => nativeLocationCountryName(value)
  || nativeCountryName(value.replace(/^remote\s*[-:/]\s*/i, ''))
  || (/\bIndia\b/i.test(value) ? 'India' : /\bUnited States\b|\bU\.S\.(?:A\.)?|\bUSA\b/i.test(value) ? 'United States' : null)
const normalizeCountry = value => value === 'UK' ? 'United Kingdom' : nativeCountryName(value)
const display = new Intl.DisplayNames(['en'], { type: 'region' })
const explicitCountryNames = []
for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
  const code = String.fromCharCode(a, b), name = display.of(code)
  if (name !== code && nativeCountryName(name)) explicitCountryNames.push([name, nativeCountryName(name)])
}
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const countryClauses = explicitCountryNames.map(([name, country]) => [new RegExp('(?:^|[^\\p{L}])' + escape(name) + '(?=$|[^\\p{L}])', 'iu'), country])
const countriesInClause = value => {
  const countries = new Set(countryClauses.filter(([pattern]) => pattern.test(value)).map(([, country]) => country))
  if (/\bU\.S\.(?:A\.)?|\bUS\b|\bUSA\b/.test(value)) countries.add('United States')
  if (/\bU\.K\.|\bUK\b/.test(value)) countries.add('United Kingdom')
  return countries
}
const restriction = value => /^(?:\*\s*)?(?:location(?:\/city)?\s*:|in[ -]?person\b)/i.test(value)
  || /\b(?:this|the) (?:role|position)\b.{0,100}\b(?:based|onsite|on-site|remote|open only)\b/i.test(value)
  || /\b(?:applicants|candidates|employees)\b.{0,80}\b(?:must|required|only)\b/i.test(value)
  || /\b(?:must|required to) (?:work|reside|live|be based)\b/i.test(value)

// A display label or authored worksite clause may contradict an explicit typed
// relation. It never supplies a missing typed country or turns a city into IN.
export function inspectNativeCountries(row, ownedBlocks, check) {
  const locations = [{ location: row.location, address: row.address }, ...row.secondaryLocations].map((location, index) => {
    check()
    requireValue(object(location) && text(location.location) && object(location.address), 'Invalid typed native location relation')
    const address = location.address.postalAddress ?? location.address
    requireValue(object(address) && ['addressCountry', 'addressLocality', 'addressRegion'].every(field => address[field] == null || typeof address[field] === 'string'), 'Invalid native postal address relation')
    requireValue(location.address.addressCountry == null || typeof location.address.addressCountry === 'string', 'Invalid direct native address country')
    const rawCountries = [location.address.addressCountry, ...(address === location.address ? [] : [address.addressCountry])].filter(value => value != null)
    const typedCountries = rawCountries.map(normalizeCountry), known = typedCountries.filter(Boolean)
    const issues = []
    if (!rawCountries.length || typedCountries.some(value => !value)) issues.push('native-country-unresolved')
    if (new Set(known).size > 1) issues.push('native-direct-postal-country-conflict')
    const country = known.length && !issues.length ? known[0] : null
    const written = writtenCountry(location.location)
    requireValue(!country || !written || country === written, 'Contradictory typed native country and written country label')
    return { kind: index === 0 ? 'primary' : 'secondary', location: location.location,
      nativeAddress: structuredClone(address), nativeAddressContainer: structuredClone(location.address),
      nativeCountryRaw: address.addressCountry ?? null, nativeCountryRawFields: rawCountries, country,
      countryProvenance: country ? 'native-address-postalAddress-addressCountry' : 'unknown',
      countryScopeQualified: issues.length === 0, worksiteScopeQualified: true,
      qualifiedForProjection: issues.length === 0, unresolved: issues, cityOrRemoteUsedAsCountryEvidence: false }
  })
  // Both original authored fields are retained source evidence. The plain
  // carrier can contain a role restriction omitted from its HTML counterpart;
  // it must constrain qualification without supplying new typed countries.
  const plainClauses = typeof row.descriptionPlain === 'string'
    ? row.descriptionPlain.split(/\r?\n+|(?<=[.!?])\s+(?=[A-Z*])/u).map(normalized).filter(restriction) : []
  check()
  const clauses = [...new Set([...ownedBlocks, ...plainClauses].filter(restriction))]
  for (const clause of clauses) {
    check()
    const explicit = countriesInClause(clause)
    const worksite = /\b(?:in[ -]?person|onsite|on-site)\b.{0,55}\b(?:in|at)\b/i.test(clause)
      || /\b(?:must|required to)\b.{0,35}\b(?:office|work from)\b/i.test(clause)
    const aliases = locations.map(location => {
      const label = location.location.replace(/^remote\s*[-:/]\s*/i, '').split(',')[0]
      return [label, location.nativeAddress.addressLocality].filter(value => text(value) && !nativeCountryName(value))
    })
    // Reconcile an explicit country with its own named site. A site's typed
    // country must never overwrite the different country written beside it.
    const segments = clause.split(/\s+(?:or|and)\s+/i).map(value => {
      const segmentWords = ' ' + words(value) + ' '
      return { countries: countriesInClause(value), matches: aliases.map(values => values.some(alias => segmentWords.includes(' ' + words(alias) + ' '))) }
    })
    const namedSite = segments.some(segment => segment.matches.some(Boolean))
    for (const segment of segments) for (const [index, location] of locations.entries()) {
      if (segment.matches[index] && segment.countries.size && location.country && !segment.countries.has(location.country))
        location.unresolved.push('native-authored-country-restriction-conflict')
    }
    if (explicit.size && !namedSite) {
      for (const location of locations) if (location.country && !explicit.has(location.country)) location.unresolved.push('native-authored-country-restriction-conflict')
    }
    if (worksite && (namedSite || !explicit.size)) {
      for (const [index, location] of locations.entries()) {
        const matched = segments.some(segment => segment.matches[index]
          || !segment.matches.some(Boolean) && location.country && segment.countries.has(location.country))
        if (!matched) location.unresolved.push('native-authored-worksite-restriction-unresolved')
      }
    }
  }
  for (const location of locations) {
    location.countryScopeQualified = !location.unresolved.some(issue => !issue.includes('worksite'))
    location.worksiteScopeQualified = !location.unresolved.some(issue => issue.includes('worksite'))
    location.qualifiedForProjection = location.countryScopeQualified && location.worksiteScopeQualified
  }
  check()
  return { locations, restrictionClauses: clauses,
    countryScopeQualified: locations.every(location => location.countryScopeQualified),
    worksiteScopeQualified: locations.every(location => location.worksiteScopeQualified),
    qualifiedForProjection: locations.every(location => location.qualifiedForProjection) }
}
