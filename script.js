// Utility: localStorage cart
const CART_KEY = 'blucifer_cart_v2';

const $ = (sel, ctx=document) => ctx.querySelector(sel);
const $$ = (sel, ctx=document) => [...ctx.querySelectorAll(sel)];

const fmt = n => '$' + (Math.round(n * 100) / 100).toFixed(2);

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
          <input type="number" min="1" value="${i.qty}" style="width:60px;background:#0000;color:#fff;border:1px solid #ffffff33;border-radius:8px;padding:4px 6px" />
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
      addToCart({ id, name, price, img, qty: parseInt(qtySel.value, 10) });
      openCart();
    });
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

// Init
bindProducts();
renderCart();
refreshBadge();

