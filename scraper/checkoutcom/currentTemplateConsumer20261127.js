import {createHash} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
import {parse} from 'acorn'
import {all,need,one} from './currentFacts20261120.js'
import {ancestors,carrier} from './currentConstraints20261121.js'
import {scriptKind} from './currentScriptKind20261120.js'
import {reviewedTemplateContract as reviewed} from './currentTemplateContract20261127.js'

const functions=new Set(['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'])
const children=node=>Object.entries(node??{}).filter(([name])=>!['start','end','raw','loc','range'].includes(name)).flatMap(([,value])=>(Array.isArray(value)?value:[value]).filter(value=>value&&typeof value==='object'&&typeof value.type==='string'))
const owned=node=>node?[node,...children(node).filter(child=>!functions.has(child.type)).flatMap(owned)]:[]
const canonical=node=>JSON.stringify(node,(key,value)=>['start','end','loc','range','raw'].includes(key)?undefined:value)
const sha=value=>createHash('sha256').update(value).digest('hex')
const ordered=value=>Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)))
const expression=source=>parse('('+source+')',{ecmaVersion:'latest'}).body[0].expression
const statement=source=>parse(source,{ecmaVersion:'latest'}).body[0]
const sameExpression=(actual,source,label)=>need(canonical(actual)===canonical(expression(source)),'current template '+label+' differs')
const sameFunction=(actual,source,label)=>need(canonical(actual)===canonical(statement(source)),'current template '+label+' differs')
const shape=node=>typeof node==='string'?node.replace(/\s+/g,' ').trim():node.tag==='script'?{tag:node.tag,attrs:ordered(node.attrs),ast:scriptKind(node)?sha(canonical(parse(node.raw,{ecmaVersion:'latest',sourceType:scriptKind(node)==='module'?'module':'script'}))):sha(node.raw??'')}:node.tag==='style'?{tag:node.tag,attrs:ordered(node.attrs),css:sha(node.raw??'')}:{tag:node.tag,attrs:ordered(node.attrs),children:node.children.map(shape)}

