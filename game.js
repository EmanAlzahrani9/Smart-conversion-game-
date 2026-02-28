/* =====================================================    
لعبة "التحويل الذكي" — نسخة محسّنة  
إعداد: إيمان الزهراني  
===================================================== */  

/*-----------------------------  أدوات أساسية ------------------------------*/ 
const $  = sel => document.querySelector(sel); 
const $$ = sel => document.querySelectorAll(sel);  

/*-----------------------------  عناصر الشاشات والواجهات ------------------------------*/ 
const screens = {   
  start: $('#start-screen'),   
  game:  $('#game-screen'),   
  end:   $('#end-screen'), 
};  

const ui = {   
  level: $('#level'),   
  score: $('#score'),   
  time:  $('#time'),   
  qText: $('#question-text'),   
  choices: $('#choices'),   
  feedback: $('#feedback'),   
  progress: $('#progress-bar'),    

  endTitle: $('#end-title'),   
  endSummary: $('#end-summary'),   
  btnNext: $('#btn-next-level'),   
  btnRestart: $('#btn-restart'),   
  btnStart: $('#btn-start'),   
  btnCert: $('#btn-certificate'),    

  unitSelect: $('#unit-select'),   
  rangeSelect: $('#range-select'),   
  qPerLevel: $('#questions-per-level'),   
  studentInput: $('#student-name'), 
};  

/*-----------------------------  الحالة العامة للعبة ------------------------------*/ 
const Game = {   
  level: 1,   
  maxLevel: 3,   
  score: 0,   
  timeLeft: 60,   
  timerId: null,   
  asked: 0,   
  levelErrors: 0,

  questions: [],   
  questionsPerLevel: 5,   

  unit: 'm',   
  prefixRange: 'common',   

  highScore: +localStorage.getItem('smart_lab_highscore') || 0, 
};  

/*-----------------------------  جدول البادئات ------------------------------*/ 
const PREFIXES = [   
  { name:'pico',  symbol:'p',  exp:-12 },   
  { name:'nano',  symbol:'n',  exp:-9  },   
  { name:'micro', symbol:'µ',  exp:-6  },   
  { name:'milli', symbol:'m',  exp:-3  },   
  { name:'centi', symbol:'c',  exp:-2  },   
  { name:'deci',  symbol:'d',  exp:-1 },   
  { name:'',      symbol:'',   exp:0   },   
  { name:'kilo',  symbol:'k',  exp:3   },   
  { name:'mega',  symbol:'M',  exp:6   },   
  { name:'giga',  symbol:'G',  exp:9   },   
  { name:'tera',  symbol:'T',  exp:12  }, 
];  

/*-----------------------------  تحديد مجموعة البادئات ------------------------------*/ 
function getPrefixPool(range){   
  if(range === 'common')     
    return PREFIXES.filter(p => [-3,-2,0,3,6,9].includes(p.exp));    

  if(range === 'extended')     
    return PREFIXES.filter(p => [-9,-6,-3,-2,0,3,6,9,12].includes(p.exp));    

  return PREFIXES;
}  

/*-----------------------------  مؤثرات صوتية ------------------------------*/ 
function beep(type='success'){   
  const ctx = new (window.AudioContext || window.webkitAudioContext)();   
  const osc = ctx.createOscillator();   
  const gain = ctx.createGain();    

  osc.type = "sine";   
  osc.frequency.value = (type === 'success') ? 900 : (type === 'error') ? 220 : 440;    

  osc.connect(gain);   
  gain.connect(ctx.destination);    

  gain.gain.setValueAtTime(0.001, ctx.currentTime);   
  gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.01);    

  osc.start();   
  osc.stop(ctx.currentTime + 0.18); 
}  

function activatePulse(){   
  const ctx = new (window.AudioContext||window.webkitAudioContext)();   
  const o = ctx.createOscillator();   
  const g = ctx.createGain();    

  o.type = "triangle";   
  o.frequency.setValueAtTime(440, ctx.currentTime);   
  o.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.4);    

  o.connect(g);   
  g.connect(ctx.destination);    

  g.gain.setValueAtTime(0.001, ctx.currentTime);   
  g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.05);    

  o.start();   
  o.stop(ctx.currentTime + 0.45); 
}  

/*-----------------------------  أدوات مساعدة ------------------------------*/ 
const rnd = (min,max)=> Math.floor(Math.random()*(max-min+1))+min;  
function pick(arr) { return arr[Math.floor(Math.random()*arr.length)]; }  
function fmt(x){   
  const abs = Math.abs(x);   
  if(abs !== 0 && (abs < 1e-3 || abs >= 1e6))     
    return x.toExponential(2).replace('+','');    
  return (+x.toFixed(6)).toString(); 
}  

