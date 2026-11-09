import {document, norm} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {nativeCountryName,nativeLocationCountryName} from '../../scraper-support/shared/nativeJobPosting.js'

export const ENDPOINT = 'https://www.trigyn.com/get-career-data'
const ORIGIN = 'https://www.trigyn.com'
const check = (ok, message) => { if (!ok) throw Object.assign(Error(`Trigyn ${message}`), {code:'TRIGYN_NATIVE_CONTRACT'}) }
const numericId = value => typeof value === 'string' && /^[1-9]\d*$/.test(value)
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b)
const countryMarkers=['India','Canada','United States','USA','United Kingdom','UK','Germany','France','Australia','Singapore','Thailand','Philippines','Spain','Italy','Uganda','Somalia','Kenya','Lebanon','Colombia']
function geography(location,country) {
  const found=countryMarkers.filter(name=>new RegExp(`\\b${name}\\b`,'i').test(location))
  const expected=nativeCountryName(country)||country
  const written=location.split(/[,;/|]/).map(part=>part.trim()).filter(part=>part.length>3)
    .map(part=>nativeLocationCountryName(part)).filter(Boolean)
  const foreignState=/(?:,|;)\s*(?:CA|NY|NJ|TX|WA|MA|IL|FL|AZ|CO|CT|MD|MI|MN|NC|NH|NV|OH|PA|RI|SC|VA|VT|WI|DC)(?:\s+\d{5}(?:-\d{4})?)?\s*$/.test(location)
  check(found.every(name=>(nativeCountryName(name)||({USA:'United States',UK:'United Kingdom'})[name]||name)===expected)
    &&written.every(name=>name===expected)&&(!foreignState||expected==='United States'),'native location/country geography contradiction')
}

export function careersContract(html) {
  const doc=document(html), canonical=doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical')
  check(canonical.length===1&&canonical[0].attrs.href===`${ORIGIN}/careers`,'careers listing identity unavailable')
  check(/<title>\s*Career Opportunity \| Trigyn\s*<\/title>/i.test(html),'careers listing title unavailable')
  const forms=doc.nodes(n=>n.tag==='form'&&n.attrs.id==='career-opportunities-form'&&n.attrs.action==='/careers')
  check(forms.length===1,'careers listing form unavailable');doc.outer(forms[0])
  const selects=doc.nodes(n=>n.tag==='select'&&n.attrs.name==='region',forms[0])
  check(selects.length===1,'careers region inventory unavailable')
  const regions=doc.nodes(n=>n.tag==='option'&&numericId(n.attrs.value),selects[0]).map(n=>({id:n.attrs.value,name:doc.text(n)}))
  check(regions.length<=25&&new Set(regions.map(r=>r.id)).size===regions.length,'careers region inventory invalid')
  const clients=doc.nodes(n=>n.tag==='script'&&n.attrs.src).map(n=>new URL(n.attrs.src,ORIGIN))
    .filter(url=>url.origin===ORIGIN&&url.pathname.startsWith('/sites/default/files/js/')&&url.searchParams.get('scope')==='footer')
  check(clients.length===1,'careers listing client binding unavailable')
  return {regions,clientUrl:clients[0].href}
}

export function verifyClient(js) {
  check(js.includes('function createParam()')&&js.includes('url:"/get-career-data"')
    &&js.includes("data:{'param':param}")&&js.includes('param.current_page=current_page')
    &&js.includes('param.region=region')&&js.includes('param.country=country')&&js.includes('var pageSize=20')
    &&js.includes("localStorage.setItem('region',54)"),
  'native listing client contract changed')
}

export function regionUniverse(payload) {
  const regions=payload?.dropdown?.region
  check(Array.isArray(regions)&&regions.length>0&&regions.length<=25&&regions.every(r=>numericId(r.id)&&norm(r.name))
    &&new Set(regions.map(r=>r.id)).size===regions.length,'native region inventory unavailable')
  return regions
}

