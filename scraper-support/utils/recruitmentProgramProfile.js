import { createHash } from 'node:crypto'

// Preserve the complete executable AST. Only one separately validated native
// account literal is variable; formatting, comments and quote spelling are not
// executable differences. All other values and control/data flow remain exact.
export function recruitmentProgramProfile(program, nativeAccountLiteral) {
  const normalize = value => {
    if (value === nativeAccountLiteral) return { type: 'Literal', value: '<current-native-board>' }
    if (typeof value === 'number' && (!Number.isFinite(value) || Object.is(value, -0))) {
      return { numericLiteralValue: Object.is(value, -0) ? '-0' : String(value) }
    }
    if (Array.isArray(value)) return value.map(normalize)
    if (!value || typeof value !== 'object') return value
    return Object.fromEntries(Object.keys(value).sort()
      .filter(key => !['start', 'end', 'loc', 'range', 'raw'].includes(key))
      .map(key => [key, normalize(value[key])]))
  }
  return createHash('sha256').update(JSON.stringify(normalize(program))).digest('hex')
}
