/* Consistent hardware switches and control-cell sizing; existing events stay intact. */
(()=>{
 const main=document.querySelector('main');
 function arrange(){
  main.querySelectorAll('input[type="checkbox"]').forEach(input=>{input.setAttribute('role','switch');if(!input.title)input.title=input.getAttribute('aria-label')||input.closest('label')?.textContent.trim()||'Toggle';const label=input.closest('.bass-check');if(label&&!label.querySelector('.switch-name')){const name=document.createElement('span');name.className='switch-name';[...label.childNodes].filter(n=>n.nodeType===3).forEach(n=>name.append(n));label.append(name)}});
  main.querySelectorAll('.bass-grid').forEach(grid=>{const cells=[...grid.children].filter(el=>!el.hidden&&!el.classList.contains('control-concealed')&&!el.classList.contains('bass-group-label'));const count=cells.length,columns=count>8?Math.ceil(count/2):count;grid.style.setProperty('--control-columns',Math.max(2,columns));grid.dataset.controlCount=count;grid.querySelectorAll(':scope>.bass-control').forEach(cell=>cell.classList.toggle('selector-cell',!!cell.querySelector('select')))});
 }
 let queued=false;const schedule=()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;arrange()})};
 new MutationObserver(records=>{if(records.some(r=>r.type==='attributes'&&r.target.matches('.control-concealed,.bass-control,.bass-check')||r.type==='childList'&&[...r.addedNodes].some(n=>n.nodeType===1&&!n.matches?.('.segment-digits,svg,span.switch-name'))))schedule()}).observe(main,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden']});main.addEventListener('click',schedule);arrange();
})();
