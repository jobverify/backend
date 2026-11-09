import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'acorn'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'seoak'
export const COMPANY = 'SEOAK Innovations Private Limited'
export const CAREERS_URL = 'https://www.seoak.in/careers'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim() || null

const stripTags = (value) => normalizeWhitespace(value)

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return /Discover Career/i.test(page)
    && /Opportunities at SEOAK!/i.test(page)
    && /<h1>\s*Open Position\s*<\/h1>/i.test(page)
    && /career-cards-container\s+web-view/i.test(page)
    && /SEOAK INNOVATIONS PRIVATE LIMITED/i.test(page)
}

const extractLabelValue = (cardHtml, label) => {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return stripTags(
    String(cardHtml ?? '').match(new RegExp(`<div>\\s*${escapedLabel}:([\\s\\S]*?)<\\/div>`, 'i'))?.[1],
  )
}

export const extractOpenings = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('SEOAK verified official public careers surface changed or disappeared')
  }

  const page = String(html ?? '')
  const desktopStart = page.indexOf('<div class="career-cards-container web-view">')
  const mobileStart = desktopStart >= 0 ? page.indexOf('<div class="mob-view carousel">', desktopStart) : -1
  const desktopSection = desktopStart >= 0 && mobileStart > desktopStart
    ? page.slice(desktopStart, mobileStart)
    : null

  if (!desktopSection) {
    throw new Error('SEOAK verified official public careers surface changed or disappeared')
  }

  const jobs = desktopSection
    .split('<div class="career-card bg-light-4 cursor">')
    .slice(1)
    .map((cardHtml) => {
      const title = stripTags(cardHtml.match(/<h2>([\s\S]*?)<\/h2>/i)?.[1])
      const department = extractLabelValue(cardHtml, 'Type')
      const locationLabel = extractLabelValue(cardHtml, 'Location')

      if (!title || !department || !locationLabel) return null

      return {
        title,
        department,
        location: `${locationLabel}, India`,
        city: null,
        sourceUrl: CAREERS_URL,
        applyUrl: CAREERS_URL,
        employmentType: null,
        remoteStatus: /work from office/i.test(locationLabel) ? 'On-site' : null,
      }
    })
    .filter(Boolean)

  if (jobs.length === 0) {
    throw new Error('SEOAK verified official public careers surface changed or disappeared')
  }

  return jobs
}

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  signal, attempts: 1, timeoutMs: 15000,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
})

const nodes = root => {
  const result = [], pending = [root]
  while (pending.length) {
    const node = pending.pop()
    if (!node?.type) continue
    result.push(node)
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) pending.push(...value)
      else if (value?.type) pending.push(value)
    }
  }
  return result
}

const literal = node => node?.type === 'Literal' ? node.value : undefined
const propertyName = node => node?.type === 'Identifier' ? node.name : literal(node)
const properties = node => {
  if (node?.type !== 'ObjectExpression') return null
  const values = new Map()
  for (const prop of node.properties) {
    if (prop.type !== 'Property' || prop.computed || prop.method || prop.kind !== 'init') return null
    const key = propertyName(prop.key)
    if (values.has(key)) return null
    values.set(key, prop.value)
  }
  return values
}
const member = (node, name) => node?.type === 'MemberExpression' && !node.computed && propertyName(node.property) === name
const callee = node => node?.type === 'SequenceExpression' ? node.expressions.at(-1) : node
const jsx = node => {
  const fn = callee(node?.callee)
  if (node?.type !== 'CallExpression' || !(member(fn, 'jsx') || member(fn, 'jsxs'))) return null
  const props = properties(node.arguments[1])
  return props ? { tag: node.arguments[0], props } : null
}
const returned = fn => fn?.body?.type === 'BlockStatement'
  ? fn.body.body.find(node => node.type === 'ReturnStatement')?.argument : fn?.body
const optionalValue = node => node?.type === 'ConditionalExpression'
  && node.test.type === 'BinaryExpression' && node.test.operator === '=='
  && literal(node.test.left) === null && node.consequent.type === 'UnaryExpression'
  && node.consequent.operator === 'void' ? node.alternate : node

export const linkedCareerAssets = html => [...new Set([...String(html).matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)].map(match => {
  try {
    const url = new URL(match[1], CAREERS_URL)
    return url.origin === 'https://www.seoak.in' && !url.username && !url.password && !url.search && !url.hash
      && /^\/_next\/static\/chunks\/app\/careers\/page-[a-z0-9]+\.js$/i.test(url.pathname) ? url.href : null
  } catch { return null }
}).filter(Boolean))]

