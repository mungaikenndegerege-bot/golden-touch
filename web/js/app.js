/* =====================================================================
   Golden Touch — Beauty & Jewellery Shop
   Frontend Application Logic
   ===================================================================== */

'use strict';

// ── State ──────────────────────────────────────────────────────────────
let products   = [];
let sales      = [];
let customers  = [];
let suppliers  = [];
let stockList  = [];
let expenses   = [];
let staffList  = [];
let constants  = { categories: [], expenseCategories: [], paymentMethods: [] };
let settings   = { mpesaNumber: '0723432205', shopName: 'Golden Touch' };

let cart       = [];          // POS cart items
let posPayment = 'Cash';      // currently selected payment method
let pendingSaleData = null;   // holds sale payload while mpesa modal is open

// ── Init ───────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setupNav();
  setupTheme();
  populateReportSelectors();
  loadConstants().then(() => {
    loadAll();
  });
});

async function loadAll() {
  await Promise.all([
    loadSettings(),
    loadProducts(),
    loadSales(),
    loadCustomers(),
    loadSuppliers(),
    loadStock(),
    loadExpenses(),
    loadStaff(),
  ]);
  loadDashboard();
}

// ── Navigation ─────────────────────────────────────────────────────────
function setupNav() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
      // Refresh data for current tab
      const tab = btn.dataset.tab;
      if (tab === 'dashboard') loadDashboard();
      if (tab === 'pos')       renderPosGrid();
      if (tab === 'sales')     renderSales();
      if (tab === 'products')  renderProducts();
      if (tab === 'stock')     renderStock();
      if (tab === 'customers') renderCustomers();
      if (tab === 'suppliers') renderSuppliers();
      if (tab === 'expenses')  renderExpenses();
      if (tab === 'staff')     renderStaff();
    });
  });
}

// ── Theme Toggle ───────────────────────────────────────────────────────
function setupTheme() {
  const icon = document.getElementById('theme-icon');
  const saved = localStorage.getItem('gt-theme');
  if (saved === 'light') { document.body.classList.add('light'); icon.textContent = '☀️'; }
  document.getElementById('theme-toggle').addEventListener('click', () => {
    const isLight = document.body.classList.toggle('light');
    icon.textContent = isLight ? '☀️' : '🌙';
    localStorage.setItem('gt-theme', isLight ? 'light' : 'dark');
  });
}

// ── API helpers ────────────────────────────────────────────────────────
async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || res.statusText);
  }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}

// ── Formatters ─────────────────────────────────────────────────────────
const fmt = n => 'KSh ' + Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);
const nowTime = () => new Date().toTimeString().slice(0, 5);

// ── Toast ──────────────────────────────────────────────────────────────
let _toastTimer;
function showToast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show ' + type;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

// ── Modals ─────────────────────────────────────────────────────────────
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// Close on backdrop click
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
  }
});

// ── CONSTANTS ──────────────────────────────────────────────────────────
async function loadConstants() {
  try {
    constants = await api('GET', '/api/constants');
    // Populate category selects
    const catSels = ['pm-category', 'pos-cat-filter', 'product-cat-filter'];
    catSels.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const hasAll = id.includes('filter');
      el.innerHTML = hasAll ? '<option value="">All Categories</option>' : '';
      constants.categories.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c; opt.textContent = c;
        el.appendChild(opt);
      });
    });
    // Expense categories
    const exCat = document.getElementById('ex-category');
    if (exCat) {
      exCat.innerHTML = '';
      constants.expenseCategories.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c; opt.textContent = c;
        exCat.appendChild(opt);
      });
    }
  } catch (e) { console.error('loadConstants', e); }
}

// ── SETTINGS ───────────────────────────────────────────────────────────
async function loadSettings() {
  try {
    settings = await api('GET', '/api/settings');
    document.getElementById('set-name').value  = settings.shopName    || 'Golden Touch';
    document.getElementById('set-mpesa').value = settings.mpesaNumber || '0723432205';
    document.querySelector('.logo-text').textContent = settings.shopName || 'Golden Touch';
    document.title = (settings.shopName || 'Golden Touch') + ' — Beauty & Jewellery';
  } catch (e) { console.error('loadSettings', e); }
}

async function saveSettings(e) {
  e.preventDefault();
  try {
    await api('PUT', '/api/settings', {
      shopName:    document.getElementById('set-name').value.trim(),
      mpesaNumber: document.getElementById('set-mpesa').value.trim(),
    });
    await loadSettings();
    showToast('Settings saved', 'success');
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

// ── DASHBOARD ──────────────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const d = await api('GET', '/api/dashboard');

    document.getElementById('d-today-rev').textContent   = fmt(d.todayRevenue);
    document.getElementById('d-today-sales').textContent = d.todaySales;
    document.getElementById('d-month-rev').textContent   = fmt(d.monthRevenue);
    document.getElementById('d-gross').textContent       = fmt(d.monthGrossProfit);
    document.getElementById('d-expenses').textContent    = fmt(d.monthExpenses + d.monthPayroll);

    const netEl = document.getElementById('d-net');
    netEl.textContent = fmt(d.monthNet);
    netEl.className = 'stat-value ' + (d.monthNet >= 0 ? 'pos' : 'neg');
    document.getElementById('d-net-card').className = 'stat-card ' + (d.monthNet >= 0 ? 'green' : 'red');

    // Breakdown
    document.getElementById('db-revenue').textContent  = fmt(d.monthRevenue);
    document.getElementById('db-cogs').textContent     = fmt(d.monthCogs);
    document.getElementById('db-gross').textContent    = fmt(d.monthGrossProfit);
    document.getElementById('db-expenses').textContent = fmt(d.monthExpenses);
    document.getElementById('db-payroll').textContent  = fmt(d.monthPayroll);
    document.getElementById('db-pending').textContent  = fmt(d.monthPendingPayroll);
    document.getElementById('db-net').textContent      = fmt(d.monthNet);

    // Payroll notice
    const notice = document.getElementById('payroll-notice');
    const noticeText = document.getElementById('payroll-notice-text');
    if (d.monthPendingPayroll > 0) {
      noticeText.textContent = `⚠️ Pending payroll not yet authorised: ${fmt(d.monthPendingPayroll)}`;
      notice.style.display = 'flex';
      document.getElementById('pr-month').value = d.currentMonth;
      document.getElementById('payroll-modal-desc').textContent =
        `Authorise payroll of ${fmt(d.monthPendingPayroll)} for ${d.currentMonth}?`;
    } else {
      notice.style.display = 'none';
    }

    // Low stock
    const ls = document.getElementById('low-stock-list');
    if (!d.lowStock || d.lowStock.length === 0) {
      ls.innerHTML = '<p class="muted">✅ All products are well-stocked.</p>';
    } else {
      ls.innerHTML = d.lowStock.map(p => `
        <div class="alert-item">
          <span class="alert-icon">${p.stockQty === 0 ? '🚫' : '⚠️'}</span>
          <div>
            <strong>${esc(p.name)}</strong>
            <span style="color:var(--text-secondary)"> — ${esc(p.category)}</span><br>
            <span style="font-size:.8rem;color:${p.stockQty === 0 ? 'var(--red)' : 'var(--amber)'}">
              Stock: ${p.stockQty} (alert at ≤${p.lowStockThreshold})
            </span>
          </div>
        </div>
      `).join('');
    }

    // Top products
    const tp = document.getElementById('top-products-list');
    const medals = ['🥇','🥈','🥉','4️⃣','5️⃣'];
    if (!d.topProducts || d.topProducts.length === 0) {
      tp.innerHTML = '<p class="muted">No sales recorded this month.</p>';
    } else {
      tp.innerHTML = d.topProducts.map((p, i) => `
        <div class="top-product-row">
          <span class="top-product-rank">${medals[i] || (i+1)}</span>
          <div class="top-product-info">
            <div class="top-product-name">${esc(p.name)}</div>
            <div class="top-product-qty">${p.qtySold} units sold</div>
          </div>
          <span class="top-product-rev">${fmt(p.revenue)}</span>
        </div>
      `).join('');
    }
  } catch (e) { console.error('loadDashboard', e); }
}

