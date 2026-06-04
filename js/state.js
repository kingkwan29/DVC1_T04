// js/state.js
// Global State and Data

const state = {
    jurisdiction: "all",
    age: "all",
    method: "all"
};

let kpiData = {};
let monthlyData = [];
let geoData = [];
let intersectionData = [];
let rawData = [];           // Full dataset from Clean Police Enforcement 2024.csv

const COLORS = {
    fines: '#3b82f6',
    arrests: '#f59e0b',
    charges: '#10b981',
    finesLight: '#93c5fd',
    arrestsLight: '#fcd34d',
    chargesLight: '#6ee7b7'
};

let tooltipDiv = null;

function getTooltip() {
    if (!tooltipDiv) {
        tooltipDiv = document.createElement('div');
        tooltipDiv.className = 'chart-tooltip';
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
    if (x + 280 > window.innerWidth) {
        x = event.clientX - 290;
    }
    if (y < 10) {
        y = event.clientY + 20;
    }
    if (y + 150 > window.innerHeight) {
        y = window.innerHeight - 160;
    }

    tooltip.style.left = x + 'px';
    tooltip.style.top = y + 'px';
}

function hideTooltip() {
    const tooltip = getTooltip();
    tooltip.style.opacity = '0';
}

// Aggregate monthly data from rawData based on current filters
function computeMonthlyData() {
    if (!rawData || rawData.length === 0) return;

    let filtered = rawData;

    if (state.jurisdiction !== 'all') {
        filtered = filtered.filter(d => d.jurisdiction === state.jurisdiction);
    }

    if (state.age !== 'all') {
        filtered = filtered.filter(d => d.ageGroup === state.age);
    }

    if (state.method !== 'all') {
        const methodMap = {
            'Police issued': 'Police issued',
            'Fixed camera': 'Fixed camera',
            'Mobile camera': 'Mobile camera',
            'Red light camera': 'Red light camera',
            'Manual Action': 'Manual Action',
            'Camera (Unspecified)': 'Camera',
            'All Methods': 'All Methods'
        };
        const targetMethod = methodMap[state.method];
        if (targetMethod) {
            filtered = filtered.filter(d => d.detectionMethod === targetMethod);
        }
    }

    const grouped = d3.rollup(
        filtered,
        v => d3.sum(v, d => d.fines),
        d => d.year,
        d => d.month
    );

    const result = [];
    for (const [year, monthMap] of grouped) {
        for (const [month, fines] of monthMap) {
            result.push({
                date: new Date(year, month - 1, 1),
                year: year,
                month: month,
                monthPadded: String(month).padStart(2, '0'),
                fines: fines
            });
        }
    }

    result.sort((a, b) => a.date - b.date);
    monthlyData = result;
}

function applyAllFilters(data) {
    let result = [...data];

    if (state.jurisdiction !== 'all') {
        const jurisMap = {
            'ACT': 'ACT', 'NSW': 'NSW', 'NT': 'NT', 'QLD': 'QLD',
            'SA': 'SA', 'TAS': 'TAS', 'VIC': 'VIC', 'WA': 'WA'
        };
        const targetLoc = jurisMap[state.jurisdiction];
        if (targetLoc) {
            result = result.filter(d => d.location === targetLoc);
        } else {
            result = result.filter(d => d.location === 'All Regions');
        }
    }

    if (state.age !== 'all') {
        result = result.filter(d => d.ageGroup === state.age);
    }

    if (state.method !== 'all' && result.length > 0 && result[0].method !== undefined) {
        result = result.filter(d => d.method === state.method);
    }

    return result;
}

function applyJurisdictionFilter(data) {
    if (state.jurisdiction === 'all') return data;
    return data.filter(d => d.jurisdiction === state.jurisdiction);
}

function refreshAllCharts() {
    computeMonthlyData();
    if (typeof renderKPI === 'function') renderKPI();
    if (typeof renderMonthlyTrend === 'function') renderMonthlyTrend();
    if (typeof renderGroupedBarChart === 'function') renderGroupedBarChart();
    if (typeof renderHBarChart === 'function') renderHBarChart();
    if (typeof renderVBarChart === 'function') renderVBarChart();
}