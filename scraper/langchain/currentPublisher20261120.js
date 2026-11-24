import {scriptKind} from './currentScriptKind20261120.js'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {need,one,all,norm,props,scalarFields,constraints} from './currentFacts20261120.js'
const lower=value=>value.replace(/[A-Z]/g,c=>c.toLowerCase())

export const HOME='https://www.langchain.com/careers',BOARD='https://jobs.ashbyhq.com/langchain',CLIENT=BOARD+'/embed',EMBED=BOARD+'?embed=js',FEED='https://api.ashbyhq.com/posting-api/job-board/langchain'
const COMPANY='LangChain',brand=/\bLangChain\b/i,key=value=>String(value).replace(/^data[-_:]/i,'').replace(/[-_\s]/g,'').toLowerCase()
const countries=new Set(['country','countrycode','jobcountry','workcountry','workplacecountry','addresscountry']),applications=new Set(['applyurl','applicationurl','jobapplicationurl','applyuri','applicationuri','applylink','applicationlink','joburl','detailurl']),employers=new Set(['employer','employername','company','companyname','hiringorganization','legalemployer'])
function url(value,base=HOME){need(typeof value==='string'&&value===value.trim()&&value.length,'current publisher URL malformed');const u=new URL(value,base);need(u.protocol==='https:'&&!u.username&&!u.password&&!u.port,'current publisher URL protocol/credentials differ');return u}
const exactPage=value=>{const u=url(value);return !u.hash&&u.href===HOME}
const pageIdentifier=value=>{const u=url(value);u.hash='';return u.href===HOME}
const homepage=value=>{const u=url(value);return ['langchain.com','www.langchain.com'].includes(u.hostname)&&u.pathname==='/'&&!u.search}
const generic=value=>/^(?:current\s+)?(?:careers?|career opportunities|job openings|open (?:roles|positions)|join (?:us|our team))[\s.!|:–—-]*$/i.test(norm(value))
function path(root,node,prior=[]){if(root===node)return[...prior,node];for(const child of root.children.filter(n=>typeof n!=='string')){const found=path(child,node,[...prior,root]);if(found)return found}return null}
function properties(values,at){
 for(const p of values)if(applications.has(key(p.key))&&p.value!=null){const u=url(p.value,BOARD);need(!u.hash&&[BOARD,EMBED].includes(u.href),'current own publisher/application binding differs')}
 constraints(values,[],{employer:COMPANY,observedAt:at,countryAlternatives:[]})
}
function carrier(d,node,at){
 const owners=path(d.root,node);need(owners,'actual own publisher carrier missing')
 for(const n of owners)need(!Object.hasOwn(n.attrs,'disabled')&&!Object.hasOwn(n.attrs,'hidden')&&!Object.hasOwn(n.attrs,'inert')&&n.attrs['aria-disabled']!=='true'&&n.attrs['aria-hidden']!=='true'&&!/(?:^|\s)(?:disabled|hidden|d-none)(?:\s|$)/.test(n.attrs.class??'')&&!/(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(n.attrs.style??''),'actual own publisher/control carrier withdrawn')
 properties(props(owners.map(n=>({...n,inactive:false,inert:false}))),at)
}
function publisherFacts(model,at){
 const retained=Object.fromEntries(Object.entries(model).filter(([name])=>!countries.has(key(name))))
 for(const [name,value] of Object.entries(retained))if(employers.has(key(name))&&value!=null)need((typeof value==='string'?value:value&&typeof value==='object'&&!Array.isArray(value)?value.name:null)===COMPANY,'current structured publisher employer differs')
 properties(scalarFields(retained),at)
}
export function currentAuthority(html,at){
 need(typeof html==='string'&&html.length>0,'original own publisher HTML missing')
 const d=document(html),nodes=all(d.root,()=>true),head=one(nodes.filter(n=>n.tag==='head'),'current own head'),headTitles=all(head,n=>n.tag==='title'),title=one(activeHead(html).titles,'current own head publisher title'),titleNode=one(headTitles,'actual own head title')
 need(norm(title)&&(brand.test(title)||generic(title)),'current own head title publisher differs')
 need(!nodes.some(n=>n.tag==='base'||n.tag==='meta'&&/refresh/i.test(n.attrs['http-equiv']??'')),'current own base/refresh differs')
 let named=brand.test(title);const originalPublisherModels=[]
 const canonical=one(nodes.filter(n=>n.tag==='link'&&(n.attrs.rel??'').toLowerCase()==='canonical'),'current own canonical');need(exactPage(canonical.attrs.href),'current own canonical differs');carrier(d,canonical,at);carrier(d,titleNode,at)
 for(const meta of nodes.filter(n=>n.tag==='meta'&&['og:title','og:site_name','og:url'].includes(n.attrs.property))){
  if(meta.attrs.property==='og:title'){need(typeof meta.attrs.content==='string'&&(brand.test(meta.attrs.content)||generic(meta.attrs.content)),'current own OG publisher title differs');named||=brand.test(meta.attrs.content)}
  if(meta.attrs.property==='og:site_name'){need(meta.attrs.content===COMPANY,'current own OG named publisher differs');named=true}
  if(meta.attrs.property==='og:url')need(exactPage(meta.attrs.content),'current own OG publisher URL differs')
  carrier(d,meta,at)
 }
 const headings=d.nodes(n=>n.tag==='h1');need(headings.length>0&&headings.length<=8,'current own heading missing/excessive');headings.forEach(n=>carrier(d,n,at))
 let visited=0
 function structured(value,inherited,depth=0){
  need(depth<=32&&++visited<=20000,'finite current own publisher structured scope exceeded')
  if(Array.isArray(value)){value.forEach(v=>structured(v,inherited,depth+1));return}if(!value||typeof value!=='object')return
  const context=Object.hasOwn(value,'@context')?value['@context']:inherited,types=(Array.isArray(value['@type'])?value['@type']:[value['@type']]).map(t=>String(t??'').replace(/^https?:\/\/schema\.org\//,''))
  need(!types.includes('JobPosting'),'additional own JobPosting requires vacancy qualification')
  if(types.some(t=>['WebPage','AboutPage','Article','WebSite','Organization'].includes(t))){
   need(typeof context==='string'&&/^https?:\/\/schema\.org\/?$/.test(context),'current own structured publisher context differs');publisherFacts(value,at);originalPublisherModels.push(structuredClone(value))
   if(types.some(t=>['WebSite','Organization'].includes(t))){need(value.name===COMPANY,'current own structured named publisher differs');named=true;if(value.url!=null)need(homepage(value.url),'current own structured publisher homepage differs');if(value['@id']!=null)need(homepage(value['@id']),'current own structured publisher identifier differs')}
   else{if(value.name!=null){need(typeof value.name==='string'&&(brand.test(value.name)||generic(value.name)),'current own structured page publisher wording differs');named||=brand.test(value.name)}if(value.url!=null)need(exactPage(value.url),'current own structured page URL differs');if(value['@id']!=null)need(pageIdentifier(value['@id']),'current own structured page identifier differs')}
   if(value.mainEntityOfPage!=null){const v=value.mainEntityOfPage;if(typeof v==='string')need(pageIdentifier(v),'current own nested page identifier differs');else need(v&&typeof v==='object'&&!Array.isArray(v),'current own nested page malformed')}
  }
  for(const [field,child] of Object.entries(value))if(field!=='@context'&&child&&typeof child==='object')structured(child,context,depth+1)
 }
 for(const script of nodes.filter(n=>n.tag==='script'&&!n.attrs.src&&lower(n.attrs.type??'')==='application/ld+json')){carrier(d,script,at);structured(readLiteralModel(script.raw??'').value)}
 need(named,'generic own title has no named publisher proof')
 const scripts=nodes.filter(n=>n.tag==='script'&&n.attrs.src).filter(n=>{try{return new URL(n.attrs.src,HOME).origin===new URL(BOARD).origin}catch{return false}}),declared=one(scripts,'current own declared native client'),container=one(nodes.filter(n=>n.attrs.id==='ashby_embed'),'current own native container')
 need(url(declared.attrs.src).href===CLIENT,'current own declared native account/client differs');need(scriptKind(declared),'current own declared client is programme data');carrier(d,declared,at);carrier(d,container,at)
 return{publisher:COMPANY,home:HOME,board:BOARD,client:CLIENT,originalDeclarations:[{attributes:structuredClone(declared.attrs)}],originalContainer:{tag:container.tag,attributes:structuredClone(container.attrs)},originalPublisherModels,legalEmployer:null}
}
