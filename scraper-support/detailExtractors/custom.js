import { collectListItems, collectSkills, firstMatch, joinItems, toPlainText } from './shared.js'

const decodeHtmlEntities = (value = '') => String(value)
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&#43;/gi, '+')

const normalizeText = (value = '') => decodeHtmlEntities(toPlainText(value))
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const extractTextSection = (text, startPatterns, stopPatterns) => {
  const source = normalizeText(text)
  if (!source) return null

  for (const startPattern of startPatterns) {
    const startMatch = startPattern.exec(source)
    if (!startMatch) continue

    const tail = source.slice(startMatch.index + startMatch[0].length).trim()
    if (!tail) continue

    let endIndex = tail.length
    for (const stopPattern of stopPatterns) {
      const stopMatch = stopPattern.exec(tail)
      if (stopMatch && stopMatch.index < endIndex) {
        endIndex = stopMatch.index
      }
    }

    const section = tail.slice(0, endIndex).trim()
    if (section) return section
  }

  return null
}

const extractExperiencePhrase = (text = '') =>
  normalizeText(text).match(/\b\d+(?:\s*-\s*\d+)?(?:\+)?\s*years?\b[^.;]*/i)?.[0] || null

export const extractGoogleJobDetail = (html = '') => {
  const description = firstMatch(html, [
    /Responsibilities[\s\S]*?<div[^>]*>([\s\S]*?)<\/div>/i,
    /About the job[\s\S]*?<div[^>]*>([\s\S]*?)<\/div>/i,
  ])
  const minimumItems = collectListItems(html, [/Minimum qualifications[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/i])
  const preferredItems = collectListItems(html, [/Preferred qualifications[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/i])
  const experienceRequired =
    [...minimumItems, ...preferredItems].find((item) => /\byears?\b/i.test(item)) || null
  const hasPublicDetailEvidence = Boolean(description || minimumItems.length > 0 || preferredItems.length > 0)

  return {
    jobDescription: description,
    minimumQualification: joinItems(minimumItems),
    preferredQualification: joinItems(preferredItems),
    requiredSkills: collectSkills([...minimumItems, ...preferredItems]),
    experienceRequired,
    publicExperienceChecked: hasPublicDetailEvidence,
    department: null,
  }
}

export const extractRubrikJobDetail = (html = '') => {
  const description = firstMatch(html, [
    /What you'll do[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/i,
    /About the role[\s\S]*?<div[^>]*>([\s\S]*?)<\/div>/i,
  ]) || extractTextSection(
    html,
    [
      /\bWhat you(?:'|’)?ll do\b\s*:?\s*/i,
      /\bAbout the role\b\s*:?\s*/i,
    ],
    [
      /\bExperience you(?:'|’)?ll need\b\s*:?\s*/i,
      /\bRequirements\b\s*:?\s*/i,
      /\bQualifications\b\s*:?\s*/i,
      /\bJoin Us in Securing\b/i,
      /\bApply For This Job\b/i,
    ],
  )
  const minimumItems = collectListItems(html, [
    /Requirements[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/i,
    /Qualifications[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/i,
  ])
  const joinedMinimumQualification = joinItems(minimumItems) || extractTextSection(
    html,
    [
      /\bExperience you(?:'|’)?ll need\b\s*:?\s*/i,
      /\bRequirements\b\s*:?\s*/i,
      /\bQualifications\b\s*:?\s*/i,
    ],
    [
      /\bJoin Us in Securing\b/i,
      /\bInclusion @ Rubrik\b/i,
      /\bApply For This Job\b/i,
      /\bEEO IS THE LAW\b/i,
    ],
  )
  const experienceRequired =
    minimumItems.find((item) => /\byears?\b/i.test(item))
    || extractExperiencePhrase(joinedMinimumQualification)
    || null
  const hasPublicDetailEvidence = Boolean(description || joinedMinimumQualification || minimumItems.length > 0)

  return {
    jobDescription: description || joinedMinimumQualification,
    minimumQualification: joinedMinimumQualification,
    preferredQualification: null,
    requiredSkills: collectSkills(minimumItems),
    experienceRequired,
    publicExperienceChecked: hasPublicDetailEvidence,
    department: null,
  }
}
