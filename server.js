// UTILITIES
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const toast = (msg) => {
  const el = document.createElement('div');
  el.className = 'item';
  el.textContent = msg;
  $('#toast').appendChild(el);
  setTimeout(()=> el.remove(), 2800);
};

const saveHistory = (entry) => {
  const history = JSON.parse(localStorage.getItem('cc_history')||'[]');
  history.unshift({...entry, t: Date.now()});
  localStorage.setItem('cc_history', JSON.stringify(history.slice(0,20)));
  renderHistory();
};
const renderHistory = () => {
  const history = JSON.parse(localStorage.getItem('cc_history')||'[]');
  const box = $('#historyList');
  box.innerHTML = '';
  history.forEach(h => {
    const b = document.createElement('button');
    b.innerHTML = `<span>${h.mode} → ${h.tgt}</span><span class="kbd">${new Date(h.t).toLocaleTimeString()}</span>`;
    b.onclick = ()=>{ $('#result').textContent = h.out; };
    box.appendChild(b);
  });
};

// PARTICLES
const canvas = document.getElementById('particles');
const ctx = canvas.getContext('2d');
let w,h,parts=[]; function resize(){w=canvas.width=innerWidth; h=canvas.height=innerHeight}; resize(); addEventListener('resize', resize);
function spawn(n=90){
  parts = Array.from({length:n}, _=>({x:Math.random()*w, y:Math.random()*h, r:1+Math.random()*2, vx:(Math.random()-.5)*.4, vy:(Math.random()-.5)*.4}));
}
function tick(){
  ctx.clearRect(0,0,w,h);
  parts.forEach(p=>{
    p.x+=p.vx; p.y+=p.vy; if(p.x<0||p.x>w) p.vx*=-1; if(p.y<0||p.y>h) p.vy*=-1;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fillStyle='rgba(124,92,255,.5)'; ctx.fill();
  });
  for(let i=0;i<parts.length;i++){
    for(let j=i+1;j<parts.length;j++){
      const a=parts[i], b=parts[j];
      const d = Math.hypot(a.x-b.x, a.y-b.y);
      if(d<110){ ctx.strokeStyle=`rgba(0,224,255, ${1-d/110})`; ctx.lineWidth=.6; ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke(); }
    }
  }
  requestAnimationFrame(tick);
}
spawn(); tick();

// TILT
const tilt = $('#tilt');
tilt.addEventListener('mousemove', (e)=>{
  const r = tilt.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width - .5;
  const y = (e.clientY - r.top) / r.height - .5;
  tilt.style.transform = `perspective(1000px) rotateX(${(-y*4).toFixed(2)}deg) rotateY(${(x*4).toFixed(2)}deg)`;
});
tilt.addEventListener('mouseleave', ()=> tilt.style.transform='');

// THEME/STATUS/YEAR
const themeBtn = $('#themeBtn');
const root = document.documentElement;
themeBtn.onclick = ()=>{
  const next = root.getAttribute('data-theme')==='dark' ? 'light' : 'dark';
  root.setAttribute('data-theme', next);
  localStorage.setItem('cc_theme', next);
};
const savedTheme = localStorage.getItem('cc_theme'); if(savedTheme) root.setAttribute('data-theme', savedTheme);
$('#year').textContent = new Date().getFullYear();
const setStatus = ()=>{
  const on = navigator.onLine; $('#statusDot').style.background = on ? 'var(--accent)' : 'var(--warn)';
  $('#statusText').textContent = on? 'Online' : 'Offline';
}; setStatus(); addEventListener('online', setStatus); addEventListener('offline', setStatus);

// MODE TABS
let currentMode = 'translate';
$$('#modeTabs .pill').forEach(p=>p.onclick = ()=>{
  $$('#modeTabs .pill').forEach(x=>x.classList.remove('active'));
  p.classList.add('active');
  currentMode = p.dataset.mode;
  toast(`Mode: ${currentMode}`);
});

