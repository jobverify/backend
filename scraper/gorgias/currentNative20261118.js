import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { corporateScriptNodes, requireCorporateFeed, runCurrentCorporateFeeds } from '../../scraper-support/utils/currentCorporateFeed20261118.js'

const companyCareerPage = 'https://www.gorgias.com/careers'
export const discoverGorgiasFeeds = async (corporate, reader) => {
  const document = readNativeDocument(corporate.html)
  const scripts = document.nodes(node => node.tag === 'script' && typeof node.attrs.src === 'string'
    && /^https:\/\/cdn\.jsdelivr\.net\/gh\/gorgias\/gorgias-webflow@[^/]+\/src\/js\/careers\/job-list(?:\.min)?\.js$/.test(node.attrs.src)
    && (!node.attrs.type || /^(?:text|application)\/javascript$/.test(node.attrs.type)))
  requireCorporateFeed(scripts.length === 1 && document.nodes(node => node.attrs.id === 'city-list').length === 1,
    'Gorgias active company-owned job renderer declaration unavailable')
  const renderer = await reader.readPage(scripts[0].attrs.src)
  // The renderer is parsed as code, never evaluated or concatenated into HTML.
  const nodes = corporateScriptNodes('<script>' + renderer.html.replace(/<\/script/gi, '<\\/script') + '</script>', { publisherHTML: corporate.html })
  const declarations = nodes.filter(node => node.type === 'VariableDeclarator' && node.id.name === 'JOB_BOARD_NAME'
    && node.init?.type === 'Literal' && node.init.value === 'Gorgias')
  const endpoints = nodes.filter(node => node.type === 'VariableDeclarator' && node.id.name === 'API_URL'
    && node.init?.type === 'TemplateLiteral' && node.init.expressions.length === 1
    && node.init.quasis[0]?.value.cooked === 'https://api.ashbyhq.com/posting-api/job-board/'
    && node.init.quasis[1]?.value.cooked === '?includeCompensation=false'
    && node.init.expressions[0].type === 'CallExpression' && node.init.expressions[0].callee.name === 'encodeURIComponent'
    && node.init.expressions[0].arguments.length === 1 && node.init.expressions[0].arguments[0].value === 'Gorgias')
  const fetches = nodes.filter(node => node.type === 'CallExpression' && node.callee.name === 'fetch'
    && node.arguments[0]?.name === 'API_URL')
  requireCorporateFeed(declarations.length === 1 && endpoints.length === 1 && fetches.length === 1,
    'Gorgias current renderer API account unavailable')
  const declaredToken = declarations[0].init.value
  const inventoryURL = 'https://api.ashbyhq.com/posting-api/job-board/' + declaredToken + '?includeCompensation=false'
  const hosted = await reader.readPage('https://jobs.ashbyhq.com/' + declaredToken)
  const board = readNativeDocument(hosted.html)
  const canonicals = board.nodes(node => node.tag === 'meta' && node.attrs.property === 'og:url')
  requireCorporateFeed(canonicals.length === 1, 'Gorgias current hosted board canonical unavailable')
  const canonical = new URL(canonicals[0].attrs.content), token = canonical.pathname.slice(1)
  requireCorporateFeed(canonical.origin === 'https://jobs.ashbyhq.com' && token.toLowerCase() === declaredToken.toLowerCase()
    && /^[a-zA-Z0-9_-]+$/.test(token) && !canonical.search && !canonical.hash,
  'Gorgias current hosted board canonical account mismatch')
  return [{ kind: 'ashby', token, inventoryURL, binding: { carrier: 'active-external-company-owned-renderer-fetch',
    rendererURL: renderer.url, rendererSHA256: renderer.bodySHA256, declaredEndpoint: inventoryURL,
    nativeBoardCanonicalEvidence: { handoffURL: hosted.url, canonicalBoardURL: canonical.href, bodySHA256: hosted.bodySHA256 } } }]
}

export const runCurrentGorgias = options => runCurrentCorporateFeeds({ source: 'gorgias', companyName: 'Gorgias',
  companyDomain: 'gorgias.com', companyCareerPage, discover: discoverGorgiasFeeds, reconcileNativeScope: true }, options)
