import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'

const sourceText = (...values) => values.find(value => typeof value === 'string'
  && hasSourceDescription({ jobDescription: value }))?.trim() || null

// Lever publishes the introduction, responsibility/qualification lists and
// closing employer text separately. Preserve those sections, choosing one
// native variant of each rather than repeating the plain and HTML versions.
export const composeLeverDescription = (record = {}) => [
  sourceText(record.descriptionPlain, record.description, record.descriptionBodyPlain),
  ...(Array.isArray(record.lists) ? record.lists : []).map(section => {
    const content = sourceText(section?.content)
    return content ? [sourceText(section?.text), content].filter(Boolean).join('\n') : null
  }),
  sourceText(record.additionalPlain, record.additional),
].filter(Boolean).join('\n\n') || null
