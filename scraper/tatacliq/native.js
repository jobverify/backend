import { document, decode } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { nativeCountryName, nativeLocationCountryName } from '../../scraper-support/shared/nativeJobPosting.js'
const requireShape = (ok, message) => { if (!ok) throw Error('Tata CLiQ native contract: ' + message) }
const reviewedGeographyFields=new Set(['country','officelocation_arr','officelocation_show_arr','officelocations_area','officelocations_without_area','officelocation_show_arr_list','locations','tool_tip_locations','nativeCountryHints','nativeUnreviewedGeography'])
export const hasUnreviewedGeography = value => {
 if(!value||typeof value!=='object')return false
 return Object.entries(value).some(([key,item])=>(/country|location|address|city|state|region/i.test(key)&&!reviewedGeographyFields.has(key))||hasUnreviewedGeography(item))
}
const labelCountries = label => String(label||'').split(/[,;|/]/).map(value=>value.trim().replace(/\s*\([a-z]+\d+\)$/i,'')).filter(value=>value.length>2).map(nativeCountryName).filter(Boolean)
export const discoverOfficialClient = html => {
 const doc=document(html), scripts=doc.nodes(node=>node.tag==='script'&&/^\/client\.[\da-z]+\.js$/.test(node.attrs.src||''))
 requireShape(scripts.length===1,'Missing/ambiguous official application script')
 return new URL(scripts[0].attrs.src,'https://www.tatacliq.com').href
}
export const verifyOfficialClient = js => {
 requireShape(js.includes('https://apimw.tatacliq.com/content-aggregator-service')&&js.includes('/v1/pages/landing/custom/')&&js.includes('"x-tenant-id":"beaute"'),'Changed official public CMS helper')
}
export const verifyOfficialCMS = payload => {
 requireShape(payload?.title==='careers'&&payload.store==='fashion'&&Array.isArray(payload.results),'Wrong official CMS page')
 const docs=payload.results.filter(row=>row.postType==='CommercePostTextComponent'&&row.content?.isHtmlContent===true).map(row=>row.content.htmlContent).filter(html=>typeof html==='string'&&!/content-visibility\s*:\s*hidden/i.test(html)).map(document)
 const bound=docs.filter(doc=>doc.nodes(node=>node.tag==='a'&&node.attrs.href==='https://cliqonnect.darwinbox.in/ms/candidate/careers').length===1&&/Tata UniStore Limited \(TUL\) owns and operates/i.test(doc.text(doc.root))&&doc.text(doc.root).includes('Tata CLiQ Fashion and Tata CLiQ Luxury'))
 requireShape(bound.length===1,'Missing active exact-employer official handoff')
}
export const parseCompany = payload => {
 const company = payload?.message?.company
 requireShape(payload?.status === 'success' && company?.company_name === 'Tata Unistore Limited' && company.subdomain === 'cliqonnect' && company.tenant_id === '310', 'Employer or tenant changed')
 requireShape(Number.isSafeInteger(company.allJobsCount) && company.allJobsCount >= 0 && company.allJobsCount <= 10000, 'Invalid total')
 return { total: company.allJobsCount, company }
}
export const parseListing = (payload, total) => {
 requireShape(payload?.status === 'success' && Array.isArray(payload.data) && payload.job_counts === total, 'Listing count/shape changed')
 requireShape(payload.data.length <= 10 && new Set(payload.data.map(row => row.id)).size === payload.data.length, 'Duplicate/oversized page')
 for (const row of payload.data) requireShape(/^a[\da-f]+$/.test(row.id) && typeof row.title === 'string' && row.title.trim() && row.parent_company_id === '', 'Invalid role identity or employer scope')
 return payload.data
}
const description = (raw, title) => {
 if (typeof raw !== 'string' || !raw.trim()) return null
 const html = decode(raw)
 if (/content-visibility\s*:\s*hidden/i.test(html)) return null
 const doc = document(html), text = doc.text(doc.root)
 const core = node => node.inactive||node.tag==='script'||/^(?:h[1-6]|strong|b|u)$/.test(node.tag)||/font-weight\s*:\s*(?:bold|[6-9]00)/i.test(node.attrs?.style||'')?'':node.children.map(child=>typeof child==='string'?decode(child):core(child)).join(' ')
 const remaining = core(doc.root).replace(title,'').replace(/\s+/g,' ').trim()
 return remaining.length >= 80 && text.length >= 100 ? text : null
}
const timestamp = raw => typeof raw === 'number' && Number.isSafeInteger(raw) && raw > 0 && raw < 8640000000000 ? new Date(raw * 1000).toISOString() : null
export const parseRole = (row, nativeLocations = [], {now=new Date()}={}) => {
 requireShape(/^a[\da-f]+$/.test(row.id) && typeof row.title === 'string' && row.title.trim() && row.parent_company_id === '', 'Invalid native identity')
 const title = row.title.trim(), labels = [...new Set([...(row.officelocations_without_area || []), ...(row.officelocations_area || []), ...(row.tool_tip_locations || []), row.locations,row.officelocation_show_arr,Array.isArray(row.officelocation_show_arr_list)?row.officelocation_show_arr_list.join(', '):row.officelocation_show_arr_list].filter(value => typeof value === 'string' && value.trim()).map(value => value.replace(/\s+/g, ' ').trim()))]
 const mapped = (row.officelocation_arr || []).map(id => nativeLocations.find(location => location._id === id))
 const countries = [nativeCountryName(row.country),...labelCountries(row.country), ...(row.nativeCountryHints||[]).flatMap(value=>[nativeCountryName(value),...labelCountries(value)]), ...labels.flatMap(value=>[nativeLocationCountryName(value),...labelCountries(value)]), ...mapped.map(location => nativeCountryName(location?.country))].filter(Boolean)
 const foreignState = /(?:^|[,\s])(?:Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming|Ontario|British Columbia|Alberta|Manitoba|Saskatchewan|Quebec|Nova Scotia|New Brunswick|Newfoundland|Queensland|Victoria|New South Wales|Tasmania|Western Australia|South Australia)(?:[,\s]|$)/i
 const foreignStateCode=/(?:^|,)\s*(?:AL|AK|AZ|CA|CO|CT|DE|FL|HI|ID|IL|IA|KS|KY|LA|ME|MD|MA|MI|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|PA|RI|SC|SD|TX|UT|VT|VA|WA|WV|WI|WY|ON|BC|AB|QC|NS|NB|NL|PE|YT|NT|NU)\s*(?:,|$)/
 const unresolvedLabel=labels.some(label=>!labelCountries(label).includes('India')&&nativeLocationCountryName(label)!=='India'&&!mapped.some(location=>location?.name?.replace(/\s+/g,' ').trim()===label&&nativeCountryName(location.country)==='India'))
 const india = !row.nativeUnreviewedGeography&&!hasUnreviewedGeography(row)&&!unresolvedLabel&&countries.length > 0 && countries.every(country => country === 'India') && !labels.some(label => foreignState.test(label)||foreignStateCode.test(label)) && (row.officelocation_arr || []).every((_, index) => mapped[index])
 const jobDescription = description(row.jd, title), url = 'https://cliqonnect.darwinbox.in/ms/candidatev2/main/careers/jobDetails/' + row.id
 const dates = [timestamp(row.posted_on), timestamp(row.job_posting?.careers?.from)].filter(Boolean).sort()
 const clock=new Date(now).getTime(),window=row.job_posting?.careers||{},windowFrom=timestamp(window.from),windowTo=timestamp(window.to)
 requireShape(Number.isFinite(clock),'Invalid collection clock')
 requireShape((window.from==null||Boolean(windowFrom))&&(window.to==null||Boolean(windowTo))&&(!windowFrom||!windowTo||windowTo>=windowFrom),'Contradictory or malformed native publication window')
 const publicationStart=windowFrom||timestamp(row.posted_on)
 const nativeWindowEligible=(!publicationStart||new Date(publicationStart).getTime()<=clock)&&(!windowTo||new Date(windowTo).getTime()>clock)
 const location = (row.officelocations_without_area || []).join(' / ').replace(/\s+/g, ' ').trim()
 return { id: row.id, jobId: row.id, source: 'tatacliq', company: 'Tata CLiQ', nativeHiringOrganization: 'Tata Unistore Limited', legalEmployer: null,
 requisitionId: row.internal_job_code || null, title, country: india ? 'India' : null, location: location || null,
 city: india && /\bMumbai\b/.test(location) ? 'Mumbai' : india && /\bBengaluru\b/.test(location) ? 'Bengaluru' : null,
 locations: labels, nativeCountry: row.country ?? null, sourceUrl: url, applyUrl: url, link: url,
 jobDescription, sourceDescription: jobDescription, sourceDetailComplete: Boolean(jobDescription), sourceDetailStatus: jobDescription ? 'complete' : 'missing-description',
 postingDate: dates[0] || null, postedAt: dates[0] || null, originalPublicationDate: null, firstEverPublication: null,
 nativePostedOn: row.posted_on ?? null, nativeCareersPublication: row.job_posting?.careers ?? null, nativeCreatedOn: row.created_on ?? null,
 closingDate: timestamp(row.job_posting?.careers?.to), sourceClosingDateIsExact: Boolean(timestamp(row.job_posting?.careers?.to)),
 sourceListingComplete: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false, nativeLocationScopeComplete: india,nativeWindowEligible }
}
