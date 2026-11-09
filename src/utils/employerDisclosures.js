// Employer taxonomy and address are disclosures, not numeric experience or
// geographic identity. Keep them outside description/classifier inputs.
const optionalText = value => typeof value === 'string' ? value.trim() || null : null

export const normalizeEmployerDisclosures = (job = {}) => ({
  employerExperienceLevel: optionalText(job.employerExperienceLevel),
  employerStreetAddress: optionalText(job.employerStreetAddress),
})

// Call only on the final public DTO, after classification. Source descriptions
// and geographic/experience inputs must never include these display lines.
// Description consumers render plain/markdown text; do not introduce HTML.
export const withEmployerDisclosures = job => {
  if (!job || typeof job !== 'object' || Array.isArray(job)) return job
  const facts = normalizeEmployerDisclosures(job)
  const result = {...job}
  for (const [key, value] of Object.entries(facts)) {
    if (Object.hasOwn(job, key)) result[key] = value
  }
  if (typeof job.description !== 'string' || !job.description.trim()) return result
  const existingLines = new Set(job.description.split(/\r?\n/))
  const additions = [
    ['Employer role classification', facts.employerExperienceLevel],
    ['Employer work address', facts.employerStreetAddress],
  ].filter(([, value]) => value !== null)
    .map(([label, value]) => `${label}: ${value.replace(/\s+/g, ' ')}`)
    .filter(line => !existingLines.has(line))
  if (additions.length) result.description = job.description + '\n\n' + additions.join('\n\n')
  return result
}
