import { parse } from 'acorn'
import { readNativeDocument } from './activeNativeHtml.js'
import { normalizeNativeAttributeBoundaries } from './nativeHtmlAttributes.js'
import { nativeCountryName } from '../shared/nativeJobPosting.js'

const text = value => typeof value === 'string' ? value.trim() : ''
const uuid = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i
const need = (value, message) => { if (!value) throw Error('Keka recruitment: ' + message) }
const scripts = document => document.nodes(node => node.tag === 'script' && !node.attrs.src
  && /^(?:|module|(?:application|text)\/(?:java|ecma)script)$/i.test(node.attrs.type || ''))

// JavaScript is parsed as data. Comments and quoted examples cannot declare a
// network request, and no downloaded publisher program is executed here.
export function literalRecruitmentRequests(document) {
  const urls = []
  for (const script of scripts(document)) {
    let program
    try { program = parse(script.raw || '', { ecmaVersion: 'latest', sourceType: script.attrs.type === 'module' ? 'module' : 'script' }) } catch { continue }
    const visit = node => {
      if (!node || typeof node !== 'object') return
      if (node.type === 'CallExpression') {
        const call = node.callee, argument = node.arguments[0]
        if (call?.type === 'Identifier' && call.name === 'fetch' && argument?.type === 'Literal' && typeof argument.value === 'string') urls.push(argument.value)
        if (call?.type === 'MemberExpression' && !call.computed && ['$', 'jQuery'].includes(call.object?.name) && call.property?.name === 'ajax') {
          if (argument?.type === 'Literal' && typeof argument.value === 'string') urls.push(argument.value)
          else if (argument?.type === 'ObjectExpression' && argument.properties.every(property => property.type === 'Property' && !property.computed)) {
            const values = argument.properties.filter(property => (property.key.name || property.key.value) === 'url')
            if (values.length === 1 && values[0].value.type === 'Literal' && typeof values[0].value.value === 'string') urls.push(values[0].value.value)
          }
        }
      }
      for (const value of Object.values(node)) {
        if (Array.isArray(value)) value.forEach(visit)
        else if (value && typeof value === 'object') visit(value)
      }
    }
    visit(program)
  }
  return [...new Set(urls)]
}

const configuration = document => {
  const candidates = []
  for (const script of scripts(document)) {
    let program
    try { program = parse(script.raw || '', { ecmaVersion: 'latest' }) } catch { continue }
    for (const statement of program.body) {
      const node = statement.type === 'ExpressionStatement' ? statement.expression : null
      if (node?.type !== 'AssignmentExpression' || node.operator !== '=' || node.left?.type !== 'MemberExpression'
        || node.left.computed || node.left.object?.name !== 'window' || node.left.property?.name !== 'khConfig') continue
      need(node.right.type === 'ObjectExpression', 'non-literal portal configuration')
      const values = {}
      for (const property of node.right.properties) {
        need(property.type === 'Property' && !property.computed && !property.method && property.kind === 'init'
          && property.value.type === 'Literal', 'non-literal portal configuration field')
        const key = property.key.name ?? property.key.value
        need(!Object.hasOwn(values, key), 'duplicate portal configuration field')
        Object.defineProperty(values, key, { value: property.value.value, enumerable: true })
      }
      candidates.push(values)
    }
  }
  need(candidates.length === 1, 'missing or ambiguous portal configuration')
  return candidates[0]
}

