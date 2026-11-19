import { corporateScriptNodes, requireCorporateFeed, runCurrentCorporateFeeds } from '../../scraper-support/utils/currentCorporateFeed20261118.js'

const companyCareerPage = 'https://www.lob.com/careers'
export const discoverLobFeeds = corporate => {
  const feeds = new Map()
  for (const node of corporateScriptNodes(corporate.html)) {
    if (node.type !== 'CallExpression' || node.callee.type !== 'Identifier' || node.callee.name !== 'setupFilterAndJobs') continue
    const [endpoint, filter, target] = node.arguments
    if (![endpoint, filter, target].every(arg => arg?.type === 'Literal' && typeof arg.value === 'string')) continue
    const url = new URL(endpoint.value)
    const route = url.pathname.match(/^\/v1\/boards\/([a-zA-Z0-9_-]+)\/jobs$/)
    requireCorporateFeed(url.origin === 'https://boards-api.greenhouse.io' && route
      && url.search === '?content=true' && !url.hash && !url.username && !url.password,
    'Lob current job renderer feed changed')
    feeds.set(url.href, { kind: 'greenhouse', token: route[1], inventoryURL: url.href,
      corporateRoleRoute: { origins: ['http://www.lob.com', 'https://www.lob.com'], path: '/careers/apply', idParameter: 'gh_jid' },
      binding: { declaredEndpoint: url.href, carrier: 'active-inline-setupFilterAndJobs-call',
        filterSelector: filter.value, jobsSelector: target.value } })
  }
  return [...feeds.values()]
}

export const runCurrentLob = options => runCurrentCorporateFeeds({ source: 'lob', companyName: 'Lob',
  companyDomain: 'lob.com', companyCareerPage, discover: discoverLobFeeds, reconcileNativeScope: true }, options)
