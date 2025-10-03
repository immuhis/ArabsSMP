// Utility: localStorage cart
const CART_KEY = 'blucifer_cart_v2';
const THEME_KEY = 'arabsmp_theme';

const $ = (sel, ctx=document) => ctx.querySelector(sel);
const $$ = (sel, ctx=document) => [...ctx.querySelectorAll(sel)];

const fmt = n => '$' + (Math.round(n * 100) / 100).toFixed(2);

const themeToggle = $('#theme-toggle');

function readStoredTheme(){
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}

function writeStoredTheme(value){
  try {
    localStorage.setItem(THEME_KEY, value);
  } catch {
    /* storage unavailable */
  }
}

function applyTheme(theme, { persist = true, animate = true } = {}){
  const next = theme === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  if(themeToggle){
    const icon = $('.theme-icon', themeToggle);
    const text = $('.theme-text', themeToggle);
    if(next === 'dark'){
      themeToggle.setAttribute('aria-label', 'Switch to light mode');
      themeToggle.setAttribute('aria-pressed', 'true');
      if(icon) icon.textContent = '🌙';
      if(text) text.textContent = 'Dark';
    } else {
      themeToggle.setAttribute('aria-label', 'Switch to dark mode');
      themeToggle.setAttribute('aria-pressed', 'false');
      if(icon) icon.textContent = '☀️';
      if(text) text.textContent = 'Light';
    }
    if(animate){
      themeToggle.classList.remove('theme-toggle-spin');
      void themeToggle.offsetWidth;
      themeToggle.classList.add('theme-toggle-spin');
      setTimeout(() => themeToggle.classList.remove('theme-toggle-spin'), 400);
    }
  }
  if(persist){
    writeStoredTheme(next);
  }
}

function initTheme(){
  const stored = readStoredTheme();
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  if(stored){
    applyTheme(stored, { animate:false });
  } else {
    applyTheme(prefersDark ? 'dark' : 'light', { persist:false, animate:false });
    if(window.matchMedia){
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const syncSystemTheme = e => {
        if(!readStoredTheme()){
          applyTheme(e.matches ? 'dark' : 'light', { persist:false });
        }
      };
      if(typeof mq.addEventListener === 'function'){
        mq.addEventListener('change', syncSystemTheme);
      } else if(typeof mq.addListener === 'function'){
        mq.addListener(syncSystemTheme);
      }
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
  if(found){ found.qty += item.qty; }
  else { items.push(item); }
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
  items.forEach(i=>{
    total += i.price * i.qty;
    const li = document.createElement('li');
    li.className = 'cart-item';
    li.innerHTML = `
      <img src="${i.img}" alt="${i.name}" />
      <div>
        <div class="name">${i.name}</div>
        <div class="meta">${fmt(i.price)} ×
          <input type="number" min="1" value="${i.qty}" class="qty-input" />
        </div>
      </div>
      <div style="display:grid;gap:6px;justify-items:end">
        <div><b>${fmt(i.price * i.qty)}</b></div>
        <button class="remove">Remove</button>
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
}

function bindProducts(){
  $$('.card').forEach(card => {
    const id = card.dataset.id;
    const name = card.dataset.name;
    const price = parseFloat(card.dataset.price);
    const img = card.dataset.img;
    const qtySel = $('.qty', card);
    $('.add', card).addEventListener('click', () => {
      card.classList.remove('card-added');
      void card.offsetWidth;
      card.classList.add('card-added');
      setTimeout(() => card.classList.remove('card-added'), 500);
      addToCart({ id, name, price, img, qty: parseInt(qtySel.value, 10) });
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

function openCheckoutModal(){
  const items = getCart();
  if(!items.length){
    alert('Your cart is empty. Add a key before checking out.');
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

const statusLabels = {
  'no-issue': 'No complaints, ready to pay',
  'submitted': 'I already opened a ticket',
  'need-help': 'I still need help before paying'
};

checkoutForm.addEventListener('submit', e => {
  e.preventDefault();
  const items = getCart();
  if(!items.length){
    checkoutMessage.textContent = 'Your cart is empty. Add items before checking out.';
    return;
  }
  const minecraft = minecraftInput.value.trim();
  const discord = discordInput.value.trim();
  const complaint = complaintSelect.value;
  if(!minecraft || !discord || !complaint){
    checkoutMessage.textContent = 'Please fill in all fields to continue.';
    return;
  }
  if(complaint === 'need-help'){
    checkoutMessage.textContent = 'Open a support ticket in Discord so staff can help you before paying.';
    summarySection.hidden = true;
    return;
  }

  checkoutMessage.textContent = '';
  summaryItems.innerHTML = '';

  const details = [];
  const addSummaryItem = (label, value) => {
    const li = document.createElement('li');
    li.innerHTML = `<strong>${label}:</strong> ${htmlEscape(value)}`;
    summaryItems.appendChild(li);
  };

  addSummaryItem('Minecraft', minecraft);
  addSummaryItem('Discord', discord);
  addSummaryItem('Ticket status', statusLabels[complaint] || complaint);

  const itemsHeader = document.createElement('li');
  itemsHeader.innerHTML = '<strong>Items</strong>';
  summaryItems.appendChild(itemsHeader);

  let total = 0;
  items.forEach(item => {
    const lineTotal = item.price * item.qty;
    total += lineTotal;
    const li = document.createElement('li');
    li.innerHTML = `${htmlEscape(item.name)} × ${item.qty} — <strong>${fmt(lineTotal)}</strong>`;
    summaryItems.appendChild(li);
    details.push(`${item.name} x${item.qty} - ${fmt(lineTotal)}`);
  });

  summaryTotal.textContent = fmt(total);
  summarySection.hidden = false;

  lastOrderDetails = [
    `Minecraft: ${minecraft}`,
    `Discord: ${discord}`,
    `Ticket status: ${statusLabels[complaint] || complaint}`,
    'Items:',
    ...details,
    `Total: ${fmt(total)}`
  ].join('\n');
});

if(copyOrderBtn){
  copyOrderBtn.addEventListener('click', () => {
    if(!lastOrderDetails){
      checkoutMessage.textContent = 'Submit the form above to generate order details.';
      return;
    }
    navigator.clipboard.writeText(lastOrderDetails).then(() => {
      const original = copyOrderBtn.textContent;
      copyOrderBtn.textContent = 'Copied!';
      setTimeout(() => { copyOrderBtn.textContent = original; }, 1800);
    });
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
function copyIP(){
  const ip = $('#server-ip').textContent.trim();
  navigator.clipboard.writeText(ip).then(()=>{
    const btns = ['#copy-ip','#copy-ip-hero'];
    btns.forEach(sel=>{ const b=$(sel); if(b){ b.textContent='Copied!'; setTimeout(()=>b.textContent= sel.includes('hero')?'Copy':'Copy IP', 1400);} });
  });
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
bindProducts();
renderCart();
refreshBadge();
initRevealAnimations();
initTheme();

