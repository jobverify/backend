import { createHash } from 'node:crypto'
import { readNativeDocument, extractActiveDescription } from './activeNativeHtml.js'
import { normalizeNativeAttributeBoundaries } from './nativeHtmlAttributes.js'
import { nativeCountryName } from '../shared/nativeJobPosting.js'

const profile = Object.freeze({ source: 'branch', publisherURL: 'https://www.branch.io/careers/',
  boardURL: 'https://ats.rippling.com/branch/jobs', employerName: 'Branch Metrics, Inc.',
  endpointURL: 'https://ats.rippling.com/api/v2/board/branch/jobs?groupJobsByLocation=false&page=0&pageSize=1000',
  rendererPath: '/wp-content/plugins/branch-rippling-careers/assets/js/view.js',
  // The reviewed renderer reads this active widget's dataset.endpoint, fetches
  // with credentials omitted, and renders each item's native name/url/location.
  rendererSHA256: 'c682b0fc1afc2103d6affbad8014a2afa23f0c6f53f3ba313803e330ab761fce',
})
const requireValue = (value, message) => { if (!value) throw new Error('Rippling ' + message) }
const sha = value => createHash('sha256').update(value).digest('hex')
const text = value => typeof value === 'string' ? value.trim() : ''
const key = value => text(value).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
const criteriaText = value => text(value).normalize('NFKC').replace(/\s+/gu, ' ')
const stable = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(name => [name, item[name]])) : item)
const classes = node => new Set((node.attrs.class || '').split(/\s+/))
const names = values => [...new Set(values)].sort()
const uuid = value => typeof value === 'string' && /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(value)
const reviewedRendererURL = value => {
  try {
    const url = new URL(value, profile.publisherURL)
    return url.origin === new URL(profile.publisherURL).origin && url.pathname === profile.rendererPath
      && !url.username && !url.password && !url.hash && !url.port
      && [...url.searchParams.keys()].every(name => name === 'ver') && url.searchParams.getAll('ver').length <= 1 ? url.href : null
  } catch { return null }
}

// A data attribute by itself never authorizes an arbitrary API. This reader is
// deliberately limited to the currently reviewed first-party Branch widget.
export const declaredRipplingRecruitment = (document, pageURL, config = {}) => {
  if (config.source !== profile.source || pageURL !== profile.publisherURL
    || document.nodes(node => node.tag === 'base').length) return null
  const widgets = document.nodes(node => node.tag === 'section' && classes(node).has('branch-rippling-careers')
    && classes(node).has('wp-block-branch-rippling-careers'))
  if (widgets.length !== 1 || widgets[0].attrs['data-endpoint'] !== profile.endpointURL
    || document.nodes(node => classes(node).has('branch-rippling-careers__job-list'), widgets[0]).length !== 1) return null
  const renderers = document.nodes(node => node.tag === 'script' && node.attrs.src
    && !Object.hasOwn(node.attrs, 'nomodule') && /^(?:|module|(?:text|application)\/javascript)$/i.test(node.attrs.type || ''))
    .map(node => reviewedRendererURL(node.attrs.src)).filter(Boolean)
  if (renderers.length !== 1) return null
  return { source: profile.source, publisherURL: pageURL, endpointURL: profile.endpointURL,
    boardURL: profile.boardURL, token: 'branch', employerName: profile.employerName, rendererURL: renderers[0] }
}

const listing = payload => {
  requireValue(payload && Array.isArray(payload.items) && payload.page === 0 && payload.pageSize === 1000
    && Number.isSafeInteger(payload.totalItems) && payload.totalItems >= 0 && payload.totalItems <= 1000
    && payload.items.length === payload.totalItems && (payload.totalPages === 1 || payload.totalItems === 0 && payload.totalPages === 0),
  'native listing is incomplete or outside its reviewed bounds')
  const groups = new Map(), originalRows = new Set()
  for (const row of payload.items) {
    requireValue(row && uuid(row.id) && text(row.name) && row.url === profile.boardURL + '/' + row.id
      && row.language === 'en-US' && text(row.department?.name) && Array.isArray(row.locations) && row.locations.length,
    'native listing identity is unavailable')
    const rowSnapshot = stable(row)
    requireValue(!originalRows.has(rowSnapshot), 'native listing repeated a location row')
    originalRows.add(rowSnapshot)
    for (const location of row.locations) {
      requireValue(location && text(location.name), 'native listing location identity is unavailable')
      const label = nativeCountryName(location.country), code = nativeCountryName(location.countryCode)
      requireValue(!label || !code || label === code, 'native location country labels conflict')
    }
    const base = { id: row.id, name: row.name, url: row.url, language: row.language, department: row.department }
    const existing = groups.get(row.id)
    requireValue(!existing || stable(existing.base) === stable(base), 'conflicting duplicate native role identity')
    if (!existing) groups.set(row.id, { base, nativeListingRows: [], locations: [] })
    const group = groups.get(row.id)
    group.nativeListingRows.push(structuredClone(row))
    group.locations.push(...structuredClone(row.locations))
  }
  return { groups: [...groups.values()], snapshot: stable({ page: payload.page, pageSize: payload.pageSize,
    totalItems: payload.totalItems, totalPages: payload.totalPages, items: [...originalRows].sort() }) }
}

const publicDetail = (page, group, descriptor) => {
  requireValue(page?.status === 200 && page.url === group.base.url && typeof page.html === 'string', 'native detail response identity changed')
  const document = readNativeDocument(normalizeNativeAttributeBoundaries(page.html))
  const scripts = document.nodes(node => node.tag === 'script' && node.attrs.id === '__NEXT_DATA__'
    && node.attrs.type === 'application/json' && !node.attrs.src)
  requireValue(scripts.length === 1, 'native detail identity model is unavailable')
  let model
  try { model = JSON.parse(scripts[0].raw) } catch { throw new Error('Rippling native detail identity model is invalid') }
  const api = model.props?.pageProps?.apiData, post = api?.jobPost, board = api?.jobBoard
  requireValue(model.page === '/[jobBoardSlug]/jobs/[jobId]' && model.query?.jobBoardSlug === descriptor.token
    && model.query?.jobId === group.base.id && post?.uuid === group.base.id
    && post.name === group.base.name && post.url === group.base.url, 'listing/detail identity changed')
  requireValue(board?.companyName === descriptor.employerName && post.companyName === descriptor.employerName
    && post.board?.companyName === descriptor.employerName, 'native legal employer changed')
  requireValue(board.boardType === 'RIPPLING' && board.slug === descriptor.token && board.boardURL === descriptor.boardURL
    && board.isTest === false && stable(board) === stable(post.board), 'native public board context changed')
  requireValue(post.unlistedFromSearch === false && post.activeJobApplication && typeof post.activeJobApplication === 'object',
    'native role is unlisted or its public application is unavailable')
  const locationNames = names(group.locations.map(location => location.name))
  requireValue(Array.isArray(post.workLocations) && post.workLocations.every(name => text(name))
    && stable(names(post.workLocations)) === stable(locationNames)
    && stable(names(api.workLocations || [])) === stable(locationNames), 'listing/detail native locations changed')
  requireValue(stable(api.department) === stable(post.department)
    && post.department?.base_department === group.base.department.name
    && Array.isArray(post.department.department_tree) && post.department.department_tree[0] === group.base.department.name
    && post.department.department_tree.at(-1) === post.department.name,
    'listing/detail department identity changed')
  const companyDescription = post.description?.company, roleDescription = post.description?.role
  const companyText = extractActiveDescription(companyDescription), roleText = extractActiveDescription(roleDescription)
  requireValue(companyText && roleText && roleText.length >= 100, 'native full role description is unavailable')
  const headings = document.nodes(node => node.tag === 'h1').map(node => document.text(node))
  const visible = criteriaText(document.nodes(node => node.tag === 'root').map(node => document.text(node)).join(' '))
  requireValue(headings.some(title => key(title) === key(post.name))
    && visible.includes(criteriaText(companyText)) && visible.includes(criteriaText(roleText)), 'full native criteria do not match visible role content')
  requireValue(post.createdOn == null || typeof post.createdOn === 'string' && Number.isFinite(Date.parse(post.createdOn)),
    'native creation date is invalid')
  return { apiData: api, description: companyDescription + '\n' + roleDescription,
    identity: { page: model.page, query: model.query }, snapshot: stable(api) }
}

export const readRipplingRecruitment = async (descriptor, {
  readPage, readRenderer, readJson, permit, matchingEmployer, addJob, inventoryRead, recordRead, unresolved,
  canRead = () => true, maxDetails = 20,
}) => {
  requireValue(descriptor?.source === profile.source && descriptor.publisherURL === profile.publisherURL
    && descriptor.endpointURL === profile.endpointURL && descriptor.boardURL === profile.boardURL
    && descriptor.token === 'branch' && descriptor.employerName === profile.employerName, 'unreviewed publisher declaration')
  requireValue(reviewedRendererURL(descriptor.rendererURL) === descriptor.rendererURL, 'unreviewed renderer declaration')
  requireValue(Number.isSafeInteger(maxDetails) && maxDetails > 0 && maxDetails <= 80, 'invalid detail budget')
  requireValue(matchingEmployer(profile.employerName), 'native legal employer lacks its reviewed source binding')
  const read = async (callback, url, init = {}) => {
    requireValue(canRead(), 'source request budget reached')
    permit(url)
    return callback(url, init)
  }
  const renderer = async (init = {}) => {
    const script = await read(readRenderer, descriptor.rendererURL, init)
    requireValue(script?.status === 200 && script.url === descriptor.rendererURL && typeof script.html === 'string'
      && sha(script.html) === profile.rendererSHA256, 'current renderer does not match the reviewed active data flow')
  }
  await renderer()
  const payload = await read(readJson, descriptor.endpointURL), opened = listing(payload)
  inventoryRead({ kind: 'rippling', surface: descriptor.endpointURL, reportedTotal: payload.totalItems,
    nativeRowUnit: 'location-row', distinctJobCount: opened.groups.length,
    sourceScopeComplete: false, listingComplete: false, lifecycleCleanupAllowed: false })
  for (const group of opened.groups) {
    recordRead({ ...group.base, locations: structuredClone(group.locations), nativeListingRows: structuredClone(group.nativeListingRows) }, descriptor)
    if (group.locations.some(location => !nativeCountryName(location.country) || !nativeCountryName(location.countryCode))) {
      unresolved('native-location-scope-unresolved')
    }
  }
  const candidates = opened.groups.filter(group => group.locations.some(location => nativeCountryName(location.country) === 'India'
    && nativeCountryName(location.countryCode) === 'India'))
  if (candidates.length > maxDetails) unresolved('native-detail-budget-reached')
  const staged = []
  for (const group of candidates.slice(0, maxDetails)) {
    const detail = publicDetail(await read(readPage, group.base.url), group, descriptor)
    const closing = publicDetail(await read(readPage, group.base.url, { cache: 'no-store' }), group, descriptor)
    requireValue(closing.snapshot === detail.snapshot, 'closing native role context changed')
    const india = group.locations.find(location => nativeCountryName(location.country) === 'India'
      && nativeCountryName(location.countryCode) === 'India')
    staged.push({ id: group.base.id, title: group.base.name, url: group.base.url,
      description: detail.description, employer: { name: descriptor.employerName }, location: india.name,
      employerBinding: { method: 'current-native-rippling-role-legal-employer', field: 'apiData.jobPost.companyName',
        legalEmployer: descriptor.employerName, surface: group.base.url },
      // Native createdOn is retained below; it does not establish datePosted.
      posted: null, closing: null, employmentType: detail.apiData.jobPost.employmentType?.id || null,
      record: { apiData: structuredClone(detail.apiData), nextDataIdentity: structuredClone(detail.identity),
        nativeListingRows: structuredClone(group.nativeListingRows),
        nativeCreatedOn: detail.apiData.jobPost.createdOn ?? null,
        nativeListingEvidence: { surface: descriptor.endpointURL, reportedTotal: payload.totalItems,
          nativeRowUnit: 'location-row', companyScopeComplete: false },
        nativeClosingContext: { fullRoleRechecked: true, nativeRoleSHA256: sha(detail.snapshot), companyScopeComplete: false },
      } })
  }
  const closingListing = listing(await read(readJson, descriptor.endpointURL, { cache: 'no-store' }))
  requireValue(closingListing.snapshot === opened.snapshot, 'closing native listing changed')
  const closingPublisher = await read(readPage, descriptor.publisherURL, { cache: 'no-store' })
  requireValue(closingPublisher?.status === 200 && closingPublisher.url === descriptor.publisherURL
    && typeof closingPublisher.html === 'string', 'closing publisher response identity changed')
  const closingDeclaration = declaredRipplingRecruitment(readNativeDocument(normalizeNativeAttributeBoundaries(closingPublisher.html)),
    closingPublisher.url, { source: descriptor.source })
  requireValue(stable(closingDeclaration) === stable(descriptor), 'closing current publisher handoff changed')
  await renderer({ cache: 'no-store' })
  for (const native of staged) {
    native.record.nativeClosingContext.selectedListingRechecked = true
    native.record.nativeClosingContext.currentPublisherHandoffRechecked = true
    addJob(native)
  }
}