export function parsePage(payload,{regions,page,country}) {
  check(payload&&typeof payload==='object'&&Number.isSafeInteger(payload.total_count)&&payload.total_count>=0,'native inventory total unavailable')
  check(Array.isArray(payload.jobs),'native inventory jobs array unavailable')
  check(same(payload.dropdown?.region,regions),'native inventory region universe changed')
  const countries=payload.dropdown?.country
  check(Array.isArray(countries)&&countries.every(c=>numericId(c.id)&&norm(c.name)),'native inventory country facet unavailable')
  check(new Set(countries.map(c=>c.id)).size===countries.length,'native country facet repeated identity')
  const expected=Math.min(20,Math.max(0,payload.total_count-page*20))
  check(payload.jobs.length===expected,'native inventory page range/count mismatch')
  check(!country||countries.some(c=>c.id===country&&c.name==='India'),'native India facet identity unavailable')
  const seen=new Set(),positions=new Set()
  const jobs=payload.jobs.map(row=>{
    check(Object.keys(row).every(key=>['nid','position_id','job_length','recruiter_title_name','field_recruiter_name','location','country_name','country_code','alias'].includes(key)),'native job schema contains unknown scope fields')
    check(numericId(row.nid)&&typeof row.position_id==='string'&&/^[A-Z]\d{4}-\d{4}$/.test(row.position_id),'native job identity unavailable')
    check(!seen.has(row.nid)&&!positions.has(row.position_id),'native job duplicate identity');seen.add(row.nid);positions.add(row.position_id)
    check(typeof row.alias==='string'&&/^\/job\/[a-z0-9][a-z0-9-]*$/.test(row.alias),'native job alias route invalid')
    check(typeof row.recruiter_title_name==='string'&&norm(row.recruiter_title_name)&&typeof row.location==='string'&&norm(row.location),'native job title/location unavailable')
    check(countries.some(c=>c.id===row.country_code&&norm(c.name)===norm(row.country_name)),'native job country identity mismatch')
    geography(norm(row.location),norm(row.country_name))
    check(!country||row.country_code===country,'native India country scope mismatch')
    return {jobId:row.nid,requisitionId:row.position_id,title:norm(row.recruiter_title_name),country:norm(row.country_name),
      countryId:row.country_code,nativeLocation:norm(row.location),employmentType:norm(row.job_length)||null,
      sourceUrl:ORIGIN+row.alias,applyUrl:`${ORIGIN}/job-apply?job=${row.nid}`}
  })
  return {total:payload.total_count,jobs,countries}
}

export function detailContent(html,job) {
  const doc=document(html),canonical=doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical')
  const identity=(ok,message)=>{if(!ok)throw Object.assign(Error(`Trigyn detail identity ${message}`),{code:'TRIGYN_DETAIL_IDENTITY'})}
  for(const n of doc.nodes(n=>n.attrs.style&&/(?:^|;)\s*(?:content-visibility\s*:\s*hidden|opacity\s*:\s*0)\s*(?:!important\s*)?(?:;|$)/i.test(n.attrs.style)))n.inactive=true
  if(canonical.length)identity(canonical.length===1&&canonical[0].attrs.href===job.sourceUrl,'canonical mismatch')
  check(canonical.length===1,'detail identity canonical unavailable')
  const allArticles=doc.nodes(n=>n.tag==='article'&&n.attrs['data-history-node-id'])
  if(allArticles.length)identity(allArticles.length===1&&allArticles[0].attrs['data-history-node-id']===job.jobId,'node mismatch')
  const articles=doc.nodes(n=>n.tag==='article'&&n.attrs['data-history-node-id']===job.jobId)
  check(articles.length===1,'detail identity node mismatch');doc.outer(articles[0])
  const visibleTitles=doc.nodes(n=>n.tag==='h1'&&doc.hasClass(n,'entry-title'))
  if(visibleTitles.length)identity(visibleTitles.length===1&&doc.text(visibleTitles[0])===`Job Details: ${job.title}`,'title mismatch')
  const headings=doc.nodes(n=>n.tag==='h1'&&doc.text(n)===`Job Details: ${job.title}`)
  check(headings.length===1,'detail identity title mismatch')
  const fields=doc.nodes(n=>n.tag==='div',articles[0]).filter(n=>n.children.some(c=>typeof c!=='string'&&doc.hasClass(c,'job_field_name')))
  const values=new Map(fields.map(n=>[doc.text(n.children.find(c=>typeof c!=='string'&&doc.hasClass(c,'job_field_name'))),doc.text(n.children.find(c=>typeof c!=='string'&&doc.hasClass(c,'job_field_value')))]))
  identity(values.size===fields.length,'duplicate fields')
  identity([...values.keys()].every(key=>['Position Id:','Country:','Job Type:','Location:','Pay Rate:','Contact Recruiter:'].includes(key)),'unknown scope fields')
  identity(values.get('Position Id:')===job.requisitionId&&values.get('Country:')===job.country,'requisition/country mismatch')
  identity(values.get('Location:')===job.nativeLocation,'location mismatch')
  const candidates=doc.nodes(n=>n.tag==='div'&&doc.hasClass(n,'column-content'),articles[0])
  const description=candidates.filter(n=>{
    const text=doc.text(n)
    if(!text||/^Job Description:\s*$/i.test(text))return false
    const prose=node=>!node||node.inactive||/^(?:h[1-6]|strong|b|script|style|label)$/.test(node.tag)?'':node.children.map(c=>typeof c==='string'?norm(c):prose(c)).join(' ')
    return Boolean(norm(prose(n)))
  }).map(n=>{doc.outer(n);return doc.text(n)}).join('\n\n')
  return description||null
}
