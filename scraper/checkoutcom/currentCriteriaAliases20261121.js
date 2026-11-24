import {need,all,norm,authoredLines} from './currentFacts20261120.js'

// Same owner/leaf predicates as the reviewed semantic criteria reader, with
// this source's explicit additional issuer, URI and timestamp field vocabulary.
const blocks=new Set(['address','article','aside','blockquote','dd','details','dialog','div','dl','dt','fieldset','figcaption','figure','footer','form','h1','h2','h3','h4','h5','h6','header','hgroup','li','main','menu','nav','ol','p','pre','section','summary','table','tbody','td','tfoot','th','thead','tr','ul'])
const normalized=value=>String(value).replace(/^data[-_:]/i,'').replace(/[-_\s]/g,'').toLowerCase(),labels=new Set(['label','dt','th']),excluded=new Set(['script','style','template','iframe','object','noscript'])
const leaf=node=>node.children.every(child=>typeof child==='string'||!blocks.has(child.tag)&&!excluded.has(child.tag)&&leaf(child))
export function additionalCriteria(root,recognized,applications){
 const properties=[]
 for(const owner of all(root,node=>(node.tag==='root'||blocks.has(node.tag))&&!node.inert&&!node.inactive)){
  if(owner.children.some(node=>typeof node==='string'&&norm(node)))continue
  const children=owner.children.filter(node=>typeof node!=='string'&&!node.inert&&!node.inactive)
  for(let index=0;index+1<children.length;index++){
   const label=children[index],value=children[index+1],name=norm(authoredLines(label).join(' ')).replace(/\s*:\s*$/,''),key=normalized(name)
   if(!recognized.has(key)||!labels.has(label.tag)&&!(children.length===2&&leaf(label))||labels.has(value.tag))continue
   const written=value.attrs.content??value.attrs.datetime??(applications.has(key)&&value.tag==='a'?value.attrs.href:null)??norm(authoredLines(value).join(' '));need(typeof written==='string'&&norm(written),'source semantic criterion has no actual value');properties.push({key:name,value:written});index++
  }
 }
 for(const line of authoredLines(root)){const pair=/^([^:]{1,60})\s*:\s*(.+)$/.exec(line);if(pair&&recognized.has(normalized(pair[1])))properties.push({key:pair[1],value:pair[2]})}
 return properties
}
