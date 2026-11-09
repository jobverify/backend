import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import baseAliases from './companyAliases.json' with { type: 'json' }

const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const DEFAULT_COMPANY_ALIAS_EXTENSION_DIR = path.join(currentDir, 'companyAliasExtensions')

export const loadCompanyAliasExtensions = (extensionDir = DEFAULT_COMPANY_ALIAS_EXTENSION_DIR) => {
  if (!existsSync(extensionDir)) return {}

  return readdirSync(extensionDir)
    .filter((fileName) => fileName.toLowerCase().endsWith('.json'))
    .sort((left, right) => left.localeCompare(right))
    .reduce((aliasMap, fileName) => {
      const filePath = path.join(extensionDir, fileName)
      const parsed = JSON.parse(readFileSync(filePath, 'utf8'))

      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        Object.assign(aliasMap, parsed)
      }

      return aliasMap
    }, {})
}

export const getCompanyAliasMap = ({
  baseAliasMap = baseAliases,
  extensionDir = DEFAULT_COMPANY_ALIAS_EXTENSION_DIR,
} = {}) => ({
  ...baseAliasMap,
  ...loadCompanyAliasExtensions(extensionDir),
})

const aliases = getCompanyAliasMap()

const NOISE_PATTERNS = [
  /\bcompanies listed\b/i,
  /\blocation fragment\b/i,
  /\bui text\b/i,
  /\bdescription\b/i,
  /\bcategory label\b/i,
  /^catalog$/i,
  /^extra company$/i,
  /^global business consulting for a dynamic world$/i,
  /^software development\s*\/\s*product development$/i,
  /^sriperumbuudur,\s*kanchipuram,\s*tamil nadu$/i,
  /^teaching assistant\s*-\s*amrita mysore campus$/i,
  /^transform your learnings into earnings$/i,
  /^vehicles for a better future$/i,
  /^european summer of code$/i,
  /^ev vehicles$/i,
  /^re$/i,
  /^sfgds$/i,
  /^\s*(pune|maharashtra|bengaluru|bangalore|hyderabad|chennai|mumbai|gurgaon|gurugram|noida|delhi|coimbatore)\b/i,
  /^https?:\/\//i,
]

const COMPANY_SUFFIX_PATTERN = /\b(private|pvt|ltd|limited|inc|llc|corp|corporation|co|company|group|holdings|global|india|technologies|technology|tech|solutions|systems|services|labs|lab|networks|software)\b/gi

const normalizeLookupKey = (value) =>
  String(value || '')
    .replace(/&/g, ' and ')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

export const normalizeCompanyNameExact = (value) => normalizeLookupKey(value)

export const normalizeCompanyName = (value) =>
  normalizeLookupKey(value)
    .replace(COMPANY_SUFFIX_PATTERN, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export const isNoiseCompanyRow = (row = {}) => {
  const haystack = [row.companyName, row.note].filter(Boolean).join(' ')
  return NOISE_PATTERNS.some((pattern) => pattern.test(haystack))
}

const parseCsvLine = (line) => {
  const columns = []
  let current = ''
  let insideQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"') {
      if (insideQuotes && line[index + 1] === '"') {
        current += '"'
        index += 1
      } else {
        insideQuotes = !insideQuotes
      }
    } else if (char === ',' && !insideQuotes) {
      columns.push(current)
      current = ''
    } else {
      current += char
    }
  }

  columns.push(current)
  return columns
}

