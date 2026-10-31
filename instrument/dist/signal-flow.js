/* Signal traces are printed on the housing between the real controls. */
(()=>{
 const main=document.querySelector('main'),editor=document.querySelector('#bassEditor'),monitor=document.querySelector('.bass-monitor'),routing=document.querySelector('#advanced'),performance=document.querySelector('#performance'),macros=document.querySelector('.macros'),output=document.querySelector('.output');
 editor.before(routing);macros.after(monitor);
 main.classList.add('printed-flow-panel');
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('panel-traces');svg.setAttribute('aria-hidden','true');main.append(svg);
 const legend=document.createElement('div');legend.className='printed-trace-legend';legend.innerHTML='<span>━━▶ AUDIO</span><span>┄┄▶ CONTROL</span>';document.querySelector('.instrument').before(legend);
 let queued=false;
 function draw(){queued=false;const root=main.getBoundingClientRect(),w=main.clientWidth,h=main.scrollHeight;svg.setAttribute('viewBox',`0 0 ${w} ${h}`);svg.setAttribute('width',w);svg.setAttribute('height',h);const box=el=>{const r=el.getBoundingClientRect();return{x:r.left-root.left,y:r.top-root.top,w:r.width,h:r.height,right:r.right-root.left,bottom:r.bottom-root.top,visible:r.width>0&&r.height>0}};
 const b=box(editor),g=box(document.querySelector('.instrument')),r=box(routing),p=box(performance),m=box(macros),o=box(output),a=box(monitor);let lines='';
 const path=(d,control=false)=>{lines+=`<path d="${d}" class="${control?'printed-control':'printed-audio'}" marker-end="url(#print-${control?'control':'audio'})"/>`};
 const label=(text,x,y,rotate=0,control=false)=>{lines+=`<text x="${x}" y="${y}" transform="rotate(${rotate} ${x} ${y})" class="${control?'control-ink':'audio-ink'}">${text}</text>`};
 if(g.visible&&state.routes.some(x=>!x.target||x.target.startsWith('gen:'))){const rail=9;path('M'+g.x+','+(g.y+65)+'H'+rail+'V'+(g.bottom-20)+'H'+(g.x-4),true);label('GENERATOR FEEDBACK',rail+10,g.bottom-35,-90,true);}
 if(b.visible){
  if(r.visible){const x=g.x+32;if(r.y>=g.bottom){path(`M${x},${g.bottom+3}V${r.y-4}`,true);label('MODULATION BUS',x+12,(g.bottom+r.y)/2+3,0,true);}else{const y=g.bottom+11,end=r.x+r.w/2;path(`M${x},${g.bottom+2}V${y}H${end}V${r.bottom+3}`,true);label('MODULATION BUS',x+18,y-3,0,true);}} 
  const soundRoutes=state.routes.some(x=>x.target&&!x.target.startsWith('gen:'));
  if(soundRoutes){const source=r.visible?r:g,rail=9;path(`M${source.x},${source.bottom-13}H${rail}V${b.y+26}H${b.x-4}`,true);label('MOD',rail+4,b.y+17,0,true);}
  const rail=w-10,from=b.y+b.h*.55,to=p.y+p.h*.3;
  path(`M${b.right+3},${from}H${rail}V${to}H${p.right+4}`);label('VOICE + SUB',rail-5,(from+to)/2, -90);
  const left=9;path(`M${m.x-2},${m.y+m.h*.55}H${left}V${b.y+b.h*.75}H${b.x-4}`,true);label('MACRO CONTROL',left+11,(m.y+b.bottom)/2,-90,true);
 }
 const mixX=Math.min(p.right-35,o.x+o.w*.5);path(`M${mixX},${p.bottom+3}V${o.y-4}`);label('MIX',mixX-30,(p.bottom+o.y)/2+3);
 const meterX=Math.min(o.right-30,a.right-30);path(`M${meterX},${o.bottom+3}V${a.y-4}`);label('OUTPUT MONITOR',meterX-130,(o.bottom+a.y)/2+3);
 svg.innerHTML='<defs><marker id="print-audio" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M1 1L9 5L1 9" fill="none" stroke="#c7b782" stroke-width="1.8"/></marker><marker id="print-control" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M1 1L9 5L1 9" fill="none" stroke="#a4b9a4" stroke-width="1.8"/></marker></defs>'+lines;
 }
 function schedule(){if(!queued){queued=true;requestAnimationFrame(draw)}}
 new ResizeObserver(schedule).observe(main);[editor,routing,performance,macros,monitor].forEach(el=>new ResizeObserver(schedule).observe(el));document.addEventListener('click',schedule);document.addEventListener('change',schedule);window.addEventListener('resize',schedule);schedule();
})();

