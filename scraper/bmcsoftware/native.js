const fail = message => { throw Object.assign(new Error(`BMC native inventory/identity: ${message}`), {code:'BMC_NATIVE_IDENTITY'}) }
const requireProof = (ok,message) => { if(!ok)fail(message) }
const decode = value => String(value??'').replace(/&#x([\da-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16)))
  .replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)))
  .replace(/&(?:amp|quot|apos|nbsp|lt|gt|ndash|mdash|rsquo|lsquo);/g,name=>({'&amp;':'&','&quot;':'"','&apos;':"'",'&nbsp;':' ','&lt;':'<','&gt;':'>','&ndash;':'–','&mdash;':'—','&rsquo;':'’','&lsquo;':'‘'})[name])
const text = value => decode(String(value??'').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim()
const tokens = () => /<!--[\s\S]*?(?:-->|$)|<\/?([a-z][a-z0-9:_-]*)\b((?:[^"'<>]|"[^"]*"|'[^']*')*)>/gi
const raw = new Set(['script','style','textarea','title','xmp','noscript','noembed','noframes','iframe','plaintext'])
const activeHtml = input => {
  const html=String(input??''),matcher=tokens(),inert=[],output=[];let cursor=0,tag
  while(matcher.lastIndex<html.length){
    if(raw.has(inert.at(-1))){
      if(inert.at(-1)==='plaintext')break
      const close=new RegExp(`</${inert.at(-1)}\\s*>`,'gi');close.lastIndex=cursor
      const end=close.exec(html);if(!end)break
      inert.pop();cursor=matcher.lastIndex=close.lastIndex;continue
    }
    tag=matcher.exec(html);if(!tag)break
    if(!inert.length)output.push(html.slice(cursor,tag.index))
    cursor=tag.index+tag[0].length
    if(!tag[1])continue
    const name=tag[1].toLowerCase(),closing=tag[0].startsWith('</')
    if(closing){if(name==='template'&&inert.at(-1)===name)inert.pop();else if(!inert.length)output.push(tag[0]);continue}
    if(name==='template'||raw.has(name)){inert.push(name);continue}
    if(!inert.length)output.push(tag[0])
  }
  if(!inert.length)output.push(html.slice(cursor))
  return output.join('')
}
const attrs = source => {
  const values={}
  for(const match of source.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)){
    const name=match[1].toLowerCase(),value=decode(match[2]??match[3]??match[4]??'')
    requireProof(!(name in values)||values[name]===value,'conflicting native attribute');values[name]=value
  }
  return values
}
const hasClass = (node,name) => (node.attrs.class||'').split(/\s+/).includes(name)
const document = input => {
  const html=activeHtml(input),nodes=[],stack=[],voids=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'])
  for(const tag of html.matchAll(tokens())){
    if(!tag[1])continue
    const name=tag[1].toLowerCase()
    if(tag[0].startsWith('</')){
      const index=stack.findLastIndex(node=>node.tag===name)
      if(index>=0){stack[index].closeStart=tag.index;stack[index].end=tag.index+tag[0].length;stack.length=index}
    }else{
      const node={tag:name,attrs:attrs(tag[2]),start:tag.index,openEnd:tag.index+tag[0].length}
      if(voids.has(name)){node.closeStart=node.openEnd;node.end=node.openEnd}else stack.push(node)
      nodes.push(node)
    }
  }
  const select=(tag,predicate=()=>true)=>nodes.filter(node=>node.tag===tag&&node.end!=null&&predicate(node))
  return {html,select,inner:node=>html.slice(node.openEnd,node.closeStart),text:node=>text(html.slice(node.openEnd,node.closeStart))}
}
const unique = (values,label) => { requireProof(values.length>0&&new Set(values).size===1,`missing/conflicting ${label}`);return values[0] }
const origin='https://jobs.bmc.com'
export const INDIA_SEARCH_URL=origin+'/Careers/SearchJobs/?1274=9406&1274_format=1347&intcmp=JobsByCountry&listFilterMode=1'
export const CORPORATE_CAREERS_URL='https://www.bmc.com/careers/careers.html?vu=careers'
const safeUrl = href => {
  let url;try{url=new URL(href)}catch{fail('invalid native URL')}
  requireProof(url.origin===origin&&!url.username&&!url.password&&!url.hash,'foreign native URL');return url
}
const searchUrl = href => {
  const url=safeUrl(href);requireProof(url.pathname==='/Careers/SearchJobs/','pagination path changed')
  for(const [key,value] of [['1274','9406'],['1274_format','1347'],['listFilterMode','1']])requireProof(url.searchParams.getAll(key).length===1&&url.searchParams.get(key)===value,'India pagination scope changed')
  const allowed=new Set(['1274','1274_format','listFilterMode','intcmp','jobRecordsPerPage','jobOffset'])
  for(const key of url.searchParams.keys())requireProof(allowed.has(key)&&url.searchParams.getAll(key).length===1,'pagination scope or duplicate parameter changed')
  if(url.searchParams.has('intcmp'))requireProof(url.searchParams.get('intcmp')==='JobsByCountry','country handoff tracking changed')
  if(url.searchParams.has('jobRecordsPerPage'))requireProof(url.searchParams.get('jobRecordsPerPage')==='6','native page size changed')
  requireProof(/^\d+$/.test(url.searchParams.get('jobOffset')||'0'),'invalid native page offset');return url
}
const verifyPortal = (doc,page) => {
  for(const [name,value] of Object.entries({'avature.portal.id':'7','avature.portal.urlPath':'Careers','avature.portal.lang':'en_US','avature.portal.page':page})){
    requireProof(unique(doc.select('meta',node=>node.attrs.name===name).map(node=>node.attrs.content),name)===value,'native portal identity changed')
  }
  requireProof(/BMC Software,?\s+Inc\b/i.test(text(doc.html)),'native BMC employer identity unavailable')
}
export const verifyCorporateHandoff = html => {
  const doc=document(html)
  requireProof(unique(doc.select('link',node=>node.attrs.rel==='canonical').map(node=>node.attrs.href),'corporate canonical')==='https://www.bmc.com/careers/careers.html','official corporate canonical changed')
  const links=doc.select('a').filter(node=>node.attrs.href?.startsWith(origin))
  requireProof(links.some(node=>node.attrs.href===origin+'/Careers'),'official main careers handoff missing')
  requireProof(links.some(node=>{
    if(doc.text(node)!=='India')return false
    try{return searchUrl(node.attrs.href).searchParams.get('1274')==='9406'}catch{return false}
  }),'official India handoff missing')
}
const date = (value,now) => {
  const match=text(value).match(/^(\d{2})-([A-Za-z]{3})-(\d{4})$/),months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  requireProof(match,'native publication date malformed')
  const month=months.findIndex(name=>name.toLowerCase()===match[2].toLowerCase()),day=Number(match[1]),year=Number(match[3]),parsed=new Date(Date.UTC(year,month,day))
  requireProof(month>=0&&parsed.getUTCFullYear()===year&&parsed.getUTCMonth()===month&&parsed.getUTCDate()===day,'native publication date invalid')
  const current=new Date(typeof now==='function'?now():now)
  requireProof(Number.isFinite(current.getTime()),'invalid current native check time')
  requireProof(parsed<=current,'native publication date is in the future');return parsed.toISOString()
}
const applyUrl = (href,id) => {
  const url=safeUrl(href)
  requireProof(url.pathname==='/Careers/ApplicationMethods'&&[...url.searchParams.keys()].length===1&&url.searchParams.getAll('jobId').length===1&&url.searchParams.get('jobId')===id,'native application identity mismatch');return url.href
}
export const parseListing = (html,pageUrl=INDIA_SEARCH_URL,{now=new Date()}={}) => {
  const requested=searchUrl(pageUrl),offset=Number(requested.searchParams.get('jobOffset')||0),doc=document(html);verifyPortal(doc,'SearchJobs')
  const ranges=doc.select('div',node=>hasClass(node,'list-controls__text__legend')).map(node=>doc.text(node).match(/^(\d+)-(\d+) of (\d+) results$/))
  requireProof(ranges.length>0&&ranges.every(Boolean),'native count range unavailable')
  const [start,end,total]=unique(ranges.map(match=>match.slice(1).join(',')),'native count range').split(',').map(Number)
  requireProof(Number.isSafeInteger(total)&&total>0&&total<=10000&&start===offset+1&&end>=start&&end<=total&&end-start<6,'native inventory range invalid')
  const jobs=doc.select('article',node=>hasClass(node,'article--result')).map(node=>{
    const row=document(doc.inner(node)),titles=row.select('h3',node=>hasClass(node,'article__header__text__title'));requireProof(titles.length===1,'native listing title unavailable')
    const title=row.text(titles[0]),roleLinks=row.select('a',node=>node.start>=titles[0].openEnd&&node.end<=titles[0].closeStart).map(node=>node.attrs.href)
    const sourceUrl=unique(roleLinks,'native role link'),url=safeUrl(sourceUrl),match=url.pathname.match(/^\/Careers\/JobDetail\/[^/]+\/([1-9]\d*)$/)
    requireProof(match&&!url.search&&title,'native role identity malformed')
    const jobId=match[1],location=unique(row.select('span',node=>hasClass(node,'list-item-location')).map(node=>row.text(node)),'native location')
    requireProof(/^[^,]+, India$/.test(location),'native listing India scope unknown')
    const city=location.split(',')[0].trim(),published=unique(row.select('span',node=>hasClass(node,'list-item-posted')).map(node=>row.text(node)),'native publication date')
    requireProof(published.startsWith('Posted '),'native publication label unavailable')
    const applications=row.select('a',node=>node.attrs.href?.includes('/Careers/ApplicationMethods')).map(node=>applyUrl(node.attrs.href,jobId))
    return {jobId,requisitionId:jobId,title,sourceUrl,applyUrl:unique(applications,'native application'),location,city,country:'India',
      postingDate:date(published.slice(7),now),department:row.select('span',node=>hasClass(node,'list-item-department')).map(node=>row.text(node))[0]||null}
  })
  requireProof(jobs.length===end-start+1&&new Set(jobs.map(job=>job.jobId)).size===jobs.length,'native page count or duplicate identity')
  const pagination=doc.select('li',node=>hasClass(node,'paginationNextLink')).flatMap(node=>{
    const inner=document(doc.inner(node));return inner.select('a').map(node=>searchUrl(node.attrs.href))
  })
  if(end<total)requireProof(pagination.length===1&&Number(pagination[0].searchParams.get('jobOffset'))===end,'native pagination continuation missing or changed')
  else requireProof(pagination.length===0,'native terminal pagination inconsistent')
  return {start,end,total,jobs,nextUrl:pagination[0]?.href||null}
}
export const parseDetail = (html,listing,{now=new Date()}={}) => {
  const doc=document(html);verifyPortal(doc,'JobDetail')
  requireProof(unique(doc.select('link',node=>node.attrs.rel==='canonical').map(node=>node.attrs.href),'native canonical')===listing.sourceUrl,'native canonical role mismatch')
  requireProof(unique(doc.select('h2',node=>hasClass(node,'banner__text__title')).map(node=>doc.text(node)),'public display title')===listing.title,'native display title mismatch')
  const sections=doc.select('div',node=>node.attrs.id==='section0__content');requireProof(sections.length===1,'native basic fields unavailable')
  const basic=document(doc.inner(sections[0])),values={}
  for(const node of basic.select('div',node=>hasClass(node,'article__content__view__field'))){
    const field=document(basic.inner(node)),labels=field.select('div',node=>hasClass(node,'article__content__view__field__label')).map(node=>field.text(node));if(!labels.length)continue
    const label=unique(labels,'native field label'),value=unique(field.select('div',node=>hasClass(node,'article__content__view__field__value')).map(node=>field.text(node)),'native field value')
    requireProof(!(label in values)||values[label]===value,'conflicting native basic field');values[label]=value
  }
  requireProof(values['Job ID']===listing.jobId&&values.Country==='India'&&values.City===listing.city&&/^IN_[A-Za-z_ ]+$/.test(values.State||''),'native country/city/JobID identity mismatch')
  requireProof(date(values['Date Published'],now)===listing.postingDate,'native publication date conflict')
  const applications=doc.select('a',node=>node.attrs.href?.includes('/Careers/ApplicationMethods')).map(node=>applyUrl(node.attrs.href,listing.jobId))
  requireProof(unique(applications,'native detail application')===listing.applyUrl,'native detail application conflict')
  const descriptions=doc.select('div',node=>node.attrs.id==='section1__content');requireProof(descriptions.length<=1,'conflicting native description sections')
  const content=descriptions.length?document(doc.inner(descriptions[0])):null
  const full=content?.select('div',node=>hasClass(node,'article__content__view__field')&&!hasClass(node,'visibility--hidden')
    &&(hasClass(node,'--rich-text')||hasClass(node,'tf_crmDescription'))).map(node=>{
      const field=document(content.inner(node));return field.select('div',node=>hasClass(node,'article__content__view__field__value')).map(node=>field.inner(node)).join('\n')
    }).join('\n')||null
  return {...listing,state:values.State.slice(3).replaceAll('_',' '),sourceNativeState:values.State,sourceNativeJobName:values['Job Name']||null,
    sourceNativeSecondaryLocations:values['Secondary locations']||null,jobDescription:full,closingDate:null}
}
