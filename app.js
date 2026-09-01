const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const drawer = document.querySelector('#quote-drawer');
const overlay = document.querySelector('#overlay');
const quoteDialog = document.querySelector('#quote-form-dialog');
let catalog = [];
let activeCategory = 'all';
let activeCatalogMode = 'produccion';
let activeFilters = { genero: 'all', tipo: 'all', talla: 'all', color: 'all' };
let cart = JSON.parse(localStorage.getItem('baks-cart') || '[]').map(item => ({ ...item, duration: Number(item.duration) || 1 }));
const catalogModes = {
  produccion: { label: 'Producción', categories: ['mobiliario', 'articulos-de-oficina', 'cajas-plasticas', 'toldas', 'ventilacion-y-enfriamiento', 'electricidad-y-luces', 'comunicacion', 'varios'] },
  arte: { label: 'Arte', categories: ['muebles-para-decoracion', 'utileria', 'cajas-plasticas'] },
  vestuario: { label: 'Vestuario', categories: ['vestuario', 'ropa-hombre', 'ropa-mujer', 'ropa-nino', 'ropa-nina', 'cajas-plasticas'] }
};
const getModeCatalog = () => {
  const categories = catalogModes[activeCatalogMode]?.categories || [];
  if (!categories.length) return [];
  const categoryOrder = new Map(categories.map((categoryId, index) => [categoryId, index]));
  return catalog
    .filter(product => categories.includes(product.category))
    .sort((a, b) => (categoryOrder.get(a.category) ?? 999) - (categoryOrder.get(b.category) ?? 999));
};
const matchesFilters = product => {
  const matchesGenero = activeFilters.genero === 'all' || (product.gender || 'all') === activeFilters.genero;
  const matchesTipo = activeFilters.tipo === 'all' || (product.type || 'all') === activeFilters.tipo;
  const matchesTalla = activeFilters.talla === 'all' || (product.size || 'all') === activeFilters.talla;
  const matchesColor = activeFilters.color === 'all' || (product.color || 'all') === activeFilters.color;
  return matchesGenero && matchesTipo && matchesTalla && matchesColor;
};
const normalizeFilterValue = value => String(value || '').toLowerCase().replace(/\s+/g, '-');
const getFilterOptions = (products, key) => {
  const values = new Set(products.map(product => product[key]).filter(Boolean));
  return [...values].sort();
};
const renderCatalogModeButtons = () => {
  document.querySelectorAll('[data-catalog-mode]').forEach(button => {
    const isActive = button.dataset.catalogMode === activeCatalogMode;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
};

const safe = text => String(text).replace(/[&<>'"]/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[char]));
const formatCategoryLabel = label => {
  const words = String(label || '').trim().split(/\s+/).filter(Boolean);
  if (words.length <= 2) return safe(label);
  const lastWord = words.pop();
  return `${safe(words.join(' '))}<br>${safe(lastWord)}`;
};
const priceText = product => {
  const activation = product.activationFee ? `Activación ${money.format(product.activationFee)} · ` : '';
  if (product.daily) return `${activation}Día ${money.format(product.daily)}${product.weekly ? ` · Semana ${money.format(product.weekly)}` : ''}`;
  return product.activationFee ? `Activación ${money.format(product.activationFee)}` : 'Precio a cotizar';
};
let imageModal = null;
const getImageModal = () => {
  if (imageModal) return imageModal;
  imageModal = document.createElement('div');
  imageModal.className = 'image-modal hidden';
  imageModal.innerHTML = `
    <div class="image-modal-backdrop" data-close-image-modal></div>
    <div class="image-modal-card" role="dialog" aria-modal="true" aria-label="Vista ampliada de imagen del producto">
      <button class="image-modal-close" type="button" data-close-image-modal aria-label="Cerrar imagen">×</button>
      <img src="" alt="Vista ampliada del producto" />
    </div>
  `;
  document.body.appendChild(imageModal);
  imageModal.querySelectorAll('[data-close-image-modal]').forEach(node => node.addEventListener('click', closeImageModal));
  return imageModal;
};
const openImageModal = src => {
  const modal = getImageModal();
  const img = modal.querySelector('img');
  img.src = src;
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
};
const closeImageModal = () => {
  const modal = getImageModal();
  modal.classList.add('hidden');
  document.body.style.overflow = '';
};
const getCartItem = id => cart.find(item => item.id === id);
const totals = () => cart.reduce((sum, item) => {
  const product = catalog.find(p => p.id === item.id);
  if (!product) return sum;
  const rate = item.period === 'weekly' ? product.weekly : product.daily;
  const activation = product.activationFee || 0;
  return sum + (activation * item.quantity) + (rate * item.quantity * item.duration);
}, 0);
function persist(){ localStorage.setItem('baks-cart', JSON.stringify(cart)); renderQuote(); renderProducts(); }
function updateCart(id, change, period, duration) { const item = getCartItem(id); if (!item && change > 0) cart.push({ id, quantity: 1, period: period || 'daily', duration: Number(duration) || 1 }); else if (item) { item.quantity += change; if (period) item.period = period; if (duration) item.duration = Math.max(1, Number(duration) || 1); if (item.quantity <= 0) cart = cart.filter(row => row.id !== id); } persist(); }
function renderProducts(){ const products = getModeCatalog(); const byCategory = activeCategory === 'all' ? products : products.filter(product => product.category === activeCategory); const view = byCategory.filter(matchesFilters); const container = document.querySelector('#product-grid'); container.innerHTML = view.map(product => { const item = getCartItem(product.id); const quantity = item?.quantity || 1; const period = item?.period || 'daily'; const duration = item?.duration || 1; return `<article class="product-card" data-product-id="${safe(product.id)}"><div class="product-visual">${product.images[0] ? `<img src="${safe(product.images[0])}" alt="${safe(product.name)}" />` : ''}<span class="product-category">${safe(product.categoryLabel)}</span><span class="product-mark">B</span></div><div class="product-info"><h3>${safe(product.name)}</h3><p>${safe(product.description || 'Equipo de alquiler para producción.')}</p><div class="price">${priceText(product)}</div><div class="desktop-product-controls"><div><span>Cantidad</span><div class="controls"><button data-product-minus data-id="${safe(product.id)}">−</button><b>${quantity}</b><button data-product-plus data-id="${safe(product.id)}">+</button></div></div><label><span>Alquiler</span><div class="rental-picker"><input min="1" value="${duration}" type="number" data-product-duration data-id="${safe(product.id)}"><select data-product-period data-id="${safe(product.id)}"><option value="daily" ${period === 'daily' ? 'selected' : ''}>día(s)</option><option value="weekly" ${period === 'weekly' ? 'selected' : ''}>semana(s)</option></select></div></label></div><button class="button button-dark add-product" data-id="${safe(product.id)}">${item ? 'Ver mi cotización' : 'Agregar a cotización'}</button></div></article>`; }).join('') || '<p class="empty">No hay productos en esta categoría todavía.</p>';
  container.querySelectorAll('[data-product-plus]').forEach(button => button.addEventListener('click', () => updateCart(button.dataset.id, 1))); container.querySelectorAll('[data-product-minus]').forEach(button => button.addEventListener('click', () => { if (getCartItem(button.dataset.id)) updateCart(button.dataset.id, -1); })); container.querySelectorAll('[data-product-period]').forEach(select => select.addEventListener('change', () => updateCart(select.dataset.id, 0, select.value))); container.querySelectorAll('[data-product-duration]').forEach(input => input.addEventListener('change', () => updateCart(input.dataset.id, 0, null, input.value))); container.querySelectorAll('.product-visual img').forEach(image => image.addEventListener('click', () => openImageModal(image.src))); container.querySelectorAll('.add-product').forEach(button => button.addEventListener('click', () => { if (!getCartItem(button.dataset.id)) updateCart(button.dataset.id, 1); openQuote(); })); }
function renderTabs(){ const modeProducts = getModeCatalog(); if (!modeProducts.length) { document.querySelector('#category-tabs').innerHTML = '<p class="empty">Próximamente: este catálogo estará disponible.</p>'; return; } const categoryOrder = catalogModes[activeCatalogMode]?.categories || []; const groups = categoryOrder
    .filter(categoryId => modeProducts.some(product => product.category === categoryId))
    .map(categoryId => [categoryId, catalog.find(product => product.category === categoryId)?.categoryLabel || categoryId]); const tabs = [['all','Todo'], ...groups]; const filters = activeCatalogMode === 'vestuario' ? `
      <div class="catalog-filters">
        <label><span>Género</span><select data-filter="genero"><option value="all">Todos</option>${getFilterOptions(modeProducts, 'gender').map(value => `<option value="${safe(value)}" ${activeFilters.genero === value ? 'selected' : ''}>${safe(value)}</option>`).join('')}</select></label>
        <label><span>Tipo</span><select data-filter="tipo"><option value="all">Todos</option>${getFilterOptions(modeProducts, 'type').map(value => `<option value="${safe(value)}" ${activeFilters.tipo === value ? 'selected' : ''}>${safe(value)}</option>`).join('')}</select></label>
        <label><span>Talla</span><select data-filter="talla"><option value="all">Todas</option>${getFilterOptions(modeProducts, 'size').map(value => `<option value="${safe(value)}" ${activeFilters.talla === value ? 'selected' : ''}>${safe(value)}</option>`).join('')}</select></label>
        <label><span>Color</span><select data-filter="color"><option value="all">Todos</option>${getFilterOptions(modeProducts, 'color').map(value => `<option value="${safe(value)}" ${activeFilters.color === value ? 'selected' : ''}>${safe(value)}</option>`).join('')}</select></label>
      </div>
    ` : ''; document.querySelector('#category-tabs').innerHTML = `${tabs.map(([id,label]) => `<button class="${activeCategory === id ? 'active' : ''}" data-category="${id}">${formatCategoryLabel(label)}</button>`).join('')}${filters}`; document.querySelectorAll('[data-category]').forEach(button => button.addEventListener('click', () => { activeCategory = button.dataset.category; renderTabs(); renderProducts(); })); document.querySelectorAll('[data-filter]').forEach(select => select.addEventListener('change', () => { const key = select.dataset.filter; activeFilters[key] = normalizeFilterValue(select.value); renderProducts(); })); }
function renderQuote(){ document.querySelector('#cart-count').textContent = cart.reduce((count,item) => count + item.quantity, 0); const groups = new Map(); cart.forEach(item => { const product = catalog.find(p => p.id === item.id); if (!product) return; if (!groups.has(product.category)) groups.set(product.category, { label: product.categoryLabel, products: [] }); groups.get(product.category).products.push({ product, item }); }); const content = document.querySelector('#quote-items'); if (!cart.length) content.innerHTML = '<p class="empty">Tu cotización está vacía.<br>Agrega productos desde el catálogo.</p>'; else content.innerHTML = [...groups.values()].map((group, index) => { const subtotal = group.products.reduce((n, {product,item}) => { const rate = item.period === 'weekly' ? product.weekly : product.daily; const activation = product.activationFee || 0; return n + (activation * item.quantity) + (rate * item.quantity * item.duration); }, 0); return `<details class="quote-group" ${index === 0 ? 'open' : ''}><summary>${safe(group.label)} <span>${group.products.reduce((n,row)=>n+row.item.quantity,0)} artículos · ${money.format(subtotal)}</span></summary>${group.products.map(({product,item}) => { const rate = item.period === 'weekly' ? product.weekly : product.daily; const activation = product.activationFee || 0; const lineTotal = (activation * item.quantity) + (rate * item.quantity * item.duration); return `<div class="quote-row"><div><h4>${safe(product.name)}</h4><p class="row-price">${activation ? `${money.format(activation)} activación + ` : ''}${rate ? `${money.format(rate)} × ${item.quantity} × ${item.duration} ${item.period === 'weekly' ? 'sem.' : 'día(s)'} = ${money.format(lineTotal)}` : 'Valor a confirmar'}</p><div class="controls"><button aria-label="Restar" data-action="minus" data-id="${safe(product.id)}">−</button><b>${item.quantity}</b><button aria-label="Sumar" data-action="plus" data-id="${safe(product.id)}">+</button><input min="1" value="${item.duration}" type="number" data-duration data-id="${safe(product.id)}"><select data-period data-id="${safe(product.id)}"><option value="daily" ${item.period === 'daily' ? 'selected' : ''}>día(s)</option><option value="weekly" ${item.period === 'weekly' ? 'selected' : ''}>semana(s)</option></select></div></div></div>`; }).join('')}</details>`; }).join(''); document.querySelector('#quote-total').textContent = money.format(totals()); content.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => updateCart(button.dataset.id, button.dataset.action === 'plus' ? 1 : -1))); content.querySelectorAll('[data-period]').forEach(select => select.addEventListener('change', () => updateCart(select.dataset.id, 0, select.value))); content.querySelectorAll('[data-duration]').forEach(input => input.addEventListener('change', () => updateCart(input.dataset.id, 0, null, input.value))); }
function openQuote(){ drawer.classList.add('open'); overlay.classList.add('show'); } function closeQuote(){ drawer.classList.remove('open'); overlay.classList.remove('show'); }
document.querySelectorAll('[data-open-quote]').forEach(button => button.addEventListener('click', openQuote)); document.querySelector('[data-close-quote]').addEventListener('click', closeQuote); overlay.addEventListener('click', closeQuote); document.querySelector('#open-form').addEventListener('click', () => { if (!cart.length) return; quoteDialog.showModal(); }); document.querySelector('.modal-close').addEventListener('click', () => quoteDialog.close());
document.querySelectorAll('[data-catalog-mode]').forEach(button => button.addEventListener('click', () => {
  activeCatalogMode = button.dataset.catalogMode;
  activeCategory = 'all';
  renderCatalogModeButtons();
  renderTabs();
  renderProducts();
}));
document.querySelector('#quote-form').addEventListener('submit', async event => { event.preventDefault(); const form = event.currentTarget; const status = document.querySelector('#form-status'); const payload = { customer: Object.fromEntries(new FormData(form)), items: cart.map(item => ({ ...item, product: catalog.find(product => product.id === item.id) })), total: totals() }; status.textContent = 'Enviando solicitud…'; try { const response = await fetch('/.netlify/functions/send-quote', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) }); if (!response.ok) throw new Error(); cart = []; persist(); form.reset(); status.textContent = 'Solicitud enviada. Revisa tu correo para ver el resumen.'; } catch { status.textContent = 'No pudimos enviar la solicitud. Intenta de nuevo o contáctanos directamente.'; } });
const heroImages = ['assets/hero-production-basecamp.png', 'assets/production-studio-support.png'];
const hero = document.querySelector('.hero-image');
const previousHero = Number(sessionStorage.getItem('baks-last-hero'));
const heroIndex = Number.isInteger(previousHero) && previousHero >= 0 && previousHero < heroImages.length ? (previousHero + 1 + Math.floor(Math.random() * (heroImages.length - 1))) % heroImages.length : Math.floor(Math.random() * heroImages.length);
sessionStorage.setItem('baks-last-hero', heroIndex);
const selectedHero = heroImages[heroIndex];
hero.style.backgroundImage = `linear-gradient(125deg, #0008, #0002), url('${selectedHero}')`;
catalog = globalThis.BAKS_CATALOG || []; renderCatalogModeButtons(); renderTabs(); renderProducts(); renderQuote();