// The current component uses a different DOM/data construction protocol from the
// earlier async consumer. No original code is evaluated. The reviewed AST and
// declaration cohort bound all other side effects, while the checks below prove
// the data lineage, inactive fallback, default filter, clone and finite page
// traversal independently. Changing only a digest cannot qualify another flow.
// External browser execution and application activation remain unverified.
export function qualifyCurrentTemplateConsumer(page,at,listingURL,proxyURL,{programs,p,fetchNode,init}){
 const binding=node=>node?.type==='Identifier'?p.binding(node):null
 const same=(left,right)=>left===right||Boolean(binding(left)&&binding(left)===binding(right))
 const owner=node=>{for(let n=p.parents.get(node);n;n=p.parents.get(n))if(functions.has(n.type))return n;return null}
 const name=node=>node?.type==='MemberExpression'?p.member(node):null
 const isCall=(node,method)=>node?.type==='CallExpression'&&name(node.callee)===method
 const declared=(name,scope)=>one(p.nodes.filter(n=>n.type==='VariableDeclarator'&&n.id.type==='Identifier'&&n.id.name===name&&(!scope||owner(n)===scope)),'current template '+name+' binding')
 const named=name=>one(p.nodes.filter(n=>n.type==='FunctionDeclaration'&&n.id?.name===name),'current template '+name+' function')
 const wrapper=owner(init)
 need(init?.type==='FunctionDeclaration'&&!init.async&&init.params.length===0&&wrapper&&wrapper.params.length===0,'current template initializer closure differs')
 need(listingURL===reviewed.sourceListing&&new URL(listingURL).search===''&&!new URL(listingURL).hash,'current template configured query is active')
 need(fetchNode.arguments.length===1&&p.literal(fetchNode.arguments[0])===proxyURL&&p.builtin(fetchNode.callee,'fetch'),'current template declared request is disconnected')
 const invocation=one(owned(wrapper.body).filter(n=>n.type==='CallExpression'&&same(n.callee,init.id)),'current directly invoked template initializer')
 need(p.parents.get(invocation)?.type==='ExpressionStatement'&&p.parents.get(p.parents.get(invocation))===wrapper.body&&invocation.arguments.length===0,'current template initializer is conditional or has arguments')
 const immediate=one(p.nodes.filter(n=>n.type==='CallExpression'&&p.resolve(n.callee)===wrapper),'current immediately invoked template closure')
 need(immediate.arguments.length===0&&p.parents.get(immediate)?.type==='ExpressionStatement'&&p.parents.get(p.parents.get(immediate))===p.tree,'current template closure is not directly active')

 const rootBinding=declared('root',wrapper)
 sameExpression(rootBinding.init,"document.querySelector('[jobs-section]')",'root selection')
 need(p.builtin(rootBinding.init.callee.object,'document'),'current template document is replaced')
 const root=one(all(page.d.root,n=>Object.hasOwn(n.attrs,'jobs-section')),'current own template component')
 carrier(page,root,at,{allowed:[listingURL]})
 need(!Object.hasOwn(root.attrs,'jobs-ready'),'current template component is already initialized')
 const dummy=declared('useDummy',wrapper)
 sameExpression(dummy.init,"String(root.getAttribute('jobs-dummy')).toLowerCase() === 'true'",'dummy activation rule')
 need(p.builtin(dummy.init.left.callee.object.callee,'String')&&String(root.attrs['jobs-dummy']).toLowerCase()==='false','current template dummy data is active or unresolved')

 // Trace the very same native fetch object through each returned promise value.
 const chain=[]
 let cursor=fetchNode
 for(;;){const member=p.parents.get(cursor),call=p.parents.get(member);if(member?.type!=='MemberExpression'||member.object!==cursor||call?.type!=='CallExpression'||call.callee!==member)break;need(call.arguments.length===1&&functions.has(call.arguments[0]?.type),'current template promise callback is unresolved');chain.push({method:name(member),call,callback:call.arguments[0]});cursor=call;need(chain.length<=8,'current template promise chain is unbounded')}
 need(isDeepStrictEqual(chain.map(r=>r.method),['then','then','catch','then','catch'])&&p.parents.get(cursor)?.type==='ExpressionStatement'&&owner(cursor)===init,'current template native promise pipeline differs')
 const [decode,records,recover,consume,failed]=chain.map(row=>row.callback)
 sameExpression(decode,`function (response) {
  if (!response.ok) throw new Error('HTTP ' + response.status);
  return response.json();
 }`,'same Response JSON return')
 sameExpression(records,'function (data) { return data.jobs || []; }','unaltered complete JSON jobs return')
 sameExpression(recover,`function (error) {
  if (!useDummy) throw error;
  console.warn('[jobs] API unavailable, showing dummy jobs only:', error);
  return [];
 }`,'failed native request rethrow')
 sameExpression(consume,`function (jobs) {
  state.jobs = useDummy ? jobs.concat(DUMMY_JOBS) : jobs;
  readUrl();
  els.search.value = state.search;
  buildOptions();
  apply();
 }`,'unchanged native jobs consumption')
 sameExpression(failed,`function (error) {
  console.error('[jobs] Failed to load jobs:', error);
  showError();
 }`,'error-only UI path')
 need(binding(decode.params[0])?.writes.length===0&&binding(records.params[0])?.writes.length===0&&binding(consume.params[0])?.writes.length===0,'current template Response/JSON/jobs parameter is overwritten')
 const jobsWrites=p.nodes.filter(n=>n.type==='AssignmentExpression'&&name(n.left)==='jobs'&&n.left.object.type==='Identifier'&&n.left.object.name==='state')
 need(jobsWrites.length===1&&owner(jobsWrites[0])===consume&&same(jobsWrites[0].right.alternate,consume.params[0]),'current template raw native record identity is replaced')

 sameExpression(declared('state',wrapper).init,`{
  jobs: [], filtered: [], shown: 0, search: '',
  selected: { locations: new Set(), departments: new Set() }
 }`,'empty initial state')
 sameExpression(declared('FILTERS',wrapper).init,`{
  locations: { param: 'location', read: function (job) { return job.addressCountry || job.location || null; } },
  departments: { param: 'department', read: function (job) { return job.parentDepartment || null; } }
 }`,'native filter field definitions')
 sameExpression(declared('TYPES',wrapper).init,'Object.keys(FILTERS)','complete native filter keys')
 sameFunction(named('readUrl'),`function readUrl() {
  var params = new URLSearchParams(window.location.search);
  TYPES.forEach(function (type) { state.selected[type] = new Set(params.getAll(FILTERS[type].param)); });
  state.search = params.get('search') || '';
 }`,'empty configured URL filter reads')
 sameFunction(named('matches'),`function matches(job, query, skip) {
  return TYPES.every(function (type) {
   if (type === skip) return true;
   var picked = state.selected[type];
   if (!picked.size) return true;
   var value = FILTERS[type].read(job);
   return Boolean(value) && picked.has(value);
  }) && (job.title || '').toLowerCase().indexOf(query) !== -1;
 }`,'all-record empty-set and empty-query predicate')
 sameFunction(named('$'),`function $(selector, scope) { return (scope || root).querySelector(selector); }`,'same-root native selector')
 sameExpression(declared('els',wrapper).init,`{
  list: $('[jobs-list]'), empty: $('[jobs-empty]'), emptyReset: $('[jobs-empty-reset]'),
  more: $('[jobs-load-more]'), counter: $('[jobs-counter]'), chips: $('[jobs-chips]'),
  head: $('[jobs-table-head]'), search: $('[jobs-search]'), searchClear: $('[jobs-search-clear]')
 }`,'same-root DOM bindings')
 sameExpression(declared('tpl',wrapper).init,`{
  job: $('[jobs-templates] [jobs-job-link]'), chip: $('[jobs-templates] [jobs-chip]'),
  option: $('[jobs-templates] [jobs-dropdown-item]')
 }`,'same-root clone template bindings')

 sameFunction(named('safeUrl'),String.raw`function safeUrl(url) { return /^https?:\/\//i.test(url || '') ? url : '#'; }`,'native application URI preservation')
 sameFunction(named('createRow'),`function createRow(job) {
  var row = tpl.job.cloneNode(true);
  var url = safeUrl(job.applyUrl);
  row.setAttribute('href', url);
  if (url === '#') { row.addEventListener('click', function (event) { event.preventDefault(); }); }
  else { row.setAttribute('target', '_blank'); row.setAttribute('rel', 'noopener'); }
  renderTitle($('[jobs-job-title]', row), job.title || '');
  $('[jobs-job-department]', row).textContent = job.team || '';
  $('[jobs-job-location]', row).textContent = job.location || '';
  return row;
 }`,'same-record native application/title/workplace clone')
 sameFunction(named('renderTitle'),`function renderTitle(el, title) {
  el.textContent = '';
  var query = state.search.toLowerCase();
  var index = query ? title.toLowerCase().indexOf(query) : -1;
  if (index === -1) { el.textContent = title; return; }
  var mark = document.createElement('span');
  mark.className = look('jobs_highlight');
  mark.setAttribute('jobs-highlight', '');
  mark.textContent = title.slice(index, index + query.length);
  el.appendChild(document.createTextNode(title.slice(0, index)));
  el.appendChild(mark);
  el.appendChild(document.createTextNode(title.slice(index + query.length)));
 }`,'unchanged default native title text')
 sameFunction(named('renderRows'),`function renderRows(from, to) {
  var fragment = document.createDocumentFragment();
  state.filtered.slice(from, to).forEach(function (job) { fragment.appendChild(createRow(job)); });
  els.list.appendChild(fragment);
 }`,'contiguous same-record page and DOM append')
 sameFunction(named('render'),`function render() {
  var keepScroll = holdScroll();
  var query = state.search.toLowerCase();
  state.filtered = state.jobs.filter(function (job) { return matches(job, query); });
  state.shown = Math.min(PAGE_SIZE, state.filtered.length);
  els.list.textContent = '';
  renderRows(0, state.shown);
  renderChips();
  TYPES.forEach(function (type) { dropdowns[type].sync(); });
  var total = state.filtered.length;
  els.counter.textContent = total === 0 ? 'No jobs' : 'Showing ' + total + (total === 1 ? ' job' : ' jobs');
  els.empty.hidden = total > 0;
  if (els.head) els.head.hidden = false;
  updateSearchClear();
  els.more.hidden = state.shown >= total;
  keepScroll();
 }`,'complete default filtered inventory and first page')
 sameFunction(named('apply'),'function apply() { render(); writeUrl(); }','connected default renderer')
 sameFunction(named('loadMore'),`function loadMore() {
  var from = state.shown;
  state.shown = Math.min(state.shown + PAGE_SIZE, state.filtered.length);
  renderRows(from, state.shown);
  els.more.hidden = state.shown >= state.filtered.length;
  var firstNew = els.list.children[from];
  if (firstNew) firstNew.focus({ preventScroll: true });
 }`,'complete finite remaining-page traversal')
 const pageSize=p.literal(declared('PAGE_SIZE',wrapper).init)
 need(Number.isSafeInteger(pageSize)&&pageSize===12&&pageSize>0,'current template page size is not finite/positive')
 const moreRegistration=one(owned(init.body).filter(n=>isCall(n,'addEventListener')&&name(n.callee.object)==='more'),'current load-more event registration')
 sameExpression(moreRegistration,`els.more.addEventListener('click', function (event) { event.preventDefault(); loadMore(); })`,'connected remaining-page activation')

 const select=(attribute,scope=root,value)=>one(all(scope,n=>Object.hasOwn(n.attrs,attribute)&&(value==null||n.attrs[attribute]===value)),'actual own '+attribute+(value==null?'':'='+value))
 const list=select('jobs-list'),more=select('jobs-load-more'),templates=select('jobs-templates'),row=select('jobs-job-link',templates)
 need(row.tag==='a'&&row.attrs.href==='#','current template source row is not the native application anchor')
 const title=select('jobs-job-title',row),workplace=select('jobs-job-location',row)
 select('jobs-job-department',row);select('jobs-chip',templates);select('jobs-chip-label',templates)
 select('jobs-dropdown-item',templates);select('jobs-dropdown-item-label',templates);select('jobs-dropdown-item-check',templates)
 for(const attribute of['jobs-counter','jobs-empty','jobs-empty-reset','jobs-chips','jobs-table-head','jobs-search','jobs-search-clear'])carrier(page,select(attribute),at,{allowed:[listingURL]})
 for(const type of['locations','departments']){
  const dropdown=select('jobs-dropdown',root,type)
  carrier(page,dropdown,at,{allowed:[listingURL]})
  for(const attribute of['jobs-dropdown-trigger','jobs-dropdown-menu','jobs-dropdown-list','jobs-dropdown-clear','jobs-dropdown-count','jobs-dropdown-label'])select(attribute,dropdown)
 }
 carrier(page,list,at,{allowed:[listingURL]});carrier(page,more,at,{allowed:[listingURL]})
 // cloneNode(true) drops only the deliberately hidden templates ancestor. The
 // anchor and retained title/workplace descendants themselves must be visible.
 const visible=node=>!Object.hasOwn(node.attrs,'hidden')&&!Object.hasOwn(node.attrs,'inert')&&!Object.hasOwn(node.attrs,'disabled')&&!Object.hasOwn(node.attrs,'jobs-skeleton')&&!['true'].includes(node.attrs['aria-hidden'])&&node.attrs['aria-disabled']!=='true'&&!/(?:^|\s|--)(?:hide|hidden|invisible|d-none|sr-only)(?:\s|$)/i.test(node.attrs.class??'')&&!/(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse)|content-visibility\s*:\s*hidden)/i.test(node.attrs.style??'')
 need([list,more,...ancestors(page.d.root,list),...ancestors(page.d.root,more),...all(row,()=>true)].every(visible),'current cloned role/title/list/load-more is withdrawn')
 need(ancestors(row,title)&&ancestors(row,workplace)&&!all(list,n=>n.tag==='a').length,'current template role metadata or list cleanup scope differs')

 // Extra safety boundary for the substantial UI/scroll/dropdown helpers and
 // neighboring inline programmes: their reviewed syntax and markup are fixed.
 // This also rejects injected primitive overrides, reflection/getter aliases,
 // record rewrites, unknown callbacks, hidden CSS and script declaration drift.
 need(sha(canonical(p.tree))===reviewed.clientAstSha256,'current template programme needs a new semantic review')
 const programmeShapes=programs.map(q=>({ast:sha(canonical(q.tree)),attrs:ordered(q.script.originalNode.attrs)}))
 need(isDeepStrictEqual(programmeShapes,reviewed.programs),'current template active inline browser dependency cohort differs')
 const styles=all(page.d.root,n=>n.tag==='style').map(n=>({attrs:ordered(n.attrs),sha256:sha(n.raw??'')}))
 need(isDeepStrictEqual(styles,reviewed.inlineStyles),'current template CSS visibility declarations differ')
 const externals=all(page.d.root,n=>n.tag==='script'&&n.attrs.src&&!n.inactive&&!n.inert).map(n=>ordered(n.attrs))
 const stylesheets=all(page.d.root,n=>n.tag==='link'&&String(n.attrs.rel??'').toLowerCase()==='stylesheet').map(n=>ordered(n.attrs))
 need(isDeepStrictEqual(externals,reviewed.externalScripts)&&isDeepStrictEqual(stylesheets,reviewed.stylesheets),'current template adopted asset declarations differ')
 need(sha(JSON.stringify(shape(root)))===reviewed.sectionSha256,'current template component structure or visibility binding differs')
 need(isDeepStrictEqual(ancestors(page.d.root,root).map(n=>({tag:n.tag,attrs:ordered(n.attrs)})),reviewed.ancestorAttributes),'current template inherited publication/visibility attributes differ')
 for(const name of['fetch','document','Response','Promise','Set','Array','String','Boolean','Math','Object','URLSearchParams','Node','Element','window','globalThis','self'])need(!p.root.values.has(name),'current template browser primitive has a global replacement')

 return{proxyURL,listingURL,connected:true,defaultUnfiltered:true,nativeProgramsExecuted:false,originalProgram:p.script.raw,originalScriptAttributes:structuredClone(p.script.originalNode.attrs),originalContainerAttributes:structuredClone(list.attrs),defaultFilterEvidence:{locations:[],departments:[],input:'',source:'empty configured query; original URLSearchParams/Set reads and same-record predicate'},sameRecordFields:{id:'id',title:'title',application:'applyUrl'},templateConsumer:{defaultRenderPageSize:pageSize,loadMorePreservesMembership:true,pageIntervals:'[0,min(12,n)); then [shown,min(shown+12,n)) until shown=n',dummyActive:false,rawRecordsReplaced:false,nativeIdentityRenderedIntoDOM:false,reviewedProgramSha256:reviewed.clientAstSha256,originalRootAttributes:structuredClone(root.attrs),originalTemplateAttributes:structuredClone(row.attrs),reviewedStylesheets:structuredClone(stylesheets)},legalEmployer:null,companyIndiaTotal:null,companyGlobalTotal:null}
}