// ── PRODUCTS ───────────────────────────────────────────────────────────
async function loadProducts() {
  try { products = await api('GET', '/api/products'); } catch (e) { products = []; }
  renderProducts();
}

function renderProducts() {
  const catFilter = document.getElementById('product-cat-filter')?.value || '';
  const tbody = document.getElementById('products-tbody');
  if (!tbody) return;

  let list = products;
  if (catFilter) list = list.filter(p => p.category === catFilter);

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty-state">No products found. Add your first product!</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(p => {
    const stockBadge = p.stockQty === 0
      ? '<span class="badge badge-danger">Out of Stock</span>'
      : p.stockQty <= p.lowStockThreshold
        ? `<span class="badge badge-warn">Low: ${p.stockQty}</span>`
        : `<span class="badge badge-ok">${p.stockQty}</span>`;
    const statusBadge = p.active
      ? '<span class="badge badge-ok">Active</span>'
      : '<span class="badge badge-void">Inactive</span>';
    const margin = p.sellingPrice > 0
      ? Math.round(((p.sellingPrice - p.costPrice) / p.sellingPrice) * 100)
      : 0;
    return `<tr>
      <td><strong>${esc(p.name)}</strong>${p.brand ? `<br><small style="color:var(--text-secondary)">${esc(p.brand)}</small>` : ''}</td>
      <td><span class="badge badge-pink">${esc(p.category)}</span></td>
      <td>${esc(p.brand)}</td>
      <td style="color:var(--text-secondary);font-size:.82rem">${esc(p.sku)}</td>
      <td class="money">${fmt(p.costPrice)}</td>
      <td class="money">${fmt(p.sellingPrice)} <small style="color:var(--text-muted)">${margin}%</small></td>
      <td>${stockBadge}</td>
      <td>${statusBadge}</td>
      <td>
        <button class="btn-icon btn-edit" onclick="editProduct(${p.id})" title="Edit">✏️</button>
        <button class="btn-icon" onclick="confirmDelete('Delete product \"${esc(p.name)}\"?', () => deleteProduct(${p.id}))" title="Delete">🗑️</button>
      </td>
    </tr>`;
  }).join('');
}

function openAddProduct() {
  document.getElementById('product-modal-title').textContent = 'Add Product';
  document.getElementById('pm-id').value    = '0';
  document.getElementById('pm-name').value  = '';
  document.getElementById('pm-brand').value = '';
  document.getElementById('pm-sku').value   = '';
  document.getElementById('pm-desc').value  = '';
  document.getElementById('pm-cost').value  = '';
  document.getElementById('pm-price').value = '';
  document.getElementById('pm-stock').value = '0';
  document.getElementById('pm-lowstock').value = '5';
  openModal('product-modal');
}

function editProduct(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  document.getElementById('product-modal-title').textContent = 'Edit Product';
  document.getElementById('pm-id').value       = p.id;
  document.getElementById('pm-name').value     = p.name;
  document.getElementById('pm-category').value = p.category;
  document.getElementById('pm-brand').value    = p.brand || '';
  document.getElementById('pm-sku').value      = p.sku   || '';
  document.getElementById('pm-desc').value     = p.description || '';
  document.getElementById('pm-cost').value     = p.costPrice;
  document.getElementById('pm-price').value    = p.sellingPrice;
  document.getElementById('pm-stock').value    = p.stockQty;
  document.getElementById('pm-lowstock').value = p.lowStockThreshold;
  openModal('product-modal');
}