export async function readKekaRecruitment(board, io) {
  const advertised = new URL(board.url), root = advertised.origin + '/careers/'
  io.permit(root)
  let identifier = board.identifier, portalName = 'default', rendererPage
  if (board.mode === 'iframe') {
    rendererPage = await io.readPage(board.url)
    const requests = literalRecruitmentRequests(readNativeDocument(normalizeNativeAttributeBoundaries(rendererPage.html)))
      .map(value => new URL(value, rendererPage.url).href)
    const jobs = requests.filter(value => value.startsWith(root + 'api/embedjobs/') && value.endsWith('/active/' + identifier))
    need(jobs.length === 1, 'native embedded inventory request changed')
    portalName = new URL(jobs[0]).pathname.split('/').at(-3)
    need(requests.includes(root + 'api/organization/' + portalName + '/careerportalinfo'), 'native account request is not declared')
  } else {
    let page = board.mode === 'script' ? await io.readPage(board.bindingEvidence.officialURL)
      : await io.readPage(board.url)
    if (board.mode !== 'script') {
      const urls = literalRecruitmentRequests(readNativeDocument(normalizeNativeAttributeBoundaries(page.html))).map(value => new URL(value, page.url))
        .filter(url => url.origin === advertised.origin && /^\/ats\/documents\/[a-f\d-]{36}\/careerportal\/[a-f\d]+\.html$/i.test(url.pathname) && !url.search)
      need(urls.length === 1, 'native portal document is not declared')
      io.permit(urls[0].href); page = await io.readPage(urls[0].href)
    }
    const document = readNativeDocument(normalizeNativeAttributeBoundaries(page.html)), config = configuration(document)
    need(uuid.test(config.identifier) && config.domain === root && (!identifier || identifier === config.identifier), 'native portal account changed')
    identifier = config.identifier; portalName = config.portalName || 'default'
    const rendererURL = root + 'api/embedjobs/js/' + identifier
    need(document.nodes(node => node.tag === 'script' && node.attrs.src).some(node => new URL(node.attrs.src, page.url).href === rendererURL), 'native renderer is not declared')
    io.permit(rendererURL); rendererPage = await io.readRenderer(rendererURL)
    need(['api/organization/${portalName}/careerportalinfo', 'api/embedjobs/${portalName}/active/', 'khConfig.identifier', 'job.jobLocations', 'jobdetails/']
      .every(signal => rendererPage.html.includes(signal)), 'native renderer contract changed')
  }
  need(/^[a-z\d_-]{1,80}$/i.test(portalName) && uuid.test(identifier), 'invalid native account identity')
  const infoURL = root + 'api/organization/' + portalName + '/careerportalinfo'
  const jobsURL = root + 'api/embedjobs/' + portalName + '/active/' + identifier
  io.permit(infoURL); io.permit(jobsURL)
  const account = await io.readJson(infoURL)
  need(account && io.matchingEmployer(account.name) && text(account.careersPortalDomain).toLowerCase() === advertised.hostname,
    'native account publisher does not match the source')
  if (text(account.companyWebsite)) need(io.official(new URL(account.companyWebsite)), 'native reciprocal company website changed')
  const rows = await io.readJson(jobsURL)
  need(Array.isArray(rows) && rows.length <= 5000, 'invalid active inventory envelope')
  io.inventoryRead({ kind: 'keka', surface: board.url, identifier, portalName, publisher: account.name, reportedTotal: rows.length })
  const ids = new Set()
  for (const row of rows) {
    need(row && /^[1-9]\d{0,15}$/.test(String(row.id)) && text(row.title) && !ids.has(String(row.id)), 'invalid or duplicate native role identity')
    ids.add(String(row.id)); io.recordRead(row, { origin: advertised.origin, identifier, portalName,
      rolePrefix: root + (portalName === 'default' ? '' : portalName + '/') + 'jobdetails/' })
    const locations = Array.isArray(row.jobLocations) ? row.jobLocations : []
    for (const location of locations) {
      const code = nativeCountryName(location.countryCode), name = nativeCountryName(location.countryName)
      need(!code || !name || code === name, 'contradictory native countries')
    }
    const india = locations.filter(location => nativeCountryName(location.countryCode) === 'India' && nativeCountryName(location.countryName) === 'India')
    if (!india.length) {
      if (!locations.length || locations.some(location => !nativeCountryName(location.countryCode) || !nativeCountryName(location.countryName))) io.unresolved('native-location-scope-unresolved')
      continue
    }
    const url = root + (portalName === 'default' ? '' : portalName + '/') + 'jobdetails/' + row.id
    io.permit(url)
    io.addJob({ id: row.id, title: row.title, url, description: row.description, employer: { name: account.name },
      location: [india[0].city || india[0].name, india[0].state, 'India'].filter(Boolean).join(', '),
      posted: row.publishedOn, employmentType: typeof row.jobType === 'string' ? row.jobType : null,
      record: { ...row, nativeAccount: { name: account.name, shortName: account.shortName, careersPortalDomain: account.careersPortalDomain, identifier, portalName } } })
  }
}

export async function readDeclaredKekaWebflowFeed(config, document, page, io) {
  const feed = config.nativeJsonFeed
  if (!feed || feed.contract !== 'keka-webflow') return
  need(literalRecruitmentRequests(document).some(value => new URL(value, page.url).href === feed.url), 'reviewed first-party feed request is no longer declared')
  const prefix = new URL(feed.rolePrefix)
  need(prefix.protocol === 'https:' && /^[a-z\d-]+\.keka\.com$/i.test(prefix.hostname) && prefix.pathname === '/careers/jobdetails/'
    && !prefix.port && !prefix.username && !prefix.password && !prefix.search && !prefix.hash, 'invalid reviewed role prefix')
  io.permit(feed.url)
  const rows = await io.readJson(feed.url)
  need(Array.isArray(rows) && rows.length <= 5000, 'invalid first-party feed envelope')
  io.inventoryRead({ kind: 'first-party-keka-webflow', surface: feed.url, publisher: config.companyName, reportedTotal: rows.length })
  const ids = new Set()
  for (const row of rows) {
    need(row && uuid.test(row.id) && !ids.has(row.id) && text(row.name), 'invalid or duplicate first-party role identity')
    ids.add(row.id); io.recordRead(row)
    const url = new URL(row.url)
    need(url.origin === prefix.origin && url.pathname.startsWith(prefix.pathname) && /^[1-9]\d*$/.test(url.pathname.slice(prefix.pathname.length))
      && !url.username && !url.password && !url.port && !url.search && !url.hash, 'first-party native role URL changed account')
    const locations = Array.isArray(row.locations) ? row.locations : []
    const primary = nativeCountryName(row.location?.country?.name)
    need(!primary || !locations.length || locations.some(location => nativeCountryName(location.country?.name) === primary), 'contradictory first-party native countries')
    const india = locations.filter(location => nativeCountryName(location.country?.name) === 'India')
    if (!india.length) { if (!locations.length || locations.some(location => !nativeCountryName(location.country?.name))) io.unresolved('native-location-scope-unresolved'); continue }
    const employer = text(row.company?.name) ? { name: row.company.name } : null
    if (employer && !io.matchingEmployer(employer.name) || !employer && config.requireNativeEmployerName) { io.unresolved('native-employer-mismatch'); continue }
    io.permit(url.href)
    io.addJob({ id: row.id, title: row.name, url: url.href, description: row.description, employer,
      ...(!employer ? { employerBinding: { surface: feed.url, publisher: config.companyName, officialURL: page.url, method: 'current-company-declared-first-party-json-feed' } } : {}),
      location: [india[0].city || india[0].name, 'India'].filter(Boolean).join(', '), posted: row.published_date,
      employmentType: row.type?.name, record: row })
  }
}
