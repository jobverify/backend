import { readNativeDocument, decodeNativeEntities, extractActiveDescription } from './activeNativeHtml.js'
import { normalizeNativeAttributeBoundaries } from './nativeHtmlAttributes.js'
import { nativeCountryName } from '../shared/nativeJobPosting.js'

const need = (value, message) => { if (!value) throw Error('Oracle recruitment: ' + message) }
const country = value => nativeCountryName(value)
const text = value => typeof value === 'string' && value.trim() ? value.trim() : null
const list = value => Array.isArray(value) ? value : []

const publicDescriptionFields = ['ExternalDescriptionStr', 'ExternalResponsibilitiesStr', 'ExternalQualificationsStr',
  'CorporateDescriptionStr', 'OrganizationDescriptionStr']

// Only the reviewed workplace template on this full native role can identify
// its employer brand. A legal employer is never inferred from that statement.
const reviewedOracleBrandEmployer = (detail, contract) => {
  if (!contract || contract.kind !== 'native-role-corporate-workplace-declaration'
    || contract.field !== 'CorporateDescriptionStr' || !text(contract.name)
    || !text(contract.heading) || !text(contract.prefix) || contract.prefix.length < 100
    || !contract.prefix.startsWith('At ' + contract.name + ', ')
    || !/\bworkplace\b/i.test(contract.prefix)) return null
  const own = detail.CorporateDescriptionStr
  if (!text(own)) return null
  const doc = readNativeDocument(normalizeNativeAttributeBoundaries(own))
  const blocked = new Set(['blockquote', 'q', 'pre', 'code', 'template', 'aside', 'object', 'iframe', 'noscript', 'script', 'style'])
  const excluded = node => node.inert || blocked.has(node.tag)
    || ['hidden', 'inert', 'disabled'].some(key => Object.hasOwn(node.attrs || {}, key))
    || node.attrs?.['aria-hidden'] === 'true' || node.attrs?.['aria-disabled'] === 'true'
  const ownText = node => typeof node === 'string' ? node : excluded(node) ? '' : node.children.map(ownText).join(' ')
  const blocks = []
  const visit = node => {
    if (typeof node === 'string' || excluded(node)) return false
    let childBlock = false
    for (const child of node.children) if (visit(child)) childBlock = true
    const block = ['p', 'div', 'li'].includes(node.tag)
    if (block && !childBlock) {
      const value = decodeNativeEntities(ownText(node)).replace(/\s+/g, ' ').trim()
      if (value) blocks.push(value)
    }
    return block || childBlock
  }
  visit(doc.nodes(node => node.tag === 'root')[0])
  const heading = contract.heading.replace(/\s+/g, ' ').trim(), prefix = contract.prefix.replace(/\s+/g, ' ').trim()
  if (blocks[0] !== heading || !blocks[1]?.startsWith(prefix)) return null
  const active = publicDescriptionFields.map(field => extractActiveDescription(detail[field]) || '').join(' ').replace(/\s+/g, ' ')
  const independent = /(?:employed|employer|employment).{0,120}(?:franchis|independent(?:ly)? (?:own|operat)|third[- ]party)|(?:franchis(?:e|ed|or)|independent(?:ly)? (?:own|operat)|third[- ]party).{0,120}(?:employed|employer|employment)/i
  const escapedName = contract.name.replace(/[.*+?^$()|[\]\\]/g, '\\$&')
  const denial = new RegExp('(?:not (?:be )?(?:employed by|an? employee of) ' + escapedName
    + '|' + escapedName + '.{0,60}(?:is not|will not be).{0,40}employer)', 'i')
  const placement = /(?:this|the|your|advertised)\s+(?:job|role|position|opportunity|hotel|property)\s+(?:is|will be|would be)\b.{0,100}(?:franchis|independent(?:ly)? (?:own|operat))/i
  if (independent.test(active) || denial.test(active) || placement.test(active)) return null
  return { employer: { name: contract.name }, binding: {
    method: 'explicit-native-role-corporate-workplace-declaration', field: contract.field,
    heading, statement: prefix, brand: contract.name, legalEmployer: null,
  } }
}

