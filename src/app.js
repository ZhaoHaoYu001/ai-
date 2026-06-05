import { scenarios } from "./data.js";
import { analyze, reply, summarize } from "./coach.js";
import { buildGrowthCalendar } from "./progress.js";

const state = { view: "home", scenario: null, messages: [], elapsed: 0, timer: null, listening: false, recognition: null };
const app = document.querySelector("#app");
const header = () => `<header><button class="brand" data-home><b>F</b> FluentLoop</button><nav>练习场景　 学习方法　 成长记录</nav><span class="streak">● <b>3</b> 天连续练习</span></header>`;

function home() {
  const history = JSON.parse(localStorage.getItem("fluentloop-history") || "[]");
  app.innerHTML = `${header()}<main>
    <section class="hero"><div class="hero-copy"><label>● AI-POWERED SPEAKING STUDIO</label><h1>把每一次开口，<em>变成真实进步。</em></h1><p>沉浸式场景对话、即时智能纠错和可量化成长报告，让英语口语练习更自然、更有效。</p><button class="primary" data-start>开始练习 →</button></div>
    <div class="visual"><div class="orb"></div><article class="coach-card"><div class="coach-title"><i>FL</i><span><b>Fluent Coach</b><small>● Ready to practice</small></span></div><h2>“Tell me about a challenge you solved at work.”</h2><div class="wave">${"<i></i>".repeat(24)}</div><footer><span><b>86</b> Fluency</span><span><b>92</b> Grammar</span><span><b>84</b> Pronunciation</span></footer></article></div></section>
    <section class="scenes" id="scenes"><div class="section-title"><span><label>CHOOSE A SCENE</label><h2>今天想练什么？</h2></span><p>每个场景都由 AI 扮演真实角色，并根据你的水平动态追问。</p></div><div class="scene-grid">${scenarios.map(card).join("")}</div></section>
    <section class="loop"><div><label>LEARNING LOOP</label><h2>不只告诉你哪里错，<br>更告诉你如何变好。</h2></div><div class="steps"><article><b>01</b><h3>自然对话</h3><p>AI 根据上下文追问，避免背答案式练习。</p></article><article><b>02</b><h3>适时反馈</h3><p>不中断表达，回答结束后再给精准建议。</p></article><article><b>03</b><h3>量化成长</h3><p>持续追踪流利度、语法、词汇和发音。</p></article></div></section>
    ${growthCalendar(history)}
    ${history.length ? `<section class="history"><label>YOUR PROGRESS</label><h2>持续练习，变化看得见</h2><article><span><small>最近一次</small><b>${history[0].scenario}</b></span><strong>${history[0].overall}<small>综合得分</small></strong><span><b>↗ 保持练习</b><small>下一次会更自然</small></span></article></section>` : ""}
    </main>${pageFooter()}`;
  document.querySelector("[data-start]").onclick = () => document.querySelector("#scenes").scrollIntoView({behavior:"smooth"});
  document.querySelectorAll("[data-scene]").forEach(el => el.onclick = () => start(el.dataset.scene));
  bindHome();
}

function growthCalendar(history) {
  const calendar = buildGrowthCalendar(history);
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  return `<section class="growth-calendar">
    <div class="calendar-heading"><div><label>DAILY GROWTH</label><h2>练习日历</h2><p>完成一次口语练习，即可点亮当天成长记录。</p></div>
    <div class="calendar-stats"><span><b>${calendar.streak}</b>连续天数</span><span><b>${calendar.activeDays}</b>本月签到</span><span><b>${calendar.totalWords}</b>累计单词</span></div></div>
    <article class="calendar-card"><header><b>${calendar.label}</b><small>${calendar.activeDays ? "坚持正在发生，继续保持。" : "完成今天的第一场练习吧。"}</small></header>
    <div class="weekdays">${weekdays.map(day => `<span>${day}</span>`).join("")}</div>
    <div class="calendar-grid">${calendar.cells.map(cell => cell ? `<div class="calendar-day ${cell.activity ? "checked" : ""} ${cell.isToday ? "today" : ""}" title="${cell.activity ? `${cell.activity.sessions} 次练习 · 最高 ${cell.activity.bestScore} 分` : "尚未练习"}"><span>${cell.day}</span>${cell.activity ? `<i>✓</i><small>${cell.activity.bestScore}</small>` : ""}</div>` : "<div></div>").join("")}</div></article>
  </section>`;
}

