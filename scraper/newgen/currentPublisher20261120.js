import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {authoredLines,cls,constraints,disabled,need,norm,props,scalarFields} from './currentFacts20261120.js'

const schemaType=value=>String(value??'').replace(/^https?:\/\/schema\.org\//,'')
const key=value=>String(value).replace(/^data[-_:]/i,'').replace(/[-_\s]/g,'').toLowerCase()
const applicationKeys=new Set(['applicationurl','applyurl','jobapplicationurl','applicationuri','applyuri','jobapplicationuri','applicationlink','applylink'])

export function qualifyCurrentPublisher(p,{url,publisher,employer,observedAt,applicationURLs,requireHeading=false}) {
 const config={employer,observedAt,countryAlternatives:['India']}
 const entries=[]
 function owned(node,parents=[]){if(typeof node==='string'||node.inactive||node.inert||cls(node,'omnirecruit-panelbody'))return;const path=[...parents,node];entries.push({node,path});for(const child of node.children)owned(child,path)}
 owned(p.root)
 const scopes=entries.filter(({node,path})=>['head','h1','header'].includes(node.tag)||node.tag==='meta'||node.tag==='title'&&path.some(parent=>parent.tag==='head')||node.tag==='link'&&(node.attrs.rel??'').toLowerCase()==='canonical')
 if(requireHeading)need(scopes.some(({node})=>node.tag==='h1'),'actual own publisher heading unavailable')
 const carriers=[...new Set(scopes.flatMap(entry=>entry.path))]
 const attributes=carriers.map(n=>structuredClone(n.attrs))
 const applications=values=>{for(const value of values)if(applicationKeys.has(key(value.key)))need(typeof value.value==='string'&&applicationURLs.includes(new URL(value.value,url).href),'current publisher application alias differs')}
 for(const n of carriers) {
  need(!disabled(n)&&!Object.hasOwn(n.attrs,'hidden')&&!Object.hasOwn(n.attrs,'inert')&&n.attrs['aria-hidden']!=='true'&&!/(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse))/i.test(n.attrs.style??''),'actual publisher carrier unavailable')
  const values=props([n])
  applications(values)
  constraints(values,n.tag==='h1'?authoredLines(n):[],config)
  const property=(n.attrs.property??n.attrs.name??'').toLowerCase()
  if(property==='og:site_name')need(n.attrs.content===publisher,'current publisher OpenGraph employer differs')
  if(property==='og:url')need(new URL(n.attrs.content,url).href===url,'current publisher OpenGraph URL differs')
 }
 const models=[]
 function visit(value,inherited) {
  if(Array.isArray(value)){value.forEach(v=>visit(v,inherited));return}
  if(!value||typeof value!=='object')return
  const context=Object.hasOwn(value,'@context')?value['@context']:inherited
  const types=(Array.isArray(value['@type'])?value['@type']:[value['@type']]).map(schemaType)
  if(types.includes('JobPosting'))return
  if(types.some(type=>['Organization','WebSite','WebPage'].includes(type))) {
   need(typeof context==='string'&&/^https?:\/\/schema\.org\/?$/.test(context),'current publisher structured context differs')
   const fields=scalarFields(value).filter(field=>!['country','countrycode','addresscountry'].includes(key(field.key)))
   constraints(fields,[],config)
   applications(Object.entries(value).map(([key,value])=>({key,value})))
   if(types.includes('Organization'))need(value.name===publisher||value.name===employer,'current structured publisher employer differs')
   if(value.url!=null)need(typeof value.url==='string'&&new URL(value.url,url).origin===new URL(url).origin&&(!types.includes('WebPage')||new URL(value.url,url).href===url),'current structured publisher URL differs')
   if(value['@id']!=null)need(typeof value['@id']==='string'&&new URL(value['@id'],url).origin===new URL(url).origin,'current structured publisher identifier differs')
   models.push(structuredClone(value))
  }
  for(const[k,v]of Object.entries(value))if(k!=='@context')visit(v,context)
 }
 for(const{node:script,path}of entries.filter(({node})=>node.tag==='script'&&!node.attrs.src&&(node.attrs.type??'').toLowerCase()==='application/ld+json')) {
  const values=props(path);constraints(values,[],config);applications(values)
  visit(readLiteralModel(script.raw??'').value)
 }
 return {originalCarrierAttributes:attributes,originalStructuredPublisherModels:models,currentPublisher:publisher,legalEmployer:null,normalizedTitle:norm(p.title)}
}
