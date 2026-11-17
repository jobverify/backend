import { createHash } from 'node:crypto'
import { decodeHTML } from 'entities'
import { document } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { projectHTML } from '../arcelormittal/oracleNative.js'
import policy from './rendererPolicy.js'

const contexts = new WeakSet(), sha = value => createHash('sha256').update(value).digest('hex')
const norm = value => String(value || '').replace(/\s+/g, ' ').trim()
const escaped = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const attribute = value => escaped(value).replace(/"/g, '&quot;').replace(/'/g, '&#39;')
const ignoredWord = new Set(policy.ignoredWordProperties)
const inertCopiedClasses = new Set(policy.inertCopiedClasses || [])

export function createBirlaRendererContext({ stylesheets, client } = {}) {
  const hashes = Array.isArray(stylesheets) ? stylesheets.map(value => typeof value.body === 'string' ? sha(value.body) : '').sort() : []
  const verified = typeof client === 'string' && sha(client) === policy.clientSha256
    && JSON.stringify(hashes) === JSON.stringify(policy.stylesheetSha256)
  const result = Object.freeze({ verified, version: policy.version,
    contextSha256: verified ? sha(JSON.stringify([policy.clientSha256, hashes])) : null })
  if (verified) contexts.add(result)
  return result
}

function declarations(style) {
  const parts = []; let start = 0, quote = null, depth = 0, escaped = false
  for (let index = 0; index < style.length; index++) {
    const char = style[index]
    if (escaped) { escaped = false; continue }
    if (char === '\\') { escaped = true; continue }
    if (quote) { if (char === quote) quote = null; continue }
    if (char === '"' || char === "'") { quote = char; continue }
    if (char === '(') depth++
    if (char === ')' && --depth < 0) return null
    if (char === ';' && depth === 0) { parts.push(style.slice(start,index)); start = index + 1 }
  }
  if (quote || depth || escaped) return null
  parts.push(style.slice(start))
  const result = []
  for (const part of parts.filter(value => value.trim())) {
    const match = part.match(/^\s*([a-z_-][\w-]*)\s*:\s*(.*?)\s*$/is)
    if (!match) return null
    result.push({ property: match[1].toLowerCase(), value: match[2].replace(/\s*!\s*important\s*$/i, '').trim(), important: /!\s*important\s*$/i.test(match[2]) })
  }
  return result
}

function values(parts) {
  const result = new Map()
  const set = (property, value, important) => { const old = result.get(property); if (!old || important || !old.important) result.set(property,{ value, important }) }
  for (const part of parts) {
    const { property, value, important } = part
    if (/^border(?:-(?:top|right|bottom|left))?$/.test(property)) {
      const sides = property === 'border' ? ['top','right','bottom','left'] : [property.split('-')[1]]
      const width = value.match(/(?:^|\s)([\d.]+(?:px|pt|in|cm|mm))(?=\s|$)/)?.[1]
      const style = value.match(/(?:^|\s)(none|hidden|solid|dashed|dotted|double|groove|ridge|inset|outset)(?=\s|$)/)?.[1]
      for (const side of sides) { set('border-' + side + '-width',width || '0',important); set('border-' + side + '-style',style || 'none',important) }
    } else if (property === 'border-width' || property === 'border-style') {
      const tokens = value.split(/\s+/), suffix = property.slice(7)
      if (tokens.length <= 4) {
        const expanded = tokens.length === 1 ? [tokens[0],tokens[0],tokens[0],tokens[0]] : tokens.length === 2 ? [tokens[0],tokens[1],tokens[0],tokens[1]] : tokens.length === 3 ? [tokens[0],tokens[1],tokens[2],tokens[1]] : tokens
        ;['top','right','bottom','left'].forEach((side,index) => set('border-' + side + '-' + suffix,expanded[index],important))
      }
    } else if (['margin','padding'].includes(property)) {
      const tokens = value.split(/\s+/)
      if (tokens.length > 0 && tokens.length <= 4) {
        const expanded = tokens.length === 1 ? [tokens[0],tokens[0],tokens[0],tokens[0]] : tokens.length === 2 ? [tokens[0],tokens[1],tokens[0],tokens[1]] : tokens.length === 3 ? [tokens[0],tokens[1],tokens[2],tokens[1]] : tokens
        ;['top','right','bottom','left'].forEach((side,index) => set(property + '-' + side, expanded[index], important))
      }
    } else if (/^(?:margin|padding)-(?:block|inline)$/.test(property)) {
      const tokens = value.split(/\s+/), base = property.split('-')[0], sides = property.endsWith('block') ? ['top','bottom'] : ['left','right']
      if (tokens.length <= 2) sides.forEach((side,index) => set(base + '-' + side, tokens[index] || tokens[0], important))
    } else {
      const physical = property.replace(/-inline-start$/, '-left').replace(/-inline-end$/, '-right').replace(/-block-start$/, '-top').replace(/-block-end$/, '-bottom')
      set(physical,value,important)
    }
  }
  return result
}

const length = (value, font = 16) => {
  if (value == null || value === 'auto') return 0
  const match = value.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))(px|pt|in|cm|mm|em|rem)?$/i)
  if (!match || !match[2] && Number(match[1]) !== 0) return null
  const result = Number(match[1]) * ({ px:1, pt:96/72, in:96, cm:96/2.54, mm:96/25.4, em:font, rem:16 }[match[2]?.toLowerCase()] || 1)
  return Number.isFinite(result) && Math.abs(result) <= 100000 ? result : null
}
const border = (style,side,td) => {
  const kind = style.get('border-' + side + '-style')?.value
  if (kind === 'none' || kind === 'hidden') return 0
  return style.has('border-' + side + '-width') ? Math.max(0,length(style.get('border-' + side + '-width').value) || 0) : td ? 1 : 0
}

// The current native detail view is a BFC with horizontal scrolling at768px.
// Its table cells have1rem padding and lists have2rem inline padding. Credits
// below use that captured CSS and actual inline declarations. Font-dependent
// credits additionally require the explicitly reviewed standard font bounds.
export function projectBirlaCriteria(input, rendererContext) {
  const inputSha256 = typeof input === 'string' ? sha(input) : null, base = projectHTML(input)
  if (!contexts.has(rendererContext)) return { ...base, inputSha256, policy: 'strict-inline-fallback', transformations: [],
    gaps: base.complete ? [] : [{ kind: 'native-renderer-context-unverified' }], contextVerified: false }
  const doc = document(input), gaps = [], transformations = [], nodes = [], textByNode = new Map()
  const index = new Map(), parents = new Map(), children = node => (node.children || []).filter(value => typeof value !== 'string')
  const collect = node => { index.set(node,nodes.length); nodes.push(node); for (const child of children(node)) { parents.set(child,node); collect(child) } }
  collect(doc.root)
  const rawTexts = new WeakMap()
  const rawText = node => {
    if (!rawTexts.has(node)) rawTexts.set(node,(node.children || []).map(child => typeof child === 'string' ? decodeHTML(child) : ['script','style','template','noscript'].includes(child.tag) ? '' : rawText(child)).join(''))
    return rawTexts.get(node)
  }
  const gap = (node, kind, details = {}) => gaps.push({ node: index.get(node), tag: node.tag, kind, ...details })
  const knownClasses = /^(?:Mso[A-Za-z0-9]*|fr-(?:deletable|dii|fic|page-break|page-break-label|page-break-line)|shape)$/
  // Read-only metrics for the Arial/Times/Calibri fonts used by the captured
  // public browser have minimum ASCII advances above0.22em. Use less than half
  // that bound; never use unavailable site fonts or unknown font families.
  const typographyCache = new Map()
  const typography = node => {
    if (!node) return { font:16, family:'', letterSpacing:'normal', fontStretch:'normal', fontSizeAdjust:'none', wordBreak:'normal', overflowWrap:'normal' }
    if (typographyCache.has(node)) return typographyCache.get(node)
    const inherited = typography(parents.get(node)), style = values(declarations(node.attrs.style || '') || [])
    const get = name => style.get(name)?.value
    const result = { ...inherited }
    if (get('font-size') && get('font-size') !== 'inherit') result.font = length(get('font-size'),inherited.font)
    else if (!get('font-size') && ['p','li'].includes(node.tag)) result.font = 14.4
    if (get('font-family') && get('font-family') !== 'inherit') result.family = get('font-family').split(',')[0].replace(/["']/g,'').trim().toLowerCase()
    for (const [property,key] of [['letter-spacing','letterSpacing'],['font-stretch','fontStretch'],['font-size-adjust','fontSizeAdjust'],['word-break','wordBreak'],['overflow-wrap','overflowWrap']]) {
      if (get(property) && get(property) !== 'inherit') result[key] = get(property)
    }
    typographyCache.set(node,result)
    return result
  }
  const minimumTextWidth = node => {
    const style = values(declarations(node.attrs.style || '') || []), get = name => style.get(name)?.value
    if (get('display') === 'none' || get('content-visibility') === 'hidden' || node.attrs.hidden != null || node.attrs.inert != null) return 0
    const widthBox = get('display') ? /^(?:block|inline-block|flex|inline-flex|grid|inline-grid|table)$/.test(get('display')) : /^(?:div|section|p|h[1-6]|li|ul|ol|table)$/.test(node.tag)
    if (widthBox && ['width','max-width'].some(name=>get(name)&&!['auto','none','inherit','initial','unset'].includes(get(name)))) return 0
    const { font, family, letterSpacing, fontStretch, fontSizeAdjust, wordBreak, overflowWrap } = typography(node)
    if (fontSizeAdjust !== 'none' || !['normal','0','0px'].includes(letterSpacing) || fontStretch !== 'normal' || /hidden|clip/.test(get('overflow') || '')) return 0
    let width = 0
    if (font >= 6 && ['arial','times new roman','calibri'].includes(family)) {
      for (const child of node.children || []) if (typeof child === 'string') {
        const tokens = decodeHTML(child).match(/[A-Za-z0-9]+/g) || []
        const letters = wordBreak === 'break-all' || overflowWrap === 'anywhere' ? Math.min(1,...tokens.map(token => token.length)) : Math.max(0,...tokens.map(token => token.length))
        width = Math.max(width,letters * font * 0.1)
      }
    }
    for (const child of children(node)) width = Math.max(width,minimumTextWidth(child))
    return Math.max(0,width + (length(get('margin-left'),font || 0) || 0) + (length(get('margin-right'),font || 0) || 0)
      + Math.min(0,length(get('text-indent'),font || 0) || 0))
  }
  const columnCredits = new Map()
  for (const table of nodes.filter(node => node.tag === 'table')) {
    const closestTable = node => { for (let parent = parents.get(node); parent; parent = parents.get(parent)) if (parent.tag === 'table') return parent; return null }
    const rows = nodes.filter(node => node.tag === 'tr' && closestTable(node) === table), occupied = [], positions = [], minimums = []
    let supported = true
    for (const row of rows) {
      const rowStyle = values(declarations(row.attrs.style || '') || [])
      if (row.attrs.hidden != null || rowStyle.get('display')?.value === 'none' || rowStyle.get('visibility')?.value === 'collapse') supported = false
      let column = 0
      for (const cell of children(row).filter(node => ['td','th'].includes(node.tag))) {
        while (occupied[column] > 0) column++
        const colspan = Number(cell.attrs.colspan || 1), rowspan = Number(cell.attrs.rowspan || 1)
        if (![colspan,rowspan].every(value => Number.isSafeInteger(value) && value > 0 && value <= 100)) { supported = false; continue }
        const style = values(declarations(cell.attrs.style || '') || [])
        if (cell.attrs.hidden != null || style.get('display')?.value === 'none' || style.get('visibility')?.value === 'collapse') supported = false
        if (colspan === 1) {
          let padding = 0
          for (const side of ['left','right']) {
            const value = style.get('padding-' + side)?.value
            padding += value == null ? cell.tag === 'td' ? 16 : 0 : /(?:^|[^r])em\b|%/.test(value) ? 0 : Math.max(0,length(value,0) || 0)
          }
          const tableStyle = values(declarations(table.attrs.style || '') || [])
          const textMinimum = tableStyle.get('table-layout')?.value === 'fixed' ? 0 : minimumTextWidth(cell)
          minimums[column] = Math.max(minimums[column] || 0,padding + textMinimum + (border(style,'left',cell.tag === 'td') + border(style,'right',cell.tag === 'td')) / 2)
        }
        positions.push([cell,column])
        for (let index = column; index < column + colspan; index++) occupied[index] = Math.max(occupied[index] || 0,rowspan)
        column += colspan
      }
      occupied.forEach((value,index) => { occupied[index] = Math.max(0,value - 1) })
    }
    if (supported) for (const [cell,column] of positions) columnCredits.set(cell,minimums.slice(0,column).reduce((total,value) => total + (value || 0),0))
  }
  function render(node, parent = { left: 0, top: 0, font: 16, width: 712, hidden: false, indent:0, inlineIndent:0 }, path = 'root') {
    if (node.tag === 'root') {
      const html = (node.children || []).map((child,i) => typeof child === 'string' ? escaped(decodeHTML(child)) : render(child,parent,path + '.' + i)).join('')
      textByNode.set(node,(node.children || []).map(child => typeof child === 'string' ? decodeHTML(child) : textByNode.get(child) || '').join(''))
      return html
    }
    if (['script','template','noscript','textarea','title'].includes(node.tag)) { textByNode.set(node,''); return '' }
    if (node.tag === 'style') { if (node.raw?.trim()) gap(node,'unsupported-active-stylesheet'); textByNode.set(node,''); return '' }
    const parts = declarations(node.attrs.style || '')
    if (!parts) { gap(node,'unsupported-style-syntax'); return doc.outer(node) }
    const computed = values(parts), get = name => computed.get(name)?.value, text = norm(rawText(node))
    if (get('content-visibility') === 'hidden') { textByNode.set(node,''); transformations.push({ node: index.get(node), property:'content-visibility', value:'hidden', reason:'native-browser-skips-hidden-subtree' }); return '' }
    const hidden = parent.hidden || Object.hasOwn(node.attrs,'hidden') || Object.hasOwn(node.attrs,'inert') || node.attrs['aria-hidden'] === 'true'
      || get('display') === 'none' || ['hidden','collapse'].includes(get('visibility')) || get('opacity') === '0' || get('font-size') === '0'
    const label = !text || /^Job Description:?$/i.test(text)
    const headerShape = node.tag === 'h2' && /^[A-Za-z &():/-]{1,40}$/.test(text) && get('font-family') === 'Inter-Bold'
      && get('font-size') === '14px' && get('line-height') === '18px' && get('white-space') === 'nowrap' && get('max-width') === '100%'
    const headerChildren = node.tag === 'div' && get('height') === '40px' ? nodes.filter(child => child.start > node.start && child.end <= node.end && child.tag === 'h2') : []
    const headerCard = get('height') === '40px' && get('padding-top') === '10px' && headerChildren.length === 1
      && norm(rawText(headerChildren[0])) === text && /^[A-Za-z &():/-]{1,40}$/.test(text)
    if (node.tag === 'img' && !hidden) gap(node, /^blob:/i.test(node.attrs.src || '') || /blob:https?:/i.test(node.attrs.src || '') ? 'expired-blob-media' : 'unverified-description-media', { source: node.attrs.src || null, alt: node.attrs.alt || null })
    if (['iframe','object','embed','svg','canvas','video','audio'].includes(node.tag) && !hidden) gap(node,'unsupported-public-media')
    const classes = (node.attrs.class || '').split(/\s+/).filter(Boolean), staticHidden = classes.includes('d-none') || classes.includes('invisible')
    if (!hidden && !staticHidden) for (const cls of classes) if (!knownClasses.test(cls)) {
      // The exact captured CSSOM has no rule for these copied classes. Its
      // general class selectors affect anchors and icon-* names only; neither
      // can be authorized by this exception.
      if (node.tag !== 'a' && inertCopiedClasses.has(cls) && !classes.some(value=>value.startsWith('icon-'))) transformations.push({ node:index.get(node),class:cls,reason:'copied-class-has-no-rule-in-verified-native-CSS' })
      else gap(node,'unreviewed-native-description-class',{ class: cls })
    }
    const nativeLTR = !node.attrs.dir || node.attrs.dir.toLowerCase() === 'ltr' || node.attrs.dir.toLowerCase() === 'auto' && /^[^\p{L}]*[A-Za-z]/u.test(text)
    if (!hidden && !staticHidden && (!nativeLTR || get('direction') && get('direction') !== 'ltr' || get('writing-mode'))) gap(node,'unsupported-writing-direction')
    const font = get('font-size') === 'inherit' ? parent.font : get('font-size') ? length(get('font-size'), parent.font) : ['p','li'].includes(node.tag) ? 14.4 : parent.font
    const marginLeft = length(get('margin-left'), font || 16), marginTop = length(get('margin-top'), font || 16)
    const padLeft = get('padding-left') ? length(get('padding-left'),font || 16) : node.tag === 'td' ? 16 : ['ul','ol'].includes(node.tag) ? 32 : 0
    const padTop = length(get('padding-top'),font || 16)
    const ownWidth = get('width') == null || ['auto','inherit','initial','unset'].includes(get('width')) ? parent.width
      : /^\d+(?:\.\d+)?%$/.test(get('width')) && parent.width != null ? parent.width * Number.parseFloat(get('width')) / 100 : length(get('width'),font || 16)
    const availableWidth = parent.width == null || ownWidth == null ? null : Math.min(parent.width,ownWidth)
      - (padLeft || 0) - (length(get('padding-right'),font || 16) || 0) - border(computed,'left',false) - border(computed,'right',false)
    const fitsActualWidth = availableWidth != null && font > 0 && text.length * font * 2 < availableWidth
    const boundedHeader = headerShape && fitsActualWidth
    const innerLeft = (padLeft || 0) + (['td','th'].includes(node.tag) ? border(computed,'left',node.tag === 'td') / 2 : 0)
    let columnCredit = columnCredits.get(node) || 0
    if (['td','th'].includes(node.tag) && !columnCredits.has(node)) {
      const siblings = children(parents.get(node) || {}).filter(child => ['td','th'].includes(child.tag))
      for (const sibling of siblings.slice(0,siblings.indexOf(node))) {
        const previous = values(declarations(sibling.attrs.style || '') || [])
        for (const side of ['left','right']) columnCredit += previous.has('padding-' + side) ? Math.max(0,length(previous.get('padding-' + side).value,font || 16) || 0) : sibling.tag === 'td' ? 16 : 0
      }
    }
    const left = parent.left + columnCredit + (marginLeft || 0), top = parent.top + (marginTop || 0)
    const indent = get('text-indent') == null || get('text-indent') === 'inherit' ? parent.indent : length(get('text-indent'),font || 16)
    const blockTag = get('display') ? /^(?:block|inline-block|table-cell|list-item)$/.test(get('display')) : /^(?:div|section|p|h[1-6]|li|td|th)$/.test(node.tag)
    const oneLineToken = blockTag && /^\S+$/.test(text) && !/^(?:break-word|break-all)$/.test(get('word-break') || '') && !get('overflow-wrap')
    // A block inherits text-indent but establishes its own first line. An
    // inline child stays on its parent's line; it must not receive a second
    // block indentation or lose a negative indentation applied to that line.
    const firstLineCredit = blockTag ? indent < 0 || oneLineToken ? indent || 0 : 0 : parent.inlineIndent || 0
    const directText = (node.children || []).some(child => typeof child === 'string' && norm(decodeHTML(child)))
    if (!hidden && !staticHidden && directText && (left + innerLeft + firstLineCredit < -0.001 || top < -0.001)) gap(node,'offscreen-negative-flow',{ left, top, firstLineCredit })
    if (!hidden && !staticHidden && blockTag && text && indent != null && indent < 0 && left + innerLeft + indent < -0.001) gap(node,'unproved-hanging-indent',{ indent, availableLeft: left + innerLeft })
    for (const [name,value] of [['margin-left',marginLeft],['margin-top',marginTop],['padding-left',padLeft],['padding-top',padTop]]) {
      if (!hidden && !staticHidden && get(name) != null && value == null) gap(node,'unsupported-flow-length',{ property:name,value:get(name) })
    }
    const fixedHeight = get('height') && !['auto','inherit','initial','unset'].includes(get('height'))
    if (!hidden && !staticHidden && text && fixedHeight && !label && !headerCard && !['td','th','tr','table','tbody','thead'].includes(node.tag) && !['span','b','i','u','strong','em'].includes(node.tag)) gap(node,'unproved-fixed-height-content-box',{ height: get('height') })
    const boundedInline = node.tag === 'span' && get('display') === 'inline-flex' && /^[\x20-\x7e]{1,20}$/.test(text)
      && get('max-width') === '100%' && fitsActualWidth
    const superscript = node.tag === 'sup' && get('position') === 'relative' && /^-0?\.5em$/.test(get('top') || '') && get('line-height') === '0' && font <= parent.font
    const normalized = []
    for (const part of parts) {
      let { property, value } = part, handled = false, reason = null
      if (ignoredWord.has(property) || property === 'tab-stops') { handled = true; reason = 'unsupported-Word-property-ignored-by-native-browser' }
      else if (property === 'text-indent') {
        if (!text || indent != null && (indent >= 0 || left + innerLeft + indent >= -0.001)) { handled = true; reason = !text ? 'empty-paragraph-indent-has-no-public-criterion' : indent < 0 ? 'hanging-indent-contained-by-proved-flow-padding-and-margin' : 'nonnegative-text-indent' }
      } else if (/^(?:margin|padding)-(?:block|inline)(?:-(?:start|end))?$/.test(property)) {
        handled = true; reason = 'logical-spacing-resolved-in-native-LTR-horizontal-context'
      } else if (property === 'transition' && value === 'opacity 500ms ease-out' && get('opacity') === '1') { handled = true; reason = 'native-settled-opaque-editor-transition' }
      else if (/^(?:border-radius|border-(?:top|right|bottom|left)-(?:style|color))$/.test(property) && !/[{}\\]|var\(|expression\(/i.test(value)) { handled = true; reason = 'decorative-border-with-no-content-clip' }
      else if (/^(?:page-break-inside|break-after)$/.test(property) && /^(?:always|avoid|auto|page)$/.test(value)) { handled = true; reason = 'print-pagination-does-not-hide-screen-criteria' }
      else if (property === 'float' && /^(?:none|left)$/.test(value)) { handled = true; reason = 'native-auto-height-BFC-contains-flow-floats' }
      else if (['flex-grow','-webkit-box-flex'].includes(property) && /^(?:0|1)$/.test(value) || property === 'flex-wrap' && value === 'wrap') { handled = true; reason = 'nonclipped-native-flow-flex-layout' }
      else if (property === 'text-wrap' && /^(?:balance|pretty|wrap|nowrap)$/.test(value) || property === 'word-break' && /^(?:normal|break-word|break-all|keep-all)$/.test(value)) { handled = true; reason = 'native-scrollable-auto-height-text-wrapping' }
      else if (property === '-webkit-font-smoothing' && value === 'antialiased') { handled = true; reason = 'native-font-antialiasing-does-not-hide-text' }
      else if (property === 'text-rendering' && /^(?:auto|optimizelegibility|optimizespeed|geometricprecision)$/i.test(value)) { handled = true; reason = 'native-text-shaping-preserves-criterion-characters' }
      else if ({ 'font-size-adjust':['none','inherit'], 'font-language-override':['normal','inherit'], 'font-optical-sizing':['auto','inherit'], 'font-feature-settings':['normal','inherit'], 'font-variation-settings':['normal','inherit'], 'font-stretch':['normal','inherit'], 'unicode-bidi':['normal'] }[property]?.includes(value)) { handled = true; reason = 'captured-default-font-feature-value' }
      else if (property === 'overflow' && value === 'inherit' && (label || headerCard) || /^overflow(?:-[xy])?$/.test(property) && value === 'hidden' && (label || boundedHeader || boundedInline)
        || property === 'text-overflow' && boundedInline || property === 'top' && superscript) { handled = true; reason = superscript ? 'native-superscript-offset-within-parent-line' : 'bounded-native-label-or-inline-content-without-clipping' }
      else if (property === 'display' && value === 'inline-flex' && boundedInline) { normalized.push('display:inline'); handled = true; reason = 'bounded-native-inline-text-fits-parent' }
      if (handled) transformations.push({ node: index.get(node), property, value, reason })
      else normalized.push(property + ':' + value + (part.important ? '!important' : ''))
    }
    const originalStyle = normalized.join(';'), ownTest = projectHTML('<p style="' + attribute(originalStyle) + '">criterion</p>')
    if (!hidden && !staticHidden && !ownTest.complete) gap(node,'unsupported-inline-rendering',{ style: originalStyle })
    // Serialize parsed elements and original text nodes separately. Literal
    // style="..." prose and entities never become attribute or tag syntax.
    let opening = input.slice(node.start,node.openEnd), styleSeen = false
    const name = opening.match(/^<[a-z][a-z0-9:_-]*\b/i)?.[0]
    if (name) opening = name + opening.slice(name.length).replace(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g,(match,key) => {
      if (key.toLowerCase() !== 'style' || styleSeen) return match
      styleSeen = true; return 'style="' + attribute(originalStyle) + '"'
    })
    if (staticHidden) opening = opening.replace(/\/?>$/, ' hidden>')
    const width = ['td','th'].includes(node.tag) ? null : get('width') && !get('width').includes('%') ? length(get('width'),font || 16) : parent.width == null ? null : parent.width - (marginLeft || 0) - (padLeft || 0) - (length(get('padding-right'),font || 16) || 0)
    const childHidden = hidden || staticHidden || !ownTest.text
    const body = (node.children || []).map((child,i) => typeof child === 'string' ? escaped(decodeHTML(child)) : render(child,{ left: left + innerLeft, top: top + (padTop || 0), font: font || parent.font, width, hidden: childHidden,
      indent,inlineIndent:firstLineCredit },path + '.' + i)).join('')
    const plain = childHidden ? '' : (node.children || []).map(child => typeof child === 'string' ? decodeHTML(child) : textByNode.get(child) || '').join('')
    const block = get('display') ? /^(?:block|flex|grid|table|table-row|table-cell|list-item)$/.test(get('display')) : /^(?:div|section|p|h[1-6]|table|tbody|thead|tr|td|th|ol|ul|li)$/.test(node.tag)
    textByNode.set(node, childHidden ? '' : ['br','hr'].includes(node.tag) ? '\n' : block ? '\n' + plain + '\n' : plain)
    if (['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'].includes(node.tag)) return opening
    return opening + body + '</' + node.tag + '>'
  }
  const html = render(doc.root), projection = projectHTML(html)
  return { ...projection, text: norm(textByNode.get(doc.root)), complete: projection.complete && gaps.length === 0, inputSha256, policy: policy.version,
    contextVerified: true, contextSha256: rendererContext.contextSha256, transformations, gaps }
}
