import {activeHead,readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {criteriaStyleModel} from './criteriaVisibility.js'

export const CORPORATE='https://www.akulaku.com/staff-life'
export const BOARD='https://akulaku.zhiye.com/'
export const need=(ok,message)=>{if(!ok)throw Object.assign(Error('Akulaku native: '+message),{code:'AKULAKU_NATIVE_MODEL'})}
export const norm=value=>String(value??'').replace(/\s+/g,' ').trim()
const children=node=>node.children.filter(child=>typeof child!=='string'&&!child.inert)
const all=(node,predicate)=>typeof node==='string'||node.inert?[]:[...(predicate(node)?[node]:[]),...node.children.flatMap(child=>all(child,predicate))]
const one=(rows,label)=>{need(rows.length===1,'expected one '+label);return rows[0]}
export const dateOnly=value=>{const text=norm(value);if(!text)return null;need(/^\d{4}-\d{2}-\d{2}$/.test(text),'unsupported original date precision');const date=new Date(text+'T00:00:00Z');need(Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===text,'invalid native calendar date');return text}
const countries=new Map()
for(const locale of ['en','zh-Hans','zh-Hant','id']){const display=new Intl.DisplayNames([locale],{type:'region'});for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){const code=String.fromCharCode(a,b),name=display.of(code);if(name&&name!==code&&!['ZZ','EU','UN','XA','XB','QO'].includes(code))countries.set(norm(name).toLowerCase(),new Intl.DisplayNames(['en'],{type:'region'}).of(code))}}
for(const [name,country]of [['中国','China'],['新加坡共和国','Singapore'],['美国','United States'],['usa','United States'],['uk','United Kingdom']])countries.set(name,country)
export function countryModel(value){
 const slots=norm(value).split(/[,;|/，；、]+/).filter(Boolean).map(text=>{const exact=countries.get(text.toLowerCase()),options=exact?[exact]:[...new Set(text.split(/[-–—]+/).map(part=>countries.get(norm(part).toLowerCase())).filter(Boolean))];return{native:text,countries:options,country:options.length===1?options[0]:null,ambiguous:options.length>1}})
 return{native:value,slots,countries:[...new Set(slots.flatMap(slot=>slot.countries))],indiaQualified:slots.some(slot=>slot.country==='India')&&!slots.some(slot=>slot.ambiguous),unresolved:slots.length===0||slots.some(slot=>!slot.country)}
}
export const isExplicitIndiaLocation=value=>countryModel(value).indiaQualified
function permanentDutyWorksites(criteria,doc){
 const blocks=children(criteria),duties=blocks.map((node,index)=>({node,index})).filter(({node})=>node.tag==='p'&&doc.hasClass(node,'title')&&doc.text(node).replace(/[：:]$/,'')==='工作职责'),qualifications=blocks.map((node,index)=>({node,index})).filter(({node})=>node.tag==='p'&&doc.hasClass(node,'title')&&doc.text(node).replace(/[：:]$/,'')==='任职资格')
 if(duties.length!==1||qualifications.length!==1||duties[0].index>=qualifications[0].index)return null
 const nativeDuties=blocks.slice(duties[0].index+1,qualifications[0].index).map(doc.text).filter(Boolean).join(' '),match=/^(?:职位描述[：:]\s*)?(?:1[.、．]\s*)?常驻([^，,；;。!?]+)[，,；;。!?]/u.exec(nativeDuties)
 if(!match)return null
 const explicit=countryModel(match[1]),remaining=nativeDuties.slice(match[0].length),additionalWorksite=/常驻|(?:工作|办公)(?:地点|地址|国家|区域|室)|(?:职位|岗位)(?:可|需|在)|(?:远程|异地)(?:工作|办公)|在[^，,；;。]{1,80}(?:工作|办公)|work(?:ing)?\s*(?:location|site|place|remotely|from)|based\s+in|located\s+in|\bIndia\b|印度(?!尼西亚)/i.test(remaining),qualified=!explicit.unresolved&&explicit.slots.length>0&&explicit.slots.every(slot=>slot.country&&!slot.ambiguous)&&!additionalWorksite
 return{...explicit,qualified,kind:'own-duty-first-permanent-stationing-clause',sectionHeading:'工作职责',nativeClause:match[0],nativeDuties,additionalDutyWorksiteUnreconciled:additionalWorksite,qualificationSectionExcluded:true}
}
export function corporateModel(html){const doc=readNativeDocument(html);need(activeHead(html).titles.some(value=>/Akulaku/i.test(value)),'corporate publisher unavailable');const links=doc.nodes(node=>node.tag==='a'&&node.attrs.href===BOARD&&doc.text(node)==='Lihat Lowongan');need(links.length===1,'current exact public employer board declaration unavailable');return{publisher:'Akulaku',corporateUrl:CORPORATE,boardUrl:BOARD,cta:'Lihat Lowongan'}}
export function boardModel(html){
 const doc=readNativeDocument(html)
 need(activeHead(html).titles.some(value=>/招聘系统/.test(value)),'native recruiting publisher unavailable')
 need(doc.nodes(node=>node.tag==='a'&&node.attrs.href==='https://www.akulaku.com/about').length===1,'native public employer return link unavailable')
 const channels=[...new Set(doc.nodes(node=>node.tag==='a'&&/^\/alljob\/\?o=[12]$/.test(node.attrs.href||'')).map(node=>new URL(node.attrs.href,BOARD).href))]
 need(channels.includes(BOARD+'alljob/?o=1')&&channels.includes(BOARD+'alljob/?o=2'),'current normal/featured native public channels unavailable')
 const refs=new Map()
 for(const node of doc.nodes(node=>node.tag==='a'&&/^\/zpdetail\/\d+\?/.test(node.attrs.href||''))){const id=/^\/zpdetail\/(\d+)/.exec(node.attrs.href)[1],title=norm(node.attrs.title||doc.text(node)),before=refs.get(id);need(title&&(!before||before.title===title),'native public featured role identity conflict');refs.set(id,{detailId:id,title,detailUrl:new URL(node.attrs.href,BOARD).href})}
 return{publisher:'Akulaku-declared-public-board',corporateAboutUrl:'https://www.akulaku.com/about',channels:channels.sort(),publicCards:[...refs.values()].sort((a,b)=>a.detailId.localeCompare(b.detailId))}
}
export function listingUrl(value){const url=new URL(value,BOARD);need(url.origin===new URL(BOARD).origin&&url.pathname==='/alljob/'&&!url.hash&&!url.username&&!url.password,'unpublished listing URL');const names=[...url.searchParams.keys()];need(names.length===new Set(names).size&&names.every(name=>['o','PageIndex'].includes(name))&&['1','2'].includes(url.searchParams.get('o')),'filtered or changed native listing URL');const page=Number(url.searchParams.get('PageIndex')||1);need(Number.isSafeInteger(page)&&page>=1&&page<=50,'unqualified public page index');return{url:url.href,order:url.searchParams.get('o'),page}}
export function nextPage(html,currentUrl=BOARD+'alljob/?o=1'){
 const doc=readNativeDocument(html),links=doc.nodes(node=>node.tag==='a'&&doc.text(node)==='下一页'&&typeof node.attrs.href==='string'&&node.attrs.href.trim());if(!links.length)return null
 const node=one(links,'active native next-page link'),next=listingUrl(new URL(node.attrs.href,currentUrl).href),current=listingUrl(currentUrl);need(next.order===current.order&&next.page===current.page+1,'native next-page identity is inconsistent');return next.url
}
function cardsFromDocument(doc){
 const tables=doc.nodes(node=>node.tag==='table'&&/职位名称\s+职位类型\s+工作地点\s+发布时间/.test(doc.text(node))),table=one(tables,'native vacancy result table'),rows=[]
 for(const row of all(table,node=>node.tag==='tr')){const cells=children(row).filter(node=>node.tag==='td');if(!cells.length)continue;need(cells.length===4,'native listing public fields changed');if(cells.map(doc.text).join(' ')==='职位名称 职位类型 工作地点 发布时间')continue;const anchor=one(all(cells[0],node=>node.tag==='a'&&/^\/zpdetail\/\d+\?/.test(node.attrs.href||'')),'native posting anchor'),url=new URL(anchor.attrs.href,BOARD),id=/^\/zpdetail\/(\d+)$/.exec(url.pathname)?.[1],visibleTitle=doc.text(anchor),title=norm(anchor.attrs.title||visibleTitle),visibleLocation=doc.text(cells[2]),location=norm(cells[2].attrs.title||visibleLocation),postingRaw=doc.text(cells[3]);need(id&&url.origin===new URL(BOARD).origin&&title&&visibleTitle,'native listing identity unavailable');need(title===visibleTitle,'native tooltip/title conflict');const req=/[（(](J\d+)[)）]$/.exec(title)?.[1]||null;rows.push({title,detailUrl:url.href,detailId:id,requisitionId:req,location,visibleLocation,department:null,sourceNativePositionType:doc.text(cells[1])||null,postingDate:dateOnly(postingRaw),sourcePostingDate:postingRaw})}
 need(rows.length>0&&new Set(rows.map(row=>row.detailId)).size===rows.length,'native current listing empty or duplicate without verified empty model');return rows
}
export const jobCards=html=>cardsFromDocument(readNativeDocument(html))
export function listingModel(html,url){
 const doc=readNativeDocument(html),current=listingUrl(url),match=/共(\d+)条记录\s+当前第(\d+)\/(\d+)页/.exec(doc.text(doc.nodes(node=>node.tag==='root')[0]));need(match,'native current result total/page model unavailable');const reportedTotal=Number(match[1]),page=Number(match[2]),pages=Number(match[3]),cards=cardsFromDocument(doc);need(page===current.page&&reportedTotal>=cards.length&&pages>=1&&pages<=50&&pages===Math.ceil(reportedTotal/15)&&cards.length===Math.min(15,reportedTotal-(page-1)*15),'native page cardinality/identity does not reconcile');const next=nextPage(html,url);need((page<pages&&next)||(page===pages&&!next),'native continuation is incomplete');return{url,order:current.order,page,pages,reportedTotal,cards,nextUrl:next}
}
function publicDetail(html,{stylesheets=[]}={}){
 const doc=readNativeDocument(html),body=one(doc.nodes(node=>doc.hasClass(node,'xiangqingcontain')),'bound current public detail body'),parent=one(doc.nodes(node=>node.children.includes(body)),'native role body parent'),title=doc.text(one(children(parent).filter(node=>doc.hasClass(node,'boxSupertitle')),'current bound full native title')),criteria=one(all(body,node=>doc.hasClass(node,'xiangqingtext')),'complete current public criteria'),fields=[]
 for(const list of children(body).filter(node=>node.tag==='ul')){const cells=children(list);need(cells.length%2===0,'unpaired public role field');for(let index=0;index<cells.length;index+=2){const label=cells[index],value=cells[index+1];need(doc.hasClass(label,'ntitle')&&value.tag==='li','unrecognized public role field');const visible=doc.text(value),tooltip=norm(value.attrs.title);if(tooltip)need(visible===tooltip,'native role field/tooltip conflict');fields.push({label:doc.text(label).replace(/[：:]$/,''),value:visible})}}
 need(fields.length>0&&new Set(fields.map(row=>row.label)).size===fields.length,'native public role fields missing or duplicate')
 const text=doc.text(criteria);need(text.includes('工作职责')&&text.includes('任职资格')&&text.length>40,'full public responsibilities/qualifications unavailable')
 const supplements=children(body).filter(node=>!['ul','br'].includes(node.tag)&&node!==criteria&&!doc.hasClass(node,'xiangqingfooter')&&!doc.hasClass(node,'fenxiang')).map(doc.text).filter(Boolean)
 const publicPostingIdentity=doc.nodes(node=>node.tag==='meta'&&(node.attrs.name||'').toLowerCase()==='mobileurl').map(node=>{let url;try{url=new URL(node.attrs.content,BOARD)}catch{need(false,'public alternate posting identity URL invalid')}need(url.origin==='https://akulaku.m.zhiye.com'&&url.pathname==='/JobAd/Info'&&!url.username&&!url.password&&!url.hash&&[...url.searchParams.keys()].length===1&&/^\d+$/.test(url.searchParams.get('adid')||''),'public alternate posting identity routing changed');return{kind:'published-mobileUrl-alternate',url:url.href,postingId:url.searchParams.get('adid')}})
 const descendants=node=>typeof node==='string'||['template','script','style','noscript'].includes(node.tag)?[]:[node,...node.children.flatMap(descendants)],assets=descendants(criteria).filter(node=>['img','svg','canvas','object','embed','iframe','video','audio','math'].includes(node.tag)).map(node=>({tag:node.tag,...node.attrs})),visibility=criteriaStyleModel(html,stylesheets),issues=[...visibility.issues,...(assets.length?['unsupported-public-criteria-assets']:[])]
 return{title,fields,criteria:text,supplements,publicPostingIdentity,assets,visibility,issues,permanentDutyWorksites:permanentDutyWorksites(criteria,doc)}
}
export const description=html=>{const detail=publicDetail(html);return[...detail.fields.map(row=>row.label+'：'+row.value),detail.criteria,...detail.supplements].join('\n\n')}
export function detailModel(html,listing,options={}){
 const detail=publicDetail(html,options);need(detail.publicPostingIdentity.length===1&&detail.publicPostingIdentity.every(row=>row.postingId===listing.detailId),'public alternate posting identity missing or conflicts with requested native posting');need(detail.title===listing.title,'native list/detail title identity conflict');const fields=Object.fromEntries(detail.fields.map(row=>[row.label,row.value]));need(Object.hasOwn(fields,'发布时间')&&Object.hasOwn(fields,'截止时间')&&Object.hasOwn(fields,'工作地点'),'native original date/workplace fields unavailable');const posted=dateOnly(fields['发布时间']);need(listing.sourceNativeHotOnly||posted===listing.postingDate,'native original publication date conflict')
 const nonWorksiteLabel=label=>/citizen|nationality|国籍|资格|学历|证书|认证|qualification|education|certificate|credential/i.test(label)||!/workplace|work.?site|job.?location|工作|办公/i.test(label)&&(/headquarter|总部/i.test(label)||/^(?:company|employer|hiring organization|corporate|公司)\s*(?:country|address|国家|地址)$/i.test(label))
 const country=countryModel(fields['工作地点']),listingCountry=countryModel(listing.location),visibleDiff=Boolean(listing.visibleLocation&&listing.visibleLocation!==listing.location),prefix=/^(.+?)(?:\.{3}|…)$/u.exec(listing.visibleLocation||'')?.[1],clipped=Boolean(visibleDiff&&prefix&&listing.location?.startsWith(prefix)&&prefix.length<listing.location.length),locationConflict=!listing.sourceNativeHotOnly&&(listing.location!==fields['工作地点']||visibleDiff&&!clipped),additionalWorksites=detail.fields.filter(row=>row.label!=='工作地点'&&!nonWorksiteLabel(row.label)&&/(?:国家|地区|地址|地点|城市|省份)|办公|Country|Location|Workplace|Region|Address|(?:^|\s)(?:City|State|Province|Site)(?:$|\s)|(?:Work|Job|Office|Other|Additional).*(?:City|Site|State|Province)/i.test(row.label)),interpretations=[country,...(listing.sourceNativeHotOnly?[]:[listingCountry]),...(visibleDiff&&!clipped?[countryModel(listing.visibleLocation)]:[]),...additionalWorksites.map(row=>countryModel(row.value))]
 const permanent=detail.permanentDutyWorksites,genericQualified=Boolean(permanent?.qualified&&!listing.sourceNativeHotOnly&&!locationConflict&&fields['工作地点']==='国外'&&listing.location==='国外'&&(!listing.visibleLocation||listing.visibleLocation==='国外')),effectiveCountry=genericQualified?permanent:country,effectiveInterpretations=genericQualified?[permanent,...additionalWorksites.map(row=>countryModel(row.value))]:interpretations
 const allExplicitForeign=effectiveInterpretations.every(model=>model.slots.length>0&&model.slots.every(slot=>slot.countries.length>0&&slot.countries.every(value=>value!=='India'))),allExplicitIndia=effectiveInterpretations.every(model=>model.slots.length>0&&model.slots.every(slot=>slot.country==='India')),countryUncertainty=!allExplicitForeign&&(effectiveCountry.unresolved||effectiveCountry.slots.some(slot=>slot.ambiguous)||(additionalWorksites.length>0||locationConflict)&&!allExplicitIndia),allCountries=[...new Set(effectiveInterpretations.flatMap(model=>model.countries))],projectedCountry=!countryUncertainty&&effectiveCountry.indiaQualified?'India':!countryUncertainty&&allCountries.length===1?allCountries[0]:null
 const positionType=listing.sourceNativePositionType??null,body=[...(positionType?['职位类型：'+positionType]:[]),...detail.fields.map(row=>row.label+'：'+row.value),detail.criteria,...detail.assets.map(asset=>'Public criteria asset: '+[asset.alt,asset.src||asset.data].filter(Boolean).join(' — ')),...detail.supplements].join('\n\n')
 return{
  source:'akulaku',company:'Akulaku',companyDomain:'akulaku.com',companyCareerPage:CORPORATE,
  jobId:listing.detailId,requisitionId:listing.requisitionId,title:listing.title.replace(/\s*[（(]J\d+[)）]$/,''),
  sourceNativeFullTitle:detail.title,sourceNativePublicPostingIdentity:detail.publicPostingIdentity,
  sourceUrl:listing.detailUrl,detailUrl:listing.detailUrl,applyUrl:listing.detailUrl,department:null,
  sourceNativeListingPositionType:positionType,sourceNativeListingFields:[{label:'职位类型',value:positionType}],
  location:fields['工作地点'],city:null,state:null,country:projectedCountry,
  sourceNativeWorkplaceCountry:country,sourceNativeListingWorkplaceCountry:listingCountry,
  sourceNativeListingWorkplaceRendering:{kind:clipped?'verified-own-field-prefix-truncation':visibleDiff?'unreconciled-visible-value':'verbatim',nativeVisible:listing.visibleLocation??null,nativeFullTooltip:listing.location??null,confirmedByFullDetail:listing.location===fields['工作地点']},
  sourceNativeAdditionalWorkplaceFields:additionalWorksites,sourceNativeCountryInterpretations:[...interpretations,...(permanent?[permanent]:[])],sourceNativePermanentDutyWorksites:permanent,
  sourceNativeCountryScopeResolution:genericQualified?{kind:'generic-workplace-qualified-by-own-permanent-duty-clause',genericNativeWorkplace:fields['工作地点'],nativeClause:permanent.nativeClause,countries:permanent.countries,additionalWorkplaceFieldsChecked:additionalWorksites.length}:null,
  sourceNativeAllInterpretationsNonIndia:allExplicitForeign,sourceNativeExactCountryOrLocationUnresolved:country.unresolved||allCountries.length!==1||locationConflict,
  sourceNativeLocationConflict:locationConflict,sourceNativeHotOnly:Boolean(listing.sourceNativeHotOnly),sourceNativeActiveMembershipUnresolved:Boolean(listing.sourceNativeHotOnly),
  sourceCountryScopeUnresolved:countryUncertainty,sourceIndiaWorksiteQualified:!countryUncertainty&&effectiveCountry.indiaQualified,
  postingDate:posted,sourcePostingDate:fields['发布时间'],sourcePostingDatePrecision:'date-only',
  closingDate:dateOnly(fields['截止时间']),sourceClosingDate:fields['截止时间']||null,
  sourceClosingDatePrecision:fields['截止时间']?'date-only-native-timezone-and-exact-expiry-unpublished':'unpublished',employmentType:fields['工作性质']==='全职'?'Full-time':null,
  jobDescription:body,sourceDescription:body,sourceNativePublicRoleFields:detail.fields,sourceNativeFullCriteria:detail.criteria,sourceNativePublicSupplements:detail.supplements,
  sourceNativeCriteriaAssets:detail.assets,sourceNativeCriteriaVisibility:detail.visibility,sourceNativeCriteriaIssues:detail.issues,
  sourceDetailComplete:detail.issues.length===0,sourceScopeComplete:false,lifecycleCleanupAllowed:false
 }
}
