const PAL={V:"#00AA3A",B:"#00AFF6",O:"#FF8F00",R:"#FF5243",P:"#FF8DA3"};
const PATH={ci:"M50,0A50,50 0 1 1 50,100A50,50 0 1 1 50,0Z",sT:"M0,0H100A50,50 0 0 1 0,0Z",sB:"M0,100H100A50,50 0 0 0 0,100Z",sL:"M0,0V100A50,50 0 0 0 0,0Z",sR:"M100,0V100A50,50 0 0 1 100,0Z",qTL:"M0,0L100,0A100,100 0 0 1 0,100Z",qTR:"M100,0L100,100A100,100 0 0 1 0,0Z",qBR:"M100,100L0,100A100,100 0 0 1 100,0Z",qBL:"M0,100L0,0A100,100 0 0 1 100,100Z",sq:"M0,0H100V100H0Z"};
/* TA compo extraite au pixel (6x6). Répétée pour remplir le panneau. */
const PRESET=("V.qTR V.qTL B.qBL O.qBR P.qTR P.sq O.qBR O.qBL B.sq O.sq R.qBR R.sq B.qBL R.qBR O.qBR B.qBL . V.sq B.qTL R.qTR O.sq B.sq O.qBR O.sq B.qTR B.sq V.qBL V.qBR B.sq B.sq P.qBR P.sq V.sq V.sq B.sq B.sq").trim().split(/\s+/).map(t=>t==="."?{s:"bl"}:{c:t.split(".")[0],s:t.split(".")[1]});
const NS="http://www.w3.org/2000/svg",reduce=matchMedia("(prefers-reduced-motion:reduce)").matches;
function inner(t){return t.s==="bl"?"":`<path d="${PATH[t.s]}" fill="${PAL[t.c]}"/>`}
function fill(svg,box,U,live){const r=box.getBoundingClientRect();const mob=live&&innerWidth<=820,cols=mob?Math.max(3,Math.round(r.width/r.height)):Math.max(3,Math.round(r.width/U)),rows=mob?1:Math.max(1,Math.round(r.height/U));
 svg.setAttribute("viewBox",`0 0 ${cols*100} ${rows*100}`);svg.innerHTML="";
 for(let ri=0;ri<rows;ri++)for(let ci=0;ci<cols;ci++){const t=PRESET[(ri%6)*6+(ci%6)];const g=document.createElementNS(NS,"g");g.setAttribute("class","cell");
  g.setAttribute("transform",`translate(${ci*100} ${ri*100})`);g.innerHTML=inner(t);svg.appendChild(g);
  if(reduce)g.style.opacity=1;else setTimeout(()=>g.style.opacity=1,(ci+ri)*38+30);
  if(live&&!reduce&&t.s!=="bl"&&Math.random()<0.16){g.setAttribute("class","cell breathe");const p=g.firstChild;if(p&&p.style)p.style.animationDelay=(Math.random()*6).toFixed(2)+"s";}}}
const heroSvg=document.getElementById("hero-grid"),heroBox=document.getElementById("hero-panel");
const bandSvg=document.getElementById("band1"),bandBox=bandSvg.parentElement;
function draw(){const U=innerWidth<=820?60:90;fill(heroSvg,heroBox,U,true);fill(bandSvg,bandBox,U,false)}
draw();let rt,lastW=innerWidth;addEventListener("resize",()=>{if(innerWidth===lastW)return;lastW=innerWidth;clearTimeout(rt);rt=setTimeout(draw,220)},{passive:true});
const nav=document.getElementById("nav"),os=()=>nav.classList.toggle("scrolled",scrollY>8);addEventListener("scroll",os,{passive:true});os();
(function(){if(matchMedia("(prefers-reduced-motion:reduce)").matches)return;const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add("shown");io.unobserve(e.target)}}),{threshold:.12,rootMargin:"0px 0px -8% 0px"});const G=[[".qsn .amedia",0],[".qsn .acontent",0],[".pictos .overline",0],[".picto",90],[".mani .overline",0],[".mani .phrase",70],[".mani .sig",140],[".rdv-text",0],[".rdv-visual",0],[".icols>div",100],[".partners",0],[".fbot",0]];G.forEach(([sel,step])=>document.querySelectorAll(sel).forEach((el,i)=>{el.classList.add("reveal");if(step)el.style.transitionDelay=(i*step)+"ms";io.observe(el)}));})();
(function(){if(matchMedia("(prefers-reduced-motion:reduce)").matches)return;const P=[[".qsn .achair",0.14],[".rdv .tel-img",0.10]];const els=[];P.forEach(([sel,f])=>document.querySelectorAll(sel).forEach(el=>els.push([el,f])));if(!els.length)return;let tick=false;function upd(){tick=false;const vh=innerHeight;els.forEach(([el,f])=>{const r=el.getBoundingClientRect();if(r.bottom<-200||r.top>vh+200)return;const off=(r.top+r.height/2)-vh/2;let py=-off*f;py=Math.max(-130,Math.min(130,py));el.style.setProperty("--py",py.toFixed(1)+"px")})}addEventListener("scroll",()=>{if(!tick){tick=true;requestAnimationFrame(upd)}},{passive:true});addEventListener("resize",upd,{passive:true});upd();})();