export const parseCompanyCsv = (csvText) =>
  {
    const lines = String(csvText || '')
      .trim()
      .split(/\r?\n/)

    if (lines.length === 0) return []

    const [firstLine, ...remainingLines] = lines
    const [firstColumn, secondColumn] = parseCsvLine(firstLine).map((value) =>
      String(value || '').trim().toLowerCase(),
    )
    const hasStructuredHeader =
      firstColumn === 'row'
      && ['company_name', 'companyname', 'company name'].includes(secondColumn)
    const hasSingleColumnHeader =
      ['company_name', 'companyname', 'company name'].includes(firstColumn)
      && !secondColumn
    const dataLines = hasStructuredHeader || hasSingleColumnHeader ? remainingLines : lines

    return dataLines.map((line, index) => {
      const columns = parseCsvLine(line)

      if (hasStructuredHeader) {
        const [row, companyName, urlInText, note] = columns
        return {
          row,
          companyName: companyName?.trim() || '',
          urlInText: urlInText?.trim() || '',
          note: note?.trim() || '',
        }
      }

      const companyName = columns
        .map((value) => String(value || '').trim())
        .filter(Boolean)
        .join(', ')

      return {
        row: String(index + 1),
        companyName,
        urlInText: '',
        note: '',
      }
    })
  }

export const buildCompanyLookup = ({ catalog, aliasMap = aliases }) => {
  const exactLookup = new Map()
  const fuzzyLookup = new Map()
  const combinedLookup = new Map()

  const registerLookup = (lookup, key, source) => {
    if (!key) return
    lookup.set(key, source)
    combinedLookup.set(key, source)
  }

  for (const provider of catalog) {
    const candidates = [
      provider.source,
      provider.companyName,
      provider.companyCareerPage,
    ]

    for (const candidate of candidates) {
      const exactNormalized = normalizeCompanyNameExact(candidate)
      if (exactNormalized) {
        registerLookup(exactLookup, exactNormalized, provider.source)
      }

      if (!provider.exactCompanyMatchOnly) {
        const fuzzyNormalized = normalizeCompanyName(candidate)
        if (fuzzyNormalized) {
          registerLookup(fuzzyLookup, fuzzyNormalized, provider.source)
        }
      }
    }
  }

  for (const [alias, source] of Object.entries(aliasMap)) {
    const exactNormalized = normalizeCompanyNameExact(alias)
    if (exactNormalized) {
      registerLookup(exactLookup, exactNormalized, source)
    }

    const fuzzyNormalized = normalizeCompanyName(alias)
    if (fuzzyNormalized) {
      registerLookup(fuzzyLookup, fuzzyNormalized, source)
    }
  }

  combinedLookup.exactLookup = exactLookup
  combinedLookup.fuzzyLookup = fuzzyLookup

  return combinedLookup
}

export const generateCompanyCoverageReport = ({
  csvText,
  catalog,
  aliasMap = aliases,
} = {}) => {
  const rows = parseCompanyCsv(csvText)
  const { exactLookup, fuzzyLookup } = buildCompanyLookup({ catalog, aliasMap })
  const providersBySource = new Map(catalog.map((provider) => [provider.source, provider]))

  const matched = []
  const unmatched = []

  for (const row of rows) {
    if (!row.companyName || isNoiseCompanyRow(row)) continue

    const exactNormalizedCompanyName = normalizeCompanyNameExact(row.companyName)
    const normalizedCompanyName = normalizeCompanyName(row.companyName)
    if (!exactNormalizedCompanyName || !normalizedCompanyName) continue

    const exactSource = exactLookup.get(exactNormalizedCompanyName)
    const fuzzySource = fuzzyLookup.get(normalizedCompanyName)
    const source = exactSource || fuzzySource
    const provider = providersBySource.get(source)
    const requiresExactSourceMatch = provider?.exactCompanyMatchOnly && !exactSource
    if (!source || requiresExactSourceMatch) {
      unmatched.push({
        row: row.row,
        companyName: row.companyName,
        normalizedCompanyName,
      })
      continue
    }

    matched.push({
      row: row.row,
      companyName: row.companyName,
      normalizedCompanyName,
      source,
      provider: provider || null,
    })
  }

  return {
    totalRows: rows.length,
    coverageLabel: 'Catalog registration coverage',
    candidateRows: matched.length + unmatched.length,
    matchedCount: matched.length,
    unmatchedCount: unmatched.length,
    matched,
    unmatched,
  }
}
