import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {activeHead,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
const check=(ok,message)=>{if(!ok)throw Object.assign(Error('Fingent native role: '+message),{abortRetries:true})}
const norm=value=>decodeNativeEntities(value).replace(/â€“|â€”/g,'-').replace(/[\u2013\u2014]/g,'-').replace(/\s+/g,' ').trim()
const within=(node,p)=>node.inert?[]:[...(p(node)?[node]:[]),...node.children.filter(n=>typeof n!=='string').flatMap(n=>within(n,p))]
const controls=(node,p)=>[...(p(node)?[node]:[]),...node.children.filter(n=>typeof n!=='string').flatMap(n=>controls(n,p))]
const one=(items,label)=>{check(items.length===1,'missing/ambiguous '+label);return items[0]}
export const readFingentOpenings=html=>{
 const doc=readVisibleNativeDocument(html,{strict:true}),sections=doc.nodes(n=>doc.hasClass(n,'open-positions')&&doc.hasClass(n,'careeropenings'))
 const section=one(sections,'openings section'),jobs=new Map()
 for(const anchor of within(section,n=>n.tag==='a'&&n.attrs.href)){
  const url=new URL(anchor.attrs.href,'https://www.fingent.com/careers/career-openings/')
  if(!url.pathname.startsWith('/careers/jobs/'))continue
  check(url.origin==='https://www.fingent.com'&&/^\/careers\/jobs\/[^/]+\/$/.test(url.pathname)&&!url.search&&!url.hash,'foreign/unbound advertised role URL')
  const headings=within(anchor,n=>n.tag==='h3'),slots=controls(anchor,n=>n.tag==='title')
  const legacy=!headings.length&&!slots.length?norm(doc.text(anchor)).match(/^(.+?)\s+(\d[\d+\s-]*years?)$/i):null
  const title=legacy?legacy[1]:norm(doc.text(one(headings,'listing role title')))
  const experience=legacy?legacy[2]:norm(one(slots,'listing experience').raw||'')
  check(title&&/^\d[\d+\s-]*years?$/i.test(experience),'invalid listing role fields')
  check(!jobs.has(url.href),'duplicate advertised role URL')
  jobs.set(url.href,{title,experience,location:null,sourceUrl:url.href,applyUrl:url.href})
 }
 check(jobs.size>0,'no active advertised roles');return [...jobs.values()]
}
export const advertisedFieldStylesheet=html=>{
 const doc=readVisibleNativeDocument(html,{strict:true}),links=doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='stylesheet'&&n.attrs.href?.includes('/noo-jobmonster-child/css/custom.css'))
 const link=one(links,'declared role-field author stylesheet')
 check(!Object.hasOwn(link.attrs,'disabled')&&/^(?:all|screen)?$/i.test((link.attrs.media||'').trim()),'inactive or conditional role-field author stylesheet')
 const url=new URL(link.attrs.href)
 check(url.origin==='https://www.fingent.com'&&url.pathname==='/careers/wp-content/themes/noo-jobmonster-child/css/custom.css','foreign role-field stylesheet')
 return url.href
}
// A body <title> needs a real author display declaration. Only top-level
// rules prove it here; conditional blocks cannot establish screen visibility.
// Track strings, comments and delimiters so quoted CSS text is never a rule.
const unconditionalAuthorRules=css=>{
 const rules=[];let depth=0,round=0,quote='',token='',selector='',declarations=[],nested=false
 const text=String(css||'')
 for(let i=0;i<text.length;i++){const char=text[i]
  if(char==='\\'){token+=text.slice(i,i+2);i++;continue}
  if(quote){token+=char;if(char===quote)quote='';continue}
  if(char==='"'||char==="'"){quote=char;token+=char;continue}
  if(char==='/'&&text[i+1]==='*'){const end=text.indexOf('*/',i+2);if(end<0)return [];i=end+1;token+=' ';continue}
  if(char==='('||char==='[')round++
  else if(char===')'||char===']'){if(--round<0)return []}
  if(round){token+=char;continue}
  if(char==='{'){if(depth++===0){selector=token.trim().replace(/\s+/g,' ');token='';declarations=[];nested=false}else{nested=true;token+=char}continue}
  if(char==='}'){if(--depth<0)return [];if(depth===0){declarations.push(token.trim());if(!nested&&!selector.startsWith('@'))rules.push({selector,declarations});token=''}else token+=char;continue}
  if(char===';'){if(depth===0)token='';else if(depth===1){declarations.push(token.trim());token=''}else token+=char;continue}
  token+=char
 }
 return depth||round||quote?[]:rules
}
const declaresRenderedTitles=css=>{
 const rules=unconditionalAuthorRules(css).filter(rule=>rule.selector==='ul.career-list li title')
 const display=rules[0]?.declarations.filter(value=>/^display\s*:/i.test(value))||[]
 return rules.length===1&&display.length===1&&/^display\s*:\s*block\s*(?:!important)?$/i.test(display[0])
}
// The native author explicitly renders body <title> values. Probe only their
// visibility with a neutral element, retaining the actual ancestor tree and
// retargeting type selectors; never use probe text as role data. Attribute
// selectors, quoted values, classes and IDs retain their original meanings.
const retargetTitleSelector=selector=>{
 let result='',index=0,brackets=0,quote=''
 while(index<selector.length){const c=selector[index]
  if(c==='\\'){result+=selector.slice(index,index+2);index+=2;continue}
  if(quote){result+=c;if(c===quote)quote='';index++;continue}
  if(c==='"'||c==="'"){quote=c;result+=c;index++;continue}
  if(c==='[')brackets++;else if(c===']')brackets--
  if(!brackets&&/[a-z_-]/i.test(c)){const token=selector.slice(index).match(/^[\w-]+/)[0];result+=token.toLowerCase()==='title'&&!/[.#]/.test(selector[index-1]||' ')?'fingent-title-slot':token;index+=token.length;continue}
  result+=c;index++
 }
 return result
}
const retargetStyles=css=>String(css||'').replace(/\/\*[\s\S]*?\*\//g,'').replace(/([^{}]+)(\{[^{}]*\})/g,(_,selectors,body)=>retargetTitleSelector(selectors)+body)
const visibleHeroFields=(html,authorCSS)=>{
 check(!/<\/?fingent-title-slot\b/i.test(html),'unreviewed native field probe collision')
 const start=html.search(/<body\b/i);if(start<0)return {}
 const projected=(html.slice(0,start)+html.slice(start).replace(/(<\/?)(title)(?=[\s>])/gi,'$1fingent-title-slot'))
  .replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi,(_,open,css,close)=>open+retargetStyles(css)+close)
 const doc=readVisibleNativeDocument(projected+'<style>'+retargetStyles(authorCSS)+'</style>',{strict:true}),result={}
 for(const hero of doc.nodes(n=>n.tag==='section'&&doc.hasClass(n,'innerbnr2')))for(const list of within(hero,n=>n.tag==='ul'&&doc.hasClass(n,'career-list')))for(const li of within(list,n=>n.tag==='li')){
  const labels=within(li,n=>n.tag==='label');if(labels.length!==1)continue
  const key=norm(doc.text(labels[0])).replace(/\s*:\s*$/,'')
  if(['Location','Work Type','Experience'].includes(key))result[key]=within(li,n=>n.tag==='fingent-title-slot').length===1
 }
 return result
}
export const readFingentDetail=(html,listing,{authorCSS,stylesheetUrl}={})=>{
 if(authorCSS)check(advertisedFieldStylesheet(html)===stylesheetUrl,'unbound author stylesheet')
 const doc=readVisibleNativeDocument(html+'<style>'+String(authorCSS||'')+'</style>',{strict:true}),canonicals=doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical')
 check(canonicals.length===1&&canonicals[0].attrs.href===listing.sourceUrl,'canonical role identity contradiction')
 const titleNodes=doc.nodes(n=>n.tag==='h1'),titles=titleNodes.map(n=>norm(doc.text(n)))
 check(titles.length>=1&&titles.length<=2&&titles.every(t=>t===norm(listing.title)),'listing/detail title contradiction')
 check(activeHead(html).titles.some(t=>/Fingent/i.test(t)),'missing employer identity')
 const hero=one(doc.nodes(n=>n.tag==='section'&&doc.hasClass(n,'innerbnr2')),'role hero'),fields={}
 const fieldList=one(within(hero,n=>n.tag==='ul'&&doc.hasClass(n,'career-list')),'role field list')
 for(const li of within(fieldList,n=>n.tag==='li')){
  const labels=within(li,n=>n.tag==='label');if(labels.length!==1)continue
  const key=norm(doc.text(labels[0])).replace(/\s*:\s*$/,'')
  if(!['Location','Work Type','Experience'].includes(key))continue
  check(!Object.hasOwn(fields,key),'duplicate role hero field')
  const values=controls(li,n=>n.tag==='title'),value=one(values,'literal '+key+' slot')
  check(!Object.hasOwn(value.attrs,'hidden')&&!Object.hasOwn(value.attrs,'inert')&&value.attrs['aria-hidden']!=='true'&&!/display\s*:\s*none|visibility\s*:\s*hidden/i.test(value.attrs.style||''),'inactive declared role field')
  fields[key]=norm(value.raw||'')||null
 }
 const authorDeclared=declaresRenderedTitles(authorCSS),visibility=authorDeclared?visibleHeroFields(html,authorCSS):{}
 const rendered=authorDeclared&&Object.keys(fields).every(key=>visibility[key]===true),location=visibility.Location?fields.Location||null:null
 const content=one(doc.nodes(n=>doc.hasClass(n,'job-content')),'full role description'),description=doc.text(content)
 check(description.length>150&&!/^(?:access denied|not found|job expired|job no longer available)/i.test(description),'missing/error/closed description')
 const dates=doc.nodes(n=>n.tag==='time'&&doc.hasClass(n,'entry-date')),date=dates.length?one(dates,'posting timestamp').attrs.datetime:null
 check(!date||/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:Z|[+-]\d\d:\d\d)$/.test(date)&&Number.isFinite(Date.parse(date)),'invalid native posting timestamp')
 const form=one(doc.nodes(n=>n.tag==='form'&&n.attrs.id==='apply_job_form'),'active native application form')
 const ids=controls(form,n=>n.tag==='input'&&n.attrs.name==='job_id'),referers=controls(form,n=>n.tag==='input'&&n.attrs.name==='_wp_http_referer')
 const id=one(ids,'application job identifier').attrs.value
 check(/^\d+$/.test(id)&&one(referers,'application role reference').attrs.value===new URL(listing.sourceUrl).pathname&&form.attrs.method?.toLowerCase()==='post','unbound native application identity')
 check(!form.attrs.action||new URL(form.attrs.action,listing.sourceUrl).href===listing.sourceUrl,'foreign application action')
 const rawDoc=document(html),rawHeaders=rawDoc.nodes(n=>rawDoc.hasClass(n,'job-location')).map(n=>rawDoc.text(n)),rawDates=rawDoc.nodes(n=>n.tag==='time'&&rawDoc.hasClass(n,'entry-date')).map(n=>n.attrs.datetime)
 check(!fields.Location||rawHeaders.every(label=>norm(label)===fields.Location),'native workplace header contradiction')
 return {...listing,title:titles[0],jobId:id,requisitionId:id,location:location||null,city:null,country:location&&/\bIndia\b/i.test(location)?'India':null,employmentType:visibility['Work Type']?fields['Work Type']||null:null,postingDate:date||null,closingDate:null,jobDescription:description,rawNativeRoleEvidence:{canonicalUrl:canonicals[0].attrs.href,titles,workplaceHeader:location||null,declaredHeroFields:fields,declaredHeroRenderingQualified:rendered,declaredHeroFieldRenderingQualified:visibility,authorCSSDisplayProof:rendered?{stylesheetUrl,selector:'ul.career-list li title',display:'block'}:null,inactiveAlternateWorkplaceHeaders:rawHeaders,inactiveAlternateJobDates:rawDates,applicationJobId:id,applicationReferer:referers[0].attrs.value,identityQualified:true,applicationSubmissionQualified:false,nativeClosingDate:null}}
}
