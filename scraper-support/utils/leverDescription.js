import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'
import { decodeHTML } from 'entities'
import { readNativeDocument } from './activeNativeHtml.js'

const sourceText = (...values) => values.find(value => typeof value === 'string'
  && hasSourceDescription({ jobDescription: value }))?.trim() || null

const salaryBreaks = new Set(['address', 'article', 'aside', 'blockquote', 'br', 'caption',
  'dd', 'details', 'div', 'dl', 'dt', 'fieldset', 'figcaption', 'figure', 'footer', 'form',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'li', 'main', 'nav', 'ol', 'p',
  'section', 'summary', 'table', 'tbody', 'td', 'th', 'thead', 'tr', 'ul'])
const salaryTags = new Set(['root', 'a', 'b', 'strong', 'i', 'em', 'u', 's', 'small',
  'span', 'sub', 'sup', 'address', 'article', 'aside', 'blockquote', 'br', 'caption',
  'dd', 'div', 'dl', 'dt', 'figcaption', 'figure', 'footer', 'h1', 'h2', 'h3', 'h4',
  'h5', 'h6', 'header', 'hr', 'li', 'main', 'ol', 'p', 'section', 'table', 'tbody',
  'td', 'th', 'thead', 'tr', 'ul'])
const salaryText = value => value.replace(/\s+/g, ' ').trim()
const salaryHtmlText = node => {
  // Active text alone cannot reconcile independent hidden or non-text native
  // conditions. Inspect every child before accepting transparent salary HTML.
  if (node.inert || !salaryTags.has(node.tag)) throw new Error('Unqualified native salary HTML')
  const text = node.children.map(child => typeof child === 'string'
    ? decodeHTML(child) : salaryHtmlText(child)).join('')
  return salaryBreaks.has(node.tag) ? `\n${text}\n` : text
}
const emptySalaryPresentation = node => node.tag !== 'a'
  && Object.keys(node.attrs).length === 0
  && node.children.every(child => typeof child === 'string'
    ? salaryText(decodeHTML(child)) === '' : emptySalaryPresentation(child))

// These are separate authored compensation/benefit conditions, not salaryRange
// display values. Keep one complete original variant; disagreement must not
// silently discard either set of conditions or publish contradictory terms.
const salarySection = record => {
  if ([record.salaryDescriptionPlain, record.salaryDescription]
    .some(value => value != null && typeof value !== 'string')) return false
  const plain = sourceText(record.salaryDescriptionPlain)
  const html = record.salaryDescription?.trim() || null
  if (!html) return plain
  try {
    const document = readNativeDocument(html)
    const root = document.nodes(node => node.tag === 'root')[0]
    const text = salaryText(salaryHtmlText(root))
    if (!sourceText(html)) return emptySalaryPresentation(root) ? plain : false
    if (!text || (plain && salaryText(plain) !== text)) return false
    return html
  } catch {
    return false
  }
}

// Lever publishes the introduction, responsibility/qualification lists and
// closing employer text separately. Preserve those sections, choosing one
// native variant of each rather than repeating the plain and HTML versions.
export const composeLeverDescription = (record = {}) => {
  const salary = salarySection(record)
  if (salary === false) return null
  const description = [
    sourceText(record.descriptionPlain, record.description, record.descriptionBodyPlain),
    ...(Array.isArray(record.lists) ? record.lists : []).map(section => {
      const content = sourceText(section?.content)
      return content ? [sourceText(section?.text), content].filter(Boolean).join('\n') : null
    }),
    sourceText(record.additionalPlain, record.additional),
  ].filter(Boolean).join('\n\n') || null
  return description && salary ? `${description}\n\n${salary}` : description
}
