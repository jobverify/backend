import { corporateScriptNodes, requireCorporateFeed, runCurrentCorporateFeeds } from '../../scraper-support/utils/currentCorporateFeed20261118.js'

const companyCareerPage = 'https://www.mavenclinic.com/careers'
const property = (object, name) => object?.type === 'ObjectExpression'
  ? object.properties.find(item => item.type === 'Property' && !item.computed && (item.key.name || item.key.value) === name)?.value : null
export const discoverMavenClinicFeeds = corporate => {
  const nodes = corporateScriptNodes(corporate.html)
  const declarations = nodes.filter(node => node.type === 'VariableDeclarator' && node.id.name === 'CONFIG')
    .map(node => property(node.init, 'boardSlug')).filter(node => node?.type === 'Literal' && typeof node.value === 'string')
  const apiBase = nodes.filter(node => node.type === 'VariableDeclarator' && node.id.name === 'apiBase'
    && node.init?.type === 'TemplateLiteral' && node.init.quasis[0].value.cooked === 'https://boards-api.greenhouse.io/v1/boards/'
    && node.init.quasis[1]?.value.cooked === '' && node.init.expressions.length === 1
    && node.init.expressions[0].type === 'MemberExpression' && !node.init.expressions[0].computed
    && node.init.expressions[0].object.name === 'CONFIG' && node.init.expressions[0].property.name === 'boardSlug')
  const fetches = nodes.filter(node => node.type === 'CallExpression' && node.callee.name === 'fetch'
    && node.arguments[0]?.type === 'TemplateLiteral' && node.arguments[0].expressions.length === 1
    && node.arguments[0].expressions[0].name === 'apiBase' && node.arguments[0].quasis[0].value.cooked === ''
    && node.arguments[0].quasis[1]?.value.cooked === '/jobs')
  requireCorporateFeed(declarations.length === 1 && apiBase.length === 1 && fetches.length === 1
    && /^[a-zA-Z0-9_-]+$/.test(declarations[0].value), 'Maven Clinic current renderer board binding unavailable')
  const token = declarations[0].value, declaredEndpoint = `https://boards-api.greenhouse.io/v1/boards/${token}/jobs`
  return [{ kind: 'greenhouse', token, inventoryURL: declaredEndpoint + '?content=true',
    binding: { declaredEndpoint, carrier: 'active-page-ready-CONFIG.boardSlug-apiBase-fetch' } }]
}

export const runCurrentMavenClinic = options => runCurrentCorporateFeeds({ source: 'mavenclinic', companyName: 'Maven Clinic',
  companyDomain: 'mavenclinic.com', companyCareerPage, discover: discoverMavenClinicFeeds }, options)