// Parse the literal React tree and the active card -> state -> modal binding.
// Downloaded code is never evaluated; changed/dynamic/ambiguous structures fail closed.
export const extractStaticRoleDetails = (javascript, jobs) => {
  if (typeof javascript !== 'string' || javascript.length > 500000 || !jobs.length) return null
  let ast
  try { ast = parse(javascript, { ecmaVersion: 'latest', sourceType: 'script' }) } catch { return null }
  const candidates = []
  for (const module of nodes(ast).filter(node => node.type === 'FunctionExpression')) {
    const body = module.body.body
    const exported = body.filter(node => node.type === 'ExpressionStatement'
      && node.expression.type === 'AssignmentExpression' && member(node.expression.left, 'default')
      && node.expression.right.type === 'FunctionExpression')
    if (exported.length !== 1) continue
    const page = exported[0].expression.right
    const declarations = page.body.body.filter(node => node.type === 'VariableDeclaration').flatMap(node => node.declarations)
    const arrays = declarations.filter(node => node.id.type === 'Identifier' && node.init?.type === 'ArrayExpression'
      && node.init.elements.length === jobs.length).map(node => ({ name: node.id.name, roles: node.init.elements.map(element => {
      const values = properties(element)
      if (!values || values.size !== 4) return null
      const role = literal(values.get('role')), type = literal(values.get('type')), location = literal(values.get('location')), id = literal(values.get('id'))
      return typeof role === 'string' && typeof type === 'string' && typeof location === 'string' && Number.isInteger(id)
        ? { role, type, location, id } : null
    }) })).filter(({ roles }) => roles.every(Boolean) && new Set(roles.map(role => role.id)).size === jobs.length
      && new Set(roles.map(role => role.role)).size === jobs.length && jobs.every(job => roles.some(role => role.role === job.title
        && role.type === job.department && `${role.location}, India` === job.location)))
    const states = declarations.filter(node => node.id.type === 'ArrayPattern' && node.id.elements.length === 2
      && node.id.elements.every(item => item?.type === 'Identifier') && node.init?.type === 'CallExpression'
      && member(callee(node.init.callee), 'useState') && literal(node.init.arguments[0]) === null)
    if (arrays.length !== 1 || states.length !== 1) continue
    const [{ name: arrayName, roles }] = arrays
    const [state, setter] = states[0].id.elements.map(node => node.name)
    const tree = returned(page)
    const desktops = nodes(tree).filter(node => literal(jsx(node)?.props.get('className')) === 'career-cards-container web-view')
    const mobiles = nodes(tree).filter(node => literal(jsx(node)?.props.get('className')) === 'mob-view carousel')
    if (desktops.length !== 1 || mobiles.length !== 1) continue
    const maps = [...nodes(desktops[0]), ...nodes(mobiles[0])].filter(node => node.type === 'CallExpression'
      && member(node.callee, 'map') && node.callee.object.name === arrayName)
    if (maps.length !== 2) continue
    let cardName
    const bound = maps.every(map => {
      const callback = map.arguments[0], card = jsx(returned(callback))
      if (callback?.type !== 'ArrowFunctionExpression' || callback.params[0]?.type !== 'Identifier'
        || card?.tag.type !== 'Identifier' || card.props.get('data')?.name !== callback.params[0].name
        || card.props.get('setJobClicked')?.name !== setter) return false
      if (cardName && cardName !== card.tag.name) return false
      cardName = card.tag.name
      return true
    })
    if (!bound) continue
    const cards = declarations.filter(node => node.id.name === cardName && node.init?.type === 'ArrowFunctionExpression')
    if (cards.length !== 1) continue
    const card = cards[0].init
    const destructure = card.body.body?.find(node => node.type === 'VariableDeclaration')?.declarations[0]
    const cardProps = destructure?.id?.type === 'ObjectPattern' ? destructure.id.properties : []
    const data = cardProps.find(prop => propertyName(prop.key) === 'data')?.value?.name
    const clickSetter = cardProps.find(prop => propertyName(prop.key) === 'setJobClicked')?.value?.name
    if (!data || !clickSetter || destructure.init?.name !== card.params[0]?.name) continue
    const cardTree = jsx(returned(card)), click = cardTree?.props.get('onClick')
    const clickStatements = click?.body?.body
    const call = clickStatements?.length === 1 && clickStatements[0].type === 'ExpressionStatement' ? clickStatements[0].expression : null
    const selectedId = optionalValue(call?.arguments?.[0])
    const cardHeadings = nodes(returned(card)).map(jsx).filter(node => literal(node?.tag) === 'h2')
    const cardTitle = cardHeadings.length === 1 ? optionalValue(cardHeadings[0].props.get('children')) : null
    if (literal(cardTree?.props.get('className')) !== 'career-card bg-light-4 cursor'
      || call?.callee?.name !== clickSetter || !member(selectedId, 'id') || selectedId.object.name !== data
      || !member(cardTitle, 'role') || cardTitle.object.name !== data) continue
    const moduleDeclarations = body.filter(node => node.type === 'VariableDeclaration').flatMap(node => node.declarations)
    const details = []
    for (const role of roles) {
      const branches = nodes(tree).filter(node => node.type === 'ConditionalExpression'
        && node.test.type === 'BinaryExpression' && ['==', '==='].includes(node.test.operator)
        && literal(node.test.left) === role.id && node.test.right.name === state)
      if (branches.length !== 1) break
      const rendered = nodes(branches[0].consequent).map(jsx).filter(node => node?.tag.type === 'Identifier')
      if (rendered.length !== 1) break
      const components = moduleDeclarations.filter(node => node.id.name === rendered[0].tag.name && node.init?.type === 'ArrowFunctionExpression')
      if (components.length !== 1) break
      const detailTree = jsx(returned(components[0].init))
      if (literal(detailTree?.props.get('className')) !== 'job-description') break
      const headings = nodes(returned(components[0].init)).map(jsx).filter(node => literal(node?.tag) === 'h1')
      const heading = headings.length === 1 ? literal(headings[0].props.get('children')) : null
      if (typeof heading !== 'string' || !heading.startsWith('Role: ')) break
      if (heading.slice(6).trim() !== role.role) {
        details.push({ title: role.role, failureKind: 'source-detail-title-mismatch', nativeTitle: heading.slice(6).trim() })
        continue
      }
      const text = node => {
        if (node?.type === 'Literal' && typeof node.value === 'string') return node.value
        if (node?.type === 'ArrayExpression') {
          const parts = node.elements.map(text)
          return parts.every(part => part !== null) ? parts.join('\n\n') : null
        }
        const element = jsx(node)
        if (!element || !['div', 'section', 'h1', 'h2', 'p', 'ul', 'li'].includes(literal(element.tag))) return null
        return text(element.props.get('children'))
      }
      const description = text(returned(components[0].init))
      if (!description || description.length < 300 || !/Responsibilities/.test(description) || !/Qualifications/.test(description)) break
      details.push({ title: role.role, description })
    }
    if (details.length === jobs.length) candidates.push(details)
  }
  return candidates.length === 1 ? candidates[0] : null
}

