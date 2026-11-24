import { nativeCountryName, nativeLocationCountryName } from '../../scraper-support/shared/nativeJobPosting.js'
import { document as roleDocument, decode as decodeRoleHTML } from '../../scraper-support/shared/rmkNativePairHtml.js'

const unique = values => [...new Set(values)]
const explicitCountry = value => {
 const text = value.trim().replace(/\bU\.S\.(?=$|[\s,])/gi, 'US').replace(/^remote(?:\s*[,:-]\s*|\s+)/i, '')
 return nativeCountryName(text) ?? nativeLocationCountryName(text)
}

// OR inside a balanced preference is part of the authored primary label.
// Outside parentheses it still describes distinct worksite alternatives.
const splitAlternatives = label => {
 const parts = [];let depth = 0, start = 0, balanced = true
 for (let index = 0; index < label.length; index++) {
  if (label[index] === '(') depth++
  else if (label[index] === ')') { depth--;if (depth < 0) balanced = false }
  else if (depth === 0 && /\s/.test(label[index - 1] ?? '') && /^or\s/i.test(label.slice(index))) {
   parts.push(label.slice(start, index).trim());start = index + 2;index++
  }
 }
 parts.push(label.slice(start).trim())
 return { parts, balanced: balanced && depth === 0 }
}

const readAlternative = originalLabel => {
 let depth = 0, start = 0, main = '';const preferences = []
 for (let index = 0; index < originalLabel.length; index++) {
  const char = originalLabel[index]
  if (char === '(') { if (depth === 0) { start = index + 1;main += ' ' };depth++ }
  else if (char === ')') { depth--;if (depth === 0) preferences.push(originalLabel.slice(start, index)) }
  else if (depth === 0) main += char
 }
 const country = explicitCountry(main), preferenceCountries = [];let preferencesKnown = true
 for (const preference of preferences) {
  // This repair recognizes a preference, never an unlabelled second worksite.
  if (!/\bpreferred\s*[.!]?\s*$/i.test(preference) || /[()]|\b(?:unknown|undisclosed|unspecified|worldwide|global|anywhere|international|other|tbd)\b/i.test(preference)) preferencesKnown = false
  const locations = preference.replace(/\s+(?:strongly\s+)?preferred\s*[.!]?\s*$/i, '').split(/\b(?:or|and)\b|[;/|]/i)
  for (const location of locations) {
   const candidate = location.trim(), scoped = /\b(?:in|from|within)\s+(.+)$/i.exec(candidate)?.[1]
   const found = explicitCountry(candidate) ?? (scoped ? explicitCountry(scoped) : null)
   if (found) preferenceCountries.push(found)
  }
 }
 return { originalLabel, mainLabel: main.trim(), country, preferences, preferenceCountries: unique(preferenceCountries), preferencesKnown }
}

export const parseDoximityPrimaryLabel = label => {
 const originalLabel = typeof label === 'string' ? label : null
 const split = splitAlternatives(originalLabel ?? ''), alternatives = split.parts.map(readAlternative)
 const countries = unique(alternatives.map(value => value.country).filter(Boolean))
 const preferenceCountries = unique(alternatives.flatMap(value => value.preferenceCountries))
 const conflicts = alternatives.flatMap(value => value.preferenceCountries.filter(country => value.country && country !== value.country)
  .map(country => ({ primaryCountry: value.country, preferenceCountry: country, originalLabel: value.originalLabel })))
 const resolved = Boolean(originalLabel && split.balanced && alternatives.every(value => value.country && value.preferencesKnown) && countries.length === 1 && !conflicts.length)
 return { originalLabel, balanced: split.balanced, alternatives, countries, preferenceCountries, conflicts, resolved, country: resolved ? countries[0] : null }
}

