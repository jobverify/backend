import { createHash } from 'node:crypto'
import { decodeHTML, encodeHTML } from 'entities'
import { readNativeAttributeTokens, readNativeDocument, extractActiveDescription } from './activeNativeHtml.js'
import { nativeCountryName, nativeLocationCountryName } from '../shared/nativeJobPosting.js'
import { parseEightfoldJson, readEightfoldDataCarrier, eightfoldDocument } from './recruitmentEightfoldData.js'

// This profile is grounded in the current corporate declaration, actual browser
// API/visible full-role proof, and opening/closing captures dated 2026-11-11.
// Other Eightfold accounts and client variants require their own reviewed proof.
const profile = Object.freeze({ source: 'dsmfirmenich', domain: 'dsm.com', employerName: 'dsm-firmenich',
  officialURL: 'https://careers.dsm-firmenich.com/en/careers.html', origin: 'https://jobs.dsm-firmenich.com',
  boardURL: 'https://jobs.dsm-firmenich.com/careers',
  entryPath: '/gen/js/pcsxPwa.6c903be3a68c07ae.js',
  entrySHA256: 'c99cb7da4f4a8e6eef449602e15fea1c01ef90b31b4925947bd8ab54d0f1c111',
  roleRendererPath: '/gen/js/12480.612f8bee165df945.js',
  roleRendererSHA256: '48ab46e9fdd729f1117dc855913b9eff925eff8996519686eb31ed25d89eb385',
  configsSHA256: '66642cccd156f8fc33e49fa5896ac1b876e8c190bff61aef557614072c81eb18',
  brandingSHA256: '7b1495cfe6e1d2fdb32e1e2225c8e7b8b2adf772c5d2a4a0186992b418ebd2bb',
  supplementalConditionsSHA256: '4eea1a43c50d0c0c316623b36c714a0bfaae894740838f186b4bd1d933cc4832',
  videoSHA256: ['20ac7ae35cb5e323768385acebf9a4df1a6723dc0d5f19c5fea26b7a51aa6a10',
    '4b0bca9eb38beef334a137ce624e3a2e65b6c1b54cace3e99e4a66148d45944f',
    '2b3416e6cb427f7853d9e25dcf83c7a009363b9b228c1355cd5205f613d8d294'],
  blogSHA256: ['cc5b33bd73aa70b65089c4d010043d57ad5a2c8617f020cf9603cd304562bd2c'],
  heroOverrideSHA256: '9e2434220710a7a8da704326765e8ac9dfe51d25008b7783e8818b22e68c79b7',
})
const need = (condition, message) => { if (!condition) throw new Error('Eightfold PWA ' + message) }
const sha = value => createHash('sha256').update(value).digest('hex')
const text = value => typeof value === 'string' && value.trim().length > 0
const norm = value => String(value).normalize('NFC').replace(/\s+/gu, ' ').trim()
const stable = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item)
const same = (a, b) => stable(a) === stable(b)
const html = page => {
  need(page && (typeof page.html === 'string' || typeof page.text === 'string'), 'native page text unavailable')
  need(page.html == null || page.text == null || page.html === page.text, 'ambiguous native response text')
  return page.html ?? page.text
}
const exactResponse = (page, url) => {
  need(page?.status === 200 && page.url === url, 'native response identity/status changed')
  return html(page)
}
const active = ({ node, ancestors }) => !node.inert && !node.nativeTagUnqualified
  && !ancestors.some(parent => parent.inert || ['svg','math','template','object','noscript'].includes(parent.tag))
const allowedKeys = (value, keys, label) => need(value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).every(key => keys.includes(key)), 'unreviewed ' + label + ' fields/config')
const envelope = value => {
  allowedKeys(value, ['status','error','data','metadata'], 'native envelope')
  allowedKeys(value.error, ['message','body'], 'native error envelope')
  need(value.status === 200 && value.error.message === '' && value.error.body === '' && value.metadata === null,
    'native envelope upstream error/fallback/metadata changed')
  return value
}

