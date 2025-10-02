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
$('#checkout').addEventListener('click', () => {
  alert('Demo only. Hook this to your payment gateway later. The cart state is saved in your browser.');
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

// Close cart on ESC
window.addEventListener('keydown', e=>{ if(e.key==='Escape') closeCart(); });

