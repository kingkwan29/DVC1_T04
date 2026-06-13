// js/state.js - Updated
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
let rawData = [];
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
            'Camera': 'Camera',
            'Average speed camera': 'Average speed camera'
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
    if (typeof refreshMetricMethodCharts === 'function') refreshMetricMethodCharts();
}