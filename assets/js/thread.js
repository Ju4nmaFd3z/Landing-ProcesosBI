/* ════════════════════════════════════════════════════════════
   ProcesosBI — hilo de luz
   Un único path SVG que nace en el hero, serpentea por las
   secciones (waypoints = elementos .th-a) y termina en el
   interruptor ¿Hablamos?.

   Fluidez (en CUALQUIER dispositivo): cada frame se relee el
   objetivo directamente del scroll —sin forzar reflow— y el dibujo
   lo persigue con un suavizado exponencial de constante de tiempo
   corta (~55 ms). El objetivo NO depende de la frecuencia de los
   eventos `scroll` (que iOS/Android estrangulan durante el
   momentum): se recalcula dentro del propio bucle rAF, así el hilo
   va pegado al dedo aunque no llegue ni un solo evento de scroll.

   Coste por frame ≈ 0 reflow: la punta se interpola en O(1) desde
   un muestreo precalculado del path (nada de getPointAtLength en
   caliente) y todas las escrituras al DOM están protegidas para no
   repintar si el valor no cambió. El glow son tres trazos
   superpuestos —ningún filtro SVG—, barato incluso con paths de
   miles de píxeles.

   Curvas: spline Catmull-Rom CENTRÍPETA (α = 0.5). La ponderación
   por distancia real entre anclas elimina cúspides, lazos y
   sobreoscilaciones aunque estén desigualmente espaciadas —ésos
   eran los "picotazos"—.
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
  let samples = [];       // muestreo del path EQUIESPACIADO en longitud
  let sampleN = 0;        // nº de tramos del muestreo (samples.length - 1)
  let nodes = [];
  let docH = 0;           // altura del documento, cacheada (evita leer scrollHeight por frame)
  let current = 0;
  let target = 0;
  let running = false;
  let lastT = 0;

  /* caché de la última escritura al DOM, para no repintar de balde */
  let lastOff = -1;
  let lastTipX = -1e9, lastTipY = -1e9;
  let tipOn = false;
  let lastArrived = null;

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

  /* spline Catmull-Rom CENTRÍPETA (α = 0.5) → Bézier cúbicas.
     La parametrización centrípeta pondera cada tangente por la
     distancia real entre waypoints: a diferencia de la uniforme,
     no produce cúspides, lazos ni sobreoscilaciones cuando las
     anclas están desigualmente espaciadas —ésos eran los
     "picotazos"—. Además es C1-continua en cada nodo, así que no
     hace falta recortar las asas (el recorte rompía justamente esa
     continuidad y generaba el pico). */
  function buildD(p) {
    if (p.length < 2) return "";
    const f = (x) => x.toFixed(2);
    const knot = (a, b) => Math.sqrt(Math.hypot(b.x - a.x, b.y - a.y)) || 1e-6;

    let d = `M ${f(p[0].x)} ${f(p[0].y)}`;
    for (let i = 0; i < p.length - 1; i++) {
      const p0 = p[i - 1] || p[i];
      const p1 = p[i];
      const p2 = p[i + 1];
      const p3 = p[i + 2] || p2;

      const d01 = knot(p0, p1);
      const d12 = knot(p1, p2);
      const d23 = knot(p2, p3);

      /* tangentes Catmull-Rom no uniformes en p1 y p2 */
      let m1x = (p2.x - p1.x) / d12 - (p2.x - p0.x) / (d01 + d12) + (p1.x - p0.x) / d01;
      let m1y = (p2.y - p1.y) / d12 - (p2.y - p0.y) / (d01 + d12) + (p1.y - p0.y) / d01;
      let m2x = (p2.x - p1.x) / d12 - (p3.x - p1.x) / (d12 + d23) + (p3.x - p2.x) / d23;
      let m2y = (p2.y - p1.y) / d12 - (p3.y - p1.y) / (d12 + d23) + (p3.y - p2.y) / d23;

      /* Hermite → Bézier: asas a un tercio del intervalo del tramo */
      const c1x = p1.x + (m1x * d12) / 3, c1y = p1.y + (m1y * d12) / 3;
      const c2x = p2.x - (m2x * d12) / 3, c2y = p2.y - (m2y * d12) / 3;

      d += ` C ${f(c1x)} ${f(c1y)}, ${f(c2x)} ${f(c2y)}, ${f(p2.x)} ${f(p2.y)}`;
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
    docH = h;

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

    /* Muestreo del path EQUIESPACIADO en longitud (len = total·i/N).
       Al ser equiespaciado, mapear longitud → punto es O(1) (índice
       directo + lerp), sin getPointAtLength por frame. */
    sampleN = Math.min(2000, Math.max(400, Math.round(total / 10)));
    samples = new Array(sampleN + 1);
    for (let i = 0; i <= sampleN; i++) {
      const len = (total * i) / sampleN;
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
      nodes.push({ el, len: best, lit: false });
    });

    /* invalidar la caché de escritura: la geometría cambió */
    lastOff = -1;
    lastTipX = lastTipY = -1e9;
    lastArrived = null;

    retarget();
    current = target; // sin animación de arranque tras un reflow
    apply();
  }

  /* posición Y objetivo → longitud de hilo (búsqueda binaria +
     interpolación lineal: mapeo CONTINUO, sin escalones que se
     traduzcan en micro-tirones del objetivo). */
  function lenAtY(yTarget) {
    if (!samples.length) return 0;
    const hi0 = samples.length - 1;
    if (yTarget <= samples[0].y) return 0;
    if (yTarget >= samples[hi0].y) return total;
    let lo = 0, hi = hi0;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (samples[mid].y <= yTarget) lo = mid;
      else hi = mid - 1;
    }
    const a = samples[lo];
    const b = samples[lo + 1] || a;
    const span = b.y - a.y;
    const t = span > 1e-6 ? (yTarget - a.y) / span : 0;
    return a.len + (b.len - a.len) * t;
  }

  /* longitud de hilo → punto (x,y), O(1) por ser muestreo
     equiespaciado en longitud. Interpola entre las dos muestras
     vecinas: el error de cuerda con ~10 px de paso es sub-píxel. */
  function pointAtLen(len) {
    if (len <= 0) return samples[0];
    if (len >= total) return samples[sampleN];
    const fpos = (len / total) * sampleN;
    const i = fpos | 0;
    const t = fpos - i;
    const a = samples[i];
    const b = samples[i + 1] || a;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }

  /* la punta sigue el centro del viewport; cerca del final de la
     página se desliza hacia el borde inferior para alcanzar el
     interruptor cuando el contacto está en pantalla.
     Sin reflow: scrollY/innerHeight no fuerzan layout y docH está
     cacheado (no se lee scrollHeight aquí). */
  function retarget() {
    if (!total) return;
    if (reduced) { target = total; return; }
    const vh = window.innerHeight;
    const maxScroll = Math.max(1, docH - vh);
    const p = window.scrollY / maxScroll;
    const slide = Math.min(1, Math.max(0, (p - 0.72) / 0.28));
    const frac = 0.56 + 0.4 * slide;
    target = lenAtY(window.scrollY + vh * frac);
  }

  function apply() {
    /* offset del trazo: solo se escribe si cambió a la décima de px */
    const off = Math.max(0, total - current);
    const offR = Math.round(off * 10) / 10;
    if (offR !== lastOff) {
      lastOff = offR;
      const s = String(offR);
      for (let i = 0; i < strokes.length; i++) strokes[i].style.strokeDashoffset = s;
    }

    /* punta: interpolada en O(1), escrita solo si se movió */
    const arrived = current >= total - 2;
    if (current > 4 && !arrived) {
      const pt = pointAtLen(current);
      if (Math.abs(pt.x - lastTipX) > 0.2 || Math.abs(pt.y - lastTipY) > 0.2) {
        lastTipX = pt.x; lastTipY = pt.y;
        tip.setAttribute("transform", `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`);
      }
      if (!tipOn) { tip.classList.add("on"); tipOn = true; }
    } else if (tipOn) {
      tip.classList.remove("on"); tipOn = false;
    }

    /* nodos: toggle solo en el cruce de umbral, no cada frame */
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const lit = current >= n.len - 2;
      if (lit !== n.lit) { n.lit = lit; n.el.classList.toggle("lit", lit); }
    }

    if (arrived !== lastArrived) {
      lastArrived = arrived;
      if (contact) contact.classList.toggle("lit", arrived);
    }
  }

  /* Bucle de suavizado. Relee el objetivo CADA frame (barato y sin
     reflow): así el hilo rastrea el scroll en tiempo real aunque el
     dispositivo no emita eventos `scroll` durante el momentum. Corre
     solo mientras quede distancia que cubrir. */
  function loop(t) {
    const dt = Math.min(64, t - lastT);
    lastT = t;
    retarget();
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

  /* En móvil, mostrar/ocultar la barra de direcciones dispara `resize`
     cambiando SOLO la altura del viewport. Reconstruir ahí (re-muestreo
     del path + getTotalLength) en pleno scroll provoca tirones. Por eso
     sólo reconstruimos cuando cambia el ANCHO; los cambios reales de
     altura del documento ya los cubre el ResizeObserver de abajo, y la
     altura del viewport la lee retarget() en cada frame sin reflow. */
  let lastW = window.innerWidth;
  window.addEventListener("resize", () => {
    if (window.innerWidth !== lastW) {
      lastW = window.innerWidth;
      scheduleRebuild();
    }
  });
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
