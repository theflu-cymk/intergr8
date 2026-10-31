const fs=require('fs');let h=fs.readFileSync('dist/index.html','utf8');
if(!h.includes('global-controls')){
 h=h.replace('<button id="save">↥ Save patch</button>','').replace('<button id="help" aria-label="Help">?</button>','');
 const toolbar=h.match(/<section class="toolbar">[\s\S]*?<\/section>/)[0];h=h.replace(toolbar,'');
 const modes=toolbar.match(/<div class="mode"[\s\S]*?<\/div>/)[0];
 const clock=toolbar.match(/<div class="clock">[\s\S]*?<\/div>/)[0];
 h=h.replace(/<section class="patchbar">[\s\S]*?<\/section>/,'');
 h=h.replace(/<section class="tape-bank"[\s\S]*?<\/section>/,'');
 const macroStart=h.indexOf('<section class="macros">');h=h.slice(0,macroStart)+'<section class="global-controls" aria-label="Global controls"><div class="toolbar">'+modes+'<span id="modeHint"></span><span class="global-caption">GLOBAL CONTROLS</span></div>'+h.slice(macroStart);
 const terminal=`<section class="patchbar" aria-label="Preset and transport display"><div class="preset-readout"><div class="readout-header"><small>PRESET</small><span id="patchStatus" role="status">SAVED</span></div><h1 id="patchName"></h1><p id="patchDesc"></p><div class="terminal-controls">${clock}<button id="save">SAVE PATCH</button><button id="help" aria-label="Help">?</button></div></div><div class="patchnav"><button id="prev" aria-label="Previous preset">←</button><button id="next" aria-label="Next preset">→</button><button id="random">⤨ Mutate</button></div></section>`;
 h=h.replace('<section class="presets">',terminal+'<section class="presets">');h=h.replace('<div id="presets"></div></section><footer>','<div id="presets"></div><div id="userPresets" aria-label="Saved patches"></div></section></section><footer>');
 h=h.replace('<script src="app.js"></script>','<dialog id="saveDialog"><form id="saveForm"><h2>Save patch</h2><label for="patchTitle">Patch name</label><input id="patchTitle" maxlength="60" required autocomplete="off"><div class="save-actions"><button type="button" id="cancelSave">Cancel</button><button type="submit">Save patch</button></div><p>Saved in this browser. A JSON backup downloads automatically.</p></form></dialog><script src="app.js"></script><script src="patch-ui.js"></script>');
 h=h.replace('<link rel="stylesheet" href="preset-terminal.css">','<link rel="stylesheet" href="preset-terminal.css"><link rel="stylesheet" href="global-layout.css">');
 fs.writeFileSync('dist/index.html',h);
}