/*-----------------------------  صنع سؤال جديد ------------------------------*/ 
function makeQuestion(pool, unit, level){   
  const p1 = pick(pool);   
  let p2 = pick(pool);    
  while(p1.exp === p2.exp) p2 = pick(pool);    

  const baseVal = (level === 1) ? rnd(2,900)/10 : (level === 2) ? rnd(5,900) : rnd(50,5000);    
  const v_base = baseVal * Math.pow(10, p1.exp);   
  const correct = v_base / Math.pow(10, p2.exp);    

  const qText = `<b>${fmt(baseVal)} ${p1.symbol}${unit}</b> → <b>${p2.symbol}${unit}</b>`;   
  const correctAns = fmt(correct);    

  // توليد خيارات خاطئة مضمونة التفرد
  const usedExps = new Set([0]); // 0 = نفس الإجابة الصحيحة
  const wrongOptions = [];
  const expCandidates = [-6,-5,-4,-3,-2,-1,1,2,3,4,5,6];

  for(const e of expCandidates.sort(()=>Math.random()-0.5)){
    if(wrongOptions.length >= 3) break;
    if(usedExps.has(e)) continue;
    const val = fmt(correct * Math.pow(10, e));
    if(val !== correctAns && !wrongOptions.includes(val)){
      wrongOptions.push(val);
      usedExps.add(e);
    }
  }

  // احتياطي إذا ما اكتملت الخيارات
  let fallbackMult = 10;
  while(wrongOptions.length < 3){
    const val = fmt(correct * fallbackMult);
    if(val !== correctAns && !wrongOptions.includes(val)) wrongOptions.push(val);
    fallbackMult *= 10;
  }

  let options = [correctAns, ...wrongOptions];
  options.sort(()=>Math.random()-0.5);    

  const explain = `<div>فرق الأسس: Δ = (${p1.exp}) − (${p2.exp}) = <b>${p1.exp - p2.exp}</b></div><div>${fmt(baseVal)} × 10<sup>${p1.exp}</sup> = ${fmt(correct)} ${p2.symbol}${unit}</div>`;    

  return { text: qText, options, answer: correctAns, explain, meta: { from:p1, to:p2, baseVal, correct } }; 
}  

/*-----------------------------  بناء مستوى ------------------------------*/ 
function buildLevel(level){   
  const pool = getPrefixPool(Game.prefixRange);   
  const qs = [];    

  while(qs.length < Game.questionsPerLevel){     
    const q = makeQuestion(pool, Game.unit, level);     
    const delta = Math.abs(q.meta.from.exp - q.meta.to.exp);      

    if(level === 1 && delta <= 3) qs.push(q);     
    else if(level === 2 && delta >= 3 && delta <= 9) qs.push(q);     
    else if(level === 3 && delta >= 6) qs.push(q);   
  }   
  return qs; 
}  

/*-----------------------------  المؤقت ------------------------------*/ 
function startTimer(seconds){
    Game.timeLeft = seconds;
    ui.time.textContent = Game.timeLeft;
    clearInterval(Game.timerId);

    Game.timerId = setInterval(()=>{
        Game.timeLeft--;
        ui.time.textContent = Game.timeLeft;

        if(Game.timeLeft <= 0){
            clearInterval(Game.timerId);
            endLevel(false, 'انتهى الوقت!');
        }
    }, 1000);
}

/*-----------------------------  بدء اللعبة ------------------------------*/ 
function startGame(){ 
    const studentName = ui.studentInput.value.trim();
    if(!studentName){
        alert('✍️ الرجاء إدخال الاسم قبل بدء اللعبة!');
        return;
    }

    Game.level = 1;
    Game.score = 0;    
    Game.unit = ui.unitSelect.value;   
    Game.prefixRange = ui.rangeSelect.value;   
    Game.questionsPerLevel = Math.max(3, Math.min(12, +ui.qPerLevel.value || 5));    

    swapScreen('game');   
    ui.level.textContent = Game.level;   
    ui.score.textContent = Game.score;    

    loadLevel(); 
}  

/*-----------------------------  تحميل مستوى ------------------------------*/ 
function loadLevel(){
    const baseTime = 120;
    const timeByLevel = Math.max(baseTime - (Game.level-1)*5, 5);

    Game.questions = buildLevel(Game.level);
    Game.asked = 0;
    Game.levelErrors = 0;

    startTimer(timeByLevel);
    askNext();
}

/*-----------------------------  عرض سؤال جديد ------------------------------*/ 
function askNext(){   
    ui.feedback.innerHTML = '';    
    const q = Game.questions[Game.asked];   
    if(!q){     
        endLevel(true, "أحسنت! أنهيت جميع أسئلة هذا المستوى.");     
        return;   
    }    

    ui.qText.innerHTML = q.text;   
    ui.qText.style.fontWeight = 'bold';
    ui.choices.innerHTML = '';    

    q.options.forEach(opt=>{
        const btn = document.createElement('button');
        btn.className = 'choice';
        btn.textContent = opt;
        btn.style.fontSize = '1.2em';
        btn.style.padding = '12px 24px';
        btn.addEventListener('click', ()=> handleAnswer(btn, q));
        ui.choices.appendChild(btn);
    });    

    const pct = Math.round((Game.asked/Game.questions.length)*100);   
    ui.progress.style.width = pct + '%'; 
}  

/*-----------------------------  التحقق من الإجابة ------------------------------*/ 
function handleAnswer(btn, q){   
    $$('.choice').forEach(b=> b.disabled = true);    

    if(btn.textContent === q.answer){     
        btn.classList.add('correct');     
        beep('success');      
        Game.score += 10 + Math.floor(Game.timeLeft/10);     
        ui.score.textContent = Game.score;      
        ui.feedback.innerHTML = '✔️ إجابة صحيحة!<br>' + q.explain;      
        Game.asked++;     
        setTimeout(askNext, 700);   
    }   
    else{     
        btn.classList.add('wrong');     
        beep('error');      
        Game.levelErrors++;
        Game.timeLeft = Math.max(0, Game.timeLeft - 5);     
        ui.time.textContent = Game.timeLeft;      
        ui.feedback.innerHTML = `❌ ليست صحيحة — حاول/ي مجددًا<br>خطأ ${Game.levelErrors} من 2<br>` + q.explain;      

        if(Game.levelErrors >= 2){
            endLevel(false, 'لقد ارتكبت خطأين في هذا المستوى!'); 
            return;
        }

        setTimeout(()=>{
            $$('.choice').forEach(b=>{
                if(!b.classList.contains('wrong')) b.disabled = false;
            });
        }, 300);   
    } 
}  

/*-----------------------------  نهاية المستوى ------------------------------*/ 
function endLevel(won, msg){   
    clearInterval(Game.timerId);   
    swapScreen('end');    

    if(won){     
        ui.endTitle.textContent = (Game.level < Game.maxLevel) ? "ممتاز! أكملت المستوى." : "🎉 بطل/ة مختبر الفيزياء!";   
    } else {     
        ui.endTitle.textContent = "انتهى المستوى!";   
    }    

    ui.endSummary.innerHTML = `${msg}<br>نقاطك: <b>${Game.score}</b>`;    
    ui.btnNext.style.display = (won && Game.level < Game.maxLevel) ? 'inline-block' : 'none';    
    ui.btnCert.style.display = (won && Game.level === Game.maxLevel) ? 'inline-block' : 'none';    
    activatePulse();

    const playerName = ui.studentInput.value.trim() || "طالب";
    saveScore(playerName, Game.score);
    renderTopScores();
    renderTopPlayers();
}  

/*-----------------------------  المستوى التالي ------------------------------*/ 
function nextLevel(){   
    Game.level++;   
    if(Game.level > Game.maxLevel){     
        restartGame();     
        return;   
    }   
    swapScreen('game');   
    ui.level.textContent = Game.level;   
    loadLevel(); 
}  

/*-----------------------------  إعادة اللعبة ------------------------------*/ 
function restartGame(){   
    swapScreen('start'); 
}  

/*-----------------------------  تبديل الشاشات ------------------------------*/ 
function swapScreen(name){   
    Object.values(screens).forEach(s=> s.classList.remove('active'));   
    screens[name].classList.add('active'); 
}  

/*=================  Firebase Setup  =================*/

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getDatabase, ref, push, onValue } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyBWbITwH_vg8R41v9Gk-pwy4rcyqPlWr6s",
    authDomain: "smart-game-822dd.firebaseapp.com",
    databaseURL: "https://smart-game-822dd-default-rtdb.firebaseio.com",
    projectId: "smart-game-822dd",
    storageBucket: "smart-game-822dd.firebasestorage.app",
    messagingSenderId: "555814813008",
    appId: "1:555814813008:web:7d45354b35540db7894055"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);