const card = s => `<article class="scene" data-scene="${s.id}" style="--accent:${s.color}"><div><i>${s.icon}</i><small>${s.level}</small></div><h3>${s.title}</h3><label>${s.en}</label><p>${s.description}</p><footer><span>◷ ${s.time}</span><b>开始 →</b></footer></article>`;

function practice() {
  const s = state.scenario, last = [...state.messages].reverse().find(m => m.role === "user");
  app.innerHTML = `${header()}<main class="practice"><aside><button class="back" data-home>← 返回场景</button><div class="current" style="--accent:${s.color}"><i>${s.icon}</i><span><small>当前场景</small><b>${s.title}</b><label>${s.en}</label></span></div><div class="goal"><small>本次目标</small><p>${s.goal}</p></div><div class="live"><small>实时表现</small>${mini("流利度",last?.analysis.scores.fluency)}${mini("语法",last?.analysis.scores.grammar)}${mini("词汇",last?.analysis.scores.vocabulary)}${mini("发音",last?.analysis.scores.pronunciation)}</div><button class="finish" data-finish>结束练习并查看报告</button></aside>
  <section class="conversation"><div class="conv-head"><span>● <b>对话进行中</b><small>AI 会在你说完后提供反馈</small></span><b id="timer">${format(state.elapsed)}</b></div><div class="messages">${state.messages.map(message).join("")}${state.listening ? `<div class="listening">● 正在聆听…</div>` : ""}</div><div class="composer"><small>💡 试着说：${s.prompts[state.messages.filter(m=>m.role==="user").length%s.prompts.length]}</small><div><button data-demo>填入演示回答</button><input placeholder="也可以输入英文回答…"><button data-send>↑</button><button class="mic ${state.listening?"active":""}" data-mic>${state.listening?"■ 停止":"● 按下说话"}</button></div></div></section></main>`;
  bindHome(); document.querySelector("[data-finish]").onclick=finish;
  document.querySelector("[data-demo]").onclick=()=>document.querySelector("input").value=s.demo;
  document.querySelector("[data-send]").onclick=send; document.querySelector("input").onkeydown=e=>e.key==="Enter"&&send();
  document.querySelector("[data-mic]").onclick=mic; document.querySelectorAll("[data-speak]").forEach(b=>b.onclick=()=>speak(decodeURIComponent(b.dataset.speak)));
  requestAnimationFrame(()=>{ const el=document.querySelector(".messages"); el.scrollTop=el.scrollHeight; });
}
const mini=(name,value=0)=>`<div><span>${name}</span><i><b style="width:${value}%"></b></i><strong>${value||"—"}</strong></div>`;
const message=m=>m.role==="coach"?`<article class="msg coach"><i>FL</i><div><small>FLUENT COACH</small><p>${m.text}</p><button data-speak="${encodeURIComponent(m.text)}">▶ 播放</button></div></article>`:
`<article class="msg user"><div><small>YOU</small><p>${m.text}</p><section class="feedback"><strong>${m.analysis.scores.overall}</strong><span><b>${m.analysis.corrections.length?"表达清晰，留意下面的小调整。":"表达自然且清晰，句型使用得很好。"}</b><small>${m.analysis.wpm} WPM · ${m.analysis.words} words</small></span>${m.analysis.corrections.map(c=>`<article><label>表达建议</label><del>${c.original}</del><b>→ ${c.improved}</b><small>${c.reason}</small></article>`).join("")||"<em>✓ 本轮没有发现明显语法问题</em>"}</section></div><i>YOU</i></article>`;

