import {readNativeDocument as readBase} from '../../scraper-support/utils/activeNativeHtml.js'

// Visibility and inherited inert state apply to native preload scripts and JD.
export function readNativeDocument(html) {
  const doc=readBase(html),root=doc.nodes(n=>n.tag==='root')[0]
  const mark=(node,inherited=false)=>{
    if(typeof node==='string')return
    node.inert=Boolean(node.inert||inherited||Object.hasOwn(node.attrs,'inert'))
    for(const child of node.children)mark(child,node.inert)
  }
  mark(root)
  return doc
}
export const activeText=html=>{
  const doc=readNativeDocument(html)
  return doc.text(doc.nodes(n=>n.tag==='root')[0])
}
