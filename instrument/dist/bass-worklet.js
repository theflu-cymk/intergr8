import './bass-core.js';
class MotherBassProcessor extends AudioWorkletProcessor {
  constructor(){super();this.engine=new MotherBassEngine(sampleRate);this.capture=null;this.blocks=0;this.port.onmessage=({data:d})=>{
    if(d.type==='patch')this.engine.configure(d.patch);
    if(d.type==='noteOn')this.engine.noteOn(d.note,d.velocity,d.id);
    if(d.type==='noteOff')this.engine.noteOff(d.id);
    if(d.type==='bend')this.engine.pitchBend=d.value;
    if(d.type==='transport')this.engine.start(d.on);
    if(d.type==='panic')this.engine.panic();
    if(d.type==='sample')this.engine.setSample(d.samples,d.rate);
    if(d.type==='capture'){const len=Math.min(sampleRate*8,Math.max(128,d.seconds*sampleRate|0));this.capture={samples:new Float32Array(len),pos:0,sub:d.sub};}
  };}
  process(_,outputs){const e=this.engine,main=outputs[0],sub=outputs[1],character=outputs[2];for(let i=0;i<main[0].length;i++){
    e.sample();main[0][i]=e.L;main[1][i]=e.R;sub[0][i]=e.subOut*e.outputGain;character[0][i]=e.charL*e.outputGain;character[1][i]=e.charR*e.outputGain;
    if(this.capture){const c=this.capture;c.samples[c.pos++]=c.sub?(e.L+e.R)*.5:(e.charL+e.charR)*.5*e.outputGain;if(c.pos===c.samples.length){this.port.postMessage({type:'capture',samples:c.samples,rate:sampleRate,root:e.p.root},[c.samples.buffer]);this.capture=null;}}
  }if(++this.blocks%12===0)this.port.postMessage({type:'status',step:e.step,gate:e.gate,env:e.env,cutoff:e.currentCutoff,outputs:Array.from(e.outs),capturing:!!this.capture});return true;}
}
registerProcessor('motherbox-bass',MotherBassProcessor);
