/* One CRT surface, using the Bass Engine's existing phosphor controls throughout. */
(()=>{
 document.body.classList.add('unified-crt');
 const play=document.querySelector('#play'),scope=document.querySelector('.canvaswrap');scope.append(play);play.classList.add('waveform-transport');
 function transportIcon(){const stopped=play.getAttribute('aria-label')!=='Stop audio';const state=stopped?'play':'stop';if(play.dataset.phosphorState===state&&play.querySelector('svg'))return;play.dataset.phosphorState=state;play.title=stopped?'Play phrase · Space':'Stop playback · Space';play.setAttribute('aria-pressed',String(!stopped));play.innerHTML='<svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'+(stopped?'<path d="M16 9L39 24L16 39Z"/>':'<path d="M13 13H35V35H13Z"/>')+'</svg>';}
 new MutationObserver(transportIcon).observe(play,{childList:true,attributes:true,attributeFilter:['aria-label']});transportIcon();
})();