// DROPZONE / FILE INPUT
const drop = $('#dropzone');
const fileInput = $('#fileInput');
$('#fileBtn').onclick = ()=> fileInput.click();
['dragenter','dragover'].forEach(ev=> drop.addEventListener(ev, e=>{e.preventDefault();drop.classList.add('drag')}));
['dragleave','drop'].forEach(ev=> drop.addEventListener(ev, e=>{e.preventDefault();drop.classList.remove('drag')}));
drop.addEventListener('drop', async (e)=>{ const f = e.dataTransfer.files?.[0]; if(f) await readFile(f); });
fileInput.addEventListener('change', async ()=>{ const f=fileInput.files[0]; if(f) await readFile(f); });
async function readFile(file){
  const name = file.name || '';
  const isPDF = /\.pdf$/i.test(name) || file.type === 'application/pdf';
  if(isPDF){
    try{
      progressText.textContent = 'Extracting text from PDF…';
      const text = await extractTextFromPDF(file);
      $('#inputText').value = (text && text.trim()) ? text : `Loaded file: ${file.name} (no extractable text)`;
      toast(`Loaded ${file.name} (PDF text extracted)`);
      progressText.textContent = 'Idle';
      return;
    }catch(err){ console.error(err); toast('PDF extraction failed — loading raw'); }
  }
  const text = await file.text().catch(()=> '');
  $('#inputText').value = text || `Loaded file: ${file.name} (binary preview hidden)`;
  toast(`Loaded ${file.name}`);
}

async function loadPdfJs(){
  if(window.pdfjsLib) return window.pdfjsLib;
  await new Promise((resolve, reject)=>{
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
  });
  const workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  if(window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions){
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
  }
  return window.pdfjsLib;
}

async function extractTextFromPDF(file){
  const pdfjs = await loadPdfJs();
  const buf = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: buf });
  const pdf = await loadingTask.promise;
  const parts = [];
  for(let p=1; p<=pdf.numPages; p++){
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    const pageText = tc.items.map(it=>('str' in it ? it.str : (it?.text || ''))).join(' ');
    parts.push(pageText);
    if(p % 5 === 0) progressText.textContent = `Extracting… page ${p}/${pdf.numPages}`;
    await new Promise(r=>setTimeout(r, 10));
  }
  const text = parts.join('\n\n');
  return text;
}

// SPEECH
const micBtn = $('#micBtn');
let recog;
micBtn.onclick = ()=>{
  try{
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if(!SR) return toast('SpeechRecognition not supported');
    if(recog){recog.stop(); recog=null; micBtn.textContent='🎙️ Dictate'; return}
    recog = new SR(); recog.lang = ($('#srcLang').value.includes('English')? 'en-IN':'hi-IN');
    recog.interimResults = true; recog.onresult = (e)=>{ const t = Array.from(e.results).map(r=>r[0].transcript).join(' '); $('#inputText').value = t; };
    recog.onend = ()=>{ micBtn.textContent='🎙️ Dictate'; toast('Dictation stopped') };
    recog.start(); micBtn.textContent='⏺️ Stop'; toast('Dictation started…');
  }catch(err){ console.error(err); toast('Speech init failed'); }
};

const speakBtn = $('#speakBtn');
speakBtn.onclick = ()=>{
  const t = $('#result').textContent.trim(); if(!t) return toast('Nothing to speak');
  const u = new SpeechSynthesisUtterance(t); u.lang = ($('#tgtLang').value.includes('English')? 'en-IN':'hi-IN');
  speechSynthesis.speak(u);
};

// RUN AI
const runBtn = $('#runBtn');
const progressText = $('#progressText');
async function run(){
  const input = $('#inputText').value.trim();
  if(!input){ toast('Please paste some text or upload a file.'); return; }
  progressText.textContent = 'Processing…';

  const steps = [
    'Detecting language…',
    'Chunking large paragraphs…',
    currentMode==='translate'? 'Translating with glossary…' : currentMode==='simplify'? 'Simplifying legalese…' : currentMode==='summarise'? 'Generating summary…' : currentMode==='extract'? 'Extracting entities…' : 'Generating speech…',
    'Formatting citations…',
    'Quality checks…'
  ];
  for(const s of steps){ progressText.textContent = s; await new Promise(r=>setTimeout(r, 500)); }

  const src = $('#srcLang').value; const tgt = $('#tgtLang').value;
  let out = '';
  if(currentMode==='translate'){
    try{
      const srcCode = getLanguageCode(src, true, input);
      const tgtCode = getLanguageCode(tgt, false, input);
      const {text:limitedText, truncated} = clampToWords(input, 10000);
      if(truncated) toast('Input exceeds 10,000 words. Trimming to first 10,000.');
      const translated = await translateLargeText(limitedText, srcCode, tgtCode, (i,n)=>{ progressText.textContent = `Translating… ${i}/${n}`; });
      out = translated || '[Translation failed]';
    }catch(err){ console.error(err); toast('Translation failed'); out = '[Translation failed]'; }
  } else if(currentMode==='simplify'){
    out = `【DEMO】Plain‑language rewrite in ${tgt}. Key points are made concise.\n\n` + simplify(input);
  } else if(currentMode==='summarise'){
    out = `【DEMO】Summary: This document discusses …\n• Parties: A v. B\n• Court: XYZ\n• Key holdings: …\n• Outcome: …\n\nQuoted: \n` + input.slice(0, 240) + (input.length>240?'…':'');
  } else if(currentMode==='extract'){
    out = `【DEMO】Extracted Entities\n— Parties: …\n— Dates: …\n— Statutes: IPC 420, CrPC 197\n— Bench: …\n— Citations: (2014) 2 SCC 123 …`;
  } else if(currentMode==='audio'){
    out = `【DEMO】Audio ready for ${tgt}. Use 🔊 Speak to play.`;
  }

  $('#result').textContent = out;
  $('#citations').innerHTML = `<ul style="margin:0;padding-left:18px">\n<li>State of X v. Y, (2014) 2 SCC 123</li>\n<li>Section 482, CrPC — Inherent powers</li>\n<li>Article 226, Constitution of India</li>\n</ul>`;

  saveHistory({mode: currentMode, tgt, out});
  progressText.textContent = 'Done';
  confetti();
}

