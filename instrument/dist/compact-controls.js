/* Compact controls keep the original range inputs and DSP event handlers intact. */
(()=>{
  const sections={voice:['Oscillators','Envelope','Sub & attack'],tone:['Filter','Vowel','Comb','Dispersion'],fx:['Drive','Delay & stereo','Quality']};
  const selected={};
  function rotary(input){
    if(input.closest('.knob'))return;if(input.closest('.rotary-control')){input.syncRotary?.();return;}
    if(input.closest('.route')){input.type='number';input.classList.add('digital-value');return;}
    const wrap=document.createElement('span');wrap.className='rotary-control';
    input.before(wrap);wrap.append(input);
    const cap=document.createElement('span');cap.className='rotary-cap';cap.setAttribute('aria-hidden','true');wrap.append(cap);
    const number=document.createElement('input');number.type='number';number.className='rotary-value';number.min=input.min;number.max=input.max;number.step=input.step||'1';if(input.dataset.bass){const unit=rangeSpec[input.dataset.bass]?.[4];if(unit){number.title='Value in '+unit;const label=input.closest('.bass-control')?.querySelector('label');if(label){const unitLabel=document.createElement('small');unitLabel.className='control-unit';unitLabel.textContent=unit;label.append(unitLabel)}}}number.setAttribute('aria-label',(input.getAttribute('aria-label')||input.labels?.[0]?.textContent?.trim()||'Control')+' value');wrap.append(number);
    const refresh=()=>{if(document.activeElement!==number)number.value=input.value;wrap.style.setProperty('--angle',(-135+270*(+input.value-+input.min)/(+input.max-+input.min))+'deg')};
    input.syncRotary=refresh;refresh();input.addEventListener('input',refresh);
    const commitNumber=()=>{if(number.value===''||!Number.isFinite(number.valueAsNumber)){number.value=input.value;return;}input.value=Math.max(+input.min,Math.min(+input.max,number.valueAsNumber));number.value=input.value;input.dispatchEvent(new Event('input',{bubbles:true}));};
    number.addEventListener('change',commitNumber);number.addEventListener('blur',commitNumber);number.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();commitNumber();number.blur()}if(e.key==='Escape'){number.value=input.value;number.blur()}});
    bindKnob(input);
  }
  function bindKnob(input){
    if(input.dataset.dragReady)return;input.dataset.dragReady='true';
    const face=input.closest('.knob,.rotary-control');
    let active=null,lastY=0,lastX=0,value=0;
    const commit=()=>{const step=+input.step||1;input.value=Math.round(value/step)*step;input.dispatchEvent(new Event('input',{bubbles:true}));};
    const finish=e=>{if(active!==e.pointerId)return;active=null;face.classList.remove('dragging');if(input.hasPointerCapture(e.pointerId))input.releasePointerCapture(e.pointerId);input.dispatchEvent(new Event('change',{bubbles:true}));};
    input.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();input.focus({preventScroll:true});active=e.pointerId;lastY=e.clientY;lastX=e.clientX;value=+input.value;input.setPointerCapture(e.pointerId);face.classList.add('dragging');});
    input.addEventListener('pointermove',e=>{if(active!==e.pointerId)return;e.preventDefault();const dy=lastY-e.clientY,dx=e.clientX-lastX;lastY=e.clientY;lastX=e.clientX;const movement=Math.abs(dy)>=Math.abs(dx)?dy:dx;value=Math.max(+input.min,Math.min(+input.max,value+movement*(+input.max-+input.min)/(e.shiftKey?1600:220)));commit();});
    input.addEventListener('pointerup',finish);input.addEventListener('pointercancel',finish);input.addEventListener('lostpointercapture',()=>{active=null;face.classList.remove('dragging');});
    input.title='Drag up or right to increase · Down or left to decrease · Hold Shift for precision · Arrow keys to adjust';
  }

  function compact(){
    document.querySelectorAll('#bassPages input[type=range],#parameters input[type=range],.performance-row input[type=range],#volume,.route input[type=range]').forEach(rotary);
    document.querySelectorAll('.knob input[type=range]').forEach(bindKnob);
    Object.entries(sections).forEach(([page,names])=>{
      const grid=document.querySelector(`[data-page="${page}"] > .bass-grid`);if(!grid||grid.dataset.grouped)return;grid.dataset.grouped='true';
      const nav=document.createElement('div');nav.className='control-subtabs';nav.setAttribute('aria-label',page+' control groups');
      const groups=[[]];Array.from(grid.children).forEach(el=>{if(el.classList.contains('bass-group-label')){groups.push([]);el.hidden=true;}groups.at(-1).push(el)});
      const choose=i=>{selected[page]=i;groups.forEach((items,j)=>items.forEach(el=>el.classList.toggle('control-concealed',i!==j)));Array.from(nav.children).forEach((b,j)=>{b.classList.toggle('active',i===j);b.setAttribute('aria-pressed',String(i===j))})};
      groups.forEach((_,i)=>{const b=document.createElement('button');b.type='button';b.textContent=names[i]||'More';b.onclick=()=>choose(i);nav.append(b)});grid.before(nav);choose(selected[page]||0);
    });
  }
  const piano=document.querySelector('#piano'),notes=document.querySelector('.keyboard-note');
  const keys=document.createElement('details');keys.className='keyboard-drawer';keys.innerHTML='<summary>Keyboard <span>A–K · Z/X octave</span></summary>';piano.before(keys);keys.append(piano,notes);
  compact();let queued=false;new MutationObserver(records=>{if(!records.some(r=>Array.from(r.addedNodes).some(n=>n.nodeType===1)))return;if(queued)return;queued=true;queueMicrotask(()=>{queued=false;compact()})}).observe(document.querySelector('main'),{childList:true,subtree:true});
})();


