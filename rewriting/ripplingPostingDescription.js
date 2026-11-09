import { extractActiveDescription } from '../scraper-support/utils/activeNativeHtml.js'

const identity = value => typeof value === 'string'
  ? value.replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim().toLowerCase() : ''

// Rippling's public role page renders its original employer HTML from Next data,
// without necessarily publishing a separate JobPosting schema. Bind that data
// to the exact native board, role, employer and India location before using it.
export function ripplingPostingDescription(job, document, responseUrl, {
  employerAliases = [], normalizeTitle = value => value,
} = {}) {
  try {
    const url = new URL(responseUrl)
    const route = /^\/([^/]+)\/jobs\/([^/]+)\/?$/.exec(url.pathname)
    if (url.protocol !== 'https:' || url.host !== 'ats.rippling.com' || url.username || url.password || !route) return null
    const [, boardSlug, roleId] = route
    if (String(job.jobId ?? job.requisitionId ?? '') !== roleId || !['india', 'in'].includes(identity(job.country))) return null

    const scripts = document.nodes(node => node.tag === 'script' && !node.attrs.src
      && node.attrs.id === '__NEXT_DATA__' && identity(node.attrs.type) === 'application/json')
    if (scripts.length !== 1) return null
    const data = JSON.parse(scripts[0].raw)
    const api = data?.props?.pageProps?.apiData
    const post = api?.jobPost
    if (!post || data.query?.jobBoardSlug !== boardSlug || data.query?.jobId !== roleId
      || api.jobBoard?.slug !== boardSlug || post.board?.slug !== boardSlug || post.uuid !== roleId) return null

    const employers = [job.company, ...employerAliases].map(identity).filter(Boolean)
    if (![post.companyName, post.board.companyName, api.jobBoard.companyName]
      .every(name => employers.includes(identity(name)))
      || !identity(post.name) || identity(normalizeTitle(post.name)) !== identity(normalizeTitle(job.title))) return null
    const nativeUrl = new URL(post.url)
    if (nativeUrl.origin !== url.origin || nativeUrl.username || nativeUrl.password
      || nativeUrl.pathname.replace(/\/$/, '') !== url.pathname.replace(/\/$/, '')
      || nativeUrl.search !== url.search || nativeUrl.hash !== url.hash) return null

    const location = identity(job.location)
    if (!/\bindia\b/.test(location) || ![api.workLocations, post.workLocations].every(locations => (
      Array.isArray(locations) && locations.length > 0 && locations.every(value => Boolean(identity(value)))
      && locations.some(value => identity(value) === location)
    ))) return null

    const role = post.description?.role
    const company = post.description?.company
    if (typeof role !== 'string' || !extractActiveDescription(role)
      || (company != null && typeof company !== 'string')) return null
    const description = [company, role].filter(value => typeof value === 'string' && value.trim()).join('\n')
    return {
      description,
      evidence: { method: 'exact_role_rippling_next_data', url: responseUrl, title: post.name,
        employer: post.companyName, jobId: roleId, board: boardSlug },
    }
  } catch {
    return null
  }
}