const defaultFetchAsset = (url, { signal }) => fetchTextWithRetry(url, {
  signal, attempts: 1, timeoutMs: 10000, includeResponseMetadata: true,
})

export const createSeoakScraper = () => ({
  async run({ fetchText = defaultFetchText, fetchAsset = defaultFetchAsset, signal,
    now = () => new Date().toISOString() } = {}) {
    signal?.throwIfAborted()
    const html = await fetchText(CAREERS_URL, { signal })
    const jobs = extractOpenings(html)
    const assets = linkedCareerAssets(html)
    let details = null, failureKind = 'missing-authoritative-jobposting'
    if (assets.length === 1) {
      try {
        const assetSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000)
        const response = await fetchAsset(assets[0], { signal: assetSignal })
        assetSignal.throwIfAborted()
        if (response?.status === 200 && response.url === assets[0]) details = extractStaticRoleDetails(response.html, jobs)
        else failureKind = 'source-detail-access-failed'
      } catch {
        signal?.throwIfAborted()
        failureKind = 'source-detail-access-failed'
      }
    }
    signal?.throwIfAborted()
    const byTitle = new Map((details || []).map(detail => [detail.title, detail]))

    return jobs.map((job) => {
      const identitySlug = slugify(job.title)
      const detail = byTitle.get(job.title)
      const description = detail?.description || null

      return {
        ...job,
        company: COMPANY,
        country: 'India',
        jobId: `${SOURCE}-${identitySlug}`,
        requisitionId: `${SOURCE}-${identitySlug}`,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: description,
        sourceDescription: description,
        sourceDetailComplete: Boolean(description),
        ...(description ? { sourceDetailVerifiedAt: now(), sourceDetailUrl: assets[0] }
          : { sourceDetailFailureKind: detail?.failureKind || failureKind,
            ...(detail?.nativeTitle ? { sourceDetailNativeTitle: detail.nativeTitle } : {}) }),
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: now(),
      }
    })
  },
})

export const run = async (options = {}) => createSeoakScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
