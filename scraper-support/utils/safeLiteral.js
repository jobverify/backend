export class JavaScriptLiteralParseError extends Error {
  constructor(message, index) {
    super(`${message} at offset ${index}`)
    this.name = 'JavaScriptLiteralParseError'
  }
}

const isWhitespace = (char) => /\s/u.test(char)
const isIdentifierStart = (char) => /[A-Za-z_$]/u.test(char)
const isIdentifierPart = (char) => /[A-Za-z0-9_$]/u.test(char)
const isNumberStart = (char) => char === '-' || /[0-9]/u.test(char)

class LiteralParser {
  constructor(source) {
    this.source = String(source ?? '')
    this.index = 0
  }

  error(message) {
    return new JavaScriptLiteralParseError(message, this.index)
  }

  eof() {
    return this.index >= this.source.length
  }

  peek() {
    return this.source[this.index]
  }

  read() {
    const char = this.source[this.index]
    this.index += 1
    return char
  }

  skipWhitespace() {
    while (!this.eof() && isWhitespace(this.peek())) {
      this.index += 1
    }
  }

  expect(expected) {
    if (this.read() !== expected) {
      throw this.error(`Expected ${expected}`)
    }
  }

  parse() {
    const value = this.parseValue()
    this.skipWhitespace()
    if (!this.eof()) {
      throw this.error('Unsupported executable JavaScript literal syntax')
    }
    return value
  }

  parseValue() {
    this.skipWhitespace()
    if (this.eof()) throw this.error('Expected literal value')

    const char = this.peek()
    if (char === '[') return this.parseArray()
    if (char === '{') return this.parseObject()
    if (char === '!' && /^[!]([01])(?=$|[\s,}\]])/u.test(this.source.slice(this.index))) {
      this.index += 2
      return this.source[this.index - 1] === '0'
    }
    if (char === '"' || char === "'" || char === '`') return this.parseString()
    if (isNumberStart(char)) return this.parseNumber()
    if (isIdentifierStart(char)) return this.parseKeyword()

    throw this.error('Unsupported executable JavaScript literal syntax')
  }

  parseArray() {
    const items = []
    this.expect('[')
    this.skipWhitespace()

    if (this.peek() === ']') {
      this.read()
      return items
    }

    while (!this.eof()) {
      items.push(this.parseValue())
      this.skipWhitespace()

      if (this.peek() === ',') {
        this.read()
        this.skipWhitespace()
        if (this.peek() === ']') {
          this.read()
          return items
        }
        continue
      }

      if (this.peek() === ']') {
        this.read()
        return items
      }

      throw this.error('Expected comma or closing bracket')
    }

    throw this.error('Unterminated array literal')
  }

  parseObject() {
    const object = Object.create(null)
    this.expect('{')
    this.skipWhitespace()

    if (this.peek() === '}') {
      this.read()
      return object
    }

    while (!this.eof()) {
      const key = this.parseObjectKey()
      this.skipWhitespace()
      this.expect(':')
      object[key] = this.parseValue()
      this.skipWhitespace()

      if (this.peek() === ',') {
        this.read()
        this.skipWhitespace()
        if (this.peek() === '}') {
          this.read()
          return object
        }
        continue
      }

      if (this.peek() === '}') {
        this.read()
        return object
      }

      throw this.error('Expected comma or closing brace')
    }

    throw this.error('Unterminated object literal')
  }

  parseObjectKey() {
    this.skipWhitespace()
    const char = this.peek()

    if (char === '"' || char === "'" || char === '`') {
      return this.parseString()
    }

    if (!isIdentifierStart(char)) {
      throw this.error('Expected object literal key')
    }

    return this.parseIdentifier()
  }

  parseString() {
    const quote = this.read()
    let result = ''

    while (!this.eof()) {
      const char = this.read()

      if (char === quote) {
        return result
      }

      if (quote === '`' && char === '$' && this.peek() === '{') {
        throw this.error('Template interpolation is not allowed in literals')
      }

      if (char === '\\') {
        result += this.parseEscape()
        continue
      }

      if (quote !== '`' && (char === '\n' || char === '\r')) {
        throw this.error('Unterminated string literal')
      }

      result += char
    }

    throw this.error('Unterminated string literal')
  }

  parseEscape() {
    if (this.eof()) throw this.error('Unterminated escape sequence')
    const char = this.read()

    if (char === '\n') return ''
    if (char === '\r') {
      if (this.peek() === '\n') this.read()
      return ''
    }

    switch (char) {
      case '0':
        return '\0'
      case 'b':
        return '\b'
      case 'f':
        return '\f'
      case 'n':
        return '\n'
      case 'r':
        return '\r'
      case 't':
        return '\t'
      case 'v':
        return '\v'
      case 'x':
        return String.fromCharCode(this.readHexCodePoint(2))
      case 'u':
        return this.parseUnicodeEscape()
      default:
        return char
    }
  }

  parseUnicodeEscape() {
    if (this.peek() !== '{') {
      return String.fromCharCode(this.readHexCodePoint(4))
    }

    this.read()
    let hex = ''
    while (!this.eof() && this.peek() !== '}') {
      const char = this.read()
      if (!/[0-9a-f]/iu.test(char)) {
        throw this.error('Invalid unicode escape')
      }
      hex += char
    }

    this.expect('}')
    const codePoint = Number.parseInt(hex, 16)
    if (!hex || !Number.isInteger(codePoint) || codePoint > 0x10ffff) {
      throw this.error('Invalid unicode escape')
    }
    return String.fromCodePoint(codePoint)
  }

  readHexCodePoint(length) {
    const hex = this.source.slice(this.index, this.index + length)
    if (hex.length !== length || !/^[0-9a-f]+$/iu.test(hex)) {
      throw this.error('Invalid hexadecimal escape')
    }
    this.index += length
    return Number.parseInt(hex, 16)
  }

  parseNumber() {
    const rest = this.source.slice(this.index)
    const match = rest.match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/u)
    if (!match) throw this.error('Invalid number literal')

    this.index += match[0].length
    return Number(match[0])
  }

  parseIdentifier() {
    if (!isIdentifierStart(this.peek())) {
      throw this.error('Expected identifier')
    }

    const start = this.index
    this.read()
    while (!this.eof() && isIdentifierPart(this.peek())) {
      this.read()
    }
    return this.source.slice(start, this.index)
  }

  parseKeyword() {
    const identifier = this.parseIdentifier()
    if (identifier === 'true') return true
    if (identifier === 'false') return false
    if (identifier === 'null') return null

    throw this.error(`Unsupported identifier ${identifier}`)
  }
}

export const parseJavaScriptLiteral = (source) => new LiteralParser(source).parse()

export const decodeJavaScriptStringLiteral = (literal) => {
  const parser = new LiteralParser(literal)
  parser.skipWhitespace()
  const value = parser.parseString()
  parser.skipWhitespace()
  if (!parser.eof()) {
    throw parser.error('Unsupported data after string literal')
  }
  return value
}
