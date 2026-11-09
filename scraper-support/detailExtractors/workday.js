import { collectListItems, collectSkills, firstMatch, joinItems } from './shared.js'
import { extractJobFilterSignals } from '../../src/utils/jobFilterSignals.js'

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const normalizeExperienceUnit = (value = '') => {
  const normalized = String(value).toLowerCase()
  if (/^yrs?$/.test(normalized) || /^years?$/.test(normalized)) return 'years'
  if (/^months?$/.test(normalized)) return 'months'
  return normalized
}

const formatExperienceValue = (value) => {
  const numericValue = Number.parseFloat(value)
  if (!Number.isFinite(numericValue)) return null
  return Number.isInteger(numericValue)
    ? String(numericValue)
    : String(numericValue).replace(/(?:\.0+|(\.\d*?)0+)$/, '$1')
}

const formatExperienceRequirement = (value, unit, { openEnded = false } = {}) => {
  const normalizedValue = formatExperienceValue(value)
  if (!normalizedValue) return null

  const normalizedUnit = normalizeExperienceUnit(unit)
  const singularUnit = normalizedUnit === 'months' ? 'month' : 'year'
  const pluralUnit = normalizedUnit === 'months' ? 'months' : 'years'

  return `${normalizedValue}${openEnded ? '+' : ''} ${
    normalizedValue === '1' && !openEnded ? singularUnit : pluralUnit
  }`
}

const WORKDAY_JSON_LD_STOP_LABELS = [
  'Basic Qualifications',
  'Minimum Qualifications',
  'Required Qualifications',
  'Preferred Qualifications',
  'Desired Qualifications',
  'Qualifications',
  'Inside this Business Group',
  'Business group',
  'Posting Statement',
  'Primary Location',
  'Work Model for this Role',
]

const parseWorkdayJsonLd = (html = '') => {
  const scripts = [...String(html).matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )]

  for (const [, payload] of scripts) {
    try {
      const data = JSON.parse(payload)
      const records = Array.isArray(data) ? data : [data]
      const jobPosting = records.find((record) => {
        const type = Array.isArray(record?.['@type']) ? record['@type'] : [record?.['@type']]
        return type.filter(Boolean).some((value) => /jobposting/i.test(String(value)))
      })

      if (jobPosting) {
        return jobPosting
      }
    } catch {
      continue
    }
  }

  return null
}

const extractLabeledSection = (text, labels, stopLabels = []) => {
  const source = String(text || '').trim()
  if (!source) return null

  for (const label of labels) {
    const pattern = new RegExp(`${escapeRegex(label)}\\s*:`, 'i')
    const match = pattern.exec(source)
    if (!match) continue

    const start = match.index + match[0].length
    const tail = source.slice(start).trim()
    if (!tail) return null

    let end = tail.length
    for (const stopLabel of stopLabels) {
      if (String(stopLabel).toLowerCase() === String(label).toLowerCase()) continue
      const stopPattern = new RegExp(`\\b${escapeRegex(stopLabel)}\\s*:`, 'i')
      const stopMatch = stopPattern.exec(tail)
      if (stopMatch && stopMatch.index < end) {
        end = stopMatch.index
      }
    }

    const section = tail.slice(0, end).trim()
    if (section) return section
  }

  return null
}

const looksLikeRangeTail = (text, matchIndex) => {
  const prefix = String(text ?? '').slice(Math.max(0, matchIndex - 24), matchIndex)
  return /(?:\d+(?:\.\d+)?|\bone|\btwo|\bthree|\bfour|\bfive|\bsix|\bseven|\beight|\bnine|\bten|\beleven|\btwelve)\s*(?:-|–|—|~|to|and)\s*$/i.test(prefix)
}

const extractExperience = (...values) => {
  const combinedText = values
    .filter(Boolean)
    .map((value) => String(value).trim())
    .filter(Boolean)
    .join(' ')

  if (!combinedText) return null

  const workdaySpecificPatterns = [
    /\b(?:desired|required|preferred|minimum|relevant)\s+experience\b\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*(\+|plus)?\s*(months?|years?|yrs?)\b/i,
    /\b(\d+(?:\.\d+)?)\s*(\+|plus)?\s*(months?|years?|yrs?)\s+of\s+(?:demonstrated|relevant|required|hands[- ]on|professional|working|industry|strategic|management|leadership)?\s*experience\b/i,
  ]

  for (const pattern of workdaySpecificPatterns) {
    const match = pattern.exec(combinedText)
    if (!match) continue
    if (looksLikeRangeTail(combinedText, match.index)) continue

    const [, value, plusMarker, unit] = match
    return formatExperienceRequirement(value, unit, { openEnded: Boolean(plusMarker) })
  }

  const { experienceProfile } = extractJobFilterSignals({
    description: combinedText,
  })

  return experienceProfile?.confidence === 'high'
    ? experienceProfile.evidence || null
    : null
}

export const extractWorkdayJobDetail = (html = '') => {
  const jsonLd = parseWorkdayJsonLd(html)
  const jsonLdDescription = String(jsonLd?.description || '').trim()

  const description = firstMatch(html, [
    /data-automation-id="jobPostingDescription"[\s\S]*?<div[^>]*>([\s\S]*?)<\/div>/i,
    /data-automation-id="jobPostingDescription"[\s\S]*?>([\s\S]*?)<\/section>/i,
  ]) || extractLabeledSection(
    jsonLdDescription,
    ['Job Description'],
    WORKDAY_JSON_LD_STOP_LABELS,
  ) || jsonLdDescription || null

  const minimumItems = collectListItems(html, [
    /Basic Qualifications[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/i,
    /Minimum Qualifications[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/i,
  ])

  const preferredItems = collectListItems(html, [
    /Preferred Qualifications[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/i,
    /Desired Qualifications[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/i,
  ])

  const department = firstMatch(html, [
    /<dt[^>]*>\s*Department\s*<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/i,
    /<dt[^>]*>\s*Job Family\s*<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/i,
  ])

  const requisitionId = firstMatch(html, [
    /<dt[^>]*>\s*Job Requisition ID\s*<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/i,
    /<dt[^>]*>\s*Requisition ID\s*<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/i,
  ]) || jsonLd?.identifier?.value || null

  const postingDate = firstMatch(html, [
    /data-automation-id="postedOn"[\s\S]*?<dd[^>]*>([\s\S]*?)<\/dd>/i,
    /<dt[^>]*>\s*posted on\s*<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/i,
    /<dt[^>]*>\s*date posted\s*<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/i,
  ]) || String(jsonLd?.datePosted || '').trim() || null

  const minimumQualification = joinItems(minimumItems) || extractLabeledSection(
    jsonLdDescription,
    ['Basic Qualifications', 'Minimum Qualifications', 'Required Qualifications', 'Qualifications'],
    [
      'Preferred Qualifications',
      'Desired Qualifications',
      'Inside this Business Group',
      'Business group',
      'Posting Statement',
      'Primary Location',
      'Work Model for this Role',
    ],
  )

  const preferredQualification = joinItems(preferredItems) || extractLabeledSection(
    jsonLdDescription,
    ['Preferred Qualifications', 'Desired Qualifications'],
    [
      'Inside this Business Group',
      'Business group',
      'Posting Statement',
      'Primary Location',
      'Work Model for this Role',
    ],
  )

  const requiredSkills = collectSkills(
    [...minimumItems, ...preferredItems].filter((item) => !/\byears?\b/i.test(item)),
  )
  const experienceRequired =
    [...minimumItems, ...preferredItems].find((item) => /\byears?\b/i.test(item))
    || extractExperience(minimumQualification, preferredQualification, description, jsonLdDescription)
  const hasPublicDetailEvidence = Boolean(
    description
    || minimumQualification
    || preferredQualification
    || requiredSkills.length > 0,
  )

  return {
    jobDescription: description,
    minimumQualification,
    preferredQualification,
    requiredSkills,
    experienceRequired,
    postingDate,
    department,
    requisitionId,
    publicExperienceChecked: hasPublicDetailEvidence,
  }
}
