import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'

// A hidden attribute or ancestor does not prevent a script from executing.
// Keep all scripts and client-readable JSON, including conservatively pinned
// template content. Never use the document's active-node filter for this proof.
export function captureTenableScriptSurface(html,url){
  const root=readNativeDocument(html).nodes(node=>node.tag==='root')[0],scripts=[]
  let position=0
  const visit=(node,ancestors)=>{
    const at=position++,attributes=Object.fromEntries(Object.entries(node.attrs).sort())
    if(node.tag==='script')scripts.push({position:at,attributes,raw:node.raw||'',inert:node.inert===true,
      sourceUrl:node.attrs.src?new URL(node.attrs.src,url).href:null,ancestors})
    const context={tag:node.tag,attributes,inert:node.inert===true}
    for(const child of node.children||[])if(typeof child!=='string')visit(child,[...ancestors,context])
  }
  visit(root,[])
  return scripts
}
