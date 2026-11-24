import {decodeHTML} from 'entities'
import {readNativeDocument,readNativeAttributeTokens} from '../../scraper-support/utils/activeNativeHtml.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
const need=(ok,message)=>{if(!ok)throw firstPartyFailure('dsmfirmenich',message)}
const norm=value=>String(value).normalize('NFC').replace(/\s+/gu,' ').trim()
// Reuse the established Eightfold block/list serialization policy without
// copying renderer, layout, media, tenant configuration or programme hashes.
const blocks = new Set(['root','div','p','h1','h2','h3','h4','h5','h6','ul','ol','li','table','tr','td','th','section','article','br','hr'])
const criteria = (source, listMarkers = false) => {
  const doc = readNativeDocument(source), hasOrderedList = listMarkers && doc.nodes(node => node.tag === 'ol').length > 0
  if (hasOrderedList) {
    // Styles are inert text nodes to the visible reader, while their rules can
    // still change list counters. Inspect the actual tree including those
    // nodes before relying on the reviewed default decimal presentation.
    const containsStyle = node => typeof node !== 'string' && (node.tag === 'style' || node.children.some(containsStyle))
    need(!containsStyle(doc.nodes(node => node.tag === 'root')[0]), 'unreviewed ordered list semantics')
    for (const match of source.matchAll(/<(?:ol|li)\b([^>]*)>/gi)) {
      const names = readNativeAttributeTokens(match[1]).map(([name]) => name)
      need(new Set(names).size === names.length, 'unreviewed ordered list semantics: duplicate attributes')
    }
  }
  const flow = (node, parentTag = null, ordinal = 0) => {
    if (typeof node === 'string') {
      const value = decodeHTML(node)
      // The captured own schema uses Markdown serialization. A new authored
      // backslash is outside this reviewed format, and cannot masquerade as
      // the schema serializer's structural escape before a numbered heading.
      if (listMarkers) need(!value.includes('\\'), 'unsupported authored backslash in native criteria')
      return value
    }
    if (node.inert || ['script','style','title'].includes(node.tag)) return ''
    if (listMarkers && node.tag === 'ol') {
      // Actual Word-authored ordered markup has numeric start/type 1 and only
      // margin styling. Nondefault counters, reversed/type/value semantics or
      // new CSS cannot be guessed from the text of a matching schema.
      need(Object.keys(node.attrs).every(key => ['start','type','style'].includes(key))
        && (!Object.hasOwn(node.attrs, 'start') || node.attrs.start === '1')
        && (!Object.hasOwn(node.attrs, 'type') || node.attrs.type === '1')
        && (!Object.hasOwn(node.attrs, 'style') || node.attrs.style === 'margin-top: 0.0in; margin-bottom: 0.0in;')
        && node.children.every(child => typeof child === 'string' ? !decodeHTML(child).trim() : child.tag === 'li'),
      'unreviewed ordered list semantics')
    }
    if (listMarkers && node.tag === 'li' && parentTag === 'ol') need(Object.keys(node.attrs).every(key => key === 'style')
      && (!Object.hasOwn(node.attrs, 'style') || node.attrs.style === 'margin-top: 0.0in; margin-right: 0.0in; margin-bottom: 8.0pt; line-height: 115%; font-size: 10.0pt; font-family: arial, helvetica, sans-serif;'),
    'unreviewed ordered list semantics')
    if (listMarkers && node.tag === 'li') need(['ol','ul'].includes(parentTag), 'unreviewed native list hierarchy')
    let item = 0
    let content = (listMarkers && node.tag === 'li' ? (parentTag === 'ol' ? ordinal + '. ' : '* ') : '')
      + node.children.map(child => flow(child, node.tag, typeof child !== 'string' && child.tag === 'li' ? ++item : 0)).join('')
    // Preserve every authored digit/dot and case. Only actual paragraph starts
    // acquire the exact structural Markdown escape observed in the full own
    // schema; punctuation elsewhere is never removed or folded.
    if (listMarkers && node.tag === 'p') content = content.replace(/^(\s*\d+)\.(?=\s)/u, '$1\\.')
    return blocks.has(node.tag) ? ' ' + content + ' ' : content
  }
  return norm(flow(doc.nodes(node => node.tag === 'root')[0]))
}
export const currentDsmCriteria=(html,apiListSerialization=false)=>criteria(html,apiListSerialization)
