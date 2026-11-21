// Choufha static site builder.
// node build.mjs  →  writes the full site to ./dist
// Env: SITE_URL (default from config.json), BASE_PATH ('' for a custom domain, '/repo' for github.io/repo)
import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';
import { T } from './src/i18n.mjs';
import { ICON, SOCIAL } from './src/icons.mjs';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(ROOT, 'dist');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
const SITE = (process.env.SITE_URL || cfg.siteUrl).replace(/\/$/, '');
const BASE = (process.env.BASE_PATH || '').replace(/\/$/, '');
const VER = Date.now().toString(36);

const u = (p) => BASE + p;                 // link inside the site
const abs = (p) => SITE + p;               // absolute canonical URL
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pre = (lang) => (lang === 'ar' ? '' : '/en');

/* ---------- content ---------- */
function frontMatter(src) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: src };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i < 1) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if (/^\[.*\]$/.test(v)) v = v.slice(1, -1).split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    else v = v.replace(/^["']|["']$/g, '');
    if (v === 'true') v = true; else if (v === 'false') v = false;
    data[k] = v;
  }
  return { data, body: m[2] };
}

function loadArticles() {
  const dir = path.join(ROOT, 'content/articles');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => {
    const { data, body } = frontMatter(fs.readFileSync(path.join(dir, f), 'utf8'));
    const slug = (data.slug || f.replace(/\.md$/, '')).toLowerCase();
    const lang = data.lang === 'en' ? 'en' : 'ar';
    const words = body.split(/\s+/).filter(Boolean).length;
    return {
      ...data, slug, lang, file: f,
      title: data.title || slug,
      description: data.description || '',
      date: data.date || new Date().toISOString().slice(0, 10),
      updated: data.updated || data.date,
      tags: Array.isArray(data.tags) ? data.tags : data.tags ? String(data.tags).split(',').map((s) => s.trim()) : [],
      html: marked.parse(body).replace(/(src|href)="\/(?!\/)/g, `$1="${BASE}/`),
      minutes: Math.max(1, Math.round(words / 200)),
      url: `${pre(lang)}/blog/${slug}/`,
    };
  }).filter((a) => !a.draft).sort((a, b) => (a.date < b.date ? 1 : -1));
}

function legalPage(name, lang) {
  const f = path.join(ROOT, `content/pages/${name}.${lang}.md`);
  const { data, body } = frontMatter(fs.readFileSync(f, 'utf8'));
  return { ...data, html: marked.parse(body) };
}

/* ---------- partials ---------- */
const wordmark = (cls = '') => `<span class="wm ${cls}" aria-hidden="true">Ch<svg viewBox="0 0 64 64"><circle class="eye-ring" cx="32" cy="32" r="25.5"/><circle class="eye-pupil" cx="39" cy="26" r="9.5"/></svg>ufha</span>`;

function head({ t, title, desc, p, alt, image = '/assets/img/og.png', type = 'website', jsonld = [], noindex = false, extra = '' }) {
  const alts = alt ? Object.entries(alt).map(([l, ap]) => `<link rel="alternate" hreflang="${l}" href="${abs(ap)}">`).join('') +
    (alt.ar ? `<link rel="alternate" hreflang="x-default" href="${abs(alt.ar)}">` : '') : '';
  return `<!DOCTYPE html>
<html lang="${t.lang}" dir="${t.dir}">
<head>
<meta charset="utf-8">
<script>document.documentElement.classList.add('js')</script>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${noindex ? '<meta name="robots" content="noindex">' : '<meta name="robots" content="index, follow, max-image-preview:large">'}
<link rel="canonical" href="${abs(p)}">${alts}
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="Choufha">
<meta property="og:locale" content="${t.locale}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${abs(p)}">
<meta property="og:image" content="${abs(image)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#1C1C1E">
<link rel="icon" href="${u('/assets/img/favicon.svg')}" type="image/svg+xml">
<link rel="icon" href="${u('/assets/img/favicon-32.png')}" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="${u('/assets/img/apple-touch-icon.png')}">
<link rel="manifest" href="${u('/site.webmanifest')}">
<link rel="preload" href="${u('/assets/fonts/readex-pro-' + (t.lang === 'ar' ? 'arabic' : 'latin') + '-400-normal.woff2')}" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${u('/assets/css/site.css')}?v=${VER}">
${jsonld.map((j) => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join('\n')}
${extra}
</head>`;
}

function header(t, { home = false, alt } = {}) {
  const h = home ? '' : u(pre(t.lang) + '/');
  const n = t.nav;
  const links = [['service', n.service], ['how', n.how], ['packages', n.packages], ['try', n.try]]
    .map(([id, l]) => `<a href="${h}#${id}">${l}</a>`).join('') +
    `<a href="${u(pre(t.lang) + '/blog/')}">${n.blog}</a><a href="${h}#contact">${n.contact}</a>`;
  return `<a class="skip" href="#main">${t.skip}</a>
<header class="site-head" id="top">
  <div class="wrap">
    <a class="brand" href="${u(pre(t.lang) + '/')}" aria-label="Choufha">${wordmark()}<small>${t.brandSub}</small></a>
    <nav class="nav" id="nav" aria-label="${t.menu}">${links}
      <a class="btn red sm nav-cta" href="${h}#contact">${t.cta}</a>
    </nav>
    <div class="head-tools">
      <a class="lang" href="${u(alt || pre(t.other) + '/')}" hreflang="${t.other}" lang="${t.other}">${t.otherLabel}</a>
      <a class="btn red sm head-cta" href="${h}#contact">${t.cta}</a>
      <button class="burger" type="button" aria-controls="nav" aria-expanded="false" aria-label="${t.menu}"><i></i><i></i><i></i></button>
    </div>
  </div>
</header>`;
}

function socialLinks(cls = 'social') {
  const s = cfg.social || {};
  const names = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', linkedin: 'LinkedIn', youtube: 'YouTube', x: 'X' };
  return `<ul class="${cls}">${Object.entries(s).filter(([, v]) => v).map(([k, v]) =>
    `<li><a href="${esc(v)}" target="_blank" rel="noopener" aria-label="${names[k] || k}" title="${names[k] || k}">${SOCIAL[k] || ''}</a></li>`).join('')}</ul>`;
}

function footer(t) {
  const P = pre(t.lang);
  const year = new Date().getFullYear();
  return `<footer class="site-foot">
  <div class="wrap">
    <div class="foot-top">
      <div class="foot-brand">
        <a href="${u(P + '/')}" aria-label="Choufha">${wordmark('lg')}</a>
        <p>${t.footer.tagline}</p>
      </div>
      <div class="foot-links">
        <a href="${u(P + '/#service')}">${t.nav.service}</a>
        <a href="${u(P + '/#packages')}">${t.nav.packages}</a>
        <a href="${u(P + '/blog/')}">${t.nav.blog}</a>
        <a href="${u(P + '/#contact')}">${t.nav.contact}</a>
        <a href="${u(P + '/privacy/')}">${t.footer.privacy}</a>
        <a href="${u(P + '/terms/')}">${t.footer.terms}</a>
      </div>
      <div class="foot-contact">
        <a class="mail" href="mailto:${cfg.email}" dir="ltr">${cfg.email.toUpperCase()}</a>
        ${cfg.phone ? `<a href="tel:${cfg.phone.replace(/\s/g, '')}" dir="ltr">${esc(cfg.phone)}</a>` : ''}
        ${socialLinks()}
      </div>
    </div>
    <div class="foot-legal">
      <span>${t.footer.legal}</span>
      <span>© ${year} Choufha · ${t.footer.rights}</span>
    </div>
  </div>
</footer>
${cfg.whatsapp ? `<a class="wa-float" href="https://wa.me/${cfg.whatsapp.replace(/\D/g, '')}" target="_blank" rel="noopener" aria-label="${t.contact.whatsapp}">${SOCIAL.whatsapp}</a>` : ''}
<script src="${u('/assets/js/main.js')}?v=${VER}" defer></script>
</body>
</html>`;
}

const orgLD = () => ({
  '@context': 'https://schema.org', '@type': 'Organization', '@id': abs('/#org'),
  name: 'Choufha', alternateName: 'شوفها', url: abs('/'), logo: abs('/assets/img/logo-512.png'), email: cfg.email,
  ...(cfg.phone ? { telephone: cfg.phone } : {}),
  parentOrganization: { '@type': 'Organization', name: 'REHLA Growth for Business Development & Marketing L.L.C', alternateName: 'رحلة النمو لتطوير الأعمال والتسويق ذ.م.م' },
  sameAs: Object.values(cfg.social || {}).filter(Boolean),
});

/* ---------- pages ---------- */
function homePage(lang, articles) {
  const t = T[lang], P = pre(lang);
  const st = t.story;
  const latest = articles.filter((a) => a.lang === lang).slice(0, 3);
  const jsonld = [
    orgLD(),
    { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Choufha', url: abs(P + '/'), inLanguage: lang },
    { '@context': 'https://schema.org', '@type': 'Service', name: lang === 'ar' ? 'المعاينة الافتراضية للأثاث' : 'AR furniture visualization',
      serviceType: 'Augmented reality 3D product visualization', provider: { '@id': abs('/#org') }, areaServed: ['EG', 'SA', 'AE'], description: t.meta.homeDesc },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: t.faq.items.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
  ];
  const dimTxt = st[0].specs.map(([k, v]) => `${k} ${v}`);
  const colors = lang === 'ar' ? ['كريمي', 'فحمي', 'أحمر', 'زيتوني'] : ['Cream', 'Charcoal', 'Red', 'Olive'];

  return head({ t, title: t.meta.homeTitle, desc: t.meta.homeDesc, p: P + '/', alt: { ar: '/', en: '/en/' }, jsonld,
    extra: `<link rel="modulepreload" href="${u('/assets/js/hero3d.js')}?v=${VER}">` }) + `
<body class="home">
<div id="loader" class="loader" aria-hidden="true">
  <div class="ld-eye"><svg viewBox="0 0 64 64"><circle class="ld-track" cx="32" cy="32" r="25.5"/><circle class="ld-ring" cx="32" cy="32" r="25.5" pathLength="100"/><circle class="ld-pupil" cx="39" cy="26" r="9.5"/></svg></div>
  <p class="ld-word">${wordmark()}</p>
  <p class="ld-tag">${t.footer.tagline}</p>
</div>
<script>(()=>{const H=document.documentElement,L=document.getElementById('loader'),R=L.querySelector('.ld-ring');let p=0,done=0;const t0=performance.now();
let seen=0;try{seen=sessionStorage.getItem('chf-seen')}catch(e){}
const red=matchMedia('(prefers-reduced-motion: reduce)').matches,minT=red?0:seen?500:1900;
const set=v=>{p=Math.max(p,Math.min(1,v));R.style.strokeDashoffset=(100-p*100).toFixed(1)};
const tr=setInterval(()=>{done?clearInterval(tr):set(Math.min(.8,p+.015))},90);
addEventListener('c3d:progress',e=>set(.1+e.detail*.85));
const finish=()=>{if(done)return;done=1;set(1);setTimeout(()=>{L.classList.add('out');H.classList.add('entered');dispatchEvent(new Event('choufha:reveal'));
try{sessionStorage.setItem('chf-seen',1)}catch(e){}setTimeout(()=>H.classList.add('landed'),1800);setTimeout(()=>L.remove(),1400)},Math.max(0,minT-(performance.now()-t0))+350)};
addEventListener('c3d:ready',finish);addEventListener('c3d:fail',finish);setTimeout(finish,9000)})()</script>
${header(t, { home: true })}
<main id="main">
<section class="story" id="story" aria-label="Choufha">
  <div class="story-canvas" aria-hidden="true">
    <canvas id="c3d"></canvas>
    <img class="poster" src="${u('/assets/img/sofa-poster.webp')}" alt="" width="900" height="700">
    <div class="dimlabels">${dimTxt.map((d, i) => `<span class="dl dl${i}">${d}</span>`).join('')}</div>
    <div class="arframe"><i></i><i></i><i></i><i></i><b>AR</b></div>
  </div>

  <div class="stage stage-hero" data-stage="0">
    <div class="wrap"><div class="st-card hero-card">
      <p class="eyebrow">${t.hero.eyebrow}</p>
      <h1>${t.hero.title}</h1>
      <p class="lead">${t.hero.lead}</p>
      <div class="ctas"><a class="btn red" href="#contact">${t.hero.primary}</a><a class="btn ghost" href="#try">${t.hero.secondary}</a></div>
    </div></div>
    <a class="scroll-cue" href="#s1"><span>${t.hero.scroll}</span><i></i></a>
  </div>
  ${st.map((s, i) => `
  <div class="stage" data-stage="${i + 1}" id="s${i + 1}">
    <div class="wrap"><article class="st-card">
      <p class="st-num"><b>${s.n}</b><span>${s.k}</span></p>
      <h2>${s.h}</h2>
      <p class="lead">${s.p}</p>
      <dl class="specs">${s.specs.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
      ${i === 1 ? `<div class="colorway" role="group" aria-label="${s.k}">${['#EDE6DC', '#3A3A3F', '#B31F28', '#5E6B4E'].map((c, j) =>
        `<button type="button" data-c="${j}" style="--c:${c}" aria-pressed="${j === 0}" aria-label="${colors[j]}"></button>`).join('')}</div>` : ''}
    </article></div>
  </div>`).join('')}
</section>

<section class="band" id="service">
  <div class="wrap">
    <div class="sec-head"><p class="kicker">${t.services.k}</p><h2>${t.services.h}</h2><p class="lead">${t.services.lead}</p></div>
    <div class="cards">${t.services.items.map(([ic, h, p], i) => `
      <article class="card"><span class="card-n">0${i + 1}</span>${ICON[ic]}<h3>${h}</h3><p>${p}</p></article>`).join('')}
    </div>
  </div>
</section>

<section class="band alt" id="how">
  <div class="wrap">
    <div class="sec-head"><p class="kicker">${t.how.k}</p><h2>${t.how.h}</h2></div>
    <ol class="steps">${t.how.steps.map(([h, p]) => `<li><b>${h}</b><span>${p}</span></li>`).join('')}</ol>
  </div>
</section>

<section class="band" id="try">
  <div class="wrap try-grid">
    <div class="try-text">
      <p class="kicker">${t.try.k}</p><h2>${t.try.h}</h2><p class="lead">${t.try.lead}</p>
      <div class="swatches" id="sw" role="group">${t.try.swatches.map(([k, n], i) => `<button type="button" data-k="${k}" aria-pressed="${i === 0}"><i class="sw-${k}"></i>${n}</button>`).join('')}</div>
      <div class="try-actions">
        <button class="btn red" id="arBtn" type="button">${ICON.ar}${t.try.ar}</button>
        <button class="btn ghost" id="dims" type="button" aria-pressed="false" data-on="${t.try.dimsOn}" data-off="${t.try.dimsOff}">${t.try.dimsOn}</button>
      </div>
      <p class="ar-note" id="arNote" hidden>${t.try.arNote}</p>
    </div>
    <div class="mv-stage" id="mvStage">
      <model-viewer dir="ltr" id="mv" loading="lazy" reveal="auto" src="${u('/assets/models/bed.glb')}" alt="${t.try.alt}"
        ar ar-modes="webxr scene-viewer quick-look" ar-scale="fixed" camera-controls touch-action="pan-y" auto-rotate auto-rotate-delay="1500" rotation-per-second="18deg"
        camera-orbit="-35deg 70deg auto" shadow-intensity="1" environment-image="neutral" exposure="1" interaction-prompt="none">
        <button slot="hotspot-w" class="dim" data-position="0 0.02 1.08" data-normal="0 1 0">${t.try.dims[0]}</button>
        <button slot="hotspot-l" class="dim" data-position="0.95 0.02 0" data-normal="0 1 0">${t.try.dims[1]}</button>
        <button slot="hotspot-h" class="dim" data-position="0 1.22 -1" data-normal="0 1 0">${t.try.dims[2]}</button>
        <button slot="ar-button" hidden></button>
      </model-viewer>
    </div>
  </div>
</section>

<section class="band alt" id="packages">
  <div class="wrap">
    <div class="sec-head"><p class="kicker">${t.packages.k}</p><h2>${t.packages.h}</h2><p class="lead">${t.packages.lead}</p></div>
    <div class="plans">${t.packages.items.map((pk) => `
      <article class="plan${pk.hot ? ' hot' : ''}">
        ${pk.hot ? `<span class="badge">${t.packages.badge}</span>` : ''}
        <h3>${pk.name}</h3><p class="units">${pk.units}</p>
        <ul>${pk.f.map((f) => `<li>${f}</li>`).join('')}</ul>
        <a class="btn ${pk.hot ? 'red' : 'ghost'} block" href="#contact" data-plan="${esc(pk.name)}">${t.packages.quote}</a>
      </article>`).join('')}
    </div>
    <p class="fine">${t.packages.note}</p>
  </div>
</section>

<section class="band" id="faq">
  <div class="wrap faq-grid">
    <div class="sec-head"><p class="kicker">${t.faq.k}</p><h2>${t.faq.h}</h2></div>
    <div class="faq">${t.faq.items.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('')}</div>
  </div>
</section>

${latest.length ? `<section class="band alt" id="insights">
  <div class="wrap">
    <div class="sec-head row"><div><p class="kicker">${t.blogTeaser.k}</p><h2>${t.blogTeaser.h}</h2></div><a class="more" href="${u(P + '/blog/')}">${t.blogTeaser.all}</a></div>
    <div class="posts">${latest.map((a) => postCard(a, t)).join('')}</div>
  </div>
</section>` : ''}

<section class="band contact" id="contact">
  <div class="wrap contact-grid">
    <div>
      <p class="kicker">${t.contact.k}</p><h2>${t.contact.h}</h2><p class="lead">${t.contact.lead}</p>
      <ul class="c-list">
        <li><span>${t.contact.email}</span><a href="mailto:${cfg.email}" dir="ltr">${cfg.email.toUpperCase()}</a></li>
        <li><span>${t.contact.phone}</span>${cfg.phone ? `<a href="tel:${cfg.phone.replace(/\s/g, '')}" dir="ltr">${esc(cfg.phone)}</a>` : `<em>${t.contact.phoneSoon}</em>`}</li>
        ${cfg.whatsapp ? `<li><span>${t.contact.whatsapp}</span><a href="https://wa.me/${cfg.whatsapp.replace(/\D/g, '')}" dir="ltr">${esc(cfg.whatsapp)}</a></li>` : ''}
      </ul>
      <p class="follow">${t.contact.follow}</p>
      ${socialLinks()}
    </div>
    <form class="c-form" id="cform" data-email="${cfg.email}" data-subject="${esc(t.contact.form.subject)}">
      ${[['name', 'text', 'name', true], ['showroom', 'text', 'organization', true], ['tel', 'tel', 'tel', true], ['city', 'text', 'address-level2', false]]
        .map(([k, ty, ac, req]) => `<label><span>${t.contact.form[k]}</span><input name="${k}" type="${ty}" autocomplete="${ac}"${req ? ' required' : ''}${ty === 'tel' ? ' dir="ltr" inputmode="tel"' : ''}></label>`).join('')}
      <label class="full"><span>${t.contact.form.msg}</span><textarea name="msg" rows="4"></textarea></label>
      <button class="btn red block full" type="submit">${t.contact.form.send}</button>
      <p class="fine full">${t.contact.form.hint}</p>
    </form>
  </div>
</section>
</main>
<script type="module" src="${u('/assets/js/hero3d.js')}?v=${VER}" data-model="${u('/assets/models/sofa.glb')}"></script>
<script type="module" src="${u('/assets/vendor/model-viewer.min.js')}"></script>
<script>window.TRY_TEX={walnut:${JSON.stringify(u('/assets/models/wood_walnut.jpg'))},velvet:${JSON.stringify(u('/assets/models/fabric_gray.jpg'))}}</script>
` + footer(t);
}

function postCard(a, t) {
  const d = new Date(a.date);
  const ds = d.toLocaleDateString(a.lang === 'ar' ? 'ar-EG' : 'en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
  return `<article class="post-card">
  <a href="${u(a.url)}" class="pc-media">${a.cover ? `<img src="${u(a.cover)}" alt="" loading="lazy">` : `<span class="pc-ph">${wordmark()}</span>`}</a>
  <div class="pc-body">
    <p class="pc-meta"><time datetime="${a.date}">${ds}</time> · ${a.minutes} ${t.blog.min}</p>
    <h3><a href="${u(a.url)}">${esc(a.title)}</a></h3>
    <p>${esc(a.description)}</p>
  </div>
</article>`;
}

function blogIndex(lang, articles) {
  const t = T[lang], P = pre(lang);
  const list = articles.filter((a) => a.lang === lang);
  return head({ t, title: t.meta.blogTitle, desc: t.meta.blogDesc, p: P + '/blog/', alt: { ar: '/blog/', en: '/en/blog/' },
    jsonld: [{ '@context': 'https://schema.org', '@type': 'Blog', name: t.meta.blogTitle, url: abs(P + '/blog/'), inLanguage: lang, publisher: { '@id': abs('/#org') } }] }) + `
<body class="page">
${header(t, { alt: pre(t.other) + '/blog/' })}
<main id="main">
  <section class="page-hero"><div class="wrap"><p class="kicker">${t.blogTeaser.k}</p><h1>${t.blog.title}</h1><p class="lead">${t.blog.lead}</p></div></section>
  <section class="band tight"><div class="wrap">
    ${list.length ? `<div class="posts">${list.map((a) => postCard(a, t)).join('')}</div>` : `<div class="empty">${wordmark('lg')}<p>${t.blog.empty}</p></div>`}
  </div></section>
</main>
` + footer(t);
}

function articlePage(a, articles) {
  const t = T[a.lang], P = pre(a.lang);
  const pair = a.translation && articles.find((x) => x.slug === a.translation && x.lang !== a.lang);
  const alt = pair ? { [a.lang]: a.url, [pair.lang]: pair.url } : null;
  const ds = new Date(a.date).toLocaleDateString(a.lang === 'ar' ? 'ar-EG' : 'en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
  const related = articles.filter((x) => x.lang === a.lang && x.slug !== a.slug).slice(0, 2);
  const jsonld = [
    { '@context': 'https://schema.org', '@type': 'BlogPosting', headline: a.title, description: a.description, inLanguage: a.lang,
      datePublished: a.date, dateModified: a.updated, mainEntityOfPage: abs(a.url), image: abs(a.cover || '/assets/img/og.png'),
      author: { '@type': 'Organization', name: a.author || 'Choufha' }, publisher: { '@id': abs('/#org') }, keywords: a.tags.join(', ') },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: t.blog.home, item: abs(P + '/') },
      { '@type': 'ListItem', position: 2, name: t.blog.title, item: abs(P + '/blog/') },
      { '@type': 'ListItem', position: 3, name: a.title, item: abs(a.url) }] },
  ];
  const share = encodeURIComponent(abs(a.url));
  return head({ t, title: `${a.title} | Choufha`, desc: a.description, p: a.url, alt, image: a.cover || '/assets/img/og.png', type: 'article', jsonld,
    extra: `<meta property="article:published_time" content="${a.date}">` }) + `
<body class="page">
${header(t, { alt: pair ? pair.url : pre(t.other) + '/blog/' })}
<main id="main">
  <article class="article">
    <header class="art-head"><div class="wrap narrow">
      <nav class="crumbs" aria-label="breadcrumb"><a href="${u(P + '/')}">${t.blog.home}</a><span>/</span><a href="${u(P + '/blog/')}">${t.blog.title}</a></nav>
      <h1>${esc(a.title)}</h1>
      <p class="lead">${esc(a.description)}</p>
      <p class="pc-meta"><time datetime="${a.date}">${ds}</time> · ${a.minutes} ${t.blog.min}${a.tags.length ? ' · ' + a.tags.map(esc).join('، ') : ''}</p>
    </div></header>
    ${a.cover ? `<figure class="art-cover wrap"><img src="${u(a.cover)}" alt="${esc(a.title)}"></figure>` : ''}
    <div class="wrap narrow prose">${a.html}</div>
    <div class="wrap narrow art-foot">
      <div class="share"><span>${t.blog.share}</span>
        <a href="https://wa.me/?text=${share}" target="_blank" rel="noopener" aria-label="WhatsApp">${SOCIAL.whatsapp}</a>
        <a href="https://www.facebook.com/sharer/sharer.php?u=${share}" target="_blank" rel="noopener" aria-label="Facebook">${SOCIAL.facebook}</a>
        <a href="https://www.linkedin.com/sharing/share-offsite/?url=${share}" target="_blank" rel="noopener" aria-label="LinkedIn">${SOCIAL.linkedin}</a>
        <a href="https://x.com/intent/post?url=${share}" target="_blank" rel="noopener" aria-label="X">${SOCIAL.x}</a>
      </div>
      <a class="more" href="${u(P + '/blog/')}">${t.blog.back}</a>
    </div>
    <aside class="wrap narrow art-cta"><h2>${t.blog.ctaH}</h2><p>${t.blog.ctaP}</p><a class="btn red" href="${u(P + '/#contact')}">${t.cta}</a></aside>
  </article>
  ${related.length ? `<section class="band alt"><div class="wrap"><div class="sec-head"><h2>${t.blog.related}</h2></div><div class="posts">${related.map((r) => postCard(r, t)).join('')}</div></div></section>` : ''}
</main>
` + footer(t);
}

function legal(lang, name) {
  const t = T[lang], P = pre(lang);
  const pg = legalPage(name, lang);
  const p = `${P}/${name}/`;
  return head({ t, title: `${pg.title} | Choufha`, desc: pg.description || pg.title, p, alt: { ar: `/${name}/`, en: `/en/${name}/` } }) + `
<body class="page">
${header(t, { alt: `${pre(t.other)}/${name}/` })}
<main id="main">
  <section class="page-hero"><div class="wrap narrow"><h1>${pg.title}</h1><p class="pc-meta">${t.legal.updated}: ${pg.updated || ''}</p></div></section>
  <div class="wrap narrow prose legal">${pg.html}</div>
</main>
` + footer(t);
}

function notFound() {
  const t = T.ar, e = T.en;
  return head({ t, title: '404 | Choufha', desc: t.nf.p, p: '/404.html', noindex: true }) + `
<body class="page">
${header(t)}
<main id="main" class="nf">
  <div class="wrap">
    <p class="nf-code">4${`<svg viewBox="0 0 64 64" aria-hidden="true"><circle class="eye-ring" cx="32" cy="32" r="25.5"/><circle class="eye-pupil" cx="39" cy="26" r="9.5"/></svg>`}4</p>
    <h1>${t.nf.title}</h1><p class="lead">${t.nf.p}</p>
    <p class="lead" lang="en" dir="ltr">${e.nf.title} — ${e.nf.p}</p>
    <div class="ctas"><a class="btn red" href="${u('/')}">${t.nf.home}</a><a class="btn ghost" href="${u('/en/')}" lang="en">${e.nf.home}</a></div>
  </div>
</main>
` + footer(t);
}

/* ---------- write ---------- */
function write(p, html) {
  const f = path.join(OUT, p.endsWith('/') ? p + 'index.html' : p);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, html);
}

fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) fs.rmSync(path.join(OUT, f), { recursive: true, force: true });
fs.cpSync(path.join(ROOT, 'static'), OUT, { recursive: true });
if (fs.existsSync(path.join(ROOT, 'content/uploads'))) fs.cpSync(path.join(ROOT, 'content/uploads'), path.join(OUT, 'uploads'), { recursive: true });

const articles = loadArticles();
const urls = [];
for (const lang of ['ar', 'en']) {
  const P = pre(lang);
  write(P + '/', homePage(lang, articles)); urls.push([P + '/', { ar: '/', en: '/en/' }, 1.0]);
  write(P + '/blog/', blogIndex(lang, articles)); urls.push([P + '/blog/', { ar: '/blog/', en: '/en/blog/' }, 0.8]);
  for (const n of ['privacy', 'terms']) { write(`${P}/${n}/`, legal(lang, n)); urls.push([`${P}/${n}/`, { ar: `/${n}/`, en: `/en/${n}/` }, 0.3]); }
}
for (const a of articles) { write(a.url, articlePage(a, articles)); urls.push([a.url, null, 0.7, a.updated]); }
write('/404.html', notFound());

// sitemap, robots, feed, manifest
const today = new Date().toISOString().slice(0, 10);
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.map(([p, alt, pr, mod]) => `<url><loc>${abs(p)}</loc><lastmod>${mod || today}</lastmod><priority>${pr.toFixed(1)}</priority>${alt ? Object.entries(alt).map(([l, ap]) => `<xhtml:link rel="alternate" hreflang="${l}" href="${abs(ap)}"/>`).join('') : ''}</url>`).join('\n')}
</urlset>`);
fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: ${abs('/sitemap.xml')}\n`);
for (const lang of ['ar', 'en']) {
  const list = articles.filter((a) => a.lang === lang).slice(0, 20);
  fs.mkdirSync(path.join(OUT, pre(lang).slice(1), 'blog'), { recursive: true });
  fs.writeFileSync(path.join(OUT, pre(lang).slice(1), 'blog/feed.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>${esc(T[lang].meta.blogTitle)}</title><link>${abs(pre(lang) + '/blog/')}</link><description>${esc(T[lang].meta.blogDesc)}</description><language>${lang}</language>
${list.map((a) => `<item><title>${esc(a.title)}</title><link>${abs(a.url)}</link><guid>${abs(a.url)}</guid><pubDate>${new Date(a.date).toUTCString()}</pubDate><description>${esc(a.description)}</description></item>`).join('\n')}
</channel></rss>`);
}
fs.writeFileSync(path.join(OUT, 'site.webmanifest'), JSON.stringify({ name: 'Choufha', short_name: 'Choufha', start_url: u('/'), display: 'standalone', background_color: '#1C1C1E', theme_color: '#1C1C1E',
  icons: [{ src: u('/assets/img/logo-192.png'), sizes: '192x192', type: 'image/png' }, { src: u('/assets/img/logo-512.png'), sizes: '512x512', type: 'image/png' }] }));
const host = new URL(SITE).hostname;
if (!host.endsWith('github.io')) fs.writeFileSync(path.join(OUT, 'CNAME'), host + '\n');
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
console.log(`Built ${urls.length + 1} pages, ${articles.length} article(s) → dist/  (site ${SITE}${BASE})`);
