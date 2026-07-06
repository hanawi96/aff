// Popup Quick Stats
const API_URL = 'https://ctv-api.yendev96.workers.dev';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const cache = {
  today: null,
  yesterday: null
};

let activePeriod = 'today';

// Format functions
function fmt(n) {
  return new Intl.NumberFormat('vi-VN').format(n || 0) + ' đ';
}

function fmtN(n) {
  return new Intl.NumberFormat('vi-VN').format(n || 0);
}

function fmtPct(n) {
  return `${(n || 0).toFixed(1)}%`;
}

// Get VN date string
function vnTodayStr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

// Build API URL
function buildUrl(period) {
  const base = `${API_URL}?action=getProfitOverview`;
  const ts = `&timestamp=${Date.now()}`;
  
  if (period === 'today') {
    const start = new Date(vnTodayStr() + 'T00:00:00+07:00').toISOString();
    return `${base}&period=today&startDate=${encodeURIComponent(start)}${ts}`;
  }
  
  const todayMs = new Date(vnTodayStr() + 'T00:00:00+07:00').getTime();
  const yStart = new Date(todayMs - 86400000).toISOString();
  const yEnd = new Date(todayMs - 1).toISOString();
  return `${base}&period=all&startDate=${encodeURIComponent(yStart)}&endDate=${encodeURIComponent(yEnd)}${ts}`;
}

// Get cached data
function getCached(period) {
  const hit = cache[period];
  if (hit && Date.now() - hit.ts < CACHE_TTL) {
    return hit.data;
  }
  return null;
}

// Fetch default ad spend
async function fetchDefaultAdSpend() {
  try {
    const res = await fetch(`${API_URL}?action=getDefaultAdSpend&timestamp=${Date.now()}`);
    const data = await res.json();
    return data.success ? (data.amount || 0) : 0;
  } catch (e) {
    console.warn('getDefaultAdSpend failed', e);
    return 0;
  }
}

// Enrich ad spend fields
async function enrichAdSpendFields(data) {
  if (!data?.success || !data.overview) return data;
  
  const o = data.overview;
  if (o.ad_spend != null && o.net_profit != null) return data;
  
  const profit = o.total_profit || 0;
  const adSpend = await fetchDefaultAdSpend();
  
  o.ad_spend = adSpend;
  o.net_profit = profit - adSpend;
  o.net_profit_per_order = o.total_orders > 0 ? o.net_profit / o.total_orders : 0;
  
  return data;
}

// Fetch stats
async function fetchStats(period) {
  const cached = getCached(period);
  if (cached) return cached;
  
  const response = await fetch(buildUrl(period));
  const data = await response.json();
  const enriched = await enrichAdSpendFields(data);
  
  if (enriched.success) {
    cache[period] = { data: enriched, ts: Date.now() };
  }
  
  return enriched;
}

// Render revenue change
function renderRevenueChange(o) {
  const el = document.getElementById('revenue-change');
  const pct = o.revenue_vs_prev_day_pct;
  const cmpLabel = activePeriod === 'yesterday' ? 'hôm kia' : 'hôm qua';
  
  if (pct == null) {
    el.innerHTML = `<span class="change flat">— vs ${cmpLabel}</span>`;
    return;
  }
  
  const abs = Math.abs(pct).toFixed(1);
  let cls = 'flat';
  let sign = '';
  
  if (pct > 0.05) { cls = 'up'; sign = '+'; }
  else if (pct < -0.05) { cls = 'down'; sign = '−'; }
  
  el.innerHTML = `<span class="change ${cls}">${sign}${abs}% vs ${cmpLabel}</span>`;
}

// Render customer sources
function renderSources(sources) {
  const container = document.getElementById('sources');
  
  if (!Array.isArray(sources) || sources.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:20px;color:#94a3b8;font-size:12px;">Chưa có đơn</div>';
    return;
  }
  
  const badges = {
    facebook: { cls: 'facebook', text: 'FB' },
    zalo: { cls: 'zalo', text: 'Z' },
    tiktok: { cls: 'tiktok', text: 'TT' },
    unknown: { cls: 'unknown', text: '?' }
  };
  
  container.innerHTML = sources.map(s => {
    const badge = badges[s.source] || badges.unknown;
    const profit = s.profit != null ? s.profit : ((s.revenue || 0) - (s.cost || 0));
    const profitCls = profit >= 0 ? '' : 'negative';
    const share = s.revenue_share || 0;
    
    return `
      <div class="source-item">
        <div class="source-header">
          <div class="source-badge ${badge.cls}">${badge.text}</div>
          <div class="source-name">${s.label}</div>
          <div class="source-meta">${fmtN(s.order_count)} đơn</div>
        </div>
        <div class="source-bar">
          <div class="source-fill" style="width: ${Math.max(share, 4).toFixed(1)}%"></div>
        </div>
        <div class="source-stats">
          <span class="source-rev">DT: ${fmt(s.revenue)}</span>
          <span class="source-profit ${profitCls}">LN: ${fmt(profit)}</span>
        </div>
      </div>
    `;
  }).join('');
}

// Render stats
function renderStats(data) {
  const o = data?.overview;
  if (!o) return;
  
  const profit = o.total_profit || 0;
  const margin = o.profit_margin || 0;
  const adSpend = o.ad_spend || 0;
  const netProfit = o.net_profit != null ? o.net_profit : (profit - adSpend);
  const totalOrders = o.total_orders || 0;
  const avgNetPerOrder = o.net_profit_per_order != null
    ? o.net_profit_per_order
    : (totalOrders > 0 ? netProfit / totalOrders : 0);
  
  // Hero
  document.getElementById('revenue').textContent = fmt(o.total_revenue);
  renderRevenueChange(o);
  
  const netProfitEl = document.getElementById('net-profit');
  netProfitEl.textContent = fmt(netProfit);
  netProfitEl.className = 'value accent' + (netProfit < 0 ? ' negative' : '');
  
  document.getElementById('ad-spend').textContent = fmt(adSpend);
  document.getElementById('profit-per-order').textContent = fmt(avgNetPerOrder);
  
  // Grid
  document.getElementById('orders').textContent = fmtN(totalOrders);
  document.getElementById('products').textContent = fmtN(o.total_products_sold);
  document.getElementById('margin').textContent = fmtPct(margin);
  document.getElementById('gross-profit').textContent = fmt(profit);
  
  // Cost
  document.getElementById('cost').textContent = fmt(o.total_cost);
  
  // Sources
  renderSources(data.customer_sources);
}

// Load data
async function loadData(period) {
  const loading = document.getElementById('loading');
  const stats = document.getElementById('stats');
  const error = document.getElementById('error');
  
  loading.style.display = 'block';
  stats.style.display = 'none';
  error.style.display = 'none';
  
  try {
    const data = await fetchStats(period);
    
    if (data.success) {
      renderStats(data);
      loading.style.display = 'none';
      stats.style.display = 'block';
    } else {
      throw new Error('API error');
    }
  } catch (e) {
    console.error('Load error:', e);
    loading.style.display = 'none';
    error.style.display = 'block';
  }
}

// Switch period
function switchPeriod(period) {
  if (period === activePeriod) return;
  
  activePeriod = period;
  
  // Update tabs
  document.getElementById('tab-today').classList.toggle('active', period === 'today');
  document.getElementById('tab-yesterday').classList.toggle('active', period === 'yesterday');
  
  // Load data
  loadData(period);
}

// Init
document.getElementById('tab-today').addEventListener('click', () => switchPeriod('today'));
document.getElementById('tab-yesterday').addEventListener('click', () => switchPeriod('yesterday'));

// Load today on open
loadData('today');