export function oracleRecruitmentEmployer(detail,{companyFlexField=null,brandEmploymentDeclaration=null}={}){
  const legal=[]
  if(detail.LegalEmployer!=null){
    need(typeof detail.LegalEmployer==='string','invalid native legal employer')
    if(text(detail.LegalEmployer))legal.push(text(detail.LegalEmployer))
  }
  const flex=list(detail.requisitionFlexFields),readField=prompt=>{
    const rows=flex.filter(field=>typeof field?.Prompt==='string'&&field.Prompt.trim()===prompt)
    const values=[]
    for(const row of rows){
      if(row.Value==null||row.Value==='')continue
      need(row.ControlType==='SingleChoiceList'&&typeof row.Value==='string'&&text(row.Value),'invalid native employer flex field')
      values.push(text(row.Value))
    }
    need(new Set(values).size<=1,'conflicting native employer flex fields')
    return values[0]||null
  }
  const legalFlex=readField('Legal Employer')
  if(legalFlex)legal.push(legalFlex)
  need(new Set(legal).size<=1,'conflicting native legal employers')
  const company=companyFlexField?readField(companyFlexField):null
  if(legal.length)return {employer:{name:legal[0]},binding:null}
  if(company)return {employer:{name:company},binding:{method:'native-requisition-company-flex-field',field:'requisitionFlexFields',prompt:companyFlexField,legalEmployer:null}}
  return reviewedOracleBrandEmployer(detail,brandEmploymentDeclaration)||{employer:null,binding:null}
}

