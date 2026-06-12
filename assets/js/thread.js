/* ════════════════════════════════════════════════════════════
   ProcesosBI — hilo de luz
   Un único path SVG que nace en el hero, serpentea por las
   secciones (waypoints = elementos .th-a) y termina en el
   interruptor ¿Hablamos?.

   Fluidez: el objetivo se calcula del scroll y el dibujo lo
   persigue con un suavizado exponencial de constante de tiempo
   corta (~55 ms). Eso elimina los saltos discretos de la rueda
   del ratón sin introducir retardo perceptible: el hilo va
   pegado al scroll y se detiene cuando éste se detiene.

   Rendimiento: el glow son tres trazos superpuestos de distinto
   grosor y opacidad —ningún filtro SVG—, así el repintado por
   frame es barato incluso con paths de miles de píxeles.
   ════════════════════════════════════════════════════════════ */

(() => {
  "use strict";

  const svg   = document.getElementById("thread");
  const dim   = document.getElementById("th-dim");
  const glow2 = document.getElementById("th-glow2");
  const glow  = document.getElementById("th-glow");
  const core  = document.getElementById("th-core");
  const tip   = document.getElementById("th-tip");
  const grad  = document.getElementById("th-grad");
  const btn   = document.getElementById("talk-btn");
  const contact = document.getElementById("contacto");
  if (!svg || !core) return;

  const strokes = [glow2, glow, core];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const TAU = 55; // ms: 90 % del recorrido en ~125 ms

  let total = 0;
  let samples = [];
  let nodes = [];
  let current = 0;
  let target = 0;
  let running = false;
  let lastT = 0;

  /* waypoints: anclas .th-a en orden de documento + el interruptor final.
     En pantallas estrechas se comprime la amplitud horizontal del
     serpenteo hacia el centro para no rozar los bordes. */
  function collectPoints() {
    const w = document.documentElement.clientWidth;
    const compress = w < 760 ? 0.45 : w < 1020 ? 0.75 : 1;
    const cx = w / 2;
    const pts = [];
    document.querySelectorAll(".th-a").forEach((el) => {
      const r = el.getBoundingClientRect();
      const x = r.left + window.scrollX;
      pts.push({ x: cx + (x - cx) * compress, y: r.top + window.scrollY });
    });
    if (btn) {
      const r = btn.getBoundingClientRect();
      pts.push({
        x: r.left + r.width / 2 + window.scrollX,
        y: r.top + window.scrollY - 1,
      });
    }
    return pts;
  }

  /* spline Catmull-Rom → curvas Bézier suaves entre waypoints */
  function buildD(p) {
    if (p.length < 2) return "";
    let d = `M ${p[0].x.toFixed(1)} ${p[0].y.toFixed(1)}`;
    for (let i = 0; i < p.length - 1; i++) {
      const p0 = p[i - 1] || p[i];
      const p1 = p[i];
      const p2 = p[i + 1];
      const p3 = p[i + 2] || p2;
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  }

  function build() {
    const doc = document.documentElement;
    const w = doc.clientWidth;
    const h = Math.max(doc.scrollHeight, document.body.scrollHeight);

    svg.setAttribute("width", w);
    svg.setAttribute("height", h);
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.style.height = h + "px";
    grad.setAttribute("y2", h);

    const pts = collectPoints();
    if (pts.length < 2) return;

    const d = buildD(pts);
    dim.setAttribute("d", d);
    strokes.forEach((p) => {
      p.setAttribute("d", d);
    });

    total = core.getTotalLength();
    strokes.forEach((p) => {
      p.style.strokeDasharray = `${total} ${total}`;
    });

    /* muestrear el path para mapear posición Y → longitud */
    const N = Math.min(2000, Math.max(400, Math.round(total / 10)));
    samples = new Array(N + 1);
    for (let i = 0; i <= N; i++) {
      const len = (total * i) / N;
      const pt = core.getPointAtLength(len);
      samples[i] = { len, x: pt.x, y: pt.y };
    }

    /* longitud del path en la que vive cada nodo etiquetado */
    nodes = [];
    document.querySelectorAll(".th-n").forEach((el) => {
      const r = el.getBoundingClientRect();
      const nx = r.left + window.scrollX;
      const ny = r.top + window.scrollY;
      let best = 0, bestD = Infinity;
      for (let i = 0; i < samples.length; i++) {
        const dx = samples[i].x - nx;
        const dy = samples[i].y - ny;
        const dist = dx * dx + dy * dy;
        if (dist < bestD) { bestD = dist; best = samples[i].len; }
      }
      nodes.push({ el, len: best });
    });

    retarget();
    current = target; // sin animación de arranque tras un reflow
    apply();
  }

  /* posición Y objetivo → longitud de hilo (búsqueda binaria) */
  function lenAtY(yTarget) {
    if (!samples.length) return 0;
    let lo = 0, hi = samples.length - 1;
    if (yTarget <= samples[0].y) return 0;
    if (yTarget >= samples[hi].y) return total;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (samples[mid].y <= yTarget) lo = mid;
      else hi = mid - 1;
    }
    return samples[lo].len;
  }

  /* la punta sigue el centro del viewport; cerca del final de la
     página se desliza hacia el borde inferior para alcanzar el
     interruptor cuando el contacto está en pantalla */
  function retarget() {
    if (!total) return;
    if (reduced) { target = total; return; }
    const vh = window.innerHeight;
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - vh);
    const p = window.scrollY / maxScroll;
    const slide = Math.min(1, Math.max(0, (p - 0.72) / 0.28));
    const frac = 0.56 + 0.4 * slide;
    target = lenAtY(window.scrollY + vh * frac);
  }

  function apply() {
    const off = Math.max(0, total - current);
    strokes.forEach((p) => {
      p.style.strokeDashoffset = off;
    });

    const arrived = current >= total - 2;
    if (current > 4 && !arrived) {
      const pt = core.getPointAtLength(current);
      tip.setAttribute("transform", `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`);
      tip.classList.add("on");
    } else {
      tip.classList.remove("on");
    }

    for (const n of nodes) {
      n.el.classList.toggle("lit", current >= n.len - 2);
    }

    if (contact) contact.classList.toggle("lit", arrived);
  }

  /* bucle de suavizado: solo corre mientras haya distancia que cubrir */
  function loop(t) {
    const dt = Math.min(64, t - lastT);
    lastT = t;
    const k = 1 - Math.exp(-dt / TAU);
    current += (target - current) * k;
    if (Math.abs(target - current) < 0.4) {
      current = target;
      apply();
      running = false;
      return;
    }
    apply();
    requestAnimationFrame(loop);
  }

  function kick() {
    retarget();
    if (!running && total) {
      running = true;
      lastT = performance.now();
      requestAnimationFrame(loop);
    }
  }

  /* reconstrucción ante reflows (fuentes, imágenes, resize) */
  let rebuildT = null;
  function scheduleRebuild() {
    clearTimeout(rebuildT);
    rebuildT = setTimeout(build, 160);
  }

  window.addEventListener("scroll", kick, { passive: true });
  window.addEventListener("resize", scheduleRebuild);
  window.addEventListener("orientationchange", scheduleRebuild);
  window.addEventListener("load", build);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(scheduleRebuild);
  }
  if ("ResizeObserver" in window) {
    let lastH = 0;
    new ResizeObserver((entries) => {
      const h = entries[0].contentRect.height;
      if (Math.abs(h - lastH) > 4) {
        lastH = h;
        scheduleRebuild();
      }
    }).observe(document.body);
  }

  build();
})();
