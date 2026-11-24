import { parse } from 'acorn'
import { readNativeDocument } from './activeNativeHtml.js'
import { recruitmentProgramProfile } from './recruitmentProgramProfile.js'

// React's completed Suspense transport moves a hidden segment into its pending
// boundary. This complete executable profile was reviewed from current public
// HTML; arbitrary scripts and Flight strings never authorize a segment.
const runtimeProfile = 'e50f8a2ba53408df525b47393d6a7757d19e0032d71f17d7711e27100eaad9dd'
const classicScript = node => node.tag === 'script' && node.sourceNamespace === 'html'
  && Number.isInteger(node.sourceEnd)
  && !node.attrs.src && !Object.hasOwn(node.attrs, 'nomodule')
  && /^(?:|(?:text|application)\/(?:java|ecma)script)$/i.test(node.attrs.type || '')
const completion = statement => {
  const call = statement.type === 'ExpressionStatement' && statement.expression
  if (call?.type !== 'CallExpression' || call.optional || call.callee.type !== 'Identifier' || call.callee.name !== '$RC'
    || call.arguments.length !== 2 || !call.arguments.every(argument => argument.type === 'Literal' && typeof argument.value === 'string')) return null
  const [boundary, segment] = call.arguments.map(argument => argument.value)
  return /^B:[a-z\d]{1,40}$/i.test(boundary) && /^S:[a-z\d]{1,40}$/i.test(segment) ? { boundary, segment } : null
}
const nativeCompletions = document => {
  const calls = []
  let ready = false
  for (const script of document.nodes(classicScript)) {
    const source = script.raw || ''
    if (!/\$(?:RC|RV|RB)\b/.test(source)) continue
    try {
      const program = parse(source, { ecmaVersion: 'latest' })
      const initializes = program.body.length >= 3
        && recruitmentProgramProfile({ ...program, body: program.body.slice(0, 3) }, {}) === runtimeProfile
      const statements = initializes ? program.body.slice(3) : program.body
      const declared = statements.map(completion)
      if ((!initializes && !ready) || declared.some(call => !call)) { ready = false; continue }
      ready = true
      calls.push(...declared.map(call => ({ ...call, before: script.sourceStart })))
    } catch { ready = false }
  }
  return calls.length <= 16 ? calls : []
}
const indexedElements = document => {
  const elements = new Map()
  const visit = (node, ancestors = []) => {
    if (typeof node === 'string') return
    if (node.attrs.id) {
      const rows = elements.get(node.attrs.id) || []
      rows.push({ node, ancestors }); elements.set(node.attrs.id, rows)
    }
    for (const child of node.children) visit(child, [...ancestors, node])
  }
  for (const root of document.nodes(node => node.tag === 'root')) visit(root)
  return elements
}
const accessible = entry => entry.node.sourceNamespace === 'html'
  && entry.ancestors.every(node => !node.nativeTagUnqualified && !['template', 'object', 'svg', 'math'].includes(node.tag))

// Input has already passed the native attribute-boundary normalizer. Original
// response bytes stay with the caller for receipts, hashes and publisher proof.
// Support only empty pending boundaries: fallback removal and other React
// transport versions remain unqualified until their actual programs are read.
export function reconcileRecruitmentStreamedHtml(input) {
  let html = input
  if (typeof html !== 'string' || !html.includes('$RC(') || !html.includes('hidden')) return html
  const original = readNativeDocument(html, { sourceRanges: true }), originalElements = indexedElements(original)
  // Receipt order belongs to the original bytes. Earlier moves can shorten
  // the projection; their new offsets cannot make a later segment available
  // to a completion call which originally ran before that segment arrived.
  const calls = nativeCompletions(original).filter(call => {
    const targets = originalElements.get(call.boundary), sources = originalElements.get(call.segment)
    return targets?.length === 1 && sources?.length === 1
      && targets[0].node.sourceEnd <= call.before && sources[0].node.sourceEnd <= call.before
  })
  for (const call of calls) {
    const elements = indexedElements(readNativeDocument(html, { sourceRanges: true }))
    const targets = elements.get(call.boundary), sources = elements.get(call.segment)
    if (targets?.length !== 1 || sources?.length !== 1) continue
    const target = targets[0], source = sources[0], template = target.node, segment = source.node
    if (!accessible(target) || !accessible(source) || template.tag !== 'template' || segment.tag !== 'div'
      || Object.keys(template.attrs).some(key => key !== 'id')
      || !Object.hasOwn(segment.attrs, 'hidden') || Object.keys(segment.attrs).some(key => !['id', 'hidden'].includes(key))
      || !Number.isInteger(template.sourceEnd) || !Number.isInteger(segment.sourceEnd)) continue
    const opening = /<!--\$\?-->\s*$/.exec(html.slice(0, template.sourceStart))
    const closing = /^\s*<!--\/\$-->/.exec(html.slice(template.sourceEnd))
    if (!opening || !closing || html.slice(template.sourceOpenEnd, template.sourceCloseStart).trim()) continue
    const start = opening.index, end = template.sourceEnd + closing[0].length
    if (segment.sourceStart < end && segment.sourceEnd > start) continue
    const edits = [{ start, end, replacement: html.slice(segment.sourceOpenEnd, segment.sourceCloseStart) },
      { start: segment.sourceStart, end: segment.sourceEnd, replacement: '' }].sort((a, b) => b.start - a.start)
    for (const edit of edits) html = html.slice(0, edit.start) + edit.replacement + html.slice(edit.end)
  }
  return html
}
