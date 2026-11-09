import { parse } from 'acorn'
import { nativeCountryName } from '../shared/nativeJobPosting.js'

// Some native Phenom country fields and their published country facets use
// ISO alpha-3 IND. This applies only to country fields, never location text.
const phenomCountry = value => nativeCountryName(value)
  || (typeof value === 'string' && /^IND$/i.test(value.trim()) ? 'India' : null)

const need = (value, message) => { if (!value) throw Error('Recruitment page data: ' + message) }
const binding = (node, name) => node?.type === 'Identifier' && node.name === name
  || node?.type === 'MemberExpression' && !node.computed && node.object?.name === 'window' && node.property?.name === name
const literal = (node, depth = 0) => {
  need(node && depth < 40, 'literal data nesting limit')
  if (node.type === 'Literal' && !node.regex && (node.value === null || ['string', 'number', 'boolean'].includes(typeof node.value))) return node.value
  if (node.type === 'UnaryExpression' && node.operator === '-' && node.argument?.type === 'Literal' && typeof node.argument.value === 'number') return -node.argument.value
  if (node.type === 'ArrayExpression') { need(node.elements.length <= 10000, 'literal array limit'); return node.elements.map(value => literal(value, depth + 1)) }
  need(node.type === 'ObjectExpression', 'non-literal data refused')
  const result = {}
  for (const property of node.properties) {
    need(property.type === 'Property' && !property.computed && !property.method && property.kind === 'init', 'non-literal object property')
    const key = property.key.name ?? property.key.value
    need(typeof key === 'string' && !['__proto__', 'prototype', 'constructor'].includes(key) && !Object.hasOwn(result, key), 'duplicate or invalid literal property')
    Object.defineProperty(result, key, { value: literal(property.value, depth + 1), enumerable: true })
  }
  return result
}

// This reads data declarations, not programs. Deferred code, quoted examples,
// hidden/template nodes and arbitrary expressions cannot grant any request.
export function literalRecruitmentPageData(document, name) {
  need(['phApp', 'workday', 'resultStyles', '_jibe', 'searchConfig', 'khConfig'].includes(name), 'unsupported configuration')
  const configurations = [], data = []
  for (const script of document.nodes(node => node.tag === 'script' && !node.attrs.src
    && /^(?:|(?:application|text)\/(?:java|ecma)script)$/i.test(node.attrs.type || ''))) {
    let program
    try { program = parse(script.raw || '', { ecmaVersion: 'latest' }) } catch { continue }
    const config = value => {
      if (value?.type === 'LogicalExpression' && value.operator === '||' && binding(value.left, name)) value = value.right
      if (['workday','resultStyles'].includes(name) && value?.type === 'ObjectExpression') {
        const seen = new Set(), fields = new Set(name === 'workday' ? ['tenant', 'siteId', 'locale', 'requestLocale']
          : ['companyId','currentLocale','defaultLocale'])
        for (const property of value.properties) {
          need(property.type === 'Property' && !property.computed && !property.method && property.kind === 'init', 'non-literal routing property')
          const key = property.key.name ?? property.key.value
          need(!seen.has(key), 'duplicate routing property'); seen.add(key)
        }
        value = { ...value, properties: value.properties.filter(property => fields.has(property.key.name ?? property.key.value)) }
      }
      configurations.push(literal(value))
    }
    const guardedStyles = name === 'resultStyles' ? program.body.filter(statement => {
      const test = statement.type === 'IfStatement' && !statement.alternate ? statement.test : null
      return test?.type === 'BinaryExpression' && test.operator === '==='
        && test.left?.type === 'UnaryExpression' && test.left.operator === 'typeof' && binding(test.left.argument,name)
        && test.right?.type === 'Literal' && test.right.value === 'undefined' && statement.consequent?.type === 'BlockStatement'
    }).flatMap(statement => statement.consequent.body) : []
    for (const statement of [...program.body,...guardedStyles]) {
      if (statement.type === 'VariableDeclaration') for (const declaration of statement.declarations) if (binding(declaration.id, name)) config(declaration.init)
      const exp = statement.type === 'ExpressionStatement' ? statement.expression : null
      if (exp?.type !== 'AssignmentExpression' || exp.operator !== '=') continue
      if (binding(exp.left, name)) config(exp.right)
      else if (exp.left.type === 'MemberExpression' && !exp.left.computed && binding(exp.left.object, name) && exp.left.property?.name === 'ddo') data.push(literal(exp.right))
    }
  }
  if (!configurations.length) return null
  // Some current public search pages repeat the same data assignment in
  // two renderer sections. Equivalent search settings add no authority;
  // different settings and native-account declarations remain ambiguous.
  const repeatedSearchSettings = name === 'searchConfig'
    && configurations.every(value => JSON.stringify(value) === JSON.stringify(configurations[0]))
  need((configurations.length === 1 || repeatedSearchSettings) && data.length <= 1, 'ambiguous page configuration')
  return { config: configurations[0], ddo: data[0] || null }
}

