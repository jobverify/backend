import { readNativeDocument, activeIframeSources } from '../../utils/activeNativeHtml.js'
import { readLiteralModel } from '../literalModel.js'
import { selectReviewedDeclaredAsset } from './reviewedDeclaredAssets.js'
import { countryName } from '../jobPostingData.js'
import { sha256 } from '../publicIO.js'
import { text, decode, plain, content, dayDate, offsetDate } from '../cisVeeam/publishedData.js'

export const requireNative = (ok, reason) => { if (!ok) throw Error('Declared Greenhouse: ' + reason) }
export const nativeJSON = page => {
  requireNative(page?.usable && page.transportQualified && typeof page.bodyBase64 === 'string'
    && typeof page.bodySHA256 === 'string' && typeof page.originalText === 'string', 'original public JSON unavailable')
  return readLiteralModel(page.originalText).value
}
const executable = node => !Object.hasOwn(node.attrs, 'nomodule')
  && ['', 'text/javascript', 'application/javascript', 'module'].includes((node.attrs.type || '').trim().toLowerCase())
export const primaryDeclaration = (html, profile) => {
  const doc = readNativeDocument(html), declarations = profile.declaration
  const titles = doc.nodes(node => node.tag === 'title').map(node => text(decode(node.raw || '')))
  if (!titles.some(title => profile.primaryTitleSignals.some(signal => title.toLowerCase().includes(signal.toLowerCase())))) return false
  if (declarations.kind === 'active-declared-external-profile' && Object.hasOwn(declarations, 'reviewedAlternates'))
    return Boolean(selectReviewedDeclaredAsset(html, profile))
  const scripts = doc.nodes(node => node.tag === 'script' && executable(node))
  if (declarations.kind === 'active-native-frame') return activeIframeSources(html).some(value => {
    try { const url = new URL(value, profile.primaryURL);return url.origin === 'https://job-boards.greenhouse.io' && !url.username && !url.password
      && url.pathname === '/embed/job_board' && url.searchParams.getAll('for').length === 1 && url.searchParams.get('for') === profile.boardToken } catch { return false }
  })
  if (declarations.kind === 'active-native-embed-script' || declarations.kind === 'active-declared-external-profile') return scripts.some(node => node.attrs.src === (declarations.scriptSpecifier || declarations.scriptURL))
  if (declarations.kind === 'active-native-board-link') return doc.nodes(node => node.tag === 'a' && node.attrs.href).some(node => {
    try { return new URL(node.attrs.href, profile.primaryURL).href.replace(/\/$/, '') === declarations.boardURL.replace(/\/$/, '') } catch { return false }
  })
  if (declarations.kind === 'visible-published-native-GET-example') return doc.nodes(node => node.tag === 'pre').some(node => content(node).includes(declarations.publicURL))
  return declarations.kind === 'active-literal-native-inline-profile' && scripts.some(node => !node.attrs.src
    && sha256(Buffer.from(node.raw || '')) === declarations.scriptSHA256 && node.raw.includes(declarations.literalPublicURI))
}
export const postURI = (value, id, profile) => {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password || url.hash) return false
    if (['pathai-first-party-gh-jid', 'lyft-careerpuck-gh-jid'].includes(profile.postURIProfile)) {
      if (url.port || url.searchParams.getAll('gh_jid').length !== 1 || url.searchParams.get('gh_jid') !== String(id)
        || [...url.searchParams.keys()].some(key => key !== 'gh_jid')) return false
      return profile.postURIProfile === 'pathai-first-party-gh-jid'
        ? url.origin === 'https://www.pathai.com' && ['/careers/' + id, '/career/job-post'].includes(url.pathname)
        : url.origin === 'https://app.careerpuck.com' && url.pathname === '/job-board/lyft/job/' + id
    }
    if (['job-boards.greenhouse.io', 'boards.greenhouse.io', 'job-boards.eu.greenhouse.io', 'boards.eu.greenhouse.io'].includes(url.hostname)) {
      return !url.port && !url.search && url.pathname === '/' + profile.boardToken + '/jobs/' + id
    }
    const primary = new URL(profile.primaryURL)
    return profile.postURIProfile === 'same-company-gh-jid' && url.origin === primary.origin && url.pathname.replace(/\/$/, '') === primary.pathname.replace(/\/$/, '')
      && url.searchParams.getAll('gh_jid').length === 1 && url.searchParams.get('gh_jid') === String(id)
  } catch { return false }
}
export const nativeHTMLText = value => {
  if (typeof value !== 'string') return ''
  const actual = /<\/?[a-z][a-z\d:-]*(?:\s[^<>]*|\/?)>/i.test(value)
  const encoded = /(?:&lt;|&#0*60;|&#x0*3c;)\/?[a-z][a-z\d:-]*(?:\s|&gt;|&#0*62;|&#x0*3e;)/i.test(value)
  const doc = readNativeDocument(!actual && encoded ? decode(value) : value)
  const blocks = new Set(['p', 'div', 'li', 'ul', 'ol', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'br', 'hr', 'table', 'tr', 'td', 'th', 'dl', 'dt', 'dd', 'section', 'article'])
  const rendered = node => {
    if (node.inert || ['script', 'style'].includes(node.tag)) return ''
    const raw = node.children.map(child => typeof child === 'string' ? decode(child) : rendered(child)).join('')
    return blocks.has(node.tag) ? ' ' + raw + ' ' : raw
  }
  return text(rendered(doc.nodes(node => node.tag === 'root')[0]))
}
export const criteria = record => {
  const body = nativeHTMLText(record.content), ai = record.include_ai_disclaimer === true ? nativeHTMLText(record.ai_disclaimer) : ''
  let full = body
  if (ai && !full.includes(ai)) full += (full ? ' ' : '') + ai
  const pay = Array.isArray(record.pay_input_ranges) ? record.pay_input_ranges : []
  for (const range of pay) {
    requireNative(range && Number.isSafeInteger(range.min_cents) && Number.isSafeInteger(range.max_cents) && range.min_cents <= range.max_cents
      && typeof range.currency_type === 'string', 'unsupported published pay range; original retained')
    const label = [text(range.title), range.currency_type + ' ' + (range.min_cents / 100).toFixed(2) + ' to ' + (range.max_cents / 100).toFixed(2), nativeHTMLText(range.blurb)].filter(Boolean).join('. ')
    if (label && !full.includes(label)) full += (full ? ' ' : '') + 'Published pay information: ' + label
  }
  return { jobDescription: full || null, sourceNativeContentText: body, sourceNativeAIText: ai, sourceNativePayInputRanges: structuredClone(pay) }
}
const aliases = new Map(), names = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' })
for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
  const name = names.of(String.fromCharCode(a, b))
  if (name && name.length > 3 && !['Georgia', 'Jersey'].includes(name)) aliases.set(name.toLowerCase(), countryName(name))
}
for (const [label, name] of [['us', 'United States'], ['usa', 'United States'], ['u.s.', 'United States'], ['u.s.a.', 'United States'], ['uk', 'United Kingdom'], ['united states of america', 'United States']]) aliases.set(label, name)
const literalCountries = value => {
  const label = text(value), exact = aliases.get(label.toLowerCase())
  if (exact) return [exact]
  const remote = label.replace(/^remote(?:\s*[-,]\s*|\s+)/i, '').replace(/(?:\s*[-,]\s*|\s+)remote$/i, '').trim()
  const supported = aliases.get(remote.toLowerCase())
  if (supported) return [supported]
  const parenthesis = /\(([^()]+)\)\s*$/.exec(label)
  if (parenthesis && aliases.get(parenthesis[1].toLowerCase())) return [aliases.get(parenthesis[1].toLowerCase())]
  if (/^United States\s*-\s*(?:West Coast|Pacific Time)\s*$/i.test(label)) return ['United States']
  return []
}
const pieces = value => text(value).split(/\s*(?:;|\||\s+or\s+|\s+and\s+|\s*\/\s*)\s*/i).filter(Boolean)
  .flatMap(label => {
    const tokens = label.split(',').map(text), known = tokens.map(token => literalCountries(token).length > 0)
    // A postal country is terminal. In a mixed flat list such as London,
    // Oxford, Poland, Krakow, Poland must not be attached to London.
    const flatMixed = known.slice(0, -1).some(Boolean) && !known.at(-1)
    return tokens.length > 1 && (tokens.every(token => aliases.has(token.toLowerCase())) || flatMixed) ? tokens : [label]
  })
