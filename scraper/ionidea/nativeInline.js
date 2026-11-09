import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { decodeNativeEntities, extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'
const hasClass = (node, value) => (node.attrs.class || '').split(/\s+/).includes(value)
const children = node => node.children.filter(child => typeof child !== 'string')
const descendants = (node, predicate) => [...(predicate(node) ? [node] : []), ...children(node).flatMap(child => descendants(child, predicate))]
const surface = document => document.nodes(node => /^h[1-6]$/.test(node.tag) && document.text(node) === 'Jobs at IonIdea').length === 1
const documentFor = html => readVisibleNativeDocument(html, { strict: true })
export const hasActiveIonSurface = html => surface(documentFor(html))
const fail = message => Object.assign(new Error('IonIdea native ' + message), { abortRetries: true, incompleteScope: true })
const nativeLines = nodes => {
  const render = node => {
    if (typeof node === 'string') return decodeNativeEntities(node)
    if (node.inert || ['a', 'script', 'style', 'form', 'button'].includes(node.tag)) return ''
    if (node.tag === 'br') return '\n'
    const block = /^(?:p|div|li|ul|ol|h[1-6])$/.test(node.tag)
    return (block ? '\n' : '') + node.children.map(render).join(' ') + (block ? '\n' : '')
  }
  return nodes.map(render).join('\n').split(/\r?\n/).map(line => line.replace(/\s+/g, ' ').trim()).filter(Boolean)
}
export const readIonInlineRoles = html => {
  const document = documentFor(html)
  if (!surface(document)) throw fail('visible employer jobs identity unavailable')
  const parents = new Map()
  const index = node => { for (const child of children(node)) { parents.set(child, node); index(child) } }
  document.nodes(node => node.tag === 'root').forEach(index)
  const titles = document.nodes(node => node.tag === 'p' && hasClass(node, 'careers-job-title'))
  if (!titles.length) throw fail('visible native role cards unavailable')
  return titles.map(titleNode => {
    const card = parents.get(titleNode), title = document.text(titleNode)
    if (card?.tag !== 'div' || descendants(card, node => node.tag === 'p' && hasClass(node, 'careers-job-title')).length !== 1) throw fail('role card identity ambiguous')
    const applications = descendants(card, node => node.tag === 'a' && document.text(node) === 'Apply Here')
    if (applications.length !== 1) throw fail('role application identity unavailable')
    let apply
    try { apply = new URL(applications[0].attrs.href, 'https://www.ionidea.com/careers.php') } catch { throw fail('application URL malformed') }
    const firstParty = apply.origin === 'https://www.ionidea.com' && apply.pathname === '/careers-apply.php'
      && [...apply.searchParams].length <= 1 && [...apply.searchParams].every(([key, value]) => key === 'id' && /^\d+$/.test(value))
    const advertisedThirdParty = apply.origin === 'https://www.jobpostingtoday.com' && /^\/application\/\d+\/apply\/$/.test(apply.pathname) && !apply.search
    if ((!firstParty && !advertisedThirdParty) || apply.username || apply.password || apply.hash) throw fail('application URL ownership unavailable')
    const lines = nativeLines(children(card).filter(node => node !== titleNode))
    const jobDescription = lines.join('\n') || null
    const locationLine = lines.find(line => /^Location\s*:/i.test(line))?.replace(/^Location\s*:\s*/i, '').trim() || null
    // This explicit worksite statement is country evidence; employer addresses,
    // customer geography and other roles never supply a missing country.
    const clientWorksite = !locationLine && lines.find(line => /^Will provide services at unanticipated client worksites throughout the U\.S\.(?:\s|$)/i.test(line))
      ?.match(/^Will provide services at (unanticipated client worksites throughout the U\.S\.)/i)?.[1]
    const criteria = lines.filter(line => !/^(?:Experience|Education|Location|Reports to)\s*:/i.test(line) && !/:$/.test(line))
    const complete = Boolean(extractActiveDescription(criteria.join('\n')))
    return { title, location: locationLine || clientWorksite || null, city: null, country: clientWorksite ? 'U.S.' : null,
      experienceRequired: lines.find(line => /^Experience\s*:/i.test(line))?.replace(/^Experience\s*:\s*/i, '').trim() || null,
      jobDescription, applyUrl: apply.href, sourceDetailComplete: complete, publicExperienceChecked: complete,
      ...(!complete ? { sourceDetailFailureKind: 'missing-content' } : {}) }
  })
}
