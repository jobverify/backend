import { readNativeDocument } from './activeNativeHtml.js'

// Keep entity decoding and company/location normalization with each consumer.
// Script, inert and nested-card content cannot supply another role's fields.
const rawText = node => !node || node.inert || ['script', 'style'].includes(node.tag) ? ''
  : node.children.map(child => typeof child === 'string' ? child : rawText(child)).join(' ').trim()

export const extractLinkedinJobCards = html => {
  const document = readNativeDocument(String(html ?? ''))
  const isCard = node => document.hasClass(node, 'job-search-card')
  return document.nodes(isCard).flatMap(card => {
    const nodes = [], pending = [card]
    while (pending.length) {
      const node = pending.pop()
      if (node.inert || node !== card && isCard(node)) continue
      nodes.push(node)
      pending.push(...node.children.filter(child => typeof child !== 'string').reverse())
    }
    const field = name => {
      const matches = nodes.filter(node => document.hasClass(node, name))
      return matches.length === 1 ? matches[0] : null
    }
    const id = /^urn:li:jobPosting:(\d+)$/.exec(card.attrs['data-entity-urn'] || '')?.[1] || null
    const href = field('base-card__full-link')?.attrs.href || null
    const title = rawText(field('base-search-card__title')) || null
    const company = rawText(field('base-search-card__subtitle')) || null
    const location = rawText(field('job-search-card__location')) || null
    const times = nodes.filter(node => node.tag === 'time')
    const datetime = times.length === 1 ? times[0].attrs.datetime || null : null
    return id && href && title && company && location ? [{ id, href, title, company, location, datetime }] : []
  })
}
