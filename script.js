// Utility: localStorage cart
const CART_KEY = 'blucifer_cart_v2';
const THEME_KEY = 'arabsmp_theme';

const $ = (sel, ctx=document) => ctx.querySelector(sel);
const $$ = (sel, ctx=document) => [...ctx.querySelectorAll(sel)];

const fmt = n => '$' + (Math.round(n * 100) / 100).toFixed(2);

const LANGUAGE_KEY = 'arabsmp_language';
const AUTO_TRANSLATION_KEY = 'arabsmp_i18n_cache_v1';

class I18nManager {
  constructor(config = {}) {
    this.config = config;
    this.defaultLanguage = config.defaultLanguage || 'en';
    this.language = this.defaultLanguage;
    this.manualTranslations = config.translations || {};
    this.googleConfig = config.googleTranslate || {};
    this.baseTexts = {};
    this.entries = new Map();
    this.extraKeys = new Set();
    this.listeners = new Set();
    this.cache = this.loadCache();
    this.registerDomEntries();
    const storedLang = this.getStoredLanguage();
    if (storedLang) {
      this.language = storedLang;
    }
  }

  onChange(fn) {
    if (typeof fn === 'function') {
      this.listeners.add(fn);
    }
  }

  registerDomEntries() {
    this.registerElements('[data-i18n]', 'i18n', el => el.textContent, (el, val) => { el.textContent = val; });
    this.registerElements('[data-i18n-html]', 'i18nHtml', el => el.innerHTML, (el, val) => { el.innerHTML = val; });
    this.registerElements('[data-i18n-placeholder]', 'i18nPlaceholder', el => el.getAttribute('placeholder'), (el, val) => { el.setAttribute('placeholder', val); });
    this.registerElements('[data-i18n-aria-label]', 'i18nAriaLabel', el => el.getAttribute('aria-label'), (el, val) => { el.setAttribute('aria-label', val); });
  }

  registerElements(selector, dataKey, getter, setter) {
    $$(selector).forEach(el => {
      const key = el.dataset[dataKey];
      if (!key) return;
      this.registerEntry(key, getter(el));
      const entry = { el, setter, key };
      if (!this.entries.has(key)) {
        this.entries.set(key, []);
      }
      this.entries.get(key).push(entry);
    });
  }

  registerEntry(key, value) {
    if (key && typeof value === 'string' && !(key in this.baseTexts)) {
      this.baseTexts[key] = value;
    }
  }

  registerString(key, value, { preload = false } = {}) {
    this.registerEntry(key, value);
    if (preload) {
      this.extraKeys.add(key);
    }
  }

  getStoredLanguage() {
    try {
      return localStorage.getItem(LANGUAGE_KEY);
    } catch {
      return null;
    }
  }

  storeLanguage(lang) {
    try {
      localStorage.setItem(LANGUAGE_KEY, lang);
    } catch {
      /* no-op */
    }
  }

  loadCache() {
    try {
      return JSON.parse(localStorage.getItem(AUTO_TRANSLATION_KEY)) || {};
    } catch {
      return {};
    }
  }

  saveCache() {
    try {
      localStorage.setItem(AUTO_TRANSLATION_KEY, JSON.stringify(this.cache));
    } catch {
      /* ignore */
    }
  }

  getManual(lang, key) {
    return (this.manualTranslations[lang] && this.manualTranslations[lang][key]) ?? null;
  }

  getCached(lang, key) {
    return this.cache[lang] && this.cache[lang][key];
  }

  setCache(lang, key, value) {
    if (!this.cache[lang]) {
      this.cache[lang] = {};
    }
    this.cache[lang][key] = value;
  }

  async initialize() {
    await this.setLanguage(this.language);
  }

  async setLanguage(lang) {
    const target = lang || this.defaultLanguage;
    await this.ensureTranslations(target);
    this.applyLanguage(target);
    this.language = target;
    this.storeLanguage(target);
    this.listeners.forEach(fn => fn(target));
  }

