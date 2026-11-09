import { composeLeverDescription } from '../utils/leverDescription.js'
import { selectGreenhouseLocation } from '../utils/greenhouseLocations.js'
import { selectLeverLocation, selectLeverCountry } from '../utils/leverLocations.js'
import { readEightfoldLocationScope } from './eightfoldLocations.js'

const DEFAULT_REQUEST = {
  method: 'GET',
  headers: {},
  query: {},
  body: null,
}

const DEFAULT_DETAIL = {
  enabled: false,
  required: false,
  method: 'GET',
  headers: {},
  body: null,
  mapping: {},
}

const DEFAULT_RESULT_FILTER = {
  include: [],
  exclude: [],
}

export const getValueAtPath = (value, path) => {
  if (!path) return value ?? null

  return String(path)
    .split('.')
    .reduce((current, key) => (current == null ? null : current[key]), value) ?? null
}

const applyValueMap = (value, valueMap) => {
  if (value == null || !valueMap || typeof valueMap !== 'object' || Array.isArray(valueMap)) {
    return value ?? null
  }

  const key = String(value)
  return Object.prototype.hasOwnProperty.call(valueMap, key)
    ? valueMap[key]
    : value
}

export const expandTemplate = (template, values = {}) =>
  String(template).replace(/\{\{(\w+)\}\}/g, (_match, token) => values[token] ?? '')

export const getMappedFieldValue = (payload, selector) => {
  if (!selector) return null
  if (Array.isArray(selector)) {
    for (const candidate of selector) {
      const value = getMappedFieldValue(payload, candidate)
      if (value != null && value !== '') return value
    }
    return null
  }
  if (typeof selector === 'string') return getValueAtPath(payload, selector)
  if (typeof selector !== 'object' || Array.isArray(selector)) return null
  if (selector.strategy === 'lever-description') return composeLeverDescription(payload)
  if (selector.strategy === 'lever-location') return selectLeverLocation(payload)
  if (selector.strategy === 'lever-country') return selectLeverCountry(payload)
  if (selector.strategy === 'greenhouse-location') return selectGreenhouseLocation(payload)
  if (selector.strategy === 'eightfold-location') return readEightfoldLocationScope(payload).location
  if (selector.strategy === 'eightfold-country') return readEightfoldLocationScope(payload).country
  if (selector.strategy === 'suffix') {
    const value = getMappedFieldValue(payload, selector.value)
    const normalized = value == null ? null : String(value).trim()
    if (!normalized) return null

    const suffix = (
      selector.singularSuffix
      && /^1(?:\.0+)?$/u.test(normalized)
    )
      ? selector.singularSuffix
      : (selector.suffix ?? '')

    return `${normalized}${suffix}`
  }
  if (selector.strategy === 'template') {
    const values = Object.fromEntries(
      Object.entries(selector.values || {}).map(([token, tokenSelector]) => ([
        token,
        getMappedFieldValue(payload, tokenSelector),
      ])),
    )

    return expandTemplate(selector.template, values)
  }

  const source = selector.path ? getValueAtPath(payload, selector.path) : payload
  if (source == null) return null

  let value = source
  if (selector.find) {
    if (!Array.isArray(source)) return null

    const matched = source.find((item) => (
      getValueAtPath(item, selector.find.key || 'name') === selector.find.value
    ))

    if (matched == null) return null
    value = selector.valuePath ? getValueAtPath(matched, selector.valuePath) : matched
  } else if (selector.valuePath) {
    value = getValueAtPath(source, selector.valuePath)
  }

  return applyValueMap(value, selector.valueMap)
}

export const normalizeApiPortalConfig = (config = {}) => ({
  discovery: config.discovery || {},
  request: { ...DEFAULT_REQUEST, ...(config.request || {}) },
  pagination: config.pagination || {},
  mapping: config.mapping || {},
  detail: { ...DEFAULT_DETAIL, ...(config.detail || {}) },
  recordFilter: config.recordFilter || null,
  resultFilter: { ...DEFAULT_RESULT_FILTER, ...(config.resultFilter || {}) },
  inventoryValidation: config.inventoryValidation || null,
  rateLimit: config.rateLimit || null,
})