export const qualifyDoximityPrimaryLabel = row => {
 const original = row?.sourceNativePrimaryLocation?.name, analysis = parseDoximityPrimaryLabel(original), reasons = []
 const evidence = row?.sourceNativeCountryEvidence, country = analysis.country
 if (!analysis.resolved || !analysis.alternatives.some(value => value.preferences.length)) reasons.push('unqualified-primary-preference-label')
 if (!row?.sourceNativeTemporalQualified || !row.sourceNativeRoleEvidencePairQualified || !row.sourceNativePublishedContractQualified || row.sourceNativePostKind !== 'job') reasons.push('unqualified-paired-native-role')
 if (!original || row?.sourceNativeRecord?.location?.name !== original || row?.sourceNativePublishedModel?.job_post_location !== original || row?.sourceNativePublishedClosingModel?.job_post_location !== original || !row?.sourceNativePublishedLocationEvidence?.matchesAPI) reasons.push('native-primary-label-identity-conflict')
 if (row?.sourceNativeCountryConflict || evidence?.conflicts?.length || (row?.country && row.country !== country)) reasons.push('existing-native-country-conflict')
 if (!evidence || !Array.isArray(evidence.primary) || !Array.isArray(evidence.assignedOffices) || !Array.isArray(evidence.typedMetadata)) reasons.push('missing-native-worksite-evidence')
 else {
  if (evidence.primary.some(value => value.ambiguousCountries || (value.country && value.country !== country))) reasons.push('conflicting-primary-country-evidence')
  if ([...evidence.assignedOffices, ...evidence.typedMetadata].some(value => !value.country || value.country !== country || value.ambiguousCountries)) reasons.push('unknown-or-conflicting-native-worksite')
 }
 if ((row?.sourceNativeCountries ?? []).some(value => value !== country)) reasons.push('conflicting-native-country-alternative')
 return { qualified: reasons.length === 0, country: reasons.length ? null : country, analysis, reasons, companyAddressUsed: false, applicationFormCountriesUsed: false }
}