const phenomData = (document, pageURL) => {
  const result = literalRecruitmentPageData(document, 'phApp')
  if (!result) return null
  const { config, ddo } = result, page = new URL(pageURL)
  const safe = value => { try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && !u.port ? u : null } catch { return null } }
  const base = safe(config.baseUrl), widget = safe(config.widgetApiEndpoint)
  need(base && widget && base.origin === page.origin && config.baseDomain === page.origin && widget.origin === page.origin
    && widget.pathname === '/widgets' && config.siteType === 'external' && /^[a-z\d_-]{3,100}$/i.test(config.refNum || ''), 'Phenom account configuration changed')
  need(ddo?.siteConfig?.status === 'success' && ddo.siteConfig.data?.refNum === config.refNum, 'Phenom site account identity changed')
  return { ...result, base, page }
}

export function phenomRecruitmentLinks(document, pageURL) {
  const result = phenomData(document, pageURL)
  if (!result) return null
  const { config, ddo, base } = result
  const links = [], nativeRoles = [], roleLinks = [], route = ddo.siteConfig.data?.urlMap?.['search-results']
  if (typeof route === 'string' && /^(?:[a-z\d_-]+\/)*[a-z\d_-]+$/i.test(route)) links.push(new URL(route, base.href.replace(/\/?$/, '/')).href)
  const inventory = ddo.eagerLoadRefineSearch
  if (inventory) {
    need(inventory.status === 200 && Array.isArray(inventory.data?.jobs) && Number.isSafeInteger(inventory.totalHits)
      && inventory.totalHits >= inventory.data.jobs.length && inventory.data.jobs.length <= 1000, 'Phenom inventory envelope changed')
    const ids = new Map()
    for (const row of inventory.data.jobs) {
      need(row && typeof row.jobId === 'string' && row.jobId && typeof row.title === 'string' && row.title, 'Phenom role identity changed')
      if (ids.has(row.jobId)) need(ids.get(row.jobId) === row.title, 'Phenom role identity conflict')
      ids.set(row.jobId, row.title)
      if (!phenomPublicRole(row)) continue
      let role
      try { const url = new URL(row.applyUrl); if (url.protocol === 'https:' && !url.username && !url.password && !url.port) role = url } catch { /* No native handoff. */ }
      if (role) nativeRoles.push(role.href)
      const template = ddo.siteConfig.data?.urlMap?.job
      if (template === 'job/:jobId/:title' && (!phenomCountry(row.country) || phenomCountry(row.country) === 'India')) {
        roleLinks.push(new URL(template.replace(':jobId', encodeURIComponent(row.jobId)).replace(':title', encodeURIComponent(row.title)), base.href.replace(/\/?$/, '/')).href)
      }
    }
  }
  return { links, nativeRoles: [...new Set(nativeRoles)], roleLinks, refNum: config.refNum,
    reportedTotal: inventory?.totalHits ?? null, observedRecords: inventory?.data?.jobs.length || 0, countryProof: false }
}

export function phenomPublicRole(record) {
  if (record?.siteType !== 'external') return false
  const declarations = []
  if (record.visibilityType != null) declarations.push(record.visibilityType === 'External')
  if (record.jobVisibility != null) declarations.push(Array.isArray(record.jobVisibility) && record.jobVisibility.length > 0
    && record.jobVisibility.every(value => typeof value === 'string') && record.jobVisibility.includes('external'))
  return declarations.length > 0 && declarations.every(Boolean)
}