function pageContext(page, url) {
  const source = exactResponse(page, url), parsed = eightfoldDocument(source)
  need(!parsed.entries.some(({ node }) => node.tag === 'base'), 'unreviewed native base URL')
  const renderers = parsed.entries.filter(({ node }) => node.tag === 'script' && /pcsxPwa\./.test(node.attrs.src || ''))
  need(renderers.length === 1 && active(renderers[0]), 'active current renderer declaration unavailable')
  const renderer = renderers[0].node
  need(!Object.hasOwn(renderer.attrs, 'nomodule')
    && /^(?:|text\/javascript|application\/javascript)$/i.test(renderer.attrs.type || '')
    && new URL(renderer.attrs.src, url).href === profile.origin + profile.entryPath,
  'unreviewed renderer execution mode/identity')
  // HTML normally keeps the first duplicate attribute. It must not erase a
  // contradictory src/type/visibility declaration on the reviewed entry.
  for (const match of parsed.normalized.matchAll(/<script\b([^>]*)>/gi)) {
    const attributes = readNativeAttributeTokens(match[1])
    if (!attributes.some(([key, value]) => key === 'src' && /pcsxPwa\./.test(value))) continue
    const names = attributes.map(([key]) => key)
    need(new Set(names).size === names.length, 'duplicate native renderer identity attributes')
  }
  const pcsx = readEightfoldDataCarrier(source, { id: 'pcsx-data', mountId: 'pcsx' })
  const branding = readEightfoldDataCarrier(source, { id: 'branding-data' })
  allowedKeys(pcsx.value, ['domain','configs','onboardingData','ipGeolocation','ipGeolocationLatLong','themeBuilderUser','instanceBannerData'], 'native model')
  need(pcsx.value.domain === profile.domain && branding.value.domain === profile.domain, 'current native account changed')
  need(pcsx.value.themeBuilderUser === null && same(pcsx.value.onboardingData, {}), 'public anonymous native mode changed')
  need(sha(stable(pcsx.value.configs)) === profile.configsSHA256 && sha(stable(branding.value)) === profile.brandingSHA256,
    'current renderer configuration/branding changed')
  return { entryURL: profile.origin + profile.entryPath, rendererAttributes: renderer.attrs,
    pcsxSnapshot: stable(pcsx.value), brandingSnapshot: stable(branding.value),
    carrierProvenance: { pcsx: pcsx.decodedJsonSHA256, branding: branding.decodedJsonSHA256 } }
}

export const declaredEightfoldPcsxRecruitment = (page, config = {}) => {
  if (config.source !== profile.source || page?.url !== profile.boardURL) return null
  const context = pageContext(page, profile.boardURL)
  return { kind: 'eightfold-pcsx', source: profile.source, origin: profile.origin, domain: profile.domain,
    boardURL: profile.boardURL, officialURL: profile.officialURL, employerName: profile.employerName,
    roleRendererURL: profile.origin + profile.roleRendererPath, ...context }
}

const handoff = page => {
  const source = exactResponse(page, profile.officialURL), doc = readNativeDocument(source)
  need(!doc.nodes(node => node.tag === 'base').length, 'unreviewed corporate handoff base')
  const links = doc.nodes(node => node.tag === 'a' && node.attrs.href === profile.boardURL)
    .map(node => ({ href: node.attrs.href, label: doc.text(node) }))
  need(links.length > 0 && links.every(link => /roles|vacancies/i.test(link.label)), 'current corporate recruitment handoff unavailable')
  return stable(links)
}
const nativeRoleURL = row => {
  need(Number.isSafeInteger(row?.id) && row.id > 0 && row.positionUrl === '/careers/job/' + row.id, 'native role URL/identity changed')
  return profile.origin + row.positionUrl
}
function countries(row) {
  need(Array.isArray(row.locations) && row.locations.length > 0 && row.locations.every(text)
    && Array.isArray(row.standardizedLocations) && row.standardizedLocations.length === row.locations.length
    && row.standardizedLocations.every(text), 'native country/location representations unavailable')
  const pairs = row.locations.map((label, index) => {
    const name = nativeLocationCountryName(label)
    const code = nativeCountryName(row.standardizedLocations[index].split(',').at(-1).trim())
    need(!name || !code || name === code, 'native country name/code contradiction')
    return { label, standardized: row.standardizedLocations[index], country: name && code ? name : null }
  })
  if (row.location != null) need(text(row.location) && row.locations.some(value => norm(value) === norm(row.location)),
    'native primary country/location contradicts additional locations')
  return pairs
}
const listingKeys = ['id','displayJobId','name','locations','standardizedLocations','postedTs','solrScore','stars','department',
  'creationTs','isHot','workLocationOption','locationFlexibility','atsJobId','positionUrl']