// Scope countries to individual authored Location-labelled role blocks.
// Company/EEO sections and forms cannot provide workplace country evidence.
const roleLocationParagraphs = (originalContent, { includeHeadings = false } = {}) => {
 if (typeof originalContent !== 'string') return []
 const encoded = !/<\/?[a-z][a-z\d:-]*(?:\s[^<>]*|\/?)>/i.test(originalContent) && /(?:&lt;|&#0*60;|&#x0*3c;)\/?[a-z]/i.test(originalContent)
 const html = encoded ? decodeRoleHTML(originalContent) : originalContent, doc = roleDocument(html)
 const formNodes = new Set(doc.nodes(node => node.tag === 'form').flatMap(node => doc.nodes(() => true, node)))
 // Inline descendants remain heading content; they cannot become body label units.
 const headingDescendants = new Set(doc.nodes(node => /^h[1-6]$/.test(node.tag)).flatMap(node => doc.nodes(value => value !== node, node)))
 const units = new Set(['p', 'div', 'section', 'label', 'span'])
 const nestedBlocks = new Set('address article aside blockquote details dialog div dl dt dd fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hr li main nav ol p section summary table tbody td tfoot th thead tr ul input select button textarea option'.split(' '))
 const paragraphs = [];let excludedSection = null
 for (const node of doc.nodes(value => units.has(value.tag) || /^h[1-6]$/.test(value.tag))) {
  if (formNodes.has(node) || headingDescendants.has(node)) continue
  const text = doc.text(node)
  const heading = /^h[1-6]$/.test(node.tag)
  if (heading) {
   const level = Number(node.tag[1])
   if (excludedSection !== null && level <= excludedSection) excludedSection = null
   const roleHeading = /^about\s+(?:(?:the|this)\s+)?(?:role|position|job)\s*[:.!]?\s*$/i.test(text)
   if (!roleHeading && /^(?:about(?:\s|$)|headquarters(?:\s|:|$)|equal[\s-]+(?:employment[\s-]+)?opportunity(?:\s|$)|eeo(?:\s|:|$))/i.test(text)) excludedSection = level
   if (!includeHeadings) continue
  }
  // A container spanning other blocks is not one authored label unit.
  if (doc.nodes(value => value !== node && nestedBlocks.has(value.tag), node).length) continue
  const match = /^Location\s*:\s*(.+)$/i.exec(text)
  if (excludedSection !== null || !match) continue
  const analysis = parseDoximityPrimaryLabel(match[1])
  paragraphs.push({ ...(includeHeadings ? { heading } : {}), paragraphHTML: Number.isInteger(node.end) ? doc.outer(node) : null, decodedFromEntityEncodedHTML: encoded,
   text, originalValue: match[1], countries: unique([...analysis.countries, ...analysis.preferenceCountries]), analysis })
 }
 return paragraphs
}

export const readDoximityRoleLocationCriteria = row => {
 const history = row.sourceNativeAPIModelHistory ?? []
 const carriers = [
  { source: 'native-api-record', phase: 'selected', originalContent: row.sourceNativeRecord?.content },
  ...history.map((value, index) => ({ source: 'native-api-history', phase: index === 0 ? 'opening' : index === history.length - 1 ? 'closing' : 'observation-' + (index + 1), originalContent: value.content })),
  { source: 'hosted-model', phase: 'opening', originalContent: row.sourceNativePublishedModel?.content },
  { source: 'hosted-model', phase: 'closing', originalContent: row.sourceNativePublishedClosingModel?.content },
  { source: 'visible-role-criteria', phase: 'opening', originalContent: row.sourceNativeOwnDescriptionHTML, originalText: row.sourceNativeOwnDescription },
  { source: 'visible-role-criteria', phase: 'closing', originalContent: row.sourceNativeClosingOwnDescriptionHTML, originalText: row.sourceNativeClosingOwnDescription },
 ].map(value => ({ ...value, originalContent: value.originalContent ?? null, originalText: value.originalText ?? null,
  paragraphs: roleLocationParagraphs(value.originalContent) }))
 const primary = parseDoximityPrimaryLabel(row.sourceNativePrimaryLocation?.name)
 const nativeCountries = unique(primary.countries)
 const criterionCountries = unique(carriers.flatMap(value => value.paragraphs.flatMap(paragraph => paragraph.countries)))
 const conflictingCountries = nativeCountries.length ? criterionCountries.filter(value => !nativeCountries.includes(value)) : []
 return { carriers, nativeCountries, criterionCountries, conflictingCountries, conflict: conflictingCountries.length > 0,
  criteriaUsedToSupplyCountry: false, companyAddressUsed: false, applicationFormCountriesUsed: false,
  scope: 'Only active individual Location-labelled role blocks (p/div/section/label/leaf span); containers spanning headings or other blocks, About/headquarters/EEO sections and forms excluded. Raw per-carrier content and original visible text retained. Criteria can reject a contradicted native country but never supply a country.' }
}


// This is a separate authority from the rejection-only criterion evidence.
// A complete role-wide country restriction can reconcile an existing country
// candidate with an otherwise unknown primary locality; it cannot invent one.
const roleCountryAssertion = unit => {
 const originalValue = unit.originalValue
 const match = /^(?:this|the)\s+(?:role|position|job)\s+is\s+(?:fully\s+)?(?:remote|based|located)\s+(?:(?:only|exclusively)\s+)?(?:in|within)\s+(.+)$/i.exec(originalValue)
 const rawCountry = match?.[1]?.trim().replace(/^the\s+/i, '').replace(/\.$/, '') ?? null
 let country = null
 if (rawCountry && /^(?:U\.?S\.?A?\.?|United States(?: of America)?)$/i.test(rawCountry)) country = 'United States'
 else if (rawCountry && !/^[a-z]{2,3}$/i.test(rawCountry)) country = nativeCountryName(rawCountry)
 return { paragraphHTML: unit.paragraphHTML, text: unit.text, originalValue, rawCountry,
  country, unconditional: Boolean(match && country), companyAddressUsed: false, applicationFormCountriesUsed: false }
}

export const qualifyDoximityRoleCountryScope = (row, criteria) => {
 const reasons = [], evidence = row.sourceNativeCountryEvidence
 const existingCountries = unique(row.sourceNativeCountries ?? [])
 const candidate = existingCountries.length === 1 && row.country === existingCountries[0] ? row.country : null
 const priorCountryScopeUnresolved = row.sourceCountryScopeUnresolved === true
 if (!candidate) reasons.push('missing-single-existing-native-country-candidate')
 if (!priorCountryScopeUnresolved) reasons.push('no-unresolved-primary-workplace-to-reconcile')
 if (row.sourceNativeCountryConflict || evidence?.conflicts?.length) reasons.push('existing-native-country-conflict')
 const primary = evidence?.primary, assigned = evidence?.assignedOffices, typed = evidence?.typedMetadata
 if (!Array.isArray(primary) || !Array.isArray(assigned) || !Array.isArray(typed)) reasons.push('missing-native-workplace-evidence')
 else {
  const unknown = primary.filter(value => !value.country)
  if (!unknown.length || unknown.some(value => !value.cityLabel || value.source !== 'native-role-location' || value.ambiguousCountries)) reasons.push('uncertainty-is-not-only-primary-localities')
  if (primary.some(value => value.ambiguousCountries || value.country && value.country !== candidate)) reasons.push('known-primary-country-conflict')
  if (!assigned.length || [...assigned, ...typed].some(value => !value.country || value.country !== candidate || value.ambiguousCountries)) reasons.push('unknown-or-conflicting-assigned-or-typed-country')
 }
 if (row.sourceNativePostKind !== 'job' || row.sourceNativeDetailQualified !== true
  || row.sourceNativeRoleEvidencePairQualified !== true || row.sourceNativePublishedContractQualified !== true
  || row.sourceNativeTemporalQualified !== true || row.sourceNativeOwnHostedPageReadThisRun !== true
  || row.sourceNativePublishedLocationEvidence?.matchesAPI !== true) reasons.push('unqualified-complete-paired-native-role')
 if (!row.sourceNativePrimaryLocation?.name || row.sourceNativeRecord?.location?.name !== row.sourceNativePrimaryLocation.name
  || row.sourceNativePublishedModel?.job_post_location !== row.sourceNativePrimaryLocation.name
  || row.sourceNativePublishedClosingModel?.job_post_location !== row.sourceNativePrimaryLocation.name) reasons.push('native-primary-role-identity-conflict')
 if (!Array.isArray(row.sourceNativeAPIModelHistory) || row.sourceNativeAPIModelHistory.length !== 2) reasons.push('missing-paired-api-history')
 const required = [
  ['native-api-record', 'selected'], ['native-api-history', 'opening'], ['native-api-history', 'closing'],
  ['hosted-model', 'opening'], ['hosted-model', 'closing'],
  ['visible-role-criteria', 'opening'], ['visible-role-criteria', 'closing'],
 ]
 const input = criteria?.carriers ?? []
 if (input.length !== required.length || required.some(([source, phase]) => input.filter(value => value.source === source && value.phase === phase).length !== 1)) reasons.push('missing-actual-country-scope-carrier-or-phase')
 const carriers = input.map(value => {
  const assertions = value.paragraphs.map(roleCountryAssertion)
  // Existing native Location headings can veto a contradictory country. They
  // never supply the required whole-role paragraph authority for admission.
  const locationHeadings = roleLocationParagraphs(value.originalContent, { includeHeadings: true }).filter(unit => unit.heading).map(unit => {
   const assertion = roleCountryAssertion(unit)
   return { paragraphHTML: unit.paragraphHTML, text: unit.text,
    countries: unique([...unit.countries, ...(assertion.unconditional ? [assertion.country] : [])]) }
  })
  const headingConflicts = locationHeadings.flatMap(unit => unit.countries).filter(country => candidate && country !== candidate)
  const qualified = Boolean(typeof value.originalContent === 'string' && value.originalContent && assertions.length
   && assertions.every(assertion => assertion.unconditional && assertion.country === candidate) && !headingConflicts.length)
  if (!qualified) reasons.push('unqualified-country-scope-' + value.source + '-' + value.phase)
  return { source: value.source, phase: value.phase, originalContent: value.originalContent, originalText: value.originalText,
   assertions, locationHeadings, qualified }
 })
 const conflictingCountries = unique(carriers.flatMap(value => [...value.assertions.filter(assertion => assertion.unconditional && candidate && assertion.country !== candidate).map(assertion => assertion.country), ...value.locationHeadings.flatMap(unit => unit.countries).filter(country => candidate && country !== candidate)]))
 if (conflictingCountries.length) reasons.push('whole-role-country-restriction-conflicts-with-native-candidate')
 const qualified = reasons.length === 0
 return { qualified, country: qualified ? candidate : null, existingNativeCountryCandidate: candidate,
  priorCountryScopeUnresolved, reasons: unique(reasons), carriers, conflictingCountries, conflict: conflictingCountries.length > 0,
  authority: 'all-carrier-paired-unconditional-role-owned-Location-country-scope',
  newCountrySupplied: false, countryInferredFromCity: false, unassignedOfficeUsed: false, headingOnlyAdmissionAllowed: false,
  originalPrimaryCountryUncertaintyRetained: true, companyAddressUsed: false, applicationFormCountriesUsed: false,
  scope: 'Only an existing single native country candidate can be reconciled. Every active full-role API/history/hosted/visible opening and closing carrier must independently assert the same unconditional whole-role country. Assigned and typed country facts must already be known and coherent; original primary geography remains unchanged.' }
}