export function phenomRecruitmentRole(document, pageURL, {postings = [], brandEmployerBindings = []} = {}) {
  const data = phenomData(document, pageURL)
  if (!data || data.config.pageName !== 'job') return null
  const payload = data.ddo.jobDetail, job = payload?.data?.job
  need(payload?.status === 200 && payload.hits === 1 && payload.totalHits === 1 && job && typeof job.jobId === 'string'
    && job.jobId && typeof job.title === 'string' && job.title, 'Phenom native role envelope changed')
  const expected = new URL(data.base), route = data.page.pathname.slice(expected.pathname.replace(/\/?$/, '/').length).split('/')
  need(route[0] === 'job' && [job.jobId, job.jobSeqNo].filter(Boolean).includes(decodeURIComponent(route[1] || ''))
    && job.uniqueValue?.refNum === data.config.refNum && job.uniqueValue.jobId === job.jobId
    && job.uniqueValue.siteType === 'external' && phenomPublicRole(job), 'Phenom public account or role identity changed')
  const country = phenomCountry(job.country)
  need(country && (!job.standardisedCountry || phenomCountry(job.standardisedCountry) === country), 'Phenom native role country unavailable or conflicting')
  const company = [job.companyName,job.company].find(value => typeof value === 'string' && value.trim())
  let employer = company ? {name:company.trim()} : null, employerRecord = null
  // A shared group account may publish several brands under one legal employer.
  // Only an exact, reviewed brand AND employer on this full role can bind it.
  const brandBinding = company && typeof job.companyBrand === 'string' && Array.isArray(brandEmployerBindings)
    && [job.companyName,job.company].filter(value => value != null).every(value => typeof value === 'string' && value.trim() === employer.name)
    && brandEmployerBindings.find(value => value && typeof value.brand === 'string' && value.brand
      && typeof value.employer === 'string' && value.employer && typeof value.refNum === 'string' && value.refNum
      && value.brand === job.companyBrand && value.employer === employer.name && value.refNum === data.config.refNum)
  const employerBinding = brandBinding ? {method:'explicit-native-role-company-brand',field:'companyBrand',value:job.companyBrand,
    refNum:data.config.refNum,nativeEmployerField:company === job.companyName ? 'companyName' : 'company',
    nativeEmployerName:employer.name,surface:data.page.href,legalEmployer:null} : null
  if (employerBinding && job.multi_location != null) need(Array.isArray(job.multi_location) && job.multi_location.length > 0
    && job.multi_location.every(place => place && phenomCountry(place.country) === country),
  'Phenom branded role worksite countries unavailable or conflicting')
  if (!employer) {
    const ownsURL = value => {
      try {
        const url = new URL(value), base = new URL(data.base), prefix = base.pathname.replace(/\/?$/, '/')
        if (url.protocol !== 'https:' || url.origin !== base.origin || url.username || url.password || url.search || url.hash
          || !url.pathname.startsWith(prefix)) return false
        const path = url.pathname.slice(prefix.length).replace(/\/$/, '').split('/')
        return path.length === 3 && path[0] === 'job' && [job.jobId,job.jobSeqNo].filter(Boolean).includes(decodeURIComponent(path[1]))
      } catch { return false }
    }
    const own = postings.filter(posting => {
      if (String(posting.identifier?.value) !== job.jobId || posting.title !== job.title || !posting.hiringOrganization?.name?.trim()) return false
      const urls = [posting.url,posting.hiringOrganization.url].filter(value => value != null)
      const addresses = (Array.isArray(posting.jobLocation) ? posting.jobLocation : [posting.jobLocation]).map(place => place?.address)
      return urls.length > 0 && urls.every(ownsURL) && addresses.length > 0 && addresses.every(address =>
        phenomCountry(typeof address?.addressCountry === 'object' ? address.addressCountry?.name : address?.addressCountry) === country)
    })
    need(new Set(own.map(posting => posting.hiringOrganization.name.trim())).size <= 1, 'Phenom native role employer conflict')
    if (own.length) { employer = {name:own[0].hiringOrganization.name.trim()}; employerRecord = own[0] }
  }
  const heldStatuses = ['atsStatus','jobStatus','postingStatus','successFactorsStatus'].filter(field => typeof job[field] === 'string'
    && /^on hold$/i.test(job[field].trim().replace(/\s+/g,' '))).map(field => ({field,value:job[field]}))
  return { id: job.jobId, title: job.title, url: data.page.href, country, heldStatuses,
    description: typeof job.description === 'string' ? job.description : null,
    employer, employerRecord, ...(employerBinding ? {employerBinding} : {}),
    location: [job.city, job.state, country].filter(Boolean).join(', '), posted: job.postedDate || null,
    closing: job.expiryDate || null, employmentType: job.type || null, record: job }
}

// Country is selected only from this current account's published aggregation.
// The locale and search keywords never establish a role's country.
export function phenomRecruitmentSearch(document, pageURL) {
  const data = phenomData(document, pageURL)
  if (!data || data.config.pageName !== 'search-results') return null
  const {config, ddo} = data, inventory = ddo.eagerLoadRefineSearch
  const facets = inventory?.data?.aggregations?.filter(item => item?.field === 'country') || []
  if (facets.length !== 1) return null
  const labels = Object.keys(facets[0].value || {}).filter(label => phenomCountry(label) === 'India')
  if (!labels.length) return null
  need(labels.length === 1, 'ambiguous Phenom India country facet')
  const label = labels[0], count = facets[0].value[label]
  need(Number.isSafeInteger(count) && count >= 0 && inventory.status === 200, 'Phenom country aggregation changed')
  const route = ddo.siteConfig.data.urlMap?.job
  need(route === 'job/:jobId/:title', 'Phenom public role route changed')
  for (const field of ['locale', 'deviceType', 'country']) need(typeof config[field] === 'string'
    && /^[a-z\d_-]{1,64}$/i.test(config[field]), 'Phenom search configuration changed')
  const endpoint = new URL(config.widgetApiEndpoint)
  need(!endpoint.search && !endpoint.hash, 'Phenom widget endpoint changed')
  const sortField = ddo.siteConfig.data.refineSearch?.sort?.field || 'postedDate'
  need(typeof sortField === 'string' && /^[a-z][a-z\d_]{0,63}$/i.test(sortField), 'Phenom search sort changed')
  return {url:endpoint.href, refNum:config.refNum, baseURL:data.base.href, pageURL, route,
    body:{lang:config.locale,deviceType:config.deviceType,country:config.country,pageName:config.pageName,
      ddoKey:'refineSearch',jobs:true,counts:true,all_fields:['country'],size:20,global:true,keywords:'',
      sortBy:'Most recent',sort:{field:sortField,order:'desc'},selected_fields:{country:[label]}}}
}