async function submitProduct(e) {
  e.preventDefault();
  const id = parseInt(document.getElementById('pm-id').value);
  const payload = {
    name:              document.getElementById('pm-name').value.trim(),
    category:          document.getElementById('pm-category').value,
    brand:             document.getElementById('pm-brand').value.trim(),
    sku:               document.getElementById('pm-sku').value.trim(),
    description:       document.getElementById('pm-desc').value.trim(),
    costPrice:         parseFloat(document.getElementById('pm-cost').value)  || 0,
    sellingPrice:      parseFloat(document.getElementById('pm-price').value) || 0,
    stockQty:          parseInt(document.getElementById('pm-stock').value)   || 0,
    lowStockThreshold: parseInt(document.getElementById('pm-lowstock').value)|| 5,
  };
  try {
    if (id === 0) {
      await api('POST', '/api/products', payload);
      showToast('Product added', 'success');
    } else {
      await api('PUT', '/api/products/' + id, payload);
      showToast('Product updated', 'success');
    }
    closeModal('product-modal');
    await loadProducts();
    renderPosGrid();
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

async function deleteProduct(id) {
  try {
    await api('DELETE', '/api/products/' + id);
    showToast('Product deleted');
    await loadProducts();
    renderPosGrid();
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

// ── POS ────────────────────────────────────────────────────────────────
function renderPosGrid() {
  const search = (document.getElementById('pos-search')?.value || '').toLowerCase();
  const cat    = document.getElementById('pos-cat-filter')?.value || '';
  const grid   = document.getElementById('pos-product-grid');
  if (!grid) return;

  // Populate customer dropdown
  const cusSel = document.getElementById('pos-customer');
  if (cusSel) {
    cusSel.innerHTML = '<option value="0">Walk-in Customer</option>';
    customers.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id; opt.textContent = c.name + (c.phone ? ` (${c.phone})` : '');
      cusSel.appendChild(opt);
    });
  }

  let list = products.filter(p => p.active);
  if (cat)    list = list.filter(p => p.category === cat);
  if (search) list = list.filter(p =>
    p.name.toLowerCase().includes(search) ||
    (p.brand||'').toLowerCase().includes(search) ||
    p.category.toLowerCase().includes(search));

  if (list.length === 0) {
    grid.innerHTML = '<p class="muted">No products match your search.</p>';
    return;
  }

  grid.innerHTML = list.map(p => {
    const oos = p.stockQty === 0;
    const low = !oos && p.stockQty <= p.lowStockThreshold;
    return `<div class="pos-product-card${oos ? ' out-of-stock' : ''}"
               onclick="${oos ? '' : `addToCart(${p.id})`}"
               title="${oos ? 'Out of stock' : 'Click to add to cart'}">
      <div class="pos-card-category">${esc(p.category)}</div>
      <div class="pos-card-name">${esc(p.name)}</div>
      ${p.brand ? `<div style="font-size:.75rem;color:var(--text-secondary)">${esc(p.brand)}</div>` : ''}
      <div class="pos-card-price">${fmt(p.sellingPrice)}</div>
      <div class="pos-card-stock ${oos ? 'none' : low ? 'low' : ''}">
        ${oos ? '🚫 Out of stock' : low ? `⚠️ Only ${p.stockQty} left` : `${p.stockQty} in stock`}
      </div>
    </div>`;
  }).join('');
}

function filterPosProducts() { renderPosGrid(); }

function addToCart(productId) {
  const p = products.find(x => x.id === productId);
  if (!p || p.stockQty === 0) return;
  const existing = cart.find(i => i.productId === productId);
  if (existing) {
    if (existing.qty >= p.stockQty) {
      showToast(`Only ${p.stockQty} in stock`, 'error'); return;
    }
    existing.qty++;
  } else {
    cart.push({ productId, productName: p.name, qty: 1, unitPrice: p.sellingPrice });
  }
  renderCart();
}

function renderCart() {
  const el = document.getElementById('pos-cart-items');
  if (!el) return;
  if (cart.length === 0) {
    el.innerHTML = '<p class="muted" style="text-align:center;padding:20px 0">Cart is empty</p>';
    updateCartTotals();
    return;
  }
  el.innerHTML = cart.map((item, idx) => {
    const p = products.find(x => x.id === item.productId);
    return `<div class="cart-item">
      <div style="flex:1">
        <div class="cart-item-name">${esc(item.productName)}</div>
        <div class="cart-item-price">${fmt(item.unitPrice)} each</div>
      </div>
      <div class="cart-qty-ctrl">
        <button class="cart-qty-btn" onclick="changeCartQty(${idx}, -1)">−</button>
        <span class="cart-qty-val">${item.qty}</span>
        <button class="cart-qty-btn" onclick="changeCartQty(${idx}, 1)">+</button>
      </div>
      <span style="min-width:80px;text-align:right;font-weight:700;color:var(--gold);font-size:.9rem">${fmt(item.qty * item.unitPrice)}</span>
      <button class="cart-item-remove" onclick="removeFromCart(${idx})">✕</button>
    </div>`;
  }).join('');
  updateCartTotals();
}

function changeCartQty(idx, delta) {
  const item = cart[idx];
  if (!item) return;
  const p = products.find(x => x.id === item.productId);
  const newQty = item.qty + delta;
  if (newQty <= 0) { removeFromCart(idx); return; }
  if (p && newQty > p.stockQty) { showToast(`Only ${p.stockQty} in stock`, 'error'); return; }
  item.qty = newQty;
  renderCart();
}

function removeFromCart(idx) {
  cart.splice(idx, 1);
  renderCart();
}

function clearCart() {
  cart = [];
  renderCart();
  document.getElementById('cart-discount').value = '0';
  selectPayment('Cash');
}

function updateCartTotals() {
  const subtotal = cart.reduce((s, i) => s + i.qty * i.unitPrice, 0);
  const discount = parseFloat(document.getElementById('cart-discount')?.value) || 0;
  const total    = Math.max(0, subtotal - discount);
  document.getElementById('cart-subtotal').textContent = fmt(subtotal);
  document.getElementById('cart-total').textContent    = fmt(total);
}

function selectPayment(method) {
  posPayment = method;
  document.querySelectorAll('.pay-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.method === method);
  });
}

async function checkoutSale() {
  if (cart.length === 0) { showToast('Cart is empty', 'error'); return; }

  const custSel = document.getElementById('pos-customer');
  const custId  = parseInt(custSel?.value) || 0;
  const custName = custSel?.options[custSel.selectedIndex]?.textContent.split(' (')[0] || 'Walk-in';
  const discount = parseFloat(document.getElementById('cart-discount')?.value) || 0;
  const subtotal = cart.reduce((s, i) => s + i.qty * i.unitPrice, 0);
  const total    = Math.max(0, subtotal - discount);

  const salePayload = {
    date:          today(),
    time:          nowTime(),
    customerId:    custId,
    customerName:  custId > 0 ? custName : 'Walk-in',
    discount,
    paymentMethod: posPayment,
    mpesaCode:     '',
    mpesaPhone:    '',
    notes:         '',
    items: cart.map(i => ({
      productId:   i.productId,
      productName: i.productName,
      qty:         i.qty,
      unitPrice:   i.unitPrice,
    })),
  };

  // If MPesa → show prompt modal
  if (posPayment === 'MPesa') {
    pendingSaleData = salePayload;
    document.getElementById('mpesa-display-number').textContent = settings.mpesaNumber || '0723432205';
    document.getElementById('mpesa-display-amount').textContent = fmt(total);
    document.getElementById('mpesa-code').value  = '';
    document.getElementById('mpesa-phone').value = '';
    openModal('mpesa-modal');
    return;
  }

  await finaliseSale(salePayload);
}

async function confirmMpesa(e) {
  e.preventDefault();
  if (!pendingSaleData) return;
  pendingSaleData.mpesaCode  = document.getElementById('mpesa-code').value.trim().toUpperCase();
  pendingSaleData.mpesaPhone = document.getElementById('mpesa-phone').value.trim();
  closeModal('mpesa-modal');
  await finaliseSale(pendingSaleData);
  pendingSaleData = null;
}

async function finaliseSale(payload) {
  try {
    const saleId = await api('POST', '/api/sales', payload);
    showToast('Sale completed! 🎉', 'success');
    clearCart();
    await loadProducts();
    await loadSales();
    renderPosGrid();
    // Auto-show receipt for printing immediately after sale
    const savedSale = sales.find(s => s.id === parseInt(saleId));
    if (savedSale) showReceiptModal(savedSale);
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

// ── SALES ──────────────────────────────────────────────────────────────
async function loadSales() {
  try { sales = await api('GET', '/api/sales'); } catch (e) { sales = []; }
  renderSales();
}

function renderSales() {
  const tbody = document.getElementById('sales-tbody');
  if (!tbody) return;
  const dateFilter = document.getElementById('sales-filter-date')?.value || '';
  let list = [...sales].reverse();
  if (dateFilter) list = list.filter(s => s.date === dateFilter);

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty-state">No sales found.</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(s => {
    const badge = s.voided
      ? '<span class="badge badge-void">Voided</span>'
      : '<span class="badge badge-ok">Completed</span>';
    const payBadge = s.paymentMethod === 'MPesa'
      ? '<span class="badge badge-pink">📱 M-Pesa</span>'
      : s.paymentMethod === 'Card'
        ? '<span class="badge badge-warn">💳 Card</span>'
        : '<span style="color:var(--text-secondary);font-size:.85rem">💵 Cash</span>';
    return `<tr class="${s.voided ? 'voided-row' : ''}">
      <td style="font-variant-numeric:tabular-nums;color:var(--text-secondary)">#${s.id}</td>
      <td>${s.date}</td>
      <td style="color:var(--text-secondary)">${s.time || '—'}</td>
      <td>${esc(s.customerName)}</td>
      <td style="color:var(--text-secondary)">${s.items ? s.items.length : 0} item(s)</td>
      <td>${payBadge}${s.mpesaCode ? `<br><small style="color:var(--text-secondary)">${esc(s.mpesaCode)}</small>` : ''}</td>
      <td class="money ${s.voided ? '' : 'pos'}" style="${s.voided ? 'text-decoration:line-through;color:var(--text-secondary)' : ''}">${fmt(s.total)}</td>
      <td>${badge}</td>
      <td>
        <button class="btn-icon" onclick="viewSaleDetail(${s.id})" title="View receipt">👁️</button>
        <button class="btn-icon" onclick="showReceiptModal(sales.find(x=>x.id===${s.id}))" title="Print receipt">🖨️</button>
        ${!s.voided ? `<button class="btn-icon" onclick="confirmDelete('Void sale #${s.id}?', () => voidSale(${s.id}))" title="Void sale">🚫</button>` : ''}
      </td>
    </tr>`;
  }).join('');
}

function viewSaleDetail(id) {
  const s = sales.find(x => x.id === id);
  if (!s) return;
  showReceiptModal(s);
}

// ── RECEIPT ────────────────────────────────────────────────────────────

function buildReceiptHTML(s) {
  const shopName = settings.shopName || 'Golden Touch';
  const mpesa    = settings.mpesaNumber || '0723432205';
  const now      = new Date();
  const printedAt = now.toLocaleDateString('en-KE', { day:'2-digit', month:'short', year:'numeric' })
                  + ' ' + now.toTimeString().slice(0, 5);

  const itemRows = (s.items || []).map(i => `
    <tr>
      <td class="r-name">${esc(i.productName)}</td>
      <td class="r-qty">${i.qty}</td>
      <td class="r-price">${fmtR(i.unitPrice)}</td>
      <td class="r-total">${fmtR(i.lineTotal)}</td>
    </tr>`).join('');

  const payLine = s.paymentMethod === 'MPesa'
    ? 'M-Pesa'
    : esc(s.paymentMethod);

  return `
    <div class="receipt-wrap">
      <!-- Shop header -->
      <div class="r-header">
        <div class="r-shop-name">${esc(shopName)}</div>
        <div class="r-tagline">Beauty &amp; Jewellery</div>
        <div class="r-contact">📱 ${esc(mpesa)}</div>
        <div class="r-divider">════════════════════════</div>
      </div>

      <!-- Receipt meta -->
      <div class="r-meta">
        <div><span class="r-label">Receipt #</span><span class="r-val">${s.id}</span></div>
        <div><span class="r-label">Date</span><span class="r-val">${s.date} ${s.time || ''}</span></div>
        <div><span class="r-label">Customer</span><span class="r-val">${esc(s.customerName)}</span></div>
        <div><span class="r-label">Payment</span><span class="r-val">${payLine}</span></div>
        ${s.voided ? '<div class="r-voided">⚠ VOIDED ⚠</div>' : ''}
      </div>

      <div class="r-divider">- - - - - - - - - - - - - - - - - -</div>

      <!-- Items table -->
      <table class="r-items">
        <thead>
          <tr>
            <th class="r-name">Item</th>
            <th class="r-qty">Qty</th>
            <th class="r-price">Price</th>
            <th class="r-total">Total</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>

      <div class="r-divider">- - - - - - - - - - - - - - - - - -</div>

      <!-- Totals -->
      <div class="r-totals">
        <div class="r-tot-row"><span>Subtotal</span><span>${fmtR(s.subtotal)}</span></div>
        ${s.discount > 0 ? `<div class="r-tot-row discount"><span>Discount</span><span>-${fmtR(s.discount)}</span></div>` : ''}
        <div class="r-tot-row grand"><span>TOTAL</span><span>${fmtR(s.total)}</span></div>
      </div>

      <div class="r-divider">════════════════════════</div>

      <!-- Footer -->
      <div class="r-footer">
        <p>We are glad to serve you! 💄✨</p>
        <p>Come back soon</p>
        <p class="r-printed">Printed: ${printedAt}</p>
      </div>
    </div>`;
}

/** Compact currency formatter for receipts — no 'KSh' prefix, right-aligned */
function fmtR(n) {
  return Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function showReceiptModal(s) {
  if (!s) return;
  document.getElementById('receipt-printable').innerHTML = buildReceiptHTML(s);
  openModal('receipt-modal');
}

function printReceipt() {
  window.print();
}

async function voidSale(id) {
  try {
    await api('PUT', '/api/sales/' + id + '/void');
    showToast('Sale voided — stock restored');
    await loadSales();
    await loadProducts();
    renderPosGrid();
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

// ── CUSTOMERS ──────────────────────────────────────────────────────────
async function loadCustomers() {
  try { customers = await api('GET', '/api/customers'); } catch (e) { customers = []; }
  renderCustomers();
}

function renderCustomers() {
  const tbody = document.getElementById('customers-tbody');
  if (!tbody) return;
  if (customers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No customers yet.</td></tr>`; return;
  }
  tbody.innerHTML = customers.map(c => `<tr>
    <td><strong>${esc(c.name)}</strong></td>
    <td>${esc(c.phone)}</td>
    <td style="color:var(--text-secondary)">${esc(c.email)}</td>
    <td style="color:var(--text-secondary)">${c.joinDate || '—'}</td>
    <td style="color:var(--text-secondary)">${esc(c.notes)}</td>
    <td>
      <button class="btn-icon btn-edit" onclick="editCustomer(${c.id})" title="Edit">✏️</button>
      <button class="btn-icon" onclick="confirmDelete('Delete customer \"${esc(c.name)}\"?', () => deleteCustomer(${c.id}))" title="Delete">🗑️</button>
    </td>
  </tr>`).join('');
}

function editCustomer(id) {
  const c = customers.find(x => x.id === id);
  if (!c) return;
  document.getElementById('cm-id').value    = c.id;
  document.getElementById('cm-name').value  = c.name;
  document.getElementById('cm-phone').value = c.phone  || '';
  document.getElementById('cm-email').value = c.email  || '';
  document.getElementById('cm-notes').value = c.notes  || '';
  openModal('customer-modal');
}

async function submitCustomer(e) {
  e.preventDefault();
  const id = parseInt(document.getElementById('cm-id').value);
  const payload = {
    name:  document.getElementById('cm-name').value.trim(),
    phone: document.getElementById('cm-phone').value.trim(),
    email: document.getElementById('cm-email').value.trim(),
    notes: document.getElementById('cm-notes').value.trim(),
  };
  try {
    if (id === 0) {
      await api('POST', '/api/customers', payload);
      showToast('Customer added', 'success');
    } else {
      await api('PUT', '/api/customers/' + id, payload);
      showToast('Customer updated', 'success');
    }
    closeModal('customer-modal');
    await loadCustomers();
    renderPosGrid(); // refresh customer dropdown in POS
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

async function deleteCustomer(id) {
  try {
    await api('DELETE', '/api/customers/' + id);
    showToast('Customer deleted');
    await loadCustomers();
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

// ── SUPPLIERS ──────────────────────────────────────────────────────────
async function loadSuppliers() {
  try { suppliers = await api('GET', '/api/suppliers'); } catch (e) { suppliers = []; }
  renderSuppliers();
}

function renderSuppliers() {
  const tbody = document.getElementById('suppliers-tbody');
  if (!tbody) return;
  if (suppliers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No suppliers yet.</td></tr>`; return;
  }
  tbody.innerHTML = suppliers.map(s => `<tr>
    <td><strong>${esc(s.name)}</strong></td>
    <td>${esc(s.phone)}</td>
    <td style="color:var(--text-secondary)">${esc(s.email)}</td>
    <td style="color:var(--text-secondary)">${esc(s.address)}</td>
    <td style="color:var(--text-secondary)">${esc(s.notes)}</td>
    <td>
      <button class="btn-icon btn-edit" onclick="editSupplier(${s.id})" title="Edit">✏️</button>
      <button class="btn-icon" onclick="confirmDelete('Delete supplier \"${esc(s.name)}\"?', () => deleteSupplier(${s.id}))" title="Delete">🗑️</button>
    </td>
  </tr>`).join('');
}

function editSupplier(id) {
  const s = suppliers.find(x => x.id === id);
  if (!s) return;
  document.getElementById('sm-id').value      = s.id;
  document.getElementById('sm-name').value    = s.name;
  document.getElementById('sm-phone').value   = s.phone   || '';
  document.getElementById('sm-email').value   = s.email   || '';
  document.getElementById('sm-address').value = s.address || '';
  document.getElementById('sm-notes').value   = s.notes   || '';
  openModal('supplier-modal');
}

async function submitSupplier(e) {
  e.preventDefault();
  const id = parseInt(document.getElementById('sm-id').value);
  const payload = {
    name:    document.getElementById('sm-name').value.trim(),
    phone:   document.getElementById('sm-phone').value.trim(),
    email:   document.getElementById('sm-email').value.trim(),
    address: document.getElementById('sm-address').value.trim(),
    notes:   document.getElementById('sm-notes').value.trim(),
  };
  try {
    if (id === 0) {
      await api('POST', '/api/suppliers', payload);
      showToast('Supplier added', 'success');
    } else {
      await api('PUT', '/api/suppliers/' + id, payload);
      showToast('Supplier updated', 'success');
    }
    closeModal('supplier-modal');
    await loadSuppliers();
    refreshStockSupplierDropdown();
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

async function deleteSupplier(id) {
  try {
    await api('DELETE', '/api/suppliers/' + id);
    showToast('Supplier deleted');
    await loadSuppliers();
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

// ── STOCK RECEIPTS ─────────────────────────────────────────────────────
async function loadStock() {
  try { stockList = await api('GET', '/api/stock'); } catch (e) { stockList = []; }
  renderStock();
}

function renderStock() {
  const tbody = document.getElementById('stock-tbody');
  if (!tbody) return;
  if (stockList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state">No stock receipts yet.</td></tr>`; return;
  }
  tbody.innerHTML = [...stockList].reverse().map(r => `<tr>
    <td>${r.date}</td>
    <td><strong>${esc(r.productName)}</strong></td>
    <td style="color:var(--text-secondary)">${esc(r.supplierName)}</td>
    <td>${r.qty}</td>
    <td class="money">${fmt(r.unitCost)}</td>
    <td class="money pos">${fmt(r.totalCost)}</td>
    <td style="color:var(--text-secondary);font-size:.82rem">${esc(r.invoiceRef)}</td>
    <td>
      <button class="btn-icon" onclick="confirmDelete('Delete this stock receipt?', () => deleteStock(${r.id}))" title="Delete">🗑️</button>
    </td>
  </tr>`).join('');
}

function openStockModal() {
  document.getElementById('stk-date').value = today();
  document.getElementById('stk-qty').value  = '1';
  document.getElementById('stk-cost').value = '';
  document.getElementById('stk-ref').value  = '';
  document.getElementById('stk-notes').value = '';
  refreshStockProductDropdown();
  refreshStockSupplierDropdown();
  openModal('stock-modal');
}

function refreshStockProductDropdown() {
  const sel = document.getElementById('stk-product');
  if (!sel) return;
  sel.innerHTML = '<option value="">-- Select Product --</option>';
  products.filter(p => p.active).forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name + (p.category ? ` [${p.category}]` : '') + ` — Stock: ${p.stockQty}`;
    sel.appendChild(opt);
  });
}

function refreshStockSupplierDropdown() {
  const sel = document.getElementById('stk-supplier');
  if (!sel) return;
  sel.innerHTML = '<option value="0">-- Select Supplier --</option>';
  suppliers.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id; opt.textContent = s.name;
    sel.appendChild(opt);
  });
}

async function submitStock(e) {
  e.preventDefault();
  const suppId   = parseInt(document.getElementById('stk-supplier').value) || 0;
  const suppName = suppId > 0
    ? (suppliers.find(s => s.id === suppId)?.name || '')
    : '';
  const payload = {
    date:         document.getElementById('stk-date').value,
    productId:    parseInt(document.getElementById('stk-product').value),
    supplierId:   suppId,
    supplierName: suppName,
    qty:          parseInt(document.getElementById('stk-qty').value) || 1,
    unitCost:     parseFloat(document.getElementById('stk-cost').value) || 0,
    invoiceRef:   document.getElementById('stk-ref').value.trim(),
    notes:        document.getElementById('stk-notes').value.trim(),
  };
  if (!payload.productId) { showToast('Please select a product', 'error'); return; }
  try {
    await api('POST', '/api/stock', payload);
    showToast('Stock receipt recorded', 'success');
    closeModal('stock-modal');
    await loadStock();
    await loadProducts();
    renderPosGrid();
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

async function deleteStock(id) {
  try {
    await api('DELETE', '/api/stock/' + id);
    showToast('Stock receipt deleted — stock adjusted');
    await loadStock();
    await loadProducts();
    renderPosGrid();
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

// ── EXPENSES ───────────────────────────────────────────────────────────
async function loadExpenses() {
  try { expenses = await api('GET', '/api/expenses'); } catch (e) { expenses = []; }
  renderExpenses();
}

function renderExpenses() {
  const tbody = document.getElementById('expenses-tbody');
  if (!tbody) return;
  if (expenses.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">No expenses recorded.</td></tr>`; return;
  }
  tbody.innerHTML = [...expenses].reverse().map(ex => `<tr>
    <td>${ex.date}</td>
    <td><span class="badge badge-warn">${esc(ex.category)}</span></td>
    <td>${esc(ex.description)}</td>
    <td style="color:var(--text-secondary)">${esc(ex.paidBy)}</td>
    <td style="color:var(--text-secondary);font-size:.82rem">${esc(ex.reference)}</td>
    <td class="money neg">${fmt(ex.amount)}</td>
    <td>
      <button class="btn-icon" onclick="confirmDelete('Delete this expense?', () => deleteExpense(${ex.id}))" title="Delete">🗑️</button>
    </td>
  </tr>`).join('');
}

function openExpenseModal() {
  document.getElementById('ex-date').value   = today();
  document.getElementById('ex-amount').value = '';
  document.getElementById('ex-desc').value   = '';
  document.getElementById('ex-ref').value    = '';
  openModal('expense-modal');
}

async function submitExpense(e) {
  e.preventDefault();
  const payload = {
    date:        document.getElementById('ex-date').value,
    category:    document.getElementById('ex-category').value,
    description: document.getElementById('ex-desc').value.trim(),
    amount:      parseFloat(document.getElementById('ex-amount').value) || 0,
    paidBy:      document.getElementById('ex-paidby').value,
    reference:   document.getElementById('ex-ref').value.trim(),
  };
  try {
    await api('POST', '/api/expenses', payload);
    showToast('Expense recorded', 'success');
    closeModal('expense-modal');
    await loadExpenses();
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

async function deleteExpense(id) {
  try {
    await api('DELETE', '/api/expenses/' + id);
    showToast('Expense deleted');
    await loadExpenses();
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

// ── STAFF ──────────────────────────────────────────────────────────────
async function loadStaff() {
  try { staffList = await api('GET', '/api/staff'); } catch (e) { staffList = []; }
  renderStaff();
}

function renderStaff() {
  const tbody = document.getElementById('staff-tbody');
  const footer = document.getElementById('staff-total');
  if (!tbody) return;

  const active = staffList.filter(s => s.active);
  const totalSalary = active.reduce((s, x) => s + x.monthlySalary, 0);

  if (staffList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">No staff members yet.</td></tr>`;
    if (footer) footer.textContent = '';
    return;
  }
  tbody.innerHTML = staffList.map(s => `<tr>
    <td><strong>${esc(s.name)}</strong></td>
    <td>${esc(s.role)}</td>
    <td>${esc(s.phone)}</td>
    <td style="color:var(--text-secondary)">${esc(s.idNumber)}</td>
    <td class="money">${fmt(s.monthlySalary)}</td>
    <td>${s.active ? '<span class="badge badge-ok">Active</span>' : '<span class="badge badge-void">Inactive</span>'}</td>
    <td>
      <button class="btn-icon btn-edit" onclick="editStaff(${s.id})" title="Edit">✏️</button>
      <button class="btn-icon" onclick="confirmDelete('Remove staff member \"${esc(s.name)}\"?', () => deleteStaff(${s.id}))" title="Delete">🗑️</button>
    </td>
  </tr>`).join('');

  if (footer) footer.textContent = `Total Monthly Payroll: ${fmt(totalSalary)}`;
}

function editStaff(id) {
  const s = staffList.find(x => x.id === id);
  if (!s) return;
  document.getElementById('sf-id').value      = s.id;
  document.getElementById('sf-name').value    = s.name;
  document.getElementById('sf-role').value    = s.role    || '';
  document.getElementById('sf-phone').value   = s.phone   || '';
  document.getElementById('sf-id-num').value  = s.idNumber|| '';
  document.getElementById('sf-salary').value  = s.monthlySalary;
  openModal('staff-modal');
}

async function submitStaff(e) {
  e.preventDefault();
  const id = parseInt(document.getElementById('sf-id').value);
  const payload = {
    name:          document.getElementById('sf-name').value.trim(),
    role:          document.getElementById('sf-role').value.trim(),
    phone:         document.getElementById('sf-phone').value.trim(),
    idNumber:      document.getElementById('sf-id-num').value.trim(),
    monthlySalary: parseFloat(document.getElementById('sf-salary').value) || 0,
    active:        true,
  };
  try {
    if (id === 0) {
      await api('POST', '/api/staff', payload);
      showToast('Staff member added', 'success');
    } else {
      await api('PUT', '/api/staff/' + id, payload);
      showToast('Staff updated', 'success');
    }
    closeModal('staff-modal');
    await loadStaff();
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

async function deleteStaff(id) {
  try {
    await api('DELETE', '/api/staff/' + id);
    showToast('Staff member removed');
    await loadStaff();
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

// ── PAYROLL ────────────────────────────────────────────────────────────
async function submitPayrollRun(e) {
  e.preventDefault();
  const payload = {
    month:        document.getElementById('pr-month').value,
    authorisedBy: document.getElementById('pr-auth').value.trim(),
  };
  try {
    await api('POST', '/api/payroll/run', payload);
    showToast('Payroll authorised ✅', 'success');
    closeModal('payroll-modal');
    loadDashboard();
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

// ── CONFIRM DELETE ─────────────────────────────────────────────────────
function confirmDelete(msg, onConfirm) {
  document.getElementById('confirm-msg').textContent = msg;
  const btn = document.getElementById('confirm-yes');
  const newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);
  newBtn.addEventListener('click', () => {
    closeModal('confirm-modal');
    onConfirm();
  });
  openModal('confirm-modal');
}

// ── REPORTS ────────────────────────────────────────────────────────────
function populateReportSelectors() {
  const months = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ];
  const mSel = document.getElementById('report-month');
  months.forEach((m, i) => {
    const opt = document.createElement('option');
    opt.value = i + 1; opt.textContent = m;
    mSel.appendChild(opt);
  });
  const now = new Date();
  mSel.value = now.getMonth() + 1;

  const ySel = document.getElementById('report-year');
  for (let y = now.getFullYear(); y >= now.getFullYear() - 4; y--) {
    const opt = document.createElement('option');
    opt.value = y; opt.textContent = y;
    ySel.appendChild(opt);
  }
}

let reportData = null;

async function loadReport() {
  const month = document.getElementById('report-month').value;
  const year  = document.getElementById('report-year').value;
  try {
    reportData = await api('GET', `/api/report?year=${year}&month=${month}`);
    renderReport(reportData);
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

function renderReport(d) {
  const monthNames = ['','January','February','March','April','May','June',
    'July','August','September','October','November','December'];
  const net = d.net;
  const el = document.getElementById('report-content');
  el.innerHTML = `
    <div class="report-section">
      <h3>📅 ${monthNames[d.month]} ${d.year} — Financial Summary</h3>
      <div class="summary-grid">
        <div class="summary-item highlight-gold"><div class="label">Total Revenue</div><div class="value">${fmt(d.revenue)}</div></div>
        <div class="summary-item"><div class="label">Cost of Goods</div><div class="value">${fmt(d.cogs)}</div></div>
        <div class="summary-item ${d.grossProfit >= 0 ? 'highlight' : 'highlight-neg'}"><div class="label">Gross Profit</div><div class="value">${fmt(d.grossProfit)}</div></div>
        <div class="summary-item"><div class="label">Operating Expenses</div><div class="value">${fmt(d.expenses)}</div></div>
        <div class="summary-item"><div class="label">Payroll</div><div class="value">${fmt(d.payroll)}</div></div>
        <div class="summary-item"><div class="label">Stock Purchased</div><div class="value">${fmt(d.stockCost)}</div></div>
        <div class="summary-item ${net >= 0 ? 'highlight' : 'highlight-neg'}">
          <div class="label">NET PROFIT / (LOSS)</div>
          <div class="value">${fmt(net)}</div>
        </div>
        <div class="summary-item"><div class="label">Sales Count</div><div class="value">${d.salesCount}</div></div>
      </div>
    </div>

    <div class="report-section">
      <h3>🧾 Sales (${d.sales.length})</h3>
      ${d.sales.length === 0 ? '<p class="muted">No sales this month.</p>' : `
      <div class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Date</th><th>Customer</th><th>Payment</th><th>Items</th><th class="money">Total</th><th>Status</th></tr></thead>
          <tbody>
            ${d.sales.map(s => `<tr>
              <td>#${s.id}</td>
              <td>${s.date}</td>
              <td>${esc(s.customerName)}</td>
              <td>${esc(s.paymentMethod)}${s.mpesaCode ? ` <small style="color:var(--text-secondary)">(${esc(s.mpesaCode)})</small>` : ''}</td>
              <td>${(s.items||[]).length}</td>
              <td class="money">${fmt(s.total)}</td>
              <td>${s.voided ? '<span class="badge badge-void">Voided</span>' : '<span class="badge badge-ok">OK</span>'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`}
    </div>

    <div class="report-section">
      <h3>💸 Expenses (${d.expenses.length})</h3>
      ${d.expenses.length === 0 ? '<p class="muted">No expenses this month.</p>' : `
      <div class="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Paid By</th><th class="money">Amount</th></tr></thead>
          <tbody>
            ${d.expenses.map(ex => `<tr>
              <td>${ex.date}</td>
              <td>${esc(ex.category)}</td>
              <td>${esc(ex.description)}</td>
              <td>${esc(ex.paidBy)}</td>
              <td class="money neg">${fmt(ex.amount)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`}
    </div>

    <div class="report-section">
      <h3>📦 Stock Received (${d.stockReceipts.length})</h3>
      ${d.stockReceipts.length === 0 ? '<p class="muted">No stock received this month.</p>' : `
      <div class="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Product</th><th>Supplier</th><th>Qty</th><th class="money">Unit Cost</th><th class="money">Total</th></tr></thead>
          <tbody>
            ${d.stockReceipts.map(r => `<tr>
              <td>${r.date}</td>
              <td>${esc(r.productName)}</td>
              <td>${esc(r.supplierName)}</td>
              <td>${r.qty}</td>
              <td class="money">${fmt(r.unitCost)}</td>
              <td class="money">${fmt(r.totalCost)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`}
    </div>
  `;
}

function exportReportCsv() {
  if (!reportData) { showToast('Generate a report first', 'error'); return; }
  const d = reportData;
  const monthNames = ['','January','February','March','April','May','June',
    'July','August','September','October','November','December'];
  let csv = `Golden Touch — ${monthNames[d.month]} ${d.year} Report\n\n`;
  csv += `SUMMARY\nRevenue,${d.revenue}\nCost of Goods,${d.cogs}\nGross Profit,${d.grossProfit}\n`;
  csv += `Expenses,${d.expenses}\nPayroll,${d.payroll}\nNet,${d.net}\n\n`;
  csv += `SALES\nID,Date,Customer,Payment,MPesa Code,Total,Status\n`;
  d.sales.forEach(s => {
    csv += `${s.id},${s.date},${s.customerName},${s.paymentMethod},${s.mpesaCode||''},${s.total},${s.voided?'Voided':'OK'}\n`;
  });
  csv += `\nEXPENSES\nDate,Category,Description,Paid By,Amount\n`;
  d.expenses.forEach(ex => {
    csv += `${ex.date},${ex.category},"${ex.description}",${ex.paidBy},${ex.amount}\n`;
  });
  downloadFile(csv, `GoldenTouch_Report_${d.year}_${d.month}.csv`, 'text/csv');
}

function exportReportPdf() {
  if (!reportData) { showToast('Generate a report first', 'error'); return; }
  if (typeof window.jspdf === 'undefined') { showToast('PDF library not loaded', 'error'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const d = reportData;
  const monthNames = ['','January','February','March','April','May','June',
    'July','August','September','October','November','December'];
  const title = `${settings.shopName || 'Golden Touch'} — ${monthNames[d.month]} ${d.year}`;

  doc.setFontSize(16); doc.setTextColor(40,10,30);
  doc.text(title, 14, 18);
  doc.setFontSize(10); doc.setTextColor(120,80,100);
  doc.text('Beauty & Jewellery Shop Report', 14, 25);

  // Summary table
  doc.autoTable({
    startY: 32,
    head: [['Metric', 'Amount (KSh)']],
    body: [
      ['Total Revenue',    fmt(d.revenue)],
      ['Cost of Goods',    fmt(d.cogs)],
      ['Gross Profit',     fmt(d.grossProfit)],
      ['Operating Expenses', fmt(d.expenses)],
      ['Payroll',          fmt(d.payroll)],
      ['NET PROFIT/(LOSS)',fmt(d.net)],
      ['Sales Count',      d.salesCount],
    ],
    theme: 'grid',
    headStyles: { fillColor: [212, 70, 140] },
  });

  // Sales
  if (d.sales.length > 0) {
    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 10,
      head: [['#', 'Date', 'Customer', 'Payment', 'Total', 'Status']],
      body: d.sales.map(s => [
        s.id, s.date, s.customerName, s.paymentMethod,
        fmt(s.total), s.voided ? 'Voided' : 'OK'
      ]),
      theme: 'striped',
      headStyles: { fillColor: [212, 70, 140] },
    });
  }

  doc.save(`GoldenTouch_Report_${d.year}_${d.month}.pdf`);
}

// ── UTILS ──────────────────────────────────────────────────────────────
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Wire up buttons that call openXxxModal() from onclick in HTML
// (product modal uses onclick="openModal('product-modal')" already,
//  but stock/expense modals need default date injection)
document.addEventListener('DOMContentLoaded', () => {
  // Wire + Add Expense button
  document.querySelector('[onclick="openModal(\'expense-modal\')"]')
    ?.setAttribute('onclick', 'openExpenseModal()');
  // Wire + Record Restock button
  document.querySelector('[onclick="openModal(\'stock-modal\')"]')
    ?.setAttribute('onclick', 'openStockModal()');
  // Wire + Add Product button
  document.querySelector('[onclick="openModal(\'product-modal\')"]')
    ?.setAttribute('onclick', 'openAddProduct()');
  // Wire + Add Customer button
  document.querySelector('[onclick="openModal(\'customer-modal\')"]')
    ?.addEventListener('click', () => {
      document.getElementById('cm-id').value = '0';
      document.getElementById('customer-form').reset();
    });
  // Wire + Add Supplier button
  document.querySelector('[onclick="openModal(\'supplier-modal\')"]')
    ?.addEventListener('click', () => {
      document.getElementById('sm-id').value = '0';
      document.getElementById('supplier-form').reset();
    });
  // Wire + Add Staff button
  document.querySelector('[onclick="openModal(\'staff-modal\')"]')
    ?.addEventListener('click', () => {
      document.getElementById('sf-id').value = '0';
      document.getElementById('staff-form').reset();
    });
});
