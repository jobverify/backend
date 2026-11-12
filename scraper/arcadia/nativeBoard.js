import { requireNative } from '../../scraper-support/shared/nativeJobPosting.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { verifyNativeBoardDeclarations } from './nativeBoardDeclarations.js'

export const BOARD_URL = 'https://ats.rippling.com/arcadiacareers/jobs'
export const NATIVE_BOARD_URL = BOARD_URL + '?pageSize=1000'
export const NATIVE_ASSETS = new Map([
  ['https://ats.us1.rippling.com/_next/static/chunks/pages/%5BjobBoardSlug%5D/jobs-349eb53a50b15de1.js', 'de2ee247d2187f319c6f228db7388ddb1e22feeebe898c737bb64997a26f0051'],
  ['https://ats.us1.rippling.com/_next/static/chunks/387-80356090a770fa21.js', '0d9f90c6a41441ccf8c5b4595c628716cdb50eb185178a21f7113cbff477fc51'],
])
const norm = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().normalize('NFKC') : ''
const one = (rows, name) => { requireNative(rows.length === 1, 'Arcadia native board missing/ambiguous ' + name); return rows[0] }
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value
export const boardRowFingerprint = items => JSON.stringify(items.map(item => JSON.stringify(canonical(item))).sort())

export function parseNativeBoard(html) {
  const doc = readVisibleNativeDocument(html, { strict: true })
  requireNative(!doc.nodes(node => node.tag === 'base').length && !doc.frames().length,
    'Arcadia native board has an unreviewed base or embedded recruiting surface')
  requireNative(one(doc.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical'), 'canonical').attrs.href === BOARD_URL,
    'Arcadia native board canonical identity changed')
  const next = JSON.parse(one(doc.nodes(node => node.tag === 'script' && node.attrs.id === '__NEXT_DATA__'
    && node.attrs.type === 'application/json'), 'page data').raw)
  requireNative(next.page === '/[jobBoardSlug]/jobs' && Object.keys(next.query || {}).sort().join(',') === 'jobBoardSlug,pageSize'
    && next.query.jobBoardSlug === 'arcadiacareers' && next.query.pageSize === '1000', 'Arcadia native board route or page-size contract changed')
  const api = next.props?.pageProps?.apiData, board = api?.jobBoard
  requireNative(api?.jobBoardSlug === 'arcadiacareers' && board?.slug === 'arcadiacareers' && board.companyName === 'Arcadia'
    && board.boardType === 'RIPPLING' && board.boardURL === BOARD_URL && board.isTest === false && board.groupJobsByLocation === false,
  'Arcadia native board employer or grouping identity changed')
  const advertised = new Set(doc.nodes(node => node.tag === 'script' && node.attrs.src).map(node => node.attrs.src))
  requireNative([...NATIVE_ASSETS.keys()].every(url => advertised.has(url)), 'Arcadia native board current controller delegation changed')
  const queries = next.props?.pageProps?.dehydratedState?.queries
  requireNative(Array.isArray(queries), 'Arcadia native board query observations unavailable')
  const query = one(queries.filter(item => Array.isArray(item.queryKey) && item.queryKey[2] === 'job-posts'), 'unfiltered job query')
  const key = query.queryKey, filter = key[4]
  requireNative(key.length === 5 && key[0] === 'board' && key[1] === 'arcadiacareers' && key[3] === false
    && filter && Object.keys(filter).sort().join(',') === 'city,country,departments,page,pageSize,searchQuery,state,workplaceType'
    && ['city', 'country', 'state', 'searchQuery'].every(name => filter[name] === '') && filter.workplaceType === null
    && Array.isArray(filter.departments) && filter.departments.length === 0 && filter.page === 0 && filter.pageSize === 1000
    && query.queryHash === JSON.stringify(canonical(key)) && query.state?.status === 'success' && query.state.error === null
    && query.state.fetchFailureCount === 0 && query.state.isInvalidated === false,
  'Arcadia native board query is filtered, contradictory or unsuccessful')
  const payload = query.state.data
  requireNative(payload && Object.keys(payload).sort().join(',') === 'items,page,pageSize,totalItems,totalPages'
    && Array.isArray(payload.items) && payload.items.length <= 1000 && payload.page === 0 && payload.pageSize === 1000
    && payload.totalItems === payload.items.length && (payload.totalPages === 1 || payload.totalPages === 0 && payload.totalItems === 0),
  'Arcadia native board pagination or publisher total remains unresolved')
  const cards = doc.nodes(node => node.tag === 'div' && doc.hasClass(node, 'css-aapqz6'))
  requireNative(cards.length === payload.items.length, 'Arcadia native board visible publisher cards do not reconcile')
  const unused = new Set(payload.items), reconciledLinks = new Set()
  for (const card of cards) {
    const descendants = new Set()
    const visit = node => { descendants.add(node); node.children.filter(child => typeof child !== 'string').forEach(visit) }
    visit(card)
    const link = one(doc.nodes(node => descendants.has(node) && node.tag === 'a'
      && /^\/arcadiacareers\/jobs\/[a-f\d-]{36}$/.test(node.attrs.href || '')), 'visible role link')
    const row = [...unused].find(item => item?.url === new URL(link.attrs.href, BOARD_URL).href
      && norm(item.name) === norm(doc.text(link)) && Array.isArray(item.locations) && item.locations.length === 1
      && norm(doc.text(card)) === norm([item.name, item.department?.name, item.locations[0]?.name, 'View job'].join(' ')))
    requireNative(row, 'Arcadia native board visible title, department or workplace contradicts a published typed row')
    reconciledLinks.add(link)
    unused.delete(row)
  }
  requireNative(unused.size === 0, 'Arcadia native board published row lacks its visible role card')
  const auxiliaryLinks = new Set(['https://www.arcadia.com/careers', NATIVE_BOARD_URL,
    'https://app.rippling.com/legal/user', 'https://app.rippling.com/legal/privacy', 'https://app.rippling.com/legal/cookie-notice',
    'https://www.rippling.com/recruiting', 'mailto:careers@arcadia.com'])
  for (const link of doc.nodes(node => node.tag === 'a' && node.attrs.href)) {
    const target = new URL(link.attrs.href, BOARD_URL)
    requireNative(reconciledLinks.has(link) || auxiliaryLinks.has(target.href)
      || target.origin === 'https://ats.rippling.com' && target.pathname === '/arcadiacareers/jobs' && !target.search,
    'Arcadia native board additional public link remains unresolved')
  }
  const declarationProof = verifyNativeBoardDeclarations(html, payload.items, board.logo?.url)
  return { payload, declarationProof, rowFingerprint: boardRowFingerprint(payload.items), visiblePublisherCards: cards.length,
    observedPublisherRows: payload.items.length, observedDistinctRoles: new Set(payload.items.map(row => row.id)).size }
}