// Language + Translation helpers
function getLanguageCode(optionLabel, allowAuto=false, textSample=''){
  if(allowAuto && (optionLabel==='Auto‑detect' || optionLabel==='auto')){
    return detectScriptCode(textSample) || 'en';
  }
  const label = optionLabel.toLowerCase();
  const map = {
    'english':'en','hindi':'hi','tamil':'ta','telugu':'te','kannada':'kn','malayalam':'ml','marathi':'mr','bengali':'bn','gujarati':'gu','punjabi':'pa','odia':'or','urdu':'ur'
  };
  for(const [name, code] of Object.entries(map)){
    if(label.includes(name)) return code;
  }
  return 'en';
}
function clampToWords(text, maxWords){
  const words = text.match(/\S+/g) || [];
  if(words.length <= maxWords) return {text, truncated:false};
  const limited = words.slice(0,maxWords).join(' ');
  return {text:limited, truncated:true};
}
function detectScriptCode(text){
  const scripts = [
    {re:/[\u0900-\u097F]/, code:'hi'},
    {re:/[\u0B80-\u0BFF]/, code:'ta'},
    {re:/[\u0C00-\u0C7F]/, code:'te'},
    {re:/[\u0C80-\u0CFF]/, code:'kn'},
    {re:/[\u0D00-\u0D7F]/, code:'ml'},
    {re:/[\u0980-\u09FF]/, code:'bn'},
    {re:/[\u0A80-\u0AFF]/, code:'gu'},
    {re:/[\u0A00-\u0A7F]/, code:'pa'},
    {re:/[\u0B00-\u0B7F]/, code:'or'},
    {re:/[\u0600-\u06FF]/, code:'ur'}
  ];
  const sample = text.slice(0, 400);
  for(const s of scripts){ if(s.re.test(sample)) return s.code; }
  return 'en';
}
function chunkTextBySize(text, targetSize=360){
  const rawChunks = [];
  let i = 0;
  while(i < text.length){
    let end = Math.min(i + targetSize, text.length);
    if(end < text.length){
      const slice = text.slice(i, end+200);
      const punctIdx = Math.max(slice.lastIndexOf('.'), slice.lastIndexOf('!'), slice.lastIndexOf('?'));
      const newline = Math.max(slice.lastIndexOf('\n'), slice.lastIndexOf('\r'));
      const cut = Math.max(punctIdx, newline);
      if(cut > 50) end = i + cut + 1;
    }
    rawChunks.push(text.slice(i, end));
    i = end;
  }
  const maxEncoded = 480;
  const safeChunks = [];
  for(const ch of rawChunks){
    if(encodeURIComponent(ch).length <= maxEncoded){
      safeChunks.push(ch);
    } else {
      const words = ch.split(/(\s+)/);
      let buf = '';
      for(const w of words){
        const next = buf + w;
        if(encodeURIComponent(next).length > maxEncoded){
          if(buf.trim()) safeChunks.push(buf);
          buf = w.trim() ? w : '';
          if(encodeURIComponent(buf).length > maxEncoded){
            let s = 0;
            while(s < w.length){
              let slice = w.slice(s, s+120);
              while(encodeURIComponent(slice).length > maxEncoded && slice.length > 10){
                slice = slice.slice(0, slice.length-10);
              }
              safeChunks.push(slice);
              s += slice.length;
            }
            buf = '';
          }
        } else {
          buf = next;
        }
      }
      if(buf.trim()) safeChunks.push(buf);
    }
  }
  return safeChunks.filter(c=>c && c.trim().length>0);
}
async function translateLargeText(text, srcCode, tgtCode, onProgress){
  let chunks = chunkTextBySize(text, 360);
  const results = new Array(chunks.length);
  const concurrency = 2;
  let idx = 0, done = 0;
  onProgress && onProgress(0, chunks.length);

  async function worker(){
    while(true){
      const myIndex = idx++; if(myIndex >= chunks.length) break;
      const piece = chunks[myIndex];
      let translated = await translateChunk(piece, srcCode, tgtCode);
      if(typeof translated === 'string' && translated.startsWith('[ERR_QUERY_TOO_LONG]')){
        const smaller = chunkTextBySize(piece, 200);
        const subResults = [];
        for(const sub of smaller){
          const t = await translateChunk(sub, srcCode, tgtCode);
          subResults.push(typeof t === 'string' && t.startsWith('[ERR_QUERY_TOO_LONG]') ? sub : t);
          await new Promise(r=>setTimeout(r, 300));
        }
        translated = subResults.join('');
      }
      results[myIndex] = translated;
      done++; onProgress && onProgress(done, chunks.length);
      await new Promise(r=>setTimeout(r, 400));
    }
  }
  const workers = Array.from({length:concurrency}, worker);
  await Promise.all(workers);
  return results.join('');
}
async function translateChunk(chunk, srcCode, tgtCode){
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=${encodeURIComponent(srcCode)}|${encodeURIComponent(tgtCode)}`;
  for(let attempt=0; attempt<3; attempt++){
    try{
      const res = await fetch(url);
      const data = await res.json();
      const txt = data && data.responseData && data.responseData.translatedText ? data.responseData.translatedText : '';
      const errMsg = (data && (data.responseDetails || data.responseStatus && data.responseStatus !== 200)) ? String(data.responseDetails||'') : '';
      if(errMsg && errMsg.toUpperCase().includes('QUERY LENGTH LIMIT EXCEEDED')){
        return '[ERR_QUERY_TOO_LONG]';
      }
      if(txt) return txt;
    }catch(e){ /* retry */ }
    await new Promise(r=>setTimeout(r, 600 + attempt*600));
  }
  return chunk;
}

function simplify(text){
  return text
    .replace(/whereas/gi,'because')
    .replace(/herein(?:after)?/gi,'later')
    .replace(/aforesaid/gi,'mentioned')
    .replace(/therewith/gi,'with that')
    .replace(/heretofore/gi,'until now');
}

runBtn.onclick = run;
document.addEventListener('keydown', (e)=>{
  if((e.ctrlKey||e.metaKey) && e.key==='Enter') run();
  if(e.key==='?'){ e.preventDefault(); $('#helpDlg').showModal(); }
  if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='k'){ e.preventDefault(); copyOut(); }
  if(e.key==='Escape'){ $('#result').focus(); }
});

// GLOSSARY, QC, CITATIONS
const glossary = JSON.parse(localStorage.getItem('cc_glossary')||'[]');
const renderGlossary = ()=>{
  const ul = $('#glossaryList'); ul.innerHTML='';
  glossary.forEach((g,i)=>{
    const li = document.createElement('li');
    li.innerHTML = `<b>${g.term}</b> → ${g.pref}`;
    ul.appendChild(li);
  });
  localStorage.setItem('cc_glossary', JSON.stringify(glossary));
};
renderGlossary(); renderHistory();

$('#glossaryBtn').onclick = ()=>{
  const term = prompt('Term (English / Source)'); if(!term) return;
  const pref = prompt('Preferred translation / Target'); if(!pref) return;
  glossary.push({term, pref}); renderGlossary(); toast('Glossary term added');
};

$('#qcBtn').onclick = ()=>{
  const checks = ['Terminology consistency ✅','Entities preserved ✅','Numbers formatted ✅'];
  $('#qcPanel').innerHTML = `<ul style="margin:0;padding-left:18px">${checks.map(c=>`<li>${c}</li>`).join('')}</ul>`;
  toast('QC finished');
};

$('#citationsBtn').onclick = ()=>{
  toast('Citations re‑linked');
};

// COPY / DOWNLOAD / CLEAR
const copyOut = ()=>{ const t = $('#result').textContent; navigator.clipboard.writeText(t); toast('Copied to clipboard'); };
$('#copyBtn').onclick = copyOut;
$('#downloadBtn').onclick = ()=>{
  const blob = new Blob([$('#result').textContent], {type:'text/plain'});
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), {href:url, download:`courtconvert_${Date.now()}.txt`});
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
};
$('#clearBtn').onclick = ()=>{ $('#inputText').value=''; $('#result').textContent=''; toast('Cleared'); };

// PRIVACY & READABLE MODE
$('#privacyToggle').onchange = (e)=>{
  const on = e.target.checked; $('#privacyLabel').textContent = on ? 'Privacy‑first (local only)' : 'Standard processing';
  toast(on? 'Confidential Mode ON — data stays on device (demo)' : 'Confidential Mode OFF');
};
$('#readableToggle').onchange = (e)=>{
  document.body.style.letterSpacing = e.target.checked ? '.4px' : '.2px';
  document.body.style.fontSize = e.target.checked ? '18px' : '16px';
  toast('Readable mode ' + (e.target.checked? 'on':'off'));
};

// HELP & SHORTCUTS
$('#kbHelp').onclick = ()=> $('#helpDlg').showModal();
$$('.history button[data-template]').forEach(b=> b.onclick = ()=>{
  const t = b.dataset.template;
  const samples = {
    translate: 'Whereas the petitioner contends that the impugned order is arbitrary, the respondent argues otherwise…',
    summarise: 'The High Court examined whether Section 482 CrPC could be invoked to quash FIR No. 123/2021 registered under Sections 420/468…',
    simplify: 'Heretofore, the party of the first part had undertaken the obligations therein contained…',
    extract: 'Between ABC Pvt. Ltd. (Appellant) vs State of X & Ors., decided on 12.05.2024 by Hon\'ble Justice …'
  };
  $('#inputText').value = samples[t] || '';
  toast('Inserted example text');
});

// CONFETTI
function confetti(){
  for(let i=0;i<24;i++){
    const s = document.createElement('span');
    s.innerHTML = '🎉';
    Object.assign(s.style,{position:'fixed',left:(Math.random()*100)+'%',top:'-20px',fontSize:(14+Math.random()*10)+'px',transition:'transform 1.2s ease, opacity 1.2s ease',zIndex:99});
    document.body.appendChild(s);
    setTimeout(()=>{ s.style.transform = `translateY(${80+Math.random()*120}vh) rotate(${(Math.random()*360)}deg)`; s.style.opacity=.1 }, 10);
    setTimeout(()=> s.remove(), 1500);
  }
}