(function(){
  let root;
  function ensureRoot(){
    if(root) return root;
    root=document.createElement('div');
    root.className='kp-root';
    root.innerHTML=`<div class="kp-dim" data-kp-close></div>
      <div class="kp-wrap"><div class="kp-panel kp-card">
        <div class="kp-head"><span class="kp-badge">CHOOSE 1 ITEM</span>
          <div class="kp-title" id="kp-title"></div>
          <button class="kp-close" data-kp-close aria-label="Close">×</button>
        </div>
        <div class="kp-flex">
          <img id="kp-img" alt="Crate preview">
          <div class="kp-desc" id="kp-desc"></div>
        </div>
      </div></div>`;
    document.body.appendChild(root);
    root.addEventListener('click',e=>{ if(e.target.hasAttribute('data-kp-close')) close(); });
    document.addEventListener('keydown',e=>{ if(e.key==='Escape') close(); });
    return root;
  }
  function open(opts){
    const el=ensureRoot();
    el.querySelector('#kp-title').textContent=opts.title||'';
    el.querySelector('#kp-img').src=opts.img||'';
    var _desc = (opts.desc||'');
try { _desc = _desc.replace(/\n/g,'<br>'); } catch(e) {}
el.querySelector('#kp-desc').innerHTML = _desc;
    el.classList.add('kp-open');
    document.body.style.overflow='hidden';
  }
  function close(){ if(!root) return; root.classList.remove('kp-open'); document.body.style.overflow=''; }
  function onDocClick(e){
    const t = e.target.closest('[data-kp-img]');
    if(!t) return;
    e.preventDefault();
    open({
      title: t.getAttribute('data-kp-title')||'',
      img:   t.getAttribute('data-kp-img')  ||'',
      desc:  t.getAttribute('data-kp-desc') ||''
    });
  }
  window.KeyPreview={open,close};
  document.addEventListener('click', function(e){
    // Ignore clicks on quantity/select/buttons or inside .actions
    if (e.target.closest('.actions, button, .btn, select, option, label')) return;
    const t = e.target.closest('[data-kp-img]');
    if(!t) return;
    e.preventDefault();
    open({
      title: t.getAttribute('data-kp-title')||'',
      img:   t.getAttribute('data-kp-img')  ||'',
      desc:  t.getAttribute('data-kp-desc') ||''
    });
  }, true);
  console.log('[KeyPreview] Loaded. Click images with data-kp-img.');
})();