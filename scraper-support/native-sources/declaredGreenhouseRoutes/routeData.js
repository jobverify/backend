import { readNativeDocument } from '../../utils/activeNativeHtml.js'
import { children, content, hasClass, text } from '../cisVeeam/publishedData.js'
import { requireNative, postURI } from '../declaredGreenhouse/nativeData.js'
import { readLiteralModel } from '../literalModel.js'
import { sha256 } from '../publicIO.js'

export const primaryRouteStructure = (profile, html) => {
  const specification = profile.primaryStructure, doc = readNativeDocument(html)
  if (specification.kind === 'pathai-current-department-grid') {
    const roots = doc.nodes(node => node.attrs.id === specification.rootId)
    const grids = roots.flatMap(root => children(root, node => node.attrs.id === specification.gridId))
    const links = doc.nodes(node => node.tag === 'a' && node.attrs.href === '#' + specification.rootId)
    requireNative(roots.length === 1 && grids.length === 1 && doc.nodes(node => node.attrs.id === specification.gridId).length === 1
      && links.length > 0, 'current PathAI active department-grid declaration changed')
    return { kind: specification.kind, originalRootAttributes: { ...roots[0].attrs }, originalGridAttributes: { ...grids[0].attrs },
      originalAnchorAttributes: links.map(node => ({ ...node.attrs })) }
  }
  requireNative(specification.kind === 'lyft-current-careers-search', 'unsupported primary structure')
  const scripts = doc.nodes(node => node.tag === 'script' && !node.attrs.src && node.attrs.id === '__NEXT_DATA__' && node.attrs.type === 'application/json')
  requireNative(scripts.length === 1, 'unique current Lyft page model unavailable')
  const value = readLiteralModel(scripts[0].raw || '').value, components = value?.props?.pageProps?.brandPageData?.components
  const matches = Array.isArray(components) ? components.filter(node => node && typeof node === 'object'
    && node.searchType === 'Careers' && node.referenceId === specification.referenceId) : []
  const canonicals = doc.nodes(node => node.tag === 'link' && (node.attrs.rel || '').toLowerCase().split(/\s+/).includes('canonical'))
  const anchors = doc.nodes(node => node.tag === 'a' && node.attrs.href).filter(node => {
    try { return new URL(node.attrs.href, profile.primaryURL).href === profile.primaryURL + '#' + specification.referenceId } catch { return false }
  })
  requireNative(matches.length === 1 && canonicals.length === 1 && canonicals[0].attrs.href === profile.primaryURL && anchors.length > 0,
    'current Lyft careers-search component/canonical/handoff changed')
  return { kind: specification.kind, currentModelPath: 'props.pageProps.brandPageData.components', originalCurrentComponent: structuredClone(matches[0]),
    originalPageModelSHA256: sha256(Buffer.from(scripts[0].raw)), originalCanonical: canonicals[0].attrs.href,
    originalAnchorAttributes: anchors.map(node => ({ ...node.attrs })) }
}

export const departmentPostIndex = payload => {
  const posts = new Map()
  for (const department of Array.isArray(payload?.departments) ? payload.departments : []) {
    for (const record of Array.isArray(department?.jobs) ? department.jobs : []) {
      if (!Number.isSafeInteger(record?.id) || record.id <= 0) continue
      if (!posts.has(record.id)) posts.set(record.id, [])
      posts.get(record.id).push({ departmentId: department.id, originalRecord: record })
    }
  }
  return posts
}

export const departmentIndex = payload => {
  requireNative(Array.isArray(payload?.departments), 'current declared department collection unavailable')
  const nodes = new Map(), posts = departmentPostIndex(payload)
  for (const department of payload.departments) {
    requireNative(Number.isSafeInteger(department?.id) && department.id >= 0 && !nodes.has(department.id)
      && Array.isArray(department.jobs) && Array.isArray(department.child_ids), 'malformed/duplicate department collection identity')
    nodes.set(department.id, department)
    for (const record of department.jobs) {
      requireNative(Number.isSafeInteger(record?.id) && record.id > 0, 'malformed department posting identity')
    }
  }
  for (const node of nodes.values()) {
    requireNative(node.parent_id == null || nodes.has(node.parent_id), 'department parent missing')
    requireNative(node.child_ids.every(id => nodes.has(id) && nodes.get(id).parent_id === node.id), 'department child/parent conflict')
    const seen = new Set();let cursor = node
    while (cursor) { requireNative(!seen.has(cursor.id), 'department hierarchy cycle');seen.add(cursor.id);cursor = nodes.get(cursor.parent_id) }
  }
  return { nodes, posts }
}
const original = page => page?.usable && page.transportQualified && page.bodyBase64 && typeof page.originalText === 'string'
const activeScript = node => node.tag === 'script' && node.attrs.src && !Object.hasOwn(node.attrs, 'nomodule')
  && ['', 'module', 'text/javascript', 'application/javascript'].includes((node.attrs.type || '').trim().toLowerCase())