const place = label => {
  const tokens = label.split(',').map(text), lastCountries = literalCountries(tokens.at(-1)), countries = []
  for (const token of tokens) {
    if (token.toLowerCase() === 'georgia' && lastCountries.includes('United States')) continue
    countries.push(...literalCountries(token))
  }
  const unique = [...new Set(countries)], cityLabel = tokens.length > 1 && !literalCountries(tokens[0]).length && !/^remote\b/i.test(tokens[0]) ? tokens[0] : null
  return { originalLabel: label, country: unique.length === 1 ? unique[0] : null, ambiguousCountries: unique.length > 1,
    cityLabel, state: tokens.length === 3 && lastCountries.length === 1 ? tokens[1] : null }
}
const sameWorksite = (a, b) => a.cityLabel && b.cityLabel && a.cityLabel.toLowerCase() === b.cityLabel.toLowerCase()
  && (!a.state || !b.state || a.state.toLowerCase() === b.state.toLowerCase() || /^[a-z]{1,3}$/i.test(a.state) || /^[a-z]{1,3}$/i.test(b.state))
export const nativeLocationMetadata = record => {
  const result=[]
  for(const [fieldIndex,field] of (Array.isArray(record.metadata)?record.metadata:[]).entries()){
    const name=text(field?.name)
    if(!/^(?:(?:job(?: posting)?|office)\s+)?(?:locations?|countries|country|offices?)(?:\s*\(for website only\))?$/i.test(name))continue
    const countryField=/\b(?:countries|country)\b/i.test(name)
    for(const originalValue of Array.isArray(field.value)?field.value:[field.value]){
      if(originalValue==null||originalValue==='')continue
      const labels=typeof originalValue==='string'?pieces(originalValue):['']
      for(const label of labels){
        const iso=countryField&&/^[a-z]{2}$/i.test(label)?names.of(label.toUpperCase()):countryField&&label.toUpperCase()==='IND'?'India':null
        const typedCountry=countryField?(iso?countryName(iso):literalCountries(label)[0]||(['Georgia','Jersey'].includes(label)?label:null)):null
        const projected=countryField?{originalLabel:label,country:typedCountry,cityLabel:null,state:null}:place(label)
        result.push({...projected,originalField:field.name,originalValue:structuredClone(originalValue),nativeFieldIndex:fieldIndex,
          countryConstraint:countryField||Boolean(projected.country&&!projected.cityLabel&&literalCountries(label).length),source:'native-role-owned-location-metadata'})
      }
    }
  }
  return result
}
export const officeIndex = payload => {
  requireNative(payload && Array.isArray(payload.offices), 'native office hierarchy unavailable')
  const nodes = new Map(), posts = new Map()
  for (const office of payload.offices) {
    requireNative(Number.isSafeInteger(office?.id) && office.id >= 0 && !nodes.has(office.id), 'duplicate/malformed native office identity')
    requireNative(office.id !== 0 || office.name === 'No Office' && office.location == null && office.parent_id == null,
      'native zero office is not the published No Office entry')
    nodes.set(office.id, office)
    for (const department of office.departments || []) for (const job of department.jobs || []) {
      if (!Number.isSafeInteger(job?.id) || job.id <= 0) continue
      if (!posts.has(job.id)) posts.set(job.id, [])
      posts.get(job.id).push({ officeId: office.id, departmentId: department.id, originalRecord: job })
    }
  }
  return { nodes, posts }
}
export const geography = (record, index) => {
  const primary = pieces(record.location?.name).map(label => ({ ...place(label), source: 'native-role-location' })), assigned = [], conflicts = []
  const typedMetadata=nativeLocationMetadata(record)
  const typedCountries=[...new Set(typedMetadata.filter(item=>item.countryConstraint).map(item=>item.country).filter(Boolean))]
  if(typedCountries.length===1)for(const item of primary)if(!item.country)item.country=typedCountries[0]
  for (const office of record.offices || []) {
    const chain = [], seen = new Set();let node = office, inherited = null
    while (node) {
      if (seen.has(node.id)) { conflicts.push({ reason: 'native-office-parent-cycle', officeId: office.id });break }
      seen.add(node.id)
      const named = pieces(node.name).flatMap(label => { const p = place(label);return p.country ? [p.country] : [] })
      const located = pieces(node.location).flatMap(label => { const p = place(label);return p.country ? [p.country] : [] })
      const countries = [...new Set([...named, ...located])]
      chain.push({ id: node.id, name: node.name ?? null, location: node.location ?? null, parent_id: node.parent_id ?? null, countries })
      if (countries.length > 1) { conflicts.push({ reason: 'one-office-country-fields-conflict', officeId: node.id });break }
      if (countries.length === 1) {
        if (inherited && inherited !== countries[0]) conflicts.push({ reason: 'native-office-ancestor-country-conflict', officeId: office.id })
        inherited ||= countries[0]
      }
      const matched = index.nodes.get(node.id)
      if (matched && ['name', 'location', 'parent_id'].some(key => (matched[key] ?? null) !== (node[key] ?? null))) conflicts.push({ reason: 'assigned-office-and-current-hierarchy-conflict', officeId: node.id })
      node = node.parent_id == null ? null : index.nodes.get(node.parent_id)
    }
    const labels = pieces(office.location || office.name)
    for (const label of labels) assigned.push({ ...place(label), country: place(label).country || inherited,
      source: 'native-assigned-office', officeId: office.id, originalOffice: structuredClone(office), nativeCountryPath: chain })
  }
  for (const item of primary.filter(item => !item.country && !/^(?:remote|global|worldwide|anywhere|multiple(?: locations)?|all locations|international|apac|emea|amer|latam|anz(?: region)?)$/i.test(item.originalLabel))) {
    const matches = assigned.filter(other => other.country && (text(other.originalOffice.name).toLowerCase() === item.originalLabel.toLowerCase()
      || other.cityLabel?.toLowerCase() === item.originalLabel.toLowerCase() || sameWorksite(item, other)))
    const countries = [...new Set(matches.map(other => other.country))]
    if (countries.length === 1) Object.assign(item, { country: countries[0], nativeAssignedOfficeIds: matches.map(other => other.officeId) })
  }
  const all = [...primary, ...assigned, ...typedMetadata]
  for(const fieldIndex of new Set(typedMetadata.filter(item=>item.countryConstraint).map(item=>item.nativeFieldIndex))){
    const scope=[...new Set(typedMetadata.filter(item=>item.nativeFieldIndex===fieldIndex&&item.countryConstraint).map(item=>item.country).filter(Boolean))]
    if(scope.length&&all.some(item=>item.country&&!scope.includes(item.country)))conflicts.push({reason:'role-owned-country-scope-vs-native-location-conflict',nativeFieldIndex:fieldIndex,countries:scope})
  }
  for (const item of all) if (item.ambiguousCountries) conflicts.push({ reason: 'ambiguous-countries-in-one-location', originalLabel: item.originalLabel })
  for (let at = 0; at < all.length; at++) for (const other of all.slice(at + 1)) if (all[at].country && other.country
    && all[at].country !== other.country && sameWorksite(all[at], other)) conflicts.push({ reason: 'same-worksite-country-conflict', first: all[at], second: other })
  const countries = [...new Set(all.map(item => item.country).filter(Boolean))], conflict = conflicts.length > 0
  const country = conflict ? null : countries.includes('India') ? 'India' : countries.length === 1 ? countries[0] : null
  const selected = all.filter(item => item.country === country), labels = [...new Set(selected.map(item => item.originalLabel))]
  return { country, city: null, state: null, location: country ? labels.join('; ') || country : null, locations: country ? labels : [],
    sourceCountryScopeUnresolved: conflict || !all.length || all.some(item => !item.country), sourceNativeCountryConflict: conflict,
    sourceNativeCountries: countries, sourceNativeCountryEvidence: { primary, assignedOffices: assigned, typedMetadata, conflicts },
    sourceNativePrimaryLocation: structuredClone(record.location ?? null), sourceNativeAssignedOffices: structuredClone(record.offices ?? []) }
}
export const literalFields = record => {
  const metadata = Array.isArray(record.metadata) ? record.metadata : []
  const field = name => { const values = [...new Set(metadata.filter(item => item?.name === name).map(item => item.value))];return values.length === 1 && typeof values[0] === 'string' ? values[0] : null }
  const hours = field('Employment Type'), explicitWorkplace = field('Workplace Type')
  const locationPrefix = /^\s*(Remote|Hybrid|On[- ]site)\b/i.exec(record.location?.name || '')
  const locationSuffix = /(?:^|[-,])\s*(Remote|Hybrid|On[- ]site)\s*$/i.exec(record.location?.name || '')
  const workplace = explicitWorkplace || locationPrefix?.[1] || locationSuffix?.[1] || null
  const remoteStatus = /^remote$/i.test(workplace || '') ? 'Remote' : /^hybrid$/i.test(workplace || '') ? 'Hybrid' : /^on[- ]site$/i.test(workplace || '') ? 'On-site' : null
  const employmentType = /^full[ -]time\b/i.test(hours || '') ? 'Full-time' : /^part[ -]time\b/i.test(hours || '') ? 'Part-time'
    : /^(?:contract|temporary|fixed term)\b/i.test(hours || '') ? 'Contract' : /^(?:internship|intern)\b/i.test(hours || '') ? 'Internship' : null
  return { sourceEmploymentType: hours, employmentType, sourceEmploymentTypeUnresolved: !employmentType || employmentType === 'Part-time',
    sourceNativeWorkplaceType: workplace, sourceNativeWorkplaceTypeProvenance: explicitWorkplace ? 'native-metadata' : workplace ? 'native-role-location-label' : null,
    remoteStatus, sourceRemoteStatusUnresolved: true,
    sourcePostingDate: record.first_published ?? null, postingDate: offsetDate(record.first_published), sourcePostingDatePrecision: 'second-offset',
    sourceClosingDate: record.application_deadline ?? null, closingDate: dayDate(record.application_deadline) || offsetDate(record.application_deadline),
    sourceNativeUpdatedAt: record.updated_at ?? null }
}
