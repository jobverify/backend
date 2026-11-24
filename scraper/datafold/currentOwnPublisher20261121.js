import {activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {need,one,all,norm,scalarFields,constraints} from './currentFacts20261120.js'

const HOME='https://www.datafold.com/careers/',ORIGIN=new URL(HOME).origin,brand=/\bDatafold\b/i
const pageTypes=new Set(['WebPage','AboutPage','Article']),employerKeys=new Set(['publisher','hiringOrganization','employer','company','parentOrganization']),applicationKeys=new Set(['applyurl','applicationurl','jobapplicationurl','applyuri','applicationuri','jobapplicationuri','applylink','applicationlink','joburl','detailurl'])
const key=value=>value.replace(/[-_\s]/g,'').toLowerCase(),schemaType=value=>typeof value==='string'?value.replace(/^https?:\/\/schema\.org\//,''):value
function identity(value,kind){
 need(typeof value==='string'&&value.trim()===value&&value.length>0,'Own structured publisher identity malformed')
 const url=new URL(value,HOME);need(!url.username&&!url.password&&!url.search,'Own structured publisher URL authority differs');url.hash=''
 need(kind==='page'?url.href===HOME:url.origin===ORIGIN&&(url.pathname==='/'||url.href===HOME),'Own structured publisher/page identity differs')
}
export function qualifyOwnPublisher(d,html,at,carrier){
 const nodes=all(d.root,()=>true),title=one(activeHead(html).titles,'Actual own head publisher title');need(brand.test(title),'Own head publisher title differs')
 const actualTitles=[]
 const visitTitle=(node,path=[])=>{if(node.tag==='title'&&path.some(owner=>owner.tag==='head')&&!path.some(owner=>owner.tag==='svg'))actualTitles.push(node);for(const child of node.children)if(typeof child!=='string')visitTitle(child,[...path,node])}
 visitTitle(d.root);carrier(d,one(actualTitles,'Actual own head title carrier'),at)
 need(!nodes.some(node=>node.tag==='base'||node.tag==='meta'&&/refresh/i.test(node.attrs['http-equiv']??'')),'Own recruitment navigation authority differs')
 const canonical=one(nodes.filter(node=>node.tag==='link'&&(node.attrs.rel??'').toLowerCase()==='canonical'),'Own current canonical');need(new URL(canonical.attrs.href,HOME).href===HOME,'Own current canonical differs');carrier(d,canonical,at)
 for(const meta of nodes.filter(node=>node.tag==='meta'&&['og:title','og:url','og:site_name'].includes(node.attrs.property))){if(meta.attrs.property==='og:url')need(new URL(meta.attrs.content,HOME).href===HOME,'Own OG page identity differs');else need(brand.test(meta.attrs.content??''),'Own OG publisher differs');carrier(d,meta,at)}
 let visited=0
 function relation(value,kind,context,depth){
  need(depth<=32&&++visited<=20000,'Finite own publisher relationship scope exceeded')
  if(Array.isArray(value)){need(value.length>0&&value.length<=128,'Own publisher relationship array malformed');value.forEach(entry=>relation(entry,kind,context,depth+1));return}
  if(typeof value==='string'){if(kind==='page'||/^(?:https?:|\/|#)/.test(value))identity(value,kind);else need(norm(value)==='Datafold','Own publisher relationship names another employer');return}
  need(value&&typeof value==='object','Own publisher relationship malformed');visit(value,context,depth+1,kind)
 }
 function visit(value,inherited,depth=0,relationship=null){
  need(depth<=32&&++visited<=20000,'Finite own structured publisher scope exceeded')
  if(Array.isArray(value)){value.forEach(entry=>visit(entry,inherited,depth+1,relationship));return}if(!value||typeof value!=='object')return
  const context=Object.hasOwn(value,'@context')?value['@context']:inherited
  need(context==null||typeof context==='string'&&/^https?:\/\/schema\.org\/?$/.test(context),'Own publisher structured context differs')
  const types=(Array.isArray(value['@type'])?value['@type']:[value['@type']]).filter(type=>type!=null).map(schemaType)
  need(!types.includes('JobPosting'),'Additional own published role needs qualification')
  const page=relationship==='page'||types.some(type=>pageTypes.has(type)),employer=relationship==='employer'||types.includes('Organization'),website=types.includes('WebSite')
  if(page||employer||website){
   for(const field of ['url','@id','sameAs'])if(value[field]!=null){const identities=Array.isArray(value[field])?value[field]:[value[field]];need(identities.length>0&&identities.length<=128,'Own publisher identity array malformed');identities.forEach(value=>identity(value,page?'page':'employer'))}
   for(const field of ['name','legalName','alternateName'])if(value[field]!=null){const names=Array.isArray(value[field])?value[field]:[value[field]];need(names.length>0&&names.every(name=>typeof name==='string'&&(page||website?brand.test(name):norm(name)==='Datafold')),'Own structured publisher name differs')}
   constraints(scalarFields(value).filter(field=>!employer||!['country','countrycode','addresscountry'].includes(key(field.key))),[],{employer:'Datafold',observedAt:at,countryAlternatives:[]})
  }
  if(relationship)need(['url','@id','name','legalName','alternateName'].some(field=>value[field]!=null),'Own publisher relationship lacks an identity')
  for(const [field,child]of Object.entries(value)){
   if(field==='@context')continue
   if(employerKeys.has(field)&&child!=null){relation(child,'employer',context,depth+1);continue}
   if(field==='mainEntityOfPage'&&child!=null){relation(child,'page',context,depth+1);continue}
   if(applicationKeys.has(key(field))&&child!=null){need(typeof child==='string'&&[HOME,'https://jobs.ashbyhq.com/datafold','https://api.ashbyhq.com/posting-api/job-board/datafold'].includes(new URL(child,HOME).href),'Own structured application alias differs')}
   if(child&&typeof child==='object')visit(child,context,depth+1)
  }
 }
 for(const script of nodes.filter(node=>node.tag==='script'&&(node.attrs.type??'').toLowerCase()==='application/ld+json')){carrier(d,script,at);visit(readLiteralModel(script.raw??'').value)}
}