const assetSummary = (page, requestedURL) => ({ url: page?.url ?? requestedURL, status: page?.status ?? null, bodySHA256: page?.bodySHA256 ?? null })
export const routeContext = (profile, result, load, allowedURLs) => {
  const assets = new Map()
  result.originalNativeRouteAssets = []
  return { load, allowedURLs, async asset(url) {
    if (!assets.has(url)) {
      allowedURLs.add(url)
      assets.set(url, (async () => {
        const page = await load(url)
        result.originalNativeRouteAssets.push(assetSummary(page, url))
        return page
      })())
    }
    return assets.get(url)
  } }
}
const hasJobPosting = value => Array.isArray(value) ? value.some(hasJobPosting) : value && typeof value === 'object'
  && ([value['@type']].flat().includes('JobPosting') || Array.isArray(value['@graph']) && value['@graph'].some(hasJobPosting))
export const observeOwnRoute = async (profile, id, native, context, job) => {
  const specification = profile.ownRoute, seen = new Set(), chain = []
  job.sourceNativeRoleRouteQualified = false
  job.sourceNativeRoleRouteChain = chain
  job.sourceNativeHostedPageActivationVerified = false
  let url = native.absolute_url, page
  for (let hop = 0; hop < 6; hop++) {
    requireNative(postURI(url, id, profile) && !seen.has(url), 'unsupported/cyclic published own-role route')
    seen.add(url);context.allowedURLs.add(url)
    page = await context.load(url)
    chain.push({ url, status: page?.status ?? null, bodySHA256: page?.bodySHA256 ?? null })
    requireNative(page?.transportQualified && typeof page.bodyBase64 === 'string' && typeof page.originalText === 'string', 'own-role route has no original HTTP transport')
    if ([301, 302, 303, 307, 308].includes(page.status)) {
      requireNative(typeof page.headers.location === 'string', 'own-role redirect has no original Location')
      url = new URL(page.headers.location, url).href
      requireNative(postURI(url, id, profile), 'own-role redirect changed company/board or native ID')
      continue
    }
    requireNative(original(page), 'published own-role page unavailable')
    break
  }
  requireNative(original(page) && page.status === 200, 'published own-role redirect chain incomplete')
  job.sourceNativeOwnHostedPageReadThisRun = true
  job.sourceResolvedNativePostURI = url
  const doc = readNativeDocument(page.originalText), heads = doc.nodes(node => node.tag === 'head')
  const titles = heads.flatMap(head => children(head, node => node.tag === 'title').map(content))
  job.sourceNativeRolePageHeadTitles = titles
  const scripts = doc.nodes(activeScript).map(node => ({ ...node.attrs, url: new URL(node.attrs.src, url).href }))
  job.sourceNativeRolePageScriptDeclarations = structuredClone(scripts)
  const structured = doc.nodes(node => node.tag === 'script' && node.attrs.type === 'application/ld+json')
    .map(node => readLiteralModel(node.raw || '').value)
  job.sourceNativeRolePageStructuredModels = structuredClone(structured)
  requireNative(!structured.some(hasJobPosting), 'unsupported additional own-page JobPosting model; originals retained')
  if (specification.kind === 'pathai-declared-native-template') {
    requireNative(titles.length === 1 && titles[0] === specification.expectedHeadTitle, 'current PathAI own-template title changed')
    requireNative(scripts.some(script => script.url === specification.scriptURL), 'current PathAI own renderer declaration changed')
    const asset = await context.asset(specification.scriptURL)
    job.sourceNativeRoleAssetObservations = [assetSummary(asset, specification.scriptURL)]
    requireNative(original(asset) && asset.bodySHA256 === specification.scriptSHA256, 'current PathAI own renderer bytes changed/unavailable')
    const regions = doc.nodes(node => hasClass(node, 'about-right'))
    requireNative(regions.length === 1, 'current PathAI role rendering target unavailable')
    const ownText = content(regions[0])
    job.sourceNativeRolePageCriteriaText = ownText || null
    if (ownText) {
      job.jobDescription += '\n\nPublished own-page criteria: ' + ownText
      job.sourceDescription = job.jobDescription
    }
    job.sourceNativeRoleCriteriaSurface = 'native-own-JSON-plus-any-literal-own-template-text;browser-rendering-and-activation-unverified'
  } else {
    requireNative(specification.kind === 'careerpuck-published-role-shell', 'unsupported own-route profile')
    requireNative(titles.length === 1 && titles[0] === text(specification.titlePrefix + native.title), 'current Careerpuck own-role publisher/title changed')
    const assets = [...new Set(scripts.filter(script => {
      const target = new URL(script.url)
      return target.protocol === 'https:' && !target.username && !target.password && !target.port && !target.search && !target.hash
        && target.hostname === specification.assetHost && /^\/[a-f0-9]{7,64}\/assets\/index-[\w-]+\.js$/.test(target.pathname)
    }).map(script => script.url))]
    requireNative(assets.length > 0, 'current Careerpuck role-shell module declaration unavailable')
    const observations = []
    for (const asset of assets) observations.push(assetSummary(await context.asset(asset), asset))
    job.sourceNativeRoleAssetObservations = observations
    job.sourceNativeRoleBootstrapAvailable = observations.every(row => row.status === 200)
    job.sourceNativeRoleCriteriaSurface = 'native-own-JSON;published-Careerpuck-shell-has-no-verified-server-rendered-criteria'
    // The employer-published URI, original native own model and current shell
    // title bind this discovery. Bootstrap availability is diagnostic; it does
    // not establish browser execution, recruitment or application activation.
  }
  job.sourceNativeRoleRouteQualified = true
}