  async ensureTranslations(lang) {
    if (lang === this.defaultLanguage) {
      return;
    }
    const manual = this.manualTranslations[lang] || {};
    const needed = new Set();
    this.entries.forEach((_, key) => {
      if (manual[key] != null) return;
      if (this.getCached(lang, key)) return;
      needed.add(key);
    });
    this.extraKeys.forEach(key => {
      if (manual[key] != null) return;
      if (this.getCached(lang, key)) return;
      needed.add(key);
    });
    if (!needed.size) return;
    try {
      await this.fetchTranslations([...needed], lang);
      this.saveCache();
    } catch (err) {
      console.warn('Translation request failed', err);
    }
  }

  applyLanguage(lang) {
    const manual = this.manualTranslations[lang] || {};
    this.entries.forEach((list, key) => {
      let value = this.baseTexts[key] ?? '';
      if (lang !== this.defaultLanguage) {
        if (manual[key] != null) {
          value = manual[key];
        } else {
          value = this.getCached(lang, key) ?? value;
        }
      }
      list.forEach(entry => entry.setter(entry.el, value));
    });
    const root = document.documentElement;
    root.lang = lang;
    if (lang === 'ar') {
      root.dir = 'rtl';
      document.body.classList.add('lang-ar');
    } else {
      root.dir = 'ltr';
      document.body.classList.remove('lang-ar');
    }
  }

