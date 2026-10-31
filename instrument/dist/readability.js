(()=>{
 const paths=['M2 12C5 2 8 22 12 12S19 2 22 12','M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8','M2 12C6-2 8-2 12 12S18 26 22 12','M2 17L7 7L12 17L17 7L22 17','M2 6Q7 1 12 6T22 6M2 12Q7 7 12 12T22 12M2 18Q7 13 12 18T22 18'];
 function icons(){document.querySelectorAll('[data-gen] .icon').forEach(el=>{if(el.querySelector('svg'))return;const index=types.indexOf(state.gens[+el.closest('[data-gen]').dataset.gen].type);el.innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="'+paths[index]+'"/></svg>'})}
 icons();new MutationObserver(records=>{if(records.some(r=>Array.from(r.addedNodes).some(n=>n.nodeType===1&&n.matches?.('[data-gen]'))))icons()}).observe(document.querySelector('#generators'),{childList:true});
})();
