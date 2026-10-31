/* Seven-segment SVG readouts; native values remain accessible and editable. */
(()=>{
 const selector='.rotary-value,.param output,.macro output,#db';
 const digits={0:'abcdef',1:'bc',2:'abdeg',3:'abcdg',4:'bcfg',5:'acdfg',6:'acdefg',7:'abc',8:'abcdefg',9:'abcdfg','-':'g'};
 const segments={a:'3,1 11,1 13,3 11,5 3,5 1,3',b:'12,4 14,2 14,12 12,14 10,12 10,6',c:'12,14 14,16 14,26 12,24 10,22 10,16',d:'3,23 11,23 13,25 11,27 3,27 1,25',e:'2,14 4,16 4,22 2,24 0,26 0,16',f:'2,4 4,6 4,12 2,14 0,12 0,2',g:'3,12 11,12 13,14 11,16 3,16 1,14'};
 function paint(el){
  const screen=el.parentElement;if(!screen.classList.contains('digital-screen'))return;
  const value=el.tagName==='INPUT'?el.value:el.textContent,match=value.trim().match(/^([+\-\d.,]+)\s*(.*)$/);const numeric=match?match[1]:value,unit=match?match[2]:'';
  if(screen.dataset.value===value)return;screen.dataset.value=value;
  let x=0,content='';for(const char of numeric){if(char==='.'||char===','){content+='<circle class="segment lit" cx="'+(x+2)+'" cy="25" r="1.5"/>';x+=6;continue;}const on=digits[char]||'';for(const [key,points]of Object.entries(segments))content+='<polygon class="segment '+(on.includes(key)?'lit':'')+'" points="'+points+'" transform="translate('+x+' 0)"/>';x+=18;}
  screen.querySelector('.segment-digits').innerHTML='<svg aria-hidden="true" viewBox="0 0 '+Math.max(16,x)+' 28" height="22" width="'+Math.max(13,x*.78)+'">'+content+'</svg>'+(unit?'<small>'+unit+'</small>':'');
 }
 function setup(){document.querySelectorAll(selector).forEach(el=>{if(!el.parentElement.classList.contains('digital-screen')){const screen=document.createElement('span');screen.className='digital-screen';el.before(screen);screen.append(el);const digits=document.createElement('span');digits.className='segment-digits';digits.setAttribute('aria-hidden','true');screen.append(digits);if(el.tagName==='INPUT'){el.addEventListener('input',()=>paint(el));el.addEventListener('change',()=>paint(el));el.addEventListener('blur',()=>paint(el));el.closest('.rotary-control')?.querySelector('input[type=range]')?.addEventListener('input',()=>paint(el));}}paint(el)})}
 setup();let queued=false;new MutationObserver(records=>{if(!records.some(r=>!r.target.closest?.('.segment-digits')&&(r.target.nodeType===3||r.target.matches?.(selector)||Array.from(r.addedNodes).some(n=>n.nodeType===1&&!n.matches?.('.digital-screen,.segment-digits')))))return;if(queued)return;queued=true;queueMicrotask(()=>{queued=false;setup()})}).observe(document.querySelector('main'),{childList:true,characterData:true,subtree:true});
})();
