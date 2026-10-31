/* Shared by the AudioWorklet and offline DSP checks. No DOM or audio callbacks. */
(() => {
  const TAU = Math.PI * 2, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const midiHz = n => 440 * Math.pow(2, (n - 69) / 12);
  const waves = {};
  for (const name of ['sine', 'saw', 'square', 'triangle', 'metal', 'hollow']) {
    const table = new Float32Array(2048);
    for (let i = 0; i < table.length; i++) {
      const p = i / table.length * TAU; let x = 0;
      for (let h = 1; h <= 48; h++) {
        if (name === 'sine' && h === 1) x = Math.sin(p);
        if (name === 'saw') x += Math.sin(p * h) / h;
        if (name === 'square' && h % 2) x += Math.sin(p * h) / h;
        if (name === 'triangle' && h % 2) x += Math.sin(p * h) * Math.pow(-1, (h - 1) / 2) / (h * h);
        if (name === 'metal') x += Math.sin(p * h) * Math.sin(h * 1.73) / Math.pow(h, .75);
        if (name === 'hollow' && h % 3 !== 0) x += Math.sin(p * h) / Math.pow(h, 1.3);
      }
      table[i] = x;
    }
    let peak = 0; for (const v of table) peak = Math.max(peak, Math.abs(v));
    for (let i = 0; i < table.length; i++) table[i] /= peak || 1;
    waves[name] = table;
  }
  function wave(name, p) {
    const t = waves[name] || waves.sine; p = ((p % 1) + 1) % 1 * 2048;
    const i = Math.floor(p), f = p - i; return t[i] * (1 - f) + t[(i + 1) % 2048] * f;
  }
  class Filter {
    constructor() { this.z1 = 0; this.z2 = 0; this.b0 = 1; this.b1 = this.b2 = this.a1 = this.a2 = 0; }
    set(type, hz, q, sr) {
      const w = TAU * clamp(hz, 10, sr * .43) / sr, c = Math.cos(w), s = Math.sin(w), alpha = s / (2 * Math.max(.2, q)), a0 = 1 + alpha;
      let b0, b1, b2;
      if (type === 'highpass') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; }
      else if (type === 'bandpass') { b0 = alpha; b1 = 0; b2 = -alpha; }
      else if (type === 'notch') { b0 = 1; b1 = -2 * c; b2 = 1; }
      else { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; }
      this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = -2 * c / a0; this.a2 = (1 - alpha) / a0;
    }
    next(x) {
      const y = this.b0 * x + this.z1;
      this.z1 = this.b1 * x - this.a1 * y + this.z2; this.z2 = this.b2 * x - this.a2 * y;
      if (!Number.isFinite(y)) { this.z1 = this.z2 = 0; return 0; } return y;
    }
  }
  const defaults = () => ({
    bank: 'Deep UK', root: 33, legato: true, glide: .07, phaseReset: true, bendRange: 12,
    wave: 'sine', waveB: 'sine', morph: .1, ratio: 2, fine: 0, fm: .7, feedback: .08, warp: .12,
    attack: .008, decay: .24, sustain: .72, release: .18, subAttack: .012, subRelease: .14,
    subWave: 'sine', subOctave: 0, subSat: .08, subLevel: .68, charLevel: .6,
    transient: .15, transientTime: .035, pitchEnv: 7, pitchTime: .04,
    cutoff: 900, resonance: .8, filterType: 'lowpass', filterEnv: 1.4,
    vowel: .1, vowelMix: 0, combMix: 0, combFreq: 180, combFeedback: .35,
    dispersion: 0, dispersionFreq: 260, dispersionPinch: .4,
    lowDrive: .1, midDrive: .32, highDrive: .2, distortion: 'saturate', distortionMix: .6,
    crossover: 95, highCross: 2200, preHP: 35, postLP: 12000, compression: .15,
    delayMix: .12, delayBeats: .75, delayFeedback: .32, delayTone: 1800, width: .12,
    gainMatch: true, bypass: false, quality: 2, solo: 'mix',
    fxOrder: ['filter', 'formant', 'comb', 'dispersion', 'distortion', 'delay'],
    seqEnabled: true, division: 4, swing: .06, sequenceGate: .72,
    steps: Array.from({ length: 16 }, (_, i) => ({ on: i % 4 === 0 || i === 10, note: i === 8 ? -5 : 0, velocity: .85, gate: .72, repeats: 1, fm: -1, cutoff: -1 })),
    sample: null, sampleStart: 0, sampleEnd: 1, sampleReverse: false, sampleStretch: 1, sampleBlend: 0,
    captureBars: 1, captureSub: false, lockSub: true, lockRhythm: true
  });
  class MotherBassEngine {
    constructor(sr = 48000) {
      this.sr = sr; this.p = defaults(); this.bpm = 120; this.sync = true; this.macros = [55, 42, 28, 35, 65, 48];
      this.gens = []; this.routes = []; this.outs = new Float64Array(8); this.genPhases = new Float64Array(8); this.chaos = Array.from({ length: 8 }, () => [.1, .1, .1]);
      this.routeSmooth = []; this.mods = {}; this.notes = []; this.freq = midiHz(33); this.target = this.freq; this.pitchBend = 0; this.velocity = .8;
      this.gate = false; this.stage = 'off'; this.env = 0; this.subEnv = 0; this.noteAge = 100;
      this.a = this.b = this.subPhase = 0; this.prevMod = 0; this.transport = false; this.step = -1; this.stepRemaining = 0; this.stepElapsed = 0; this.seqNoteOff = -1; this.nextRepeat = -1; this.repeatLeft = 0;
      this.rng = 8675309; this.frame = 0; this.previousInput = [0, 0]; this.previousOutput = [0, 0];
      this.filters = {}; for (const k of ['charHP', 'tone', 'pre', 'post', 'splitLow', 'splitMid', 'vowel1', 'vowel2', 'delayTone', 'sendHP', 'anti1', 'anti2']) this.filters[k] = new Filter();
      this.dispZ = new Float64Array(12); this.compEnv = new Float64Array(3);
      this.combBuffer = new Float32Array(Math.ceil(sr * 4)); this.combPos = 0;
      this.delayBuffer = new Float32Array(Math.ceil(sr * 4 * 4)); this.delayPos = 0;
      this.dryRms = this.wetRms = .01; this.matchGain = 1; this.outputGain = .5; this.outputTarget = .5;
      this.L = this.R = this.subOut = this.charL = this.charR = 0; this.sampleBuffer = null; this.sampleHead = 0;
      this.grains = Array.from({ length: 4 }, () => ({ age: 999999, start: 0 })); this.grainClock = 0; this.grainIndex = 0;
      this.sampleKey = ''; this.configure({ bass: this.p });
    }
    configure(patch) {
      if (patch.bass) this.p = { ...defaults(), ...patch.bass };
      if (!this.p.sample) this.sampleBuffer = null;
      this.bpm = clamp(+patch.bpm || this.bpm, 30, 240); this.sync = patch.sync !== false;
      this.macros = patch.macros || this.macros; this.gens = patch.gens || this.gens; this.routes = patch.routes || this.routes;
      this.outputTarget = clamp((patch.volume ?? 45) / 100, 0, 1) * .75; this.clip = patch.softclip !== false;
      const os = [1, 2, 4].includes(+this.p.quality) ? +this.p.quality : 2;
      this.os = os; this.internalSR = this.sr * os;
      const f = this.filters, sr = this.internalSR;
      f.charHP.set('highpass', this.p.crossover, .707, sr); f.pre.set('highpass', this.p.preHP, .707, sr); f.post.set('lowpass', this.p.postLP, .707, sr);
      f.splitLow.set('lowpass', 240, .707, sr); f.splitMid.set('lowpass', this.p.highCross, .707, sr);
      f.delayTone.set('lowpass', this.p.delayTone, .707, sr); f.sendHP.set('highpass', 180, .707, sr);
      f.anti1.set('lowpass', this.sr * .42, .5412, sr); f.anti2.set('lowpass', this.sr * .42, 1.3066, sr);
      if (this.p.sample && this.p.sample.data !== this.sampleKey) {
        this.sampleKey = this.p.sample.data;
        // PCM is decoded in the main thread and sent separately to the worklet.
      }
    }
    setSample(samples, rate) { this.sampleBuffer = samples; this.sampleRate = rate; this.sampleHead = 0; this.grains.forEach(g => g.age = 999999); }
    random() { this.rng ^= this.rng << 13; this.rng ^= this.rng >>> 17; this.rng ^= this.rng << 5; return (this.rng >>> 0) / 4294967296 * 2 - 1; }
    noteOn(note, velocity = .8, id = 'keyboard') {
      this.notes = this.notes.filter(n => n.id !== id); this.notes.push({ note, velocity, id });
      const already = this.gate; this.target = midiHz(clamp(note, 12, 108)); this.currentNote = note; this.velocity = clamp(velocity, .01, 1); this.gate = true;
      if (!already || !this.p.legato || id === 'seq') {
        this.stage = 'attack'; this.noteAge = 0; if (!this.p.glide) this.freq = this.target;
        if (this.p.phaseReset) { this.a = this.b = this.subPhase = 0; this.prevMod = 0; }
        this.sampleHead = 0; this.grainClock = 0; this.grains.forEach(g => g.age = 999999);
      }
    }
    noteOff(id) {
      this.notes = this.notes.filter(n => n.id !== id);
      const last = this.notes[this.notes.length - 1];
      if (last) { this.target = midiHz(last.note); this.currentNote = last.note; this.velocity = last.velocity; }
      else { this.gate = false; this.stage = 'release'; }
    }
    panic() { this.notes = []; this.gate = false; this.stage = 'off'; this.env=this.subEnv=0;this.noteAge=100;this.transport=false;this.seqNoteOff=-1;this.combBuffer.fill(0);this.delayBuffer.fill(0);this.dispZ.fill(0);for(const f of Object.values(this.filters))f.z1=f.z2=0;this.previousInput=[0,0];this.previousOutput=[0,0]; }
    start(on) { this.transport = on; this.stepRemaining = 0; this.step = -1; if (!on) this.noteOff('seq'); }
    sequence() {
      if (!this.transport || !this.p.seqEnabled) return;
      if (this.stepRemaining <= 0) {
        this.step = (this.step + 1) % this.p.steps.length; const s = this.p.steps[this.step];
        const swing = this.step % 2 ? 1 - this.p.swing : 1 + this.p.swing;
        this.stepLength = Math.max(64, this.sr * 60 / this.bpm / this.p.division * swing);
        this.stepRemaining += this.stepLength; this.stepElapsed = 0; this.seqNoteOff = -1; this.nextRepeat = -1; this.repeatLeft = 0;
        this.noteOff('seq');
        if (s.on) {
          this.noteOn(+this.p.root + +s.note, s.velocity, 'seq'); this.repeatLeft = clamp(s.repeats || 1, 1, 8) - 1;
          this.repeatInterval = this.stepLength / (this.repeatLeft + 1); this.nextRepeat = this.repeatInterval;
          this.seqNoteOff = this.repeatInterval * clamp(s.gate ?? this.p.sequenceGate, .05, 1);
          this.stepFm = s.fm >= 0 ? s.fm : null; this.stepCutoff = s.cutoff >= 0 ? s.cutoff : null;
        } else this.stepFm = this.stepCutoff = null;
      }
      if (this.seqNoteOff >= 0 && this.stepElapsed >= this.seqNoteOff) { this.noteOff('seq'); this.seqNoteOff = -1; }
      if (this.repeatLeft > 0 && this.stepElapsed >= this.nextRepeat) {
        const s = this.p.steps[this.step]; this.noteOn(+this.p.root + +s.note, s.velocity, 'seq'); this.repeatLeft--;
        this.seqNoteOff = this.nextRepeat + this.repeatInterval * s.gate; this.nextRepeat += this.repeatInterval;
      }
      this.stepElapsed++; this.stepRemaining--;
    }
    modulation() {
      const dt = 16 / this.sr, m = this.macros; this.mods = {};
      this.gens.forEach((g, i) => {
        const base = g.params.slice();
        for (const r of this.routes) {
          const target = r.target || `gen:${r.to}:0`; const parts = target.split(':');
          if (parts[0] === 'gen' && +parts[1] === i) base[+parts[2]] += (this.outs[r.from] || 0) * r.depth * .45;
        }
        const rate = Math.max(.01, base[0] / 50) * (this.sync ? this.bpm / 120 : 1);
        this.genPhases[i] = (this.genPhases[i] + dt * rate) % 1024; const phase = this.genPhases[i], a = phase * TAU; let v;
        if (g.type === 'Chaotic') {
          let [x, y, z] = this.chaos[i]; const algo = g.algorithm || 'Lorenz';
          const d = Math.min(.012, dt * rate * 3), repeats = Math.max(1, Math.ceil(dt * rate * 3 / d));
          for (let n = 0; n < Math.min(16, repeats); n++) {
            if (algo === 'Lorenz') { const dx=(4+base[1]*.18)*(y-x),dy=x*(15+base[2]*.45-z)-y,dz=x*y-(1+base[3]*.06)*z; x+=dx*d;y+=dy*d;z+=dz*d; }
            else if (algo === 'Rössler') { const dx=-y-z,dy=x+(.05+base[1]*.004)*y,dz=.2+z*(x-(3+base[2]*.07));x+=dx*d*4;y+=dy*d*4;z+=dz*d*4; }
            else if (Math.floor((phase-dt*rate)*24)!==Math.floor(phase*24)) {
              if (algo === 'Logistic') { x=clamp(3.4+base[2]*.006,3.4,3.999)*clamp(x,.001,.999)*(1-clamp(x,.001,.999));y=x; }
              else { const xx=1-(1.05+base[2]*.0035)*x*x+y;y=(.1+base[3]*.003)*x;x=xx; }
            }
          }
          if (![x,y,z].every(Number.isFinite)||Math.abs(x)>200) {x=.1;y=.1;z=.1;}
          this.chaos[i]=[x,y,z];v=algo==='Logistic'?x*2-1:Math.tanh(x/(algo==='Hénon'?1:12));
        } else if (g.type === 'Euclidean') { const steps=clamp(Math.round(base[1]*.31+1),1,32),beats=clamp(Math.round(base[2]/100*steps+m[1]/200*steps),0,steps),s=((Math.floor(phase*steps/4+base[3]*.16)%steps)+steps)%steps;v=(s*beats)%steps<beats?1:-1; }
        else if (g.type === 'Quadrature') v=Math.sin(a*(.5+Math.max(0,base[2])/25)+base[1]/100*TAU+Math.sin(a*.13)*base[3]/100);
        else if (g.type === 'Custom') {const steps=clamp(Math.round(base[1]*.31+1),1,32),fraction=phase%1,skew=clamp(base[2]/100,.05,.95),warped=fraction<skew?fraction/skew*.5:.5+(fraction-skew)/(1-skew)*.5,stepped=Math.floor(warped*steps)/steps;v=Math.sin(TAU*(stepped*(1-base[3]/100)+warped*base[3]/100));}
        else v=Math.tanh(Math.sin(this.subPhase*TAU)+Math.sin(this.subPhase*TAU*2)*base[1]/150+Math.sin(this.subPhase*TAU*.5)*base[2]/200)*(1+base[3]/200);
        this.outs[i]=g.muted?0:v;
      });
      this.routes.forEach((r,j)=>{
        let v=this.outs[r.from]||0;if(!r.bipolar)v=(v+1)/2;if(r.invert)v=-v;
        if(r.curve==='exponential')v=Math.sign(v)*v*v;if(r.curve==='stepped')v=Math.round(v*4)/4;
        this.routeSmooth[j]=(this.routeSmooth[j]||0)+(v-(this.routeSmooth[j]||0))*Math.min(1,dt/(.001+(r.lag||0)*.003));
        const target=r.target||`gen:${r.to}:0`;if(!target.startsWith('gen:'))this.mods[target]=(this.mods[target]||0)+this.routeSmooth[j]*(r.depth||0)/100;
      });
      const p=this.p, env=this.env, cutoffBase=this.stepCutoff??p.cutoff;
      this.currentCutoff=clamp(cutoffBase*Math.pow(2,(this.mods.cutoff||0)*5+env*p.filterEnv+(m[1]-50)/70),25,18000);
      this.filters.tone.set(p.filterType,this.currentCutoff,p.resonance,this.internalSR);
      const vowels=[[800,1150],[400,1800],[300,2300],[500,850],[350,700]],vi=clamp(p.vowel+(this.mods.vowel||0)+m[2]/400,0,.999)*4,idx=Math.floor(vi),frac=vi-idx,va=vowels[idx],vb=vowels[Math.min(4,idx+1)];
      this.filters.vowel1.set('bandpass',va[0]+(vb[0]-va[0])*frac,4,this.internalSR);this.filters.vowel2.set('bandpass',va[1]+(vb[1]-va[1])*frac,5,this.internalSR);
      this.dispCoeff=(Math.tan(Math.PI*clamp(p.dispersionFreq*Math.pow(2,(this.mods.dispersionFreq||0)*3),40,5000)/this.internalSR)-1)/(Math.tan(Math.PI*clamp(p.dispersionFreq,40,5000)/this.internalSR)+1);
    }
    envelope() {
      const p=this.p;
      if(this.stage==='attack'){this.env+=1/(Math.max(.001,p.attack)*this.sr);if(this.env>=1){this.env=1;this.stage='decay';}}
      else if(this.stage==='decay'){this.env+=(p.sustain-this.env)*(1-Math.exp(-5/(Math.max(.005,p.decay)*this.sr)));if(Math.abs(this.env-p.sustain)<.001)this.stage='sustain';}
      else if(this.stage==='sustain')this.env=p.sustain;
      else if(this.stage==='release'){this.env*=Math.exp(-7/(Math.max(.005,p.release)*this.sr));if(this.env<.00001){this.env=0;this.stage='off';}}
      this.subEnv+=((this.gate?this.velocity:0)-this.subEnv)*(1-Math.exp(-5/(Math.max(.002,this.gate?p.subAttack:p.subRelease)*this.sr)));
      this.noteAge+=1/this.sr;
    }
    distort(x,drive) {
      const g=1+drive*22; const v=x*g;
      switch(this.p.distortion){case 'clip':return clamp(v,-1,1);case 'asymmetric':return Math.tanh(v+.35)-Math.tanh(.35);case 'fold':return Math.sin(v*1.5);case 'phase':return Math.sin(v+Math.sin(v*2)*drive*4);default:return Math.tanh(v);}
    }
    effects(x) {
      const p=this.p, sr=this.internalSR; let y=x;
      for(const name of p.fxOrder){
        if(name==='filter')y=this.filters.tone.next(y);
        else if(name==='formant'){const form=(this.filters.vowel1.next(y)+this.filters.vowel2.next(y))*3;const mix=clamp(p.vowelMix+(this.mods.vowelMix||0),0,1);y=y*(1-mix)+form*mix;}
        else if(name==='comb'){
          const hz=clamp(p.combFreq*Math.pow(2,(this.mods.combFreq||0)*4),30,5000),delay=sr/hz,pos=(this.combPos-delay+this.combBuffer.length)%this.combBuffer.length,idx=Math.floor(pos),f=pos-idx;
          const z=this.combBuffer[idx]*(1-f)+this.combBuffer[(idx+1)%this.combBuffer.length]*f;
          this.combBuffer[this.combPos]=Math.tanh(y+z*clamp(p.combFeedback,0,.88));this.combPos=(this.combPos+1)%this.combBuffer.length;
          const mix=clamp(p.combMix+(this.mods.combMix||0),0,1);y=y*(1-mix)+(y+z)*.65*mix;
        }else if(name==='dispersion'){
          let z=y;const stages=2+Math.floor(p.dispersionPinch*10),a=clamp(this.dispCoeff,-.995,.995);
          for(let i=0;i<stages;i++){const out=a*z+this.dispZ[i];this.dispZ[i]=z-a*out;z=out;}
          const mix=clamp(p.dispersion+(this.mods.dispersion||0),0,1);y=y*(1-mix)+z*mix;
        }else if(name==='distortion'){
          const v=this.filters.pre.next(y),lo=this.filters.splitLow.next(v),rest=v-lo,mid=this.filters.splitMid.next(rest),hi=rest-mid;
          const bands=[lo,mid,hi],drives=[p.lowDrive,p.midDrive,p.highDrive];let sum=0;
          for(let b=0;b<3;b++){
            let z=this.distort(bands[b],clamp(drives[b]+(this.mods.drive||0)*.5+this.macros[5]/350,0,1));
            this.compEnv[b]+=(z*z-this.compEnv[b])*(z*z>this.compEnv[b]?.002:.00015);
            const rms=Math.sqrt(this.compEnv[b]+1e-9),down=rms>.35?Math.pow(.35/rms,.6):1,up=rms>.005&&rms<.12?Math.min(2,Math.pow(.12/rms,.3)):1;
            z*=1+(down*up-1)*p.compression;sum+=z;
          }
          const mix=clamp(p.distortionMix+(this.mods.distortionMix||0),0,1);y=y*(1-mix)+sum*mix;y=this.filters.post.next(y);
        }else if(name==='delay'){
          const count=Math.min(this.delayBuffer.length-2,sr*60/this.bpm*p.delayBeats),read=(this.delayPos-Math.floor(count)+this.delayBuffer.length)%this.delayBuffer.length,z=this.delayBuffer[read];
          const send=this.filters.sendHP.next(y),filtered=this.filters.delayTone.next(z);
          this.delayBuffer[this.delayPos]=Math.tanh(send+filtered*clamp(p.delayFeedback,0,.75));this.delayPos=(this.delayPos+1)%this.delayBuffer.length;
          y+=filtered*clamp(p.delayMix+(this.mods.delayMix||0),0,.8);
        }
        y=clamp(Number.isFinite(y)?y:0,-8,8);
      }
      return y;
    }
    sampleOsc() {
      if(!this.sampleBuffer?.length)return 0;
      const p=this.p,buf=this.sampleBuffer,lo=clamp(p.sampleStart,0,.98)*buf.length,hi=Math.max(lo+64,clamp(p.sampleEnd,.02,1)*buf.length),len=Math.max(64,hi-lo),rate=this.sampleRate/this.internalSR;
      const pitch=this.freq/midiHz(p.sample.root||p.root),duration=this.internalSR*.08,hop=duration/4;
      if(this.grainClock--<=0){const g=this.grains[this.grainIndex++%4];g.start=this.sampleHead;g.age=0;this.grainClock=hop;}
      this.sampleHead=(this.sampleHead+rate/clamp(p.sampleStretch,.25,4))%len;
      let y=0;
      for(const g of this.grains){if(g.age<duration){let pos=(g.start+g.age*rate*pitch)%len;if(p.sampleReverse)pos=len-1-pos;pos=lo+pos;const i=Math.floor(pos),f=pos-i;y+=(buf[i%buf.length]*(1-f)+buf[(i+1)%buf.length]*f)*(.5-.5*Math.cos(TAU*g.age/duration))*.5;g.age++;}}
      return y;
    }
    sample() {
      this.sequence();this.envelope();if((this.frame++%16)===0)this.modulation();
      const p=this.p,m=this.macros,mods=this.mods;
      this.freq+=(this.target-this.freq)*(1-Math.exp(-1/(Math.max(.0001,p.glide)*this.sr)));
      const hz=this.freq*Math.pow(2,(this.pitchBend*p.bendRange+(mods.pitch||0)*12)/12),pitchTransient=p.pitchEnv*Math.exp(-this.noteAge/Math.max(.003,p.pitchTime));
      const ratio=clamp(p.ratio*Math.pow(2,(mods.ratio||0)*2),.125,32),fm=clamp((this.stepFm??p.fm)+(mods.fm||0)*5+m[0]/65,0,18),feedback=clamp(p.feedback+(mods.feedback||0)*.5,0,.95);
      let char=0,dry=0;const dt=1/this.internalSR;
      for(let o=0;o<this.os;o++){
        this.b=(this.b+(hz*ratio+p.fine)*dt)%1;const mod=wave(p.waveB,this.b+this.prevMod*feedback*.2);this.prevMod=mod;
        this.a=(this.a+hz*Math.pow(2,pitchTransient/12)*dt)%1;const warp=clamp(p.warp+(mods.warp||0),0,1),phase=this.a+Math.sin(TAU*this.a)*warp*.2+mod*fm*.14;
        const morph=clamp(p.morph+(m[3]-35)/250,0,1);
        let source=wave(p.wave,phase)*(1-morph)+wave('hollow',phase)*morph;
        if(p.sampleBlend>0&&this.sampleBuffer)source=source*(1-p.sampleBlend)+this.sampleOsc()*p.sampleBlend;
        const transient=Math.exp(-this.noteAge/Math.max(.003,p.transientTime))*p.transient;
        source=source*this.env*this.velocity+transient*(this.random()*.5+Math.sin(TAU*this.a*5)*.5);
        source=this.filters.charHP.next(source);dry=source;
        let processed=this.effects(source);
        this.dryRms+=(dry*dry-this.dryRms)*.00005;this.wetRms+=(processed*processed-this.wetRms)*.00005;
        const target=p.gainMatch?clamp(Math.sqrt((this.dryRms+1e-5)/(this.wetRms+1e-5)),.15,3):1;this.matchGain+=(target-this.matchGain)*.0001;
        processed=p.bypass?dry:processed*this.matchGain;
        char=this.filters.anti2.next(this.filters.anti1.next(processed));
      }
      this.subPhase=(this.subPhase+hz*Math.pow(2,p.subOctave)/this.sr)%1;
      let sub=p.subWave==='triangle'?2/Math.PI*Math.asin(Math.sin(this.subPhase*TAU)):Math.sin(this.subPhase*TAU);
      sub=Math.tanh(sub*(1+p.subSat*3))/(1+p.subSat*.6)*this.subEnv;
      const subGain=clamp(p.subLevel*(.4+m[4]/100),0,1.4),charGain=p.charLevel*(.6+m[3]/120)*clamp(1+(mods.amp||0),0,2),width=p.width;
      const side=width*Math.sin(this.a*TAU*2.003)*char*.45,pan=clamp(mods.pan||0,-1,1);
      this.subOut=p.solo==='character'?0:sub*subGain;
      this.charL=p.solo==='sub'?0:(char+side)*charGain*Math.sqrt(1-pan);this.charR=p.solo==='sub'?0:(char-side)*charGain*Math.sqrt(1+pan);
      this.outputGain+=(this.outputTarget-this.outputGain)*.002;
      let l=(this.subOut+this.charL)*this.outputGain,r=(this.subOut+this.charR)*this.outputGain;
      // DC blocking after asymmetric processing, then a bounded output stage.
      const inputs=[l,r];for(let i=0;i<2;i++){const y=inputs[i]-this.previousInput[i]+.998*this.previousOutput[i];this.previousInput[i]=inputs[i];this.previousOutput[i]=y;inputs[i]=this.clip?Math.tanh(y):clamp(y,-.98,.98);}
      this.L=Number.isFinite(inputs[0])?inputs[0]:0;this.R=Number.isFinite(inputs[1])?inputs[1]:0;
    }
  }
  globalThis.MotherBassEngine=MotherBassEngine;globalThis.MotherBassDefaults=defaults;
})();
