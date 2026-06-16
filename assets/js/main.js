/* ProcesosBI — interacciones de página (nav, reveals, contadores, formulario) */

(() => {
  "use strict";

  /* ── nav: borde al hacer scroll + menú móvil ── */
  const nav = document.getElementById("nav");
  const burger = document.getElementById("nav-burger");

  const onNavScroll = () => nav.classList.toggle("scrolled", window.scrollY > 24);
  window.addEventListener("scroll", onNavScroll, { passive: true });
  onNavScroll();

  if (burger) {
    const setBurger = (open) => {
      burger.setAttribute("aria-expanded", String(open));
      burger.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
    };
    const closeMenu = () => {
      if (!nav.classList.contains("open")) return;
      nav.classList.remove("open");
      setBurger(false);
    };
    burger.addEventListener("click", (e) => {
      e.stopPropagation();
      setBurger(nav.classList.toggle("open"));
    });
    document.querySelectorAll(".nav-links a").forEach((a) =>
      a.addEventListener("click", closeMenu)
    );
    // cerrar al tocar fuera del nav o con Escape
    document.addEventListener("click", (e) => {
      if (!nav.contains(e.target)) closeMenu();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeMenu();
    });
  }

  /* ── reveal on scroll ── */
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const reveals = document.querySelectorAll(".reveal");
  if (reduced || !("IntersectionObserver" in window)) {
    reveals.forEach((el) => el.classList.add("in"));
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    reveals.forEach((el) => io.observe(el));
  }

  /* ── contadores animados ── */
  const counters = document.querySelectorAll("[data-count]");
  function animateCounter(el) {
    const end = parseInt(el.dataset.count, 10);
    const prefix = el.dataset.prefix || "";
    const suffix = el.dataset.suffix || "";
    const dur = 1300;
    const t0 = performance.now();
    function step(t) {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = prefix + Math.round(end * eased) + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  if (!reduced && "IntersectionObserver" in window) {
    const cio = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            animateCounter(e.target);
            cio.unobserve(e.target);
          }
        });
      },
      { threshold: 0.6 }
    );
    counters.forEach((el) => {
      // arrancar desde 0 evita el salto "valor final → 0 → cuenta" al entrar en viewport
      el.textContent = (el.dataset.prefix || "") + "0" + (el.dataset.suffix || "");
      cio.observe(el);
    });
  }

  /* ── año del footer ── */
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
})();