function report() {
  const r=summarize(state.messages), s=state.scenario;
  app.innerHTML=`${header()}<main class="report"><section class="report-top"><div><label>● SESSION COMPLETE</label><h1>很棒，你完成了<br><em>${s.title}</em>练习。</h1><p>你已经比开始时更敢开口了。下面是本次练习的表现总结。</p></div><div class="ring" style="--score:${r.overall}"><span><b>${r.overall||"--"}</b><small>综合得分</small></span></div></section><section class="metrics">${metric("流利度",r.fluency)}${metric("语法准确度",r.grammar)}${metric("词汇丰富度",r.vocabulary)}${metric("发音清晰度",r.pronunciation)}</section><section class="details"><article><label>HIGHLIGHTS</label><h2>本次练习亮点</h2><div class="stats"><span><b>${r.turns}</b>轮对话</span><span><b>${r.words}</b>个单词</span><span><b>${r.wpm}</b>WPM</span><span><b>${r.corrections}</b>个建议</span></div><p class="note"><b>Coach 建议</b>你的表达意图清楚，能够顺利推进对话。下次重点练习用具体例子支持观点，并保持 100–130 WPM 的自然语速。</p></article><aside><label>NEXT STEP</label><h2>把建议变成能力</h2><p>建议明天继续练习同一场景，重点复述今天的表达建议。</p><button data-retry>再练一次 →</button><button data-home>选择其他场景</button></aside></section></main>${pageFooter()}`;
  document.querySelector("[data-retry]").onclick=()=>start(s.id); bindHome();
}
const metric=(name,score)=>`<article><span><small>${name}</small><b>${score||"--"}</b></span><i><b style="width:${score}%"></b></i><p>保持练习，下一次表达会更自然。</p></article>`;

function start(id){ state.scenario=scenarios.find(s=>s.id===id); state.messages=[{role:"coach",text:state.scenario.opening}]; state.view="practice"; state.elapsed=0; clearInterval(state.timer); state.timer=setInterval(()=>{state.elapsed++; const t=document.querySelector("#timer");if(t)t.textContent=format(state.elapsed)},1000); practice(); setTimeout(()=>speak(state.scenario.opening),300); }
function send(){const input=document.querySelector("input"),text=input.value.trim();if(!text)return; const analysis=analyze(text,Math.max(7,text.split(/\s+/).length/1.8));state.messages.push({role:"user",text,analysis});practice();setTimeout(()=>{const turns=state.messages.filter(m=>m.role==="user").length;const text=reply(state.scenario,turns-1,state.messages.at(-1).text);state.messages.push({role:"coach",text});practice();speak(text)},500)}
function mic(){if(state.listening){state.recognition?.stop();return} const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){alert("请使用 Chrome 或 Edge 体验语音识别，也可使用文字输入。");return}const rec=new SR();rec.lang="en-US";rec.interimResults=false;state.recognition=rec;state.listening=true;practice();rec.onresult=e=>{state.listening=false;const text=e.results[0][0].transcript;const analysis=analyze(text);state.messages.push({role:"user",text,analysis});practice();setTimeout(()=>{const answer=reply(state.scenario,state.messages.filter(m=>m.role==="user").length-1,text);state.messages.push({role:"coach",text:answer});practice();speak(answer)},500)};rec.onend=()=>{state.listening=false;practice()};rec.start()}
function speak(text){if(!speechSynthesis)return;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang="en-US";u.rate=.94;speechSynthesis.speak(u)}
function finish(){clearInterval(state.timer);const r=summarize(state.messages),h=JSON.parse(localStorage.getItem("fluentloop-history")||"[]");h.unshift({...r,scenario:state.scenario.title,date:new Date().toISOString()});localStorage.setItem("fluentloop-history",JSON.stringify(h.slice(0,180)));state.view="report";report()}
function bindHome(){document.querySelectorAll("[data-home]").forEach(el=>el.onclick=()=>{clearInterval(state.timer);state.view="home";home()})}
const format=s=>`${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
const pageFooter=()=>`<footer class="page-footer"><span class="brand"><b>F</b> FluentLoop</span><p>Practice boldly. Speak naturally.</p><small>Built for AI speaking practice · 2026</small></footer>`;
home();