function listing(envelope) {
  need(envelope?.status === 200 && envelope.error?.message === '' && envelope.error?.body === '', 'native listing upstream error')
  const data = envelope.data
  need(data && Number.isSafeInteger(data.count) && data.count >= 0 && Array.isArray(data.positions)
    && data.positions.length <= 10 && data.count >= data.positions.length, 'native selected listing bounds changed')
  const ids = new Set(), rows = []
  for (const row of data.positions) {
    allowedKeys(row, listingKeys, 'native listing role')
    const url = nativeRoleURL(row)
    need(!ids.has(row.id) && text(row.name) && text(row.displayJobId), 'native listing duplicate/missing identity')
    ids.add(row.id)
    rows.push({ row, url, countries: countries(row) })
  }
  return { envelope, data, rows, snapshot: stable(envelope) }
}
const blocks = new Set(['root','div','p','h1','h2','h3','h4','h5','h6','ul','ol','li','table','tr','td','th','section','article','br','hr'])
const criteria = (source, listMarkers = false) => {
  const doc = readNativeDocument(source), hasOrderedList = listMarkers && doc.nodes(node => node.tag === 'ol').length > 0
  if (hasOrderedList) {
    // Styles are inert text nodes to the visible reader, while their rules can
    // still change list counters. Inspect the actual tree including those
    // nodes before relying on the reviewed default decimal presentation.
    const containsStyle = node => typeof node !== 'string' && (node.tag === 'style' || node.children.some(containsStyle))
    need(!containsStyle(doc.nodes(node => node.tag === 'root')[0]), 'unreviewed ordered list semantics')
    for (const match of source.matchAll(/<(?:ol|li)\b([^>]*)>/gi)) {
      const names = readNativeAttributeTokens(match[1]).map(([name]) => name)
      need(new Set(names).size === names.length, 'unreviewed ordered list semantics: duplicate attributes')
    }
  }
  const flow = (node, parentTag = null, ordinal = 0) => {
    if (typeof node === 'string') {
      const value = decodeHTML(node)
      // The captured own schema uses Markdown serialization. A new authored
      // backslash is outside this reviewed format, and cannot masquerade as
      // the schema serializer's structural escape before a numbered heading.
      if (listMarkers) need(!value.includes('\\'), 'unsupported authored backslash in native criteria')
      return value
    }
    if (node.inert || ['script','style','title'].includes(node.tag)) return ''
    if (listMarkers && node.tag === 'ol') {
      // Actual Word-authored ordered markup has numeric start/type 1 and only
      // margin styling. Nondefault counters, reversed/type/value semantics or
      // new CSS cannot be guessed from the text of a matching schema.
      need(Object.keys(node.attrs).every(key => ['start','type','style'].includes(key))
        && (!Object.hasOwn(node.attrs, 'start') || node.attrs.start === '1')
        && (!Object.hasOwn(node.attrs, 'type') || node.attrs.type === '1')
        && (!Object.hasOwn(node.attrs, 'style') || node.attrs.style === 'margin-top: 0.0in; margin-bottom: 0.0in;')
        && node.children.every(child => typeof child === 'string' ? !decodeHTML(child).trim() : child.tag === 'li'),
      'unreviewed ordered list semantics')
    }
    if (listMarkers && node.tag === 'li' && parentTag === 'ol') need(Object.keys(node.attrs).every(key => key === 'style')
      && (!Object.hasOwn(node.attrs, 'style') || node.attrs.style === 'margin-top: 0.0in; margin-right: 0.0in; margin-bottom: 8.0pt; line-height: 115%; font-size: 10.0pt; font-family: arial, helvetica, sans-serif;'),
    'unreviewed ordered list semantics')
    if (listMarkers && node.tag === 'li') need(['ol','ul'].includes(parentTag), 'unreviewed native list hierarchy')
    let item = 0
    let content = (listMarkers && node.tag === 'li' ? (parentTag === 'ol' ? ordinal + '. ' : '* ') : '')
      + node.children.map(child => flow(child, node.tag, typeof child !== 'string' && child.tag === 'li' ? ++item : 0)).join('')
    // Preserve every authored digit/dot and case. Only actual paragraph starts
    // acquire the exact structural Markdown escape observed in the full own
    // schema; punctuation elsewhere is never removed or folded.
    if (listMarkers && node.tag === 'p') content = content.replace(/^(\s*\d+)\.(?=\s)/u, '$1\\.')
    return blocks.has(node.tag) ? ' ' + content + ' ' : content
  }
  return norm(flow(doc.nodes(node => node.tag === 'root')[0]))
}
const roleKeys = ['id','displayJobId','name','locations','standardizedLocations','postedTs','stars','department','creationTs','jobDescription',
  'location','isHot','workLocationOption','locationFlexibility','atsJobId','positionUrl','publicUrl','jdHighlight','positionExtraDetails','positionUserActions']
const reviewedResources = (items, hashes) => {
  need(Array.isArray(items), 'unreviewed supplemental native resources')
  let previous = -1
  for (const item of items) {
    const current = hashes.indexOf(sha(stable(item)))
    need(current > previous, 'unreviewed, duplicate or reordered supplemental native resource')
    previous = current
  }
}
function detail(envelope, selected) {
  need(envelope?.status === 200 && envelope.error?.message === '' && envelope.error?.body === '', 'native full role upstream error')
  const value = envelope.data
  allowedKeys(value, roleKeys, 'native full role')
  need(nativeRoleURL(value) === selected.url && value.publicUrl === selected.url, 'native full role identity/public URL changed')
  for (const field of ['id','name','displayJobId','locations','standardizedLocations','postedTs','creationTs','department','atsJobId','workLocationOption','locationFlexibility'])
    need(same(value[field], selected.row[field]), 'native listing/full role identity changed: ' + field)
  const scope = countries(value)
  // The shared public projection has one India country field. A mixed-country
  // native role remains an observation until that projection can preserve its
  // complete public geography; it must not become country=India/location=US.
  need(scope.every(item => item.country === 'India'), 'native full role mixed-country projection scope unresolved')
  allowedKeys(value.positionUserActions, ['isSaved','applyAction'], 'native role action')
  allowedKeys(value.positionUserActions.applyAction, ['status'], 'native apply action')
  need(value.positionUserActions.isSaved === false, 'public native role action mode changed')
  need(value.positionUserActions?.applyAction?.status === 'allowed', 'native role availability changed')
  need(same(value.jdHighlight, []), 'unreviewed highlighted role criteria')
  // The actual HR role omits only already-reviewed IT media records. Every
  // authored condition stays exact; optional media may only be ordered unique
  // subsets of the captured whole records, including every original field.
  allowedKeys(value.positionExtraDetails, ['videos','blogs','perks','pymww','customContent'], 'supplemental native role criteria')
  const { videos, blogs, ...conditions } = value.positionExtraDetails
  need(sha(stable(conditions)) === profile.supplementalConditionsSHA256, 'unreviewed supplemental native role criteria')
  reviewedResources(videos, profile.videoSHA256)
  reviewedResources(blogs, profile.blogSHA256)
  need(text(value.jobDescription) && extractActiveDescription(value.jobDescription) && criteria(value.jobDescription).length >= 100,
    'native full role criteria unavailable')
  return { value, scope, snapshot: stable(envelope) }
}
function publishedRole(page, selected, native, descriptor) {
  const context = pageContext(page, selected.url)
  need(context.pcsxSnapshot === descriptor.pcsxSnapshot && context.brandingSnapshot === descriptor.brandingSnapshot,
    'own role/current board carrier context changed')
  const doc = readNativeDocument(html(page)), posts = doc.nodes(node => node.tag === 'script' && node.attrs.type === 'application/ld+json')
    .map(node => parseEightfoldJson(node.raw)).filter(value => value?.['@type'] === 'JobPosting')
  need(posts.length === 1, 'current own role schema identity unavailable')
  const post = posts[0]
  allowedKeys(post, ['@context','@type','datePosted','description','employmentType','hiringOrganization','inLanguage','jobLocation','title','url','validThrough'],
    'published role criteria')
  allowedKeys(post.hiringOrganization, ['@type','logo','name','sameAs'], 'published employer')
  need(post.title === native.value.name && post.url === selected.url, 'published title/role identity changed')
  need(post.hiringOrganization?.name === profile.employerName && post.hiringOrganization.sameAs === profile.domain,
    'published native employer/account changed')
  need(text(post.description) && criteria(native.value.jobDescription, true) === criteria(post.description),
    'complete native/published criteria differ')
  const locations = Array.isArray(post.jobLocation) ? post.jobLocation : [post.jobLocation]
  need(locations.length === native.scope.length, 'published native country scope changed')
  for (let index = 0; index < locations.length; index++) {
    const address = locations[index]?.address, publishedCountry = address?.addressCountry
    allowedKeys(locations[index], ['@type','address'], 'published country location')
    allowedKeys(address, ['@type','addressCountry','addressLocality','addressRegion'], 'published country address')
    if (typeof publishedCountry !== 'string') {
      allowedKeys(publishedCountry, ['@type','name'], 'published country object')
      need(publishedCountry['@type'] === 'Country', 'published country type unavailable')
    }
    const country = nativeCountryName(typeof publishedCountry === 'string' ? publishedCountry : publishedCountry?.name)
    const standardized = native.scope[index].standardized.split(',').map(part => norm(part))
    need(country && country === native.scope[index].country, 'published/native country contradiction')
    need(norm(address.addressLocality) === standardized[0]
      && norm(address.addressRegion).replace(/\s*,\s*/g, ',') === standardized.slice(1).join(','), 'published/native location labels contradict')
  }
  return { value: post, snapshot: stable(post), contextSnapshot: stable(context) }
}
function roleOverrides(envelope, native, descriptor) {
  need(envelope?.status === 200 && envelope.error?.message === '' && envelope.error?.body === '', 'native override upstream error')
  allowedKeys(envelope.data, ['pcsxBaseConfigOverrides'], 'native override')
  const config = envelope.data.pcsxBaseConfigOverrides
  allowedKeys(config, ['branding','positionDetailsConfig'], 'role override')
  const base = parseEightfoldJson(descriptor.pcsxSnapshot).configs.pcsxConfig
  if (Object.hasOwn(config, 'branding')) {
    allowedKeys(config.branding, ['heroImageConfig'], 'role branding override')
    allowedKeys(config.branding.heroImageConfig, ['default'], 'role hero override')
    allowedKeys(config.branding.heroImageConfig.default, ['enable','image','text'], 'role hero fields')
    need(sha(stable(config.branding.heroImageConfig.default)) === profile.heroOverrideSHA256, 'unreviewed authored hero override criteria')
  } else {
    // The current HR override leaves the exact pinned global hero in effect.
    // Omission cannot introduce a new authored headline or image criterion.
    const { enable, image, text } = base.branding.heroImageConfig.default
    need(sha(stable({ enable, image, text })) === profile.heroOverrideSHA256, 'unreviewed authored global hero criteria')
  }
  allowedKeys(config.positionDetailsConfig, ['sectionsConfig'], 'role sections override')
  const sections = config.positionDetailsConfig.sectionsConfig
  allowedKeys(sections, ['videos','blogs'], 'native role section override')
  need(Object.hasOwn(sections, 'videos'), 'reviewed native video override unavailable')
  for (const section of Object.values(sections)) {
    allowedKeys(section, ['items'], 'role supplemental content')
    need(Array.isArray(section.items) && section.items.every(text), 'native supplemental content changed')
  }
  // The renderer merges omitted sections with the hash-qualified current base
  // config. The own API model must publish exactly those effective resources.
  for (const key of ['videos','blogs']) {
    const effective = Object.hasOwn(sections, key) ? sections[key].items : base.positionDetailsConfig.sectionsConfig[key].items
    need(same(native.positionExtraDetails[key].map(item => item.url), effective), 'native supplemental resource/override membership changed')
  }
  return { value: envelope, snapshot: stable(envelope) }
}
function companyBenefits(value, descriptor) {
  const config = parseEightfoldJson(descriptor.pcsxSnapshot).configs.pcsxConfig.positionDetailsConfig
  const tabs = config.tabsDisplayConfig.filter(tab => tab.id === 'company')
  need(tabs.length === 1 && tabs[0].label === 'Company and benefits' && tabs[0].sections.includes('perks'),
    'current company criteria tab configuration changed')
  const perks = value.positionExtraDetails.perks
  need(same(perks, config.sectionsConfig.perks.items), 'native company perk criteria/configuration differ')
  return { label: tabs[0].label, items: structuredClone(perks),
    html: '<section><h2>' + encodeHTML(tabs[0].label) + '</h2>' + perks.map(perk =>
      '<section><h3>' + encodeHTML(perk.title) + '</h3><div>' + perk.description + '</div></section>').join('') + '</section>' }
}

export const readEightfoldPcsxRecruitment = async (descriptor, {
  readPage, readRenderer, readNativeJson, permit, matchingEmployer, addJob, recordRead, inventoryRead, unresolved,
  maxPages = 1, maxDetails = 8, remainingRequests, officialBinding, recheckOfficialBinding, now,
}) => {
  need(descriptor?.kind === 'eightfold-pcsx' && descriptor.source === profile.source && descriptor.domain === profile.domain
    && descriptor.origin === profile.origin && descriptor.boardURL === profile.boardURL && descriptor.officialURL === profile.officialURL
    && descriptor.entryURL === profile.origin + profile.entryPath && descriptor.roleRendererURL === profile.origin + profile.roleRendererPath,
  'unreviewed source/account descriptor')
  need(typeof remainingRequests === 'function' && Number.isSafeInteger(maxPages) && maxPages > 0
    && Number.isSafeInteger(maxDetails) && maxDetails > 0 && maxDetails <= 80, 'invalid native request/detail budget')
  need(matchingEmployer(profile.employerName), 'native employer lacks its current original-source binding')
  need(officialBinding?.officialURL === profile.officialURL && officialBinding.declaredURL === profile.boardURL,
    'current corporate handoff binding unavailable')
  const openedHandoff = handoff(officialBinding.page)
  const remaining = () => { const count = remainingRequests(); need(Number.isSafeInteger(count) && count >= 0, 'invalid remaining request budget'); return count }
  const read = async (callback, url, init = {}) => {
    need(remaining() > 0, 'native request budget exhausted before closing')
    need(permit(url) !== false, 'native public surface was not permitted')
    return callback(url, init)
  }
  const renderer = async (url, expected, init = {}) => {
    const result = await read(readRenderer, url, init)
    need(sha(exactResponse(result, url)) === expected, 'current reviewed renderer changed')
  }
  const rawJson = new WeakMap()
  const json = async (url, init = {}) => {
    const response = await read(readNativeJson, url, init)
    need(response?.status === 200 && response.url === url && typeof response.text === 'string', 'native JSON response identity/status changed')
    const value = envelope(parseEightfoldJson(response.text))
    rawJson.set(value, response.text)
    return value
  }
  if (remaining() < 3) { unresolved('native-eightfold-pcsx-opening-budget-unavailable'); return }
  await renderer(descriptor.entryURL, profile.entrySHA256)
  await renderer(descriptor.roleRendererURL, profile.roleRendererSHA256)
  // The exact current renderer constructs this search URL from domain, query,
  // location and start. Only the actually reviewed first page is selected.
  const selectedURL = profile.origin + '/api/pcsx/search?domain=' + profile.domain + '&query=&location=India&start=0&'
  const opened = listing(await json(selectedURL))
  inventoryRead({ kind: 'eightfold-pcsx', surface: selectedURL, reportedTotal: opened.data.count,
    observedRecordCount: opened.rows.length, selectedPages: 1, nativeRowUnit: 'position',
    sourceScopeComplete: false, listingComplete: false, lifecycleCleanupAllowed: false })
  const observedIDs = new Set()
  const observe = item => {
    if (observedIDs.has(item.row.id)) return
    observedIDs.add(item.row.id)
    recordRead({ ...structuredClone(item.row), url: item.url }, descriptor)
    if (item.countries.some(location => !location.country)) unresolved('native-eightfold-pcsx-country-scope-unresolved')
    if (item.countries.some(location => location.country === 'India') && item.countries.some(location => location.country !== 'India'))
      unresolved('native-eightfold-pcsx-mixed-country-public-projection-unqualified')
  }
  opened.rows.forEach(observe)
  unresolved('native-eightfold-pcsx-partial-first-page-source-scope-unverified-cleanup-forbidden')
  if (!opened.rows.length) { unresolved('native-eightfold-pcsx-empty-location-query-is-not-verified-zero'); return }
  const candidates = opened.rows.filter(item => item.countries.every(location => location.country === 'India'))
  // Fixed closing reserve: selected listing, native board, corporate handoff and
  // both renderers = 5 GETs. Each selected role costs 3 opening + 3 closing GETs.
  const selectedCount = Math.min(candidates.length, maxDetails, Math.max(0, Math.floor((remaining() - 5) / 6)))
  if (selectedCount < candidates.length) unresolved('native-eightfold-pcsx-detail-budget-closing-reserve')
  if (!selectedCount) return
  const staged = [], openedRoles = []
  for (const selected of candidates.slice(0, selectedCount)) {
    const query = '?position_id=' + selected.row.id + '&domain=' + profile.domain + '&hl=en'
    const detailURL = profile.origin + '/api/pcsx/position_details' + query
    const overrideURL = profile.origin + '/api/pcsx/overrides' + query
    const current = detail(await json(detailURL), selected)
    const published = publishedRole(await read(readPage, selected.url), selected, current, descriptor)
    const overrides = roleOverrides(await json(overrideURL), current.value, descriptor)
    openedRoles.push({ selected, current, published, overrides, detailURL, overrideURL })
  }
  // Earlier roles can change while later details are acquired. Their closing
  // reads must all follow the complete opening-detail phase.
  for (const { selected, current, published, overrides, detailURL, overrideURL } of openedRoles) {
    const closed = detail(await json(detailURL, { cache: 'no-store' }), selected)
    const closedPublished = publishedRole(await read(readPage, selected.url, { cache: 'no-store' }), selected, closed, descriptor)
    const closedOverrides = roleOverrides(await json(overrideURL, { cache: 'no-store' }), closed.value, descriptor)
    need(current.snapshot === closed.snapshot && published.snapshot === closedPublished.snapshot
      && published.contextSnapshot === closedPublished.contextSnapshot && overrides.snapshot === closedOverrides.snapshot,
    'closing native full role/current criteria/override changed')
    const benefits = companyBenefits(current.value, descriptor)
    staged.push({ id: String(current.value.id), title: current.value.name, url: selected.url,
      description: current.value.jobDescription + '\n' + benefits.html, employer: { name: profile.employerName }, legalEmployer: null,
      location: current.value.locations.join('; '), posted: null, closing: null, sourcePublicationDateUnavailable: true,
      remoteStatus: null, sourceRemoteStatusUnresolved: true,
      employmentType: published.value.employmentType ?? null,
      employerBinding: { method: 'current-native-eightfold-pcsx-published-employer', field: 'JobPosting.hiringOrganization',
        declaredEmployer: profile.employerName, legalEntityUnknown: true, surface: selected.url },
      record: { originalNativeRole: structuredClone(current.value), originalPublishedRole: structuredClone(published.value),
        originalNativeListingRow: structuredClone(selected.row), originalNativeOverrides: structuredClone(overrides.value),
        nativeCriteriaRepresentations: { primary: { field: 'jobDescription', fullPublishedSchemaAgreement: true, exactHTMLPreservedAsPrefix: true },
          company: { field: 'positionExtraDetails.perks', label: benefits.label, items: benefits.items,
            rendererSection: 'company/perks', roleDependentQualifiersPreserved: true },
          linkedCompanyResources: 'Original native videos/blogs retained separately; no complete linked-media or whole-company criteria claim.' },
        nativeCountries: structuredClone(current.scope), firstEverPublication: null,
        originalDateEvidence: { nativePostedTs: current.value.postedTs, nativeCreationTs: current.value.creationTs,
          publishedDatePostedLiteral: published.value.datePosted ?? null, nativePlatformValidityLiteral: published.value.validThrough ?? null,
          publicationProjection: 'unknown-native-semantics-or-timezone', exactClosingDate: null },
        sourceScopeComplete: false, lifecycleCleanupAllowed: false,
        nativeListingEvidence: { surface: selectedURL, reportedTotal: opened.data.count, observedRecordCount: opened.rows.length, selectedPageCount: 1 },
        nativeRendererEvidence: { entryURL: descriptor.entryURL, entrySHA256: profile.entrySHA256,
          roleRendererURL: descriptor.roleRendererURL, roleRendererSHA256: profile.roleRendererSHA256,
          originalCarrierProvenance: structuredClone(descriptor.carrierProvenance), observedAt: now ?? null },
        nativeClosingContext: { everySelectedRoleRechecked: true, selectedRoleSHA256: sha(current.snapshot),
          selectedListingRechecked: false, currentPublisherHandoffRechecked: false, nativeBoardRechecked: false,
          renderersRechecked: false, companyScopeComplete: false },
      } })
  }
  const closedListing = listing(await json(selectedURL, { cache: 'no-store' }))
  inventoryRead({ kind: 'eightfold-pcsx', surface: selectedURL, phase: 'closing', reportedTotal: closedListing.data.count,
    observedRecordCount: closedListing.rows.length, selectedPages: 1, nativeRowUnit: 'position',
    sourceScopeComplete: false, listingComplete: false, lifecycleCleanupAllowed: false })
  closedListing.rows.forEach(observe)
  // Only the independently qualified selected roles become positive partial
  // output. Their complete listing records must still be present unchanged.
  // Unvisited inventory churn remains real observed drift, never completeness.
  need(closedListing.data.count === opened.data.count, 'closing native reported listing count changed')
  const withoutPositions = page => ({ ...page.envelope, data: { ...page.data, positions: [] } })
  need(same(withoutPositions(opened), withoutPositions(closedListing)), 'closing native listing envelope changed')
  for (const { selected } of openedRoles) {
    const found = closedListing.rows.find(item => item.row.id === selected.row.id)
    need(found && same(found.row, selected.row), 'closing selected listing membership/fields changed')
  }
  let inventoryDrift = null
  if (closedListing.snapshot !== opened.snapshot) {
    const openingIDs = opened.rows.map(item => item.row.id), closingIDs = closedListing.rows.map(item => item.row.id)
    inventoryDrift = {
      addedIDs: closingIDs.filter(id => !openingIDs.includes(id)), removedIDs: openingIDs.filter(id => !closingIDs.includes(id)),
      changedIDs: opened.rows.filter(item => {
        const closed = closedListing.rows.find(value => value.row.id === item.row.id)
        return closed && !same(item.row, closed.row)
      }).map(item => item.row.id), orderChanged: !same(openingIDs, closingIDs), selectedRolesUnchanged: true,
      sourceScopeComplete: false, lifecycleCleanupAllowed: false,
    }
    unresolved('native-eightfold-pcsx-unselected-inventory-drift-positive-partial-scope-cleanup-forbidden')
  }
  const closedBoard = declaredEightfoldPcsxRecruitment(await read(readPage, profile.boardURL, { cache: 'no-store' }), { source: profile.source })
  need(same(closedBoard, descriptor), 'closing native board/carrier declaration changed')
  need(remaining() > 0 && permit(profile.officialURL) !== false, 'closing corporate handoff budget/permit unavailable')
  const closedOfficial = typeof recheckOfficialBinding === 'function' ? await recheckOfficialBinding(officialBinding)
    : await readPage(profile.officialURL, { cache: 'no-store' })
  need(handoff(closedOfficial) === openedHandoff, 'closing current corporate handoff changed')
  await renderer(descriptor.entryURL, profile.entrySHA256, { cache: 'no-store' })
  await renderer(descriptor.roleRendererURL, profile.roleRendererSHA256, { cache: 'no-store' })
  for (const native of staged) {
    Object.assign(native.record.nativeListingEvidence, {
      originalOpeningRawJSON: rawJson.get(opened.envelope), originalClosingRawJSON: rawJson.get(closedListing.envelope),
      unselectedInventoryDrift: structuredClone(inventoryDrift),
    })
    native.record.originalNativeClosingListingRow = structuredClone(closedListing.rows.find(item => String(item.row.id) === native.id).row)
    Object.assign(native.record.nativeClosingContext, { selectedListingRechecked: true, currentPublisherHandoffRechecked: true,
      nativeBoardRechecked: true, renderersRechecked: true })
    addJob(native)
  }
}