  async fetchTranslations(keys, lang) {
    const texts = keys.map(key => this.baseTexts[key] ?? '');
    if (!texts.length) return;
    const source = this.googleConfig.source || this.defaultLanguage || 'en';
    if (this.googleConfig.apiKey) {
      const endpoint = this.googleConfig.endpoint || 'https://translation.googleapis.com/language/translate/v2';
      const response = await fetch(`${endpoint}?key=${this.googleConfig.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: texts, target: lang, source, format: 'html' })
      });
      if (!response.ok) throw new Error('Google Translate API error');
      const data = await response.json();
      const translations = (data && data.data && data.data.translations) || [];
      translations.forEach((item, idx) => {
        const translated = item.translatedText || '';
        this.setCache(lang, keys[idx], translated);
      });
      return;
    }
    for (let i = 0; i < keys.length; i += 1) {
      const text = texts[i];
      const key = keys[i];
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(source)}&tl=${encodeURIComponent(lang)}&dt=t&q=${encodeURIComponent(text)}`;
      try {
        const response = await fetch(url);
        if (!response.ok) continue;
        const data = await response.json();
        const translated = Array.isArray(data) && Array.isArray(data[0])
          ? data[0].map(part => part[0]).join('')
          : '';
        if (translated) {
          this.setCache(lang, key, translated);
        }
      } catch (err) {
        console.warn('Fallback translation failed', err);
      }
    }
  }

  async get(key, fallback = '') {
    if (!(key in this.baseTexts) && fallback) {
      this.registerEntry(key, fallback);
    }
    if (this.language === this.defaultLanguage) {
      return this.baseTexts[key] ?? fallback;
    }
    const manual = this.getManual(this.language, key);
    if (manual != null) return manual;
    const cached = this.getCached(this.language, key);
    if (cached != null) return cached;
    try {
      await this.fetchTranslations([key], this.language);
      this.saveCache();
    } catch (err) {
      console.warn('Translation fetch failed for key', key, err);
    }
    return this.getCached(this.language, key) ?? (this.baseTexts[key] ?? fallback);
  }

  instant(key, fallback = '') {
    if (this.language === this.defaultLanguage) {
      return this.baseTexts[key] ?? fallback;
    }
    const manual = this.getManual(this.language, key);
    if (manual != null) return manual;
    return this.getCached(this.language, key) ?? (this.baseTexts[key] ?? fallback);
  }
}

const i18n = new I18nManager(window.languageConfig || {});

i18n.registerString('nav.themeLight', 'Light', { preload: true });
i18n.registerString('nav.themeDark', 'Dark', { preload: true });
i18n.registerString('nav.themeAriaLight', 'Switch to light mode', { preload: true });
i18n.registerString('nav.themeAriaDark', 'Switch to dark mode', { preload: true });
i18n.registerString('nav.languageSwitchAr', 'Switch to Arabic', { preload: true });
i18n.registerString('nav.languageSwitchEn', 'Switch to English', { preload: true });
i18n.registerString('messages.emptyCartAlert', 'Your cart is empty. Add a key before checking out.', { preload: true });
i18n.registerString('messages.emptyCartInline', 'Your cart is empty. Add items before checking out.', { preload: true });
i18n.registerString('messages.fillAllFields', 'Please fill in all fields to continue.', { preload: true });
i18n.registerString('messages.needHelp', 'Open a support ticket in Discord so staff can help you before paying.', { preload: true });
i18n.registerString('messages.generateDetails', 'Submit the form above to generate order details.', { preload: true });
i18n.registerString('messages.copied', 'Copied!', { preload: true });
i18n.registerString('cart.remove', 'Remove', { preload: true });
i18n.registerString('checkout.summaryMinecraft', 'Minecraft', { preload: true });
i18n.registerString('checkout.summaryDiscord', 'Discord', { preload: true });
i18n.registerString('checkout.summaryTicket', 'Ticket status', { preload: true });
i18n.registerString('checkout.summaryItemsHeading', 'Items', { preload: true });
i18n.registerString('checkout.summaryItemsLabel', 'Items:', { preload: true });
i18n.registerString('checkout.totalLabel', 'Total:', { preload: true });

const themeToggle = $('#theme-toggle');
const menuToggle = $('#menu-toggle');
const primaryNav = $('#primary-nav');


if(menuToggle && primaryNav){
  document.body.classList.add('menu-enhanced');
  const closeMenu = () => {
    primaryNav.classList.remove('is-open');
    menuToggle.classList.remove('is-active');
    menuToggle.setAttribute('aria-expanded', 'false');
    
  menuToggle.addEventListener('click', () => {
    const isOpen = !primaryNav.classList.contains('is-open');
    primaryNav.classList.toggle('is-open', isOpen);
    menuToggle.classList.toggle('is-active', isOpen);
    menuToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  $$('#primary-nav a, #primary-nav button').forEach(el => {
    el.addEventListener('click', () => closeMenu());
  });

  const mq = window.matchMedia('(min-width: 768px)');
  mq.addEventListener('change', e => { if(e.matches) closeMenu(); });

  closeMenu();

function applyTheme(theme, { persist = true, animate = true } = {}){
  const next = theme === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  if(themeToggle){
    const icon = $('.theme-icon', themeToggle);
    const text = $('.theme-text', themeToggle);
    const labelKey = next === 'dark' ? 'nav.themeAriaLight' : 'nav.themeAriaDark';
    const labelFallback = next === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
    themeToggle.setAttribute('aria-label', i18n.instant(labelKey, labelFallback));
    themeToggle.setAttribute('aria-pressed', next === 'dark' ? 'true' : 'false');
    if(icon) icon.textContent = next === 'dark' ? '🌙' : '☀️';
    if(text){
      const textKey = next === 'dark' ? 'nav.themeDark' : 'nav.themeLight';
      const textFallback = next === 'dark' ? 'Dark' : 'Light';
      text.textContent = i18n.instant(textKey, textFallback);
    }
    if(animate){
      themeToggle.classList.remove('theme-toggle-spin');
      void themeToggle.offsetWidth;
      themeToggle.classList.add('theme-toggle-spin');
      setTimeout(() => themeToggle.classList.remove('theme-toggle-spin'), 400);
    }
  }
  if(persist){
    localStorage.setItem(THEME_KEY, next);
  }
}

function initTheme(){
  const stored = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  if(stored){
    applyTheme(stored, { animate:false });
  } else {
    applyTheme(prefersDark ? 'dark' : 'light', { persist:false, animate:false });
    if(window.matchMedia){
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', e => {
        if(!localStorage.getItem(THEME_KEY)){
          applyTheme(e.matches ? 'dark' : 'light', { persist:false });
        }
      });
    }
  }

  if(themeToggle){
    themeToggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
    });
  }
}

function getCart(){
  try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
  catch { return []; }
}
function saveCart(items){
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  refreshBadge(items);
}
function refreshBadge(items = getCart()){
  const count = items.reduce((a,i)=>a + i.qty, 0);
  $('#cart-count').textContent = count;
}

function addToCart(item){
  const items = getCart();
  const found = items.find(i => i.id === item.id);
  if(found){
    found.qty += item.qty;
    if(item.name) found.name = item.name;
    if(item.baseName) found.baseName = item.baseName;
    if(item.nameKey) found.nameKey = item.nameKey;
    if(item.img) found.img = item.img;
    if(item.price) found.price = item.price;
  } else {
    items.push({ ...item });
  }
  saveCart(items);
  renderCart();
  animateCart();
}

function removeFromCart(id){
  const items = getCart().filter(i => i.id !== id);
  saveCart(items);
  renderCart();
}

function updateQty(id, qty){
  const items = getCart().map(i => i.id === id ? {...i, qty} : i).filter(i=>i.qty>0);
  saveCart(items);
  renderCart();
}

function clearCart(){
  saveCart([]);
  renderCart();
}

function renderCart(){
  const list = $('#cart-items');
  const items = getCart();
  list.innerHTML = '';
  let total = 0;
  let mutated = false;
  items.forEach(i=>{
    total += i.price * i.qty;
    const inferredKey = i.nameKey || PRODUCT_NAME_KEYS[i.id];
    if(inferredKey && !i.nameKey){
      i.nameKey = inferredKey;
      mutated = true;
    }
    const baseFromConfig = i.nameKey ? (i.baseName || i18n.baseTexts[i.nameKey]) : null;
    if(!i.baseName){
      i.baseName = baseFromConfig || i.name || '';
      if(i.baseName) mutated = true;
    }
    const li = document.createElement('li');
    li.className = 'cart-item';
    const nameKey = i.nameKey;
    const baseName = i.baseName || '';
    const displayName = nameKey ? i18n.instant(nameKey, baseName) : baseName;
    const removeLabel = i18n.instant('cart.remove', 'Remove');
    li.innerHTML = `
      <img src="${i.img}" alt="${htmlEscape(displayName)}" />
      <div>
        <div class="name">${htmlEscape(displayName)}</div>
        <div class="meta">${fmt(i.price)} ×
          <input type="number" min="1" value="${i.qty}" class="qty-input" />
        </div>
      </div>
      <div style="display:grid;gap:6px;justify-items:end">
        <div><b>${fmt(i.price * i.qty)}</b></div>
        <button class="remove">${htmlEscape(removeLabel)}</button>
      </div>
    `;
    const qtyInput = $('input', li);
    qtyInput.addEventListener('change', e => {
      const val = Math.max(1, parseInt(e.target.value || '1', 10));
      updateQty(i.id, val);
    });
    $('.remove', li).addEventListener('click', () => removeFromCart(i.id));
    list.appendChild(li);
  });
  $('#cart-total').textContent = fmt(total);
  if(mutated){
    saveCart(items);
  }
}

function bindProducts(){
  $$('.card').forEach(card => {
    const id = card.dataset.id;
    const name = card.dataset.name;
    const nameKey = card.dataset.nameKey || PRODUCT_NAME_KEYS[id];
    const price = parseFloat(card.dataset.price);
    const img = card.dataset.img;
    const qtySel = $('.qty', card);
    $('.add', card).addEventListener('click', () => {
      card.classList.remove('card-added');
      void card.offsetWidth;
      card.classList.add('card-added');
      setTimeout(() => card.classList.remove('card-added'), 500);
      const titleEl = $('h3', card);
      const displayName = titleEl ? titleEl.textContent.trim() : name;
      addToCart({ id, name: displayName, baseName: name, nameKey, price, img, qty: parseInt(qtySel.value, 10) });
      openCart();
    });
  });
}

function animateCart(){
  const btn = $('#open-cart');
  const badge = $('#cart-count');
  [btn, badge].forEach(el => {
    if(!el) return;
    el.classList.remove('cart-bump');
    void el.offsetWidth;
    el.classList.add('cart-bump');
  });
}

// Drawer
const cartEl = $('#cart');
function openCart(){ cartEl.classList.add('open'); }
function closeCart(){ cartEl.classList.remove('open'); }

$('#open-cart').addEventListener('click', openCart);
$('#close-cart').addEventListener('click', closeCart);
$('#clear-cart').addEventListener('click', clearCart);

const checkoutModal = $('#checkout-modal');
const checkoutForm = $('#checkout-form');
const checkoutMessage = $('#checkout-message');
const summarySection = $('#checkout-summary');
const summaryItems = $('#summary-items');
const summaryTotal = $('#summary-total');
const copyOrderBtn = $('#copy-order');
const complaintSelect = $('#complaint-status');
const minecraftInput = $('#minecraft-name');
const discordInput = $('#discord-name');
let lastOrderDetails = '';

const htmlEscape = str => str.replace(/[&<>"']/g, ch => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[ch] || ch));

async function openCheckoutModal(){
  const items = getCart();
  if(!items.length){
    alert(await i18n.get('messages.emptyCartAlert', 'Your cart is empty. Add a key before checking out.'));
    return;
  }
  closeCart();
  checkoutForm.reset();
  checkoutMessage.textContent = '';
  summarySection.hidden = true;
  summaryItems.innerHTML = '';
  summaryTotal.textContent = '';
  lastOrderDetails = '';
  checkoutModal.classList.add('open');
  checkoutModal.setAttribute('aria-hidden', 'false');
  setTimeout(()=>minecraftInput.focus(), 150);
}

function closeCheckoutModal(){
  checkoutModal.classList.remove('open');
  checkoutModal.setAttribute('aria-hidden', 'true');
}

$('#checkout').addEventListener('click', openCheckoutModal);
$('#close-modal').addEventListener('click', closeCheckoutModal);
checkoutModal.addEventListener('click', e => {
  if(e.target === checkoutModal) closeCheckoutModal();
});

checkoutForm.addEventListener('submit', async e => {
  e.preventDefault();
  const items = getCart();
  if(!items.length){
    checkoutMessage.textContent = await i18n.get('messages.emptyCartInline', 'Your cart is empty. Add items before checking out.');
    return;
  }
  const minecraft = minecraftInput.value.trim();
  const discord = discordInput.value.trim();
  const complaint = complaintSelect.value;
  if(!minecraft || !discord || !complaint){
    checkoutMessage.textContent = await i18n.get('messages.fillAllFields', 'Please fill in all fields to continue.');
    return;
  }
  if(complaint === 'need-help'){
    checkoutMessage.textContent = await i18n.get('messages.needHelp', 'Open a support ticket in Discord so staff can help you before paying.');
    summarySection.hidden = true;
    return;
  }

  checkoutMessage.textContent = '';
  summaryItems.innerHTML = '';

  const details = [];
  const addSummaryItem = (label, value) => {
    const li = document.createElement('li');
    li.innerHTML = `<strong>${htmlEscape(label)}:</strong> ${htmlEscape(value)}`;
    summaryItems.appendChild(li);
  };

  const minecraftLabel = await i18n.get('checkout.summaryMinecraft', 'Minecraft');
  const discordLabel = await i18n.get('checkout.summaryDiscord', 'Discord');
  const ticketLabel = await i18n.get('checkout.summaryTicket', 'Ticket status');
  addSummaryItem(minecraftLabel, minecraft);
  addSummaryItem(discordLabel, discord);
  const selectedOption = complaintSelect.options[complaintSelect.selectedIndex];
  const ticketValue = selectedOption ? selectedOption.textContent : complaint;
  addSummaryItem(ticketLabel, ticketValue);

  const itemsHeader = document.createElement('li');
  const itemsHeading = await i18n.get('checkout.summaryItemsHeading', 'Items');
  itemsHeader.innerHTML = `<strong>${htmlEscape(itemsHeading)}</strong>`;
  summaryItems.appendChild(itemsHeader);

  let total = 0;
  items.forEach(item => {
    const lineTotal = item.price * item.qty;
    total += lineTotal;
    const li = document.createElement('li');
    const productNameKey = item.nameKey || PRODUCT_NAME_KEYS[item.id];
    const productNameFallback = item.baseName || item.name || '';
    const productName = productNameKey ? i18n.instant(productNameKey, productNameFallback) : productNameFallback;
    li.innerHTML = `${htmlEscape(productName)} × ${item.qty} — <strong>${fmt(lineTotal)}</strong>`;
    summaryItems.appendChild(li);
    details.push(`${productName} x${item.qty} - ${fmt(lineTotal)}`);
  });

  summaryTotal.textContent = fmt(total);
  summarySection.hidden = false;

  const summaryTicketValue = ticketValue;
  const itemsLabel = await i18n.get('checkout.summaryItemsLabel', 'Items:');
  const totalLabel = await i18n.get('checkout.totalLabel', 'Total:');
  lastOrderDetails = [
    `${minecraftLabel}: ${minecraft}`,
    `${discordLabel}: ${discord}`,
    `${ticketLabel}: ${summaryTicketValue}`,
    itemsLabel,
    ...details,
    `${totalLabel} ${fmt(total)}`
  ].join('\n');
});

if(copyOrderBtn){
  copyOrderBtn.addEventListener('click', async () => {
    if(!lastOrderDetails){
      checkoutMessage.textContent = await i18n.get('messages.generateDetails', 'Submit the form above to generate order details.');
      return;
    }
    try {
      await navigator.clipboard.writeText(lastOrderDetails);
      const copiedText = await i18n.get('messages.copied', 'Copied!');
      copyOrderBtn.textContent = copiedText;
      setTimeout(() => { copyOrderBtn.textContent = i18n.instant('checkout.copy', 'Copy Order Details'); }, 1800);
    } catch (err) {
      console.warn('Copy failed', err);
    }
  });
}

window.addEventListener('keydown', e => {
  if(e.key !== 'Escape') return;
  if(checkoutModal.classList.contains('open')){
    closeCheckoutModal();
  } else {
    closeCart();
  }
});

// IP copy
async function copyIP(){
  const ip = $('#server-ip').textContent.trim();
  try {
    await navigator.clipboard.writeText(ip);
    const copiedLabel = await i18n.get('messages.copied', 'Copied!');
    ['#copy-ip', '#copy-ip-hero'].forEach(sel => {
      const btn = $(sel);
      if(!btn) return;
      btn.textContent = copiedLabel;
      setTimeout(() => {
        const resetLabel = sel.includes('hero') ? i18n.instant('hero.copy', 'Copy') : i18n.instant('nav.copyIp', 'Copy IP');
        btn.textContent = resetLabel;
      }, 1400);
    });
  } catch (err) {
    console.warn('Copy IP failed', err);
  }
}
$('#copy-ip').addEventListener('click', copyIP);
$('#copy-ip-hero').addEventListener('click', copyIP);

function initRevealAnimations(){
  const elements = $$('.reveal');
  const revealNow = el => {
    if(el.dataset.delay){
      el.style.setProperty('--reveal-delay', el.dataset.delay);
    }
    el.classList.add('is-visible');
  };

  if(!('IntersectionObserver' in window)){
    elements.forEach(revealNow);
    return;
  }

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if(!entry.isIntersecting) return;
      const target = entry.target;
      if(target.dataset.delay){
        target.style.setProperty('--reveal-delay', target.dataset.delay);
      }
      target.classList.add('is-visible');
      obs.unobserve(target);
    });
  }, {
    threshold:0.15,
    rootMargin:'0px 0px -60px 0px'
  });

  elements.forEach(el => {
    if(el.dataset.delay){
      el.style.setProperty('--reveal-delay', el.dataset.delay);
    }
    observer.observe(el);
  });
}

// Init
async function initApp(){
  await i18n.initialize();
  updateLanguageToggleUI(i18n.language);
  bindProducts();
  refreshBadge();
  renderCart();
  initRevealAnimations();
  initTheme();
}

initApp();

