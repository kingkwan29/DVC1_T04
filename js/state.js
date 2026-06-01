// ==================== GLOBAL STATE & DATA ====================
const state = {
    jurisdiction: "all",
    age: "all",
    method: "all"      // 从 metric 改为 method，匹配新的筛选器
};

let kpiData = {};
let monthlyData = [];
let geoData = [];
let intersectionData = [];

const COLORS = {
    fines: '#3b82f6',
    arrests: '#f59e0b',
    charges: '#10b981',
    finesLight: '#93c5fd',
    arrestsLight: '#fcd34d',
    chargesLight: '#6ee7b7'
};

// ==================== TOOLTIP FUNCTIONS ====================

let tooltipDiv = null;

function getTooltip() {
    if (!tooltipDiv) {
        tooltipDiv = document.createElement('div');
        tooltipDiv.style.position = 'fixed';
        tooltipDiv.style.backgroundColor = 'rgba(15, 23, 42, 0.95)';
        tooltipDiv.style.color = '#f8fafc';
        tooltipDiv.style.padding = '12px 18px';
        tooltipDiv.style.borderRadius = '10px';
        tooltipDiv.style.fontSize = '13px';
        tooltipDiv.style.fontFamily = 'Inter, sans-serif';
        tooltipDiv.style.pointerEvents = 'none';
        tooltipDiv.style.zIndex = '10000';
        tooltipDiv.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)';
        tooltipDiv.style.border = '1px solid rgba(255,255,255,0.1)';
        tooltipDiv.style.fontWeight = '500';
        tooltipDiv.style.lineHeight = '1.6';
        tooltipDiv.style.maxWidth = '300px';
        tooltipDiv.style.opacity = '0';
        tooltipDiv.style.transition = 'opacity 0.15s ease';
        document.body.appendChild(tooltipDiv);
    }
    return tooltipDiv;
}

function showTooltip(event, html) {
    const tooltip = getTooltip();
    tooltip.innerHTML = html;
    tooltip.style.opacity = '1';

    let x = event.clientX + 15;
    let y = event.clientY - 20;

    const tooltipRect = tooltip.getBoundingClientRect();
    if (x + 250 > window.innerWidth) {
        x = event.clientX - 260;
    }
    if (y < 10) {
        y = event.clientY + 20;
    }
    if (y + 100 > window.innerHeight) {
        y = window.innerHeight - 110;
    }

    tooltip.style.left = x + 'px';
    tooltip.style.top = y + 'px';
}

function hideTooltip() {
    const tooltip = getTooltip();
    tooltip.style.opacity = '0';
}

// ==================== FILTER FUNCTIONS ====================

function applyAllFilters(data) {
    let result = [...data];

    if (state.jurisdiction !== 'all') {
        const jurisMap = {
            'ACT': 'ACT', 'NSW': 'NSW', 'NT': 'NT', 'QLD': 'QLD',
            'SA': 'SA', 'TAS': 'TAS', 'VIC': 'VIC', 'WA': 'WA'
        };
        const targetLoc = jurisMap[state.jurisdiction];
        if (targetLoc) {
            result = result.filter(d => d.location === targetLoc || d.location === 'All Regions');
        }
    }

    if (state.age !== 'all') {
        result = result.filter(d => d.ageGroup === state.age);
    }

    if (state.method !== 'all') {
        result = result.filter(d => d.method === state.method);
    }

    return result;
}

function applyJurisdictionFilter(data) {
    if (state.jurisdiction === 'all') return data;
    return data.filter(d => d.jurisdiction === state.jurisdiction);
}

function refreshAllCharts() {
    if (typeof renderKPI === 'function') renderKPI();
    if (typeof renderMonthlyTrend === 'function') renderMonthlyTrend();
    if (typeof renderGroupedBarChart === 'function') renderGroupedBarChart();
    if (typeof renderHBarChart === 'function') renderHBarChart();
    if (typeof renderVBarChart === 'function') renderVBarChart();
}