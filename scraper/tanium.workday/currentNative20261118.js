import { corporateScriptNodes, requireCorporateFeed, runCurrentCorporateFeeds } from '../../scraper-support/utils/currentCorporateFeed20261118.js'

const companyCareerPage = 'https://www.tanium.com/careers?gh_src=qprker8f1'
export const discoverTaniumFeeds = corporate => {
  const records = new Map()
  const collect = value => {
    if (!value || typeof value !== 'object') return
    if (Array.isArray(value)) return value.forEach(collect)
    if (Number.isSafeInteger(value.id) && typeof value.title === 'string' && typeof value.location === 'string'
      && typeof value.absoluteUrl === 'string') {
      const url = new URL(value.absoluteUrl)
      requireCorporateFeed(url.origin === 'https://job-boards.greenhouse.io'
        && url.pathname === `/tanium/jobs/${value.id}` && !url.search && !url.hash,
      'Tanium current Flight job account or identity changed')
      const prior = records.get(String(value.id))
      requireCorporateFeed(!prior || JSON.stringify(prior) === JSON.stringify(value), 'Tanium current Flight role identity conflict')
      records.set(String(value.id), value)
    }
    for (const item of Object.values(value)) collect(item)
  }
  for (const node of corporateScriptNodes(corporate.html)) {
    if (node.type !== 'CallExpression' || node.callee.type !== 'MemberExpression' || node.callee.computed
      || node.callee.property.name !== 'push' || node.callee.object.type !== 'MemberExpression'
      || node.callee.object.computed || node.callee.object.object.name !== 'self' || node.callee.object.property.name !== '__next_f') continue
    const argument = node.arguments[0]
    if (argument?.type !== 'ArrayExpression' || argument.elements[0]?.value !== 1
      || typeof argument.elements[1]?.value !== 'string') continue
    const chunk = argument.elements[1].value
    if (!chunk.includes('CareersJobBoardView')) continue
    for (const line of chunk.split('\n')) {
      const entry = line.match(/^[a-f\d]+:(\[.*)$/)
      if (entry) { try { collect(JSON.parse(entry[1])) } catch (error) {
        if (!/JSON/.test(error.message)) throw error
      } }
    }
  }
  requireCorporateFeed(records.size > 0, 'Tanium active Flight job records unavailable')
  // The token comes from currently published job URLs, rather than the legacy
  // directory suffix (which still says workday).
  const token = new URL([...records.values()][0].absoluteUrl).pathname.split('/')[1]
  return [{ kind: 'greenhouse', token, inventoryURL: `https://boards-api.greenhouse.io/v1/boards/${token}/jobs?content=true`,
    binding: { carrier: 'active-Next-Flight-CareersJobBoardView-current-job-URLs',
      matchedLinks: [...records.values()].map(row => row.absoluteUrl), currentPublisherRecords: [...records.values()] } }]
}

export const runCurrentTanium = options => runCurrentCorporateFeeds({ source: 'tanium', companyName: 'Tanium',
  companyDomain: 'tanium.com', companyCareerPage, discover: discoverTaniumFeeds }, options)
