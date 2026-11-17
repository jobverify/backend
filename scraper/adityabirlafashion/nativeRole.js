import { parse } from 'acorn'
import { document } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { nativeCountryName } from '../../scraper-support/shared/nativeJobPosting.js'
import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'
import { projectBirlaCriteria } from './nativeCriteria.js'

const ORIGIN = 'https://careers.adityabirla.com'
const proof = (condition, message) => { if (!condition) throw new Error('Aditya Birla Fashion native: ' + message) }
const norm = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''

export function publicPayloads(html) {
  const doc = document(html), payloads = []
  for (const node of doc.nodes(node => node.tag === 'script' && !node.attrs.src)) {
    let program
    try { program = parse(node.raw || '', { ecmaVersion: 'latest' }) } catch { continue }
    for (const statement of program.body) {
      const call = statement.type === 'ExpressionStatement' ? statement.expression : null
      const member = call?.type === 'CallExpression' ? call.callee : null
      if (member?.type !== 'MemberExpression' || member.computed || member.property.name !== 'push'
        || member.object?.type !== 'MemberExpression' || member.object.computed || member.object.property.name !== '__next_f'
        || member.object.object?.name !== 'self') continue
      const value = call.arguments[0]
      if (call.arguments.length === 1 && value?.type === 'ArrayExpression' && value.elements.length === 2
        && value.elements[0]?.value === 1 && value.elements[1]?.type === 'Literal' && typeof value.elements[1].value === 'string') payloads.push(value.elements[1].value)
    }
  }
  return payloads
}


export function mapBirlaRole(row, { rendererContext } = {}) {
  proof(Number.isSafeInteger(row.id) && row.id > 0 && /^ABG\d+$/.test(row.jobCode || '') && norm(row.jobTitle), 'invalid native role identity')
  proof(norm(row.organizationUnit) && norm(row.organizationUnitComplete), 'native group organisation hierarchy absent')
  const apply = new URL(row.jobDetailUrl)
  proof(apply.origin === 'https://abgcareers.peoplestrong.com' && apply.pathname === '/job/detail/' + row.jobCode && !apply.search && !apply.hash, 'native role application identity changed')
  const hierarchy = norm(row.locationHierarchyComplete), country = nativeCountryName(hierarchy.split('>')[0])
  const projected = projectBirlaCriteria(row.jobDescription, rendererContext)
  const { transformations, ...projection } = projected
  const transformationCounts = {}
  for (const value of transformations) transformationCounts[value.reason] = (transformationCounts[value.reason] || 0) + 1
  const skills = row.skills || []
  proof(Array.isArray(skills) && skills.every(skill => typeof skill.value === 'string' && (!skill.jobId || skill.jobId === row.id)), 'native skill identity changed')
  const mandatory = skills.filter(skill => skill.type === 'musthave').map(skill => norm(skill.value))
  const preferred = skills.filter(skill => skill.type === 'goodtohave').map(skill => norm(skill.value))
  const other = skills.filter(skill => !['musthave', 'goodtohave'].includes(skill.type)).map(skill => norm(skill.value))
  const description = [projection.text, norm(row.expRange) ? 'Experience: ' + norm(row.expRange) : null,
    mandatory.length ? 'Required skills: ' + mandatory.join('; ') : null,
    preferred.length ? 'Preferred skills: ' + preferred.join('; ') : null,
    other.length ? 'Native skills: ' + other.join('; ') : null].filter(Boolean).join('\n\n')
  const contentComplete = projection.complete && hasSourceDescription({ jobDescription: projection.text })
  proof(typeof row.jobPostedDate === 'string' && Number.isFinite(Date.parse(row.jobPostedDate)), 'native publication date missing')
  proof(row.jobClosureDate == null || /^\d{4}-\d{2}-\d{2}$/.test(row.jobClosureDate) && Number.isFinite(Date.parse(row.jobClosureDate)), 'native closure date changed')
  const sourceUrl = ORIGIN + '/job-search/job-details/' + row.jobCode
  return { source: 'adityabirlafashion', company: 'Aditya Birla Fashion', companyDomain: 'abfrl.com',
    companyCareerPage: 'https://www.abfrl.com/careers/', atsPlatform: 'official-aditya-birla-native-api', title: norm(row.jobTitle),
    jobId: row.jobCode, postingId: row.jobCode, nativeJobCode: row.jobCode, requisitionCode: norm(row.requisitionCode) || null,
    requisitionId: Number.isSafeInteger(row.requisitionId) && row.requisitionId > 0 ? String(row.requisitionId) : null,
    sourceUrl, applyUrl: sourceUrl, link: sourceUrl, nativeApplyUrl: apply.href,
    nativeRecordId: row.id, nativeOrganizationHierarchy: row.organizationUnitComplete, nativeBusiness: row.organizationUnit,
    legalEmployer: null, department: norm(row.functionalArea) || null,
    location: hierarchy.replace(/>/g, ', '), city: null, country,
    sourceCountryEvidence: country ? { field: 'locationHierarchyComplete', raw: hierarchy, country, inference: false } : null,
    postingDate: row.jobPostedDate, postedAt: row.jobPostedDate, closingDate: row.jobClosureDate || null,
    nativePublicationPrecision: 'day', sourceClosingDateIsExact: false, experienceRequired: norm(row.expRange) || null,
    employmentType: null, minimumQualification: null, preferredQualification: null, requiredSkills: mandatory,
    nativeSkills: skills, jobDescription: description, sourceDescription: description,
    sourceAdditionalCriteria: { designation: row.designation, role: row.role, minExp: row.minExp, maxExp: row.maxExp,
      organisation: row.organizationUnit, functionalArea: row.functionalArea, nativeApplicationUrl: row.jobDetailUrl },
    nativeDescriptionHtml: row.jobDescription, sourceDetailComplete: contentComplete, sourceScopeComplete: false,
    sourceNativeDescriptionProjection: { ...projection, transformationCounts },
    sourceListingComplete: false, lifecycleCleanupAllowed: false }
}