// This reader only receives a board advertised by the current company page.
// The native <base> supplies the real site number, including named UI aliases;
// no tenant, site number, country ID or employer name is guessed.
export async function readOracleRecruitment(board, io) {
  io.permit(board.url)
  const page = await io.readPage(board.url)
  const doc = readNativeDocument(page.html)
  const bases = doc.nodes(node => node.tag === 'base' && node.attrs['data-sitenumber'] && node.attrs['data-apibaseurl'])
  need(bases.length === 1, 'missing or ambiguous public candidate-site contract')
  const base = bases[0], site = base.attrs['data-sitenumber']
  need(/^[a-z\d_-]{1,120}$/i.test(site), 'invalid native site number')
  const publicBase = new URL(base.attrs.href, page.url), apiOrigin = new URL(base.attrs['data-apibaseurl'])
  const original = new URL(board.url), declared = new URL(page.url)
  need(declared.origin === original.origin && (declared.href === original.href
    || board.nativeSiteRedirect?.requestedURL === original.href
      && board.nativeSiteRedirect.finalURL === declared.href),
  'unqualified native candidate-site alias changed')
  need(publicBase.origin === declared.origin && publicBase.pathname.replace(/\/$/, '') === declared.pathname.replace(/\/$/, '')
    && !publicBase.search && !publicBase.hash
    && apiOrigin.protocol === 'https:' && !apiOrigin.username && !apiOrigin.password && !apiOrigin.port, 'native API or candidate site changed authority')
  const publishers = doc.nodes(node => node.tag === 'title').map(node => decodeNativeEntities(node.raw || ''))
  publishers.push(...doc.nodes(node => node.tag === 'meta' && node.attrs.property === 'og:site_name').map(node => node.attrs.content || ''))
  const publisher = publishers.find(io.matchingPublisher) || null
  const generic = publishers.length > 0 && publishers.every(value => /^\s*Candidate Experience site\s*$/i.test(value))
    && board.bindingEvidence?.verified === true && board.bindingEvidence?.bindingMethod === 'runtime-current-careers-link'
  need(publisher || generic, 'native candidate-site publisher does not match the source')
  const oracleHost = /^[a-z\d-]+\.fa\.[a-z\d-]+\.oraclecloud\.com$/i
  const declaredOracleAPI = !oracleHost.test(declared.hostname) && oracleHost.test(apiOrigin.hostname)
    && apiOrigin.pathname === '/' && !apiOrigin.search && !apiOrigin.hash && publisher
    && board.bindingEvidence?.verified === true
    && ['runtime-current-careers-link','runtime-current-native-candidate-site'].includes(board.bindingEvidence.bindingMethod)
  need(apiOrigin.origin === declared.origin || declaredOracleAPI, 'native API or candidate site changed authority')
  const prefix = apiOrigin.origin + '/hcmRestApi/resources/latest/'
  io.permit(prefix)
  io.permit(publicBase.href)
  let total = null, offset = 0, inspected = 0
  const seen = new Set()
  for (let pageNumber = 0; pageNumber < io.maxPages && io.canRead(); pageNumber++) {
    const requestURL = prefix + 'recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber='
      + encodeURIComponent(site) + ',limit=20,offset=' + offset + ',keyword=India'
    const payload = await io.readJson(requestURL)
    need(payload && payload.count === 1 && payload.hasMore === false && Array.isArray(payload.items) && payload.items.length === 1,
      'invalid public inventory envelope')
    const collection = payload.items[0]
    need(collection.SiteNumber === site && collection.Offset === offset && collection.Limit === 20
      && Number.isSafeInteger(collection.TotalJobsCount) && collection.TotalJobsCount >= 0 && Array.isArray(collection.requisitionList),
    'native site, page or total identity changed')
    if (total === null) total = collection.TotalJobsCount
    need(total === collection.TotalJobsCount, 'inventory changed during pagination')
    io.inventoryRead({ kind: 'oracle', surface: publicBase.href, site, publisher, candidateSearch: 'India', reportedTotal: total })
    for (const row of collection.requisitionList) {
      need(row && /^\d{1,32}$/.test(row.Id || '') && text(row.Title) && !seen.has(row.Id), 'invalid or duplicate native role identity')
      seen.add(row.Id); io.recordRead(row, { origin: apiOrigin.origin, site, publicBase: publicBase.href })
      const countries = [country(row.PrimaryLocationCountry), ...list(row.secondaryLocations).map(location => country(location.CountryCode))].filter(Boolean)
      if (!countries.length) io.unresolved('native-location-scope-unresolved')
      if (!countries.includes('India')) continue
      if (inspected >= io.maxDetails || !io.canRead()) { io.unresolved('native-detail-budget-reached'); continue }
      inspected++
      const detailURL = prefix + 'recruitingCEJobRequisitionDetails?expand=all&onlyData=true&finder=ById;Id=%22'
        + encodeURIComponent(row.Id) + '%22,siteNumber=' + encodeURIComponent(site)
      const response = await io.readJson(detailURL)
      need(response && response.count === 1 && response.hasMore === false && Array.isArray(response.items) && response.items.length === 1,
        'public listing role is absent or changed in detail')
      const detail = response.items[0]
      need(detail.Id === row.Id && detail.Title === row.Title, 'listing/detail role identity changed')
      const primary = country(detail.PrimaryLocationCountry), rowPrimary = country(row.PrimaryLocationCountry)
      need(!primary || !rowPrimary || primary === rowPrimary, 'listing/detail countries conflict')
      const locations = [{ label: detail.PrimaryLocation, country: primary },
        ...list(detail.secondaryLocations).map(location => ({ label: location.LocationName, country: country(location.CountryCode) })),
        ...list(detail.workLocation).map(location => ({ label: [location.TownOrCity, location.Region2].filter(Boolean).join(', '), country: country(location.Country) }))]
      const india = locations.filter(location => location.country === 'India')
      if (!india.length) { io.unresolved('native-location-scope-unresolved'); continue }
      const roleCriteria = publicDescriptionFields.slice(0, 3).map(field => detail[field]).filter(text).join('\n')
      if ((extractActiveDescription(roleCriteria)?.length || 0) < 100) {
        io.unresolved('native-full-description-unavailable'); continue
      }
      const ownEmployer=oracleRecruitmentEmployer(detail,{companyFlexField:io.companyEmployerFlexField,
        brandEmploymentDeclaration:io.brandEmploymentDeclaration})
      const employer = ownEmployer.employer
      if (employer && !io.matchingEmployer(employer.name) || !employer && (io.requireNativeEmployerName || !publisher)) {
        io.unresolved('native-employer-mismatch'); continue
      }
      const url = publicBase.href.replace(/\/$/, '') + '/job/' + row.Id
      io.permit(url)
      io.addJob({ id: row.Id, title: detail.Title, url, employer,
        employerBinding: employer ? ownEmployer.binding : { method: 'current-corporate-delegation-and-native-site-publisher', publisher,
          siteNumber: site, publicSiteURL: publicBase.href, corporateBinding: board.bindingEvidence, legalEmployer: null },
        ...(ownEmployer.binding?.method === 'explicit-native-role-corporate-workplace-declaration' ? { legalEmployer: null } : {}),
        description: publicDescriptionFields.map(field => detail[field]).filter(text).join('\n'),
        location: india[0].label || 'India', posted: detail.ExternalPostedStartDate, closing: detail.ExternalPostedEndDate,
        employmentType: detail.JobSchedule || null, record: { detail, listing: row, nativeSiteNumber: site, publicRoleRoute: publicBase.href } })
    }
    offset += collection.requisitionList.length
    if (offset === total) return
    need(collection.requisitionList.length > 0 && offset < total, 'incomplete or inconsistent native pagination')
  }
  if (offset < total) io.unresolved('native-listing-budget-reached')
}