/*=================  حفظ النتيجة في Firebase  =================*/

function saveScore(name, score){
    const scoresRef = ref(db, 'scores');
    push(scoresRef, { name, score, time: Date.now() });
}

/*=================  أعلى 20 سكور (مع تكرار) =================*/

function renderTopScores(){
    const list = document.getElementById('topScores-list');
    if(!list) return;

    const scoresRef = ref(db, 'scores');
    onValue(scoresRef, (snapshot) => {
        const data = snapshot.val();
        if(!data){ list.innerHTML = '<li>لا توجد نتائج بعد</li>'; return; }

        let scores = Object.values(data);
        scores.sort((a,b) => b.score - a.score);
        scores = scores.slice(0, 20);

        list.innerHTML = '';
        scores.forEach((p, i) => {
            const li = document.createElement('li');
            li.textContent = `${p.name} — ${p.score} نقطة`;
            list.appendChild(li);
        });
    });
}

/*=================  أفضل 20 لاعب (بدون تكرار) =================*/

function renderTopPlayers(){
    const list = document.getElementById('topPlayers-list');
    if(!list) return;

    const scoresRef = ref(db, 'scores');
    onValue(scoresRef, (snapshot) => {
        const data = snapshot.val();
        if(!data){ list.innerHTML = '<li>لا توجد نتائج بعد</li>'; return; }

        let scores = Object.values(data);

        // أعلى نتيجة لكل لاعب فقط
        let bestPerPlayer = {};
        scores.forEach(p => {
            if(!bestPerPlayer[p.name] || p.score > bestPerPlayer[p.name]){
                bestPerPlayer[p.name] = p.score;
            }
        });

        let playersArray = Object.keys(bestPerPlayer).map(name => ({ name, score: bestPerPlayer[name] }));
        playersArray.sort((a,b) => b.score - a.score);
        playersArray = playersArray.slice(0, 20);

        list.innerHTML = '';
        playersArray.forEach(p => {
            const li = document.createElement('li');
            li.textContent = `${p.name} — ${p.score} نقطة`;
            list.appendChild(li);
        });
    });
}

/*-----------------------------  شهادة PDF ------------------------------*/ 
function generateCertificate(student, score, time) {   
    const { jsPDF } = window.jspdf;   
    const doc = new jsPDF({ orientation: "landscape", unit: "px", format: "a4" });    

    doc.setFillColor(15, 25, 55);   
    doc.rect(0, 0, 842, 595, "F");    

    doc.setTextColor("#3ddc97");   
    doc.setFontSize(36);   
    doc.text("شهادة إنجاز", 420, 80, { align: "center" });    

    doc.setTextColor("#ffffff");   
    doc.setFontSize(18);   
    doc.text("المدرسة: الثانوية الثانية مسارات بمكة المكرمة", 420, 115, { align: "center" });    

    doc.setFontSize(24);   
    doc.text(`تشهد المعلمة بأن الطالب/ـة: ${student}`, 420, 170, { align: "center" });    

    doc.setFontSize(18);   
    doc.text(`أتم/ت لعبة "التحويل الذكي" الخاصة بتحويل البادئات الفيزيائية.`, 420, 220, { align: "center" });   
    doc.text(`مجموع النقاط: ${score}`, 420, 255, { align: "center" });   
    doc.text(`الوقت المتبقي عند الإنهاء: ${time} ثانية`, 420, 285, { align: "center" });    

    doc.setDrawColor("#3ddc97");   
    doc.setLineWidth(2);   
    doc.line(200, 310, 640, 310);    

    doc.setFontSize(18);   
    doc.text("معلمتكم: إيمان الزهراني", 420, 350, { align: "center" });    

    doc.save(`شهادة-${student}.pdf`); 
}  

/*-----------------------------  تفعيل زر الشهادة ------------------------------*/ 
ui.btnCert.addEventListener('click', ()=>{
    const student = ui.studentInput.value.trim() || "طالب";
    generateCertificate(student, Game.score, Game.timeLeft);
});  

/*-----------------------------  ربط الأزرار ------------------------------*/ 
ui.btnStart.addEventListener('click', startGame); 
ui.btnNext.addEventListener('click', nextLevel); 
ui.btnRestart.addEventListener('click', restartGame);

/*-----------------------------  تحميل القوائم عند فتح الصفحة ------------------------------*/
renderTopScores();
renderTopPlayers();
