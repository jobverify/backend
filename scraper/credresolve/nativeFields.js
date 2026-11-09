import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'

const check=(ok,message)=>{if(!ok)throw Object.assign(Error('CredResolve native fields: '+message),{abortRetries:true})}
const within=(node,p)=>node.inert?[]:[...(p(node)?[node]:[]),...node.children.filter(n=>typeof n!=='string').flatMap(n=>within(n,p))]
export const readCredresolveFields=html=>{
 const doc=readVisibleNativeDocument(html,{strict:true}),parents=new Map()
 const index=node=>{for(const child of node.children.filter(n=>typeof n!=='string')){parents.set(child,node);index(child)}}
 doc.nodes(n=>n.tag==='root').forEach(index)
 const section=heading=>{
  const headings=doc.nodes(n=>/^h[1-6]$/.test(n.tag)&&doc.text(n)===heading)
  check(headings.length<=1,'duplicate/ambiguous '+heading.toLowerCase()+' field')
  if(!headings.length)return []
  const parent=parents.get(headings[0]),siblings=parent.children.filter(n=>typeof n!=='string'),start=siblings.indexOf(headings[0])+1,result=[]
  for(const node of siblings.slice(start)){if(/^h[1-6]$/.test(node.tag))break;result.push(node)}
  return result
 }
 return {
  field(heading){
   const nodes=section(heading)
   if(nodes[0]?.tag!=='p'||nodes[0].inert)return null
   const paragraphs=[]
   for(const node of nodes){if(node.tag!=='p')break;paragraphs.push(node)}
   if(heading==='Job Description')return paragraphs.filter(n=>!n.inert).map(n=>doc.text(n)).filter(Boolean).join(' ')||null
   if(paragraphs.some(n=>n.inert))return null
   const values=paragraphs.map(n=>doc.text(n)).filter(Boolean)
   check(new Set(values).size<=1,'ambiguous '+heading.toLowerCase()+' paragraph values')
   return values[0]||null
  },
  items(heading){return section(heading).flatMap(node=>within(node,n=>n.tag==='li')).map(node=>doc.text(node)).filter(Boolean)},
 }
}
