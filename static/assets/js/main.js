/* Choufha — shared page behaviour */
(() => {
  const d = document, head = d.querySelector('.site-head');
  const isHome = d.body.classList.contains('home');

  // header turns solid after the first scroll on the home page
  const onScroll = () => head && head.classList.toggle('solid', !isHome || scrollY > 40);
  onScroll(); addEventListener('scroll', onScroll, { passive: true });

  // mobile menu
  const burger = d.querySelector('.burger'), nav = d.getElementById('nav');
  const setMenu = (open) => {
    burger.setAttribute('aria-expanded', open); nav.classList.toggle('open', open);
    d.body.classList.toggle('menu-open', open);
  };
  burger && burger.addEventListener('click', () => setMenu(burger.getAttribute('aria-expanded') !== 'true'));
  nav && nav.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && burger) setMenu(false); });

  // reveal on scroll
  const els = d.querySelectorAll('.sec-head, .card, .steps li, .plan, .faq details, .post-card, .c-form, .mv-stage');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
    els.forEach((el, i) => { el.classList.add('rv'); el.style.transitionDelay = (i % 4) * 70 + 'ms'; io.observe(el); });
  }

  // contact form → opens the visitor's email app with a prepared message
  const form = d.getElementById('cform');
  if (form) {
    d.querySelectorAll('[data-plan]').forEach((a) => a.addEventListener('click', () => {
      const m = form.querySelector('[name=msg]');
      if (m && !m.value) m.value = (d.documentElement.lang === 'ar' ? 'أرغب في عرض سعر لباقة: ' : 'I would like a quote for the package: ') + a.dataset.plan;
    }));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(form), labels = {};
      form.querySelectorAll('label').forEach((l) => { const i = l.querySelector('[name]'); if (i) labels[i.name] = l.querySelector('span').textContent; });
      const body = [...f.entries()].filter(([, v]) => v).map(([k, v]) => `${labels[k] || k}: ${v}`).join('\n');
      location.href = `mailto:${form.dataset.email}?subject=${encodeURIComponent(form.dataset.subject)}&body=${encodeURIComponent(body)}`;
    });
  }

  // try-it section (model-viewer)
  const mv = d.getElementById('mv');
  if (mv) {
    const sw = d.getElementById('sw');
    const COL = { white: [0.86, 0.87, 0.9, 1], charcoal: [0.12, 0.12, 0.13, 1], red: [0.55, 0.02, 0.04, 1], olive: [0.26, 0.31, 0.19, 1] };
    const PIL = { white: null, charcoal: null, red: [0.1, 0.1, 0.11, 1], olive: null };
    let fabric = null, pillow = null, pillow0 = null;
    mv.addEventListener('load', () => {
      try {
        fabric = mv.model.getMaterialByName('Fabric'); pillow = mv.model.getMaterialByName('Pillow');
        pillow0 = pillow && pillow.pbrMetallicRoughness.baseColorFactor.slice();
        fabric && fabric.pbrMetallicRoughness.setBaseColorFactor(COL.white);
      } catch (err) { /* optional */ }
    });
    sw.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      sw.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b));
      const k = b.dataset.k;
      if (fabric) fabric.pbrMetallicRoughness.setBaseColorFactor(COL[k]);
      if (pillow && pillow0) pillow.pbrMetallicRoughness.setBaseColorFactor(PIL[k] || pillow0);
    });
    const dims = d.getElementById('dims');
    dims.addEventListener('click', () => {
      const on = dims.getAttribute('aria-pressed') !== 'true';
      dims.setAttribute('aria-pressed', on); dims.textContent = on ? dims.dataset.off : dims.dataset.on;
      d.getElementById('mvStage').classList.toggle('show-dims', on);
      if (on) mv.autoRotate = false;
    });
    d.getElementById('arBtn').addEventListener('click', () => {
      if (mv.canActivateAR) mv.activateAR();
      else d.getElementById('arNote').hidden = false;
    });
  }
})();
