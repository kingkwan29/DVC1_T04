// js/state.js
// Global State, Data Storage, and Tooltip System

// ============================================================
// GLOBAL FILTER STATE - Shared across all charts
// ============================================================
const state = {
    jurisdiction: "all",  // "all" or specific state code (e.g., "ACT", "NSW", "VIC")
    age: "all",           // "all" or age group (e.g., "0-16", "17-25", "26-39")
    method: "all"         // "all" or detection method (e.g., "Police issued", "Fixed camera")
};

// Jurisdiction name mapping: full name -> code used in data
const jurisdictionMap = {
    "all": "all",
    "Australian Capital Territory": "ACT",
    "New South Wales": "NSW",
    "Northern Territory": "NT",
    "Queensland": "QLD",
    "South Australia": "SA",
    "Tasmania": "TAS",
    "Victoria": "VIC",
    "Western Australia": "WA"
};

// Reverse mapping: code -> full name (for display)
const jurisdictionDisplayMap = {
    "all": "All",
    "ACT": "Australian Capital Territory",
    "NSW": "New South Wales",
    "NT": "Northern Territory",
    "QLD": "Queensland",
    "SA": "South Australia",
    "TAS": "Tasmania",
    "VIC": "Victoria",
    "WA": "Western Australia"
};

// ============================================================
// GLOBAL DATA - Loaded by main.js, shared across all charts
// ============================================================
let kpiData = {};           // Global KPI summary (total fines, arrests, charges)
let monthlyData = [];       // Monthly time series data (for trend chart)
let geoData = [];           // Geographic distribution data (jurisdiction-level)
let intersectionData = [];  // Fine-grained intersection data (multi-dimensional)
let rawData = [];           // Raw police enforcement data (most detailed)

// ============================================================
// TOOLTIP SYSTEM - Singleton pattern, reused across all charts
// ============================================================
// Why singleton? All charts share one tooltip DOM element.
// Benefits: better performance, consistent positioning, unified styling.

let tooltipDiv = null;  // Lazy-initialized: created on first use

// Gets or creates the tooltip element (singleton)
function getTooltip() {
    if (!tooltipDiv) {
        tooltipDiv = document.createElement('div');
        tooltipDiv.className = 'chart-tooltip';
        document.body.appendChild(tooltipDiv);
    }
    return tooltipDiv;
}

/**
 * Shows tooltip with smart positioning - never goes outside viewport
 * 
 * HOW IT WORKS:
 * 1. Inserts HTML content into the tooltip element
 * 2. Default position: bottom-right of cursor (clientX + 15, clientY - 20)
 * 3. Checks if tooltip would overflow viewport, adjusts automatically:
 *    - Overflow right edge -> flip to left side of cursor
 *    - Overflow top edge -> show below cursor
 *    - Overflow bottom edge -> move up
 * 
 * @param {MouseEvent} event - Mouse event (used to get cursor position)
 * @param {string} html - HTML content to display inside tooltip
 */
function showTooltip(event, html) {
    const tooltip = getTooltip();
    tooltip.innerHTML = html;
    tooltip.style.opacity = '1';

    // Calculate initial position: slightly right and above cursor
    let x = event.clientX + 15;
    let y = event.clientY - 20;

    // Get tooltip dimensions to detect overflow
    const tooltipRect = tooltip.getBoundingClientRect();

    // Right edge overflow: show on left side instead
    if (x + 280 > window.innerWidth) {
        x = event.clientX - 290;
    }
    // Top edge overflow: show below cursor
    if (y < 10) {
        y = event.clientY + 20;
    }
    // Bottom edge overflow: move up
    if (y + 150 > window.innerHeight) {
        y = window.innerHeight - 160;
    }

    tooltip.style.left = x + 'px';
    tooltip.style.top = y + 'px';
}

// Hides the tooltip
function hideTooltip() {
    const tooltip = getTooltip();
    tooltip.style.opacity = '0';
}

// ============================================================
// DATA COMPUTATION - Recalculates monthly data based on filters
// ============================================================

/**
 * Computes monthly aggregated data from rawData using current filter state
 * 
 * HOW FILTERS WORK:
 * 1. Start with all rawData
 * 2. Filter by jurisdiction (if not 'all')
 * 3. Filter by age group (if not 'all')
 * 4. Filter by detection method (if not 'all') - uses methodMap to match UI values
 * 5. Group by year + month using d3.rollup
 * 6. Sum fines within each year-month group
 * 7. Sort chronologically
 * 
 * This is called by refreshAllCharts() to update the trend chart
 */
function computeMonthlyData() {
    if (!rawData || rawData.length === 0) return;

    let filtered = rawData;

    // Apply filters in sequence
    if (state.jurisdiction !== 'all') {
        filtered = filtered.filter(d => d.jurisdiction === state.jurisdiction);
    }

    if (state.age !== 'all') {
        filtered = filtered.filter(d => d.ageGroup === state.age);
    }

    // Method filter: maps UI dropdown values to actual data values
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

    // Group by year and month using d3.rollup (nested grouping)
    // Structure: year -> month -> sum of fines
    const grouped = d3.rollup(
        filtered,
        v => d3.sum(v, d => d.fines),
        d => d.year,
        d => d.month
    );

    // Flatten grouped data into array of objects
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

    // Sort chronologically (oldest to newest)
    result.sort((a, b) => a.date - b.date);
    monthlyData = result;
}

// Helper: filters data by jurisdiction (kept for potential future use)
function applyJurisdictionFilter(data) {
    if (state.jurisdiction === 'all') return data;
    return data.filter(d => d.jurisdiction === state.jurisdiction);
}

// ============================================================
// MASTER REFRESH - Updates ALL charts when filters change
// ============================================================

/**
 * Central refresh function - called whenever filters change or data loads
 * 
 * EXECUTION ORDER:
 * 1. Recompute monthly data (for trend chart)
 * 2. Update KPI display (top-level summary numbers)
 * 3. Update trend chart (monthly time series)
 * 4. Update grouped bar chart (age breakdown with dual axis)
 * 5. Update horizontal bar chart (violation or jurisdiction breakdown)
 * 6. Update metric-method charts (lollipop, donut, method bar)
 * 
 * This ensures all charts stay in sync with the current filter state.
 */
function refreshAllCharts() {
    // Step 1: Recompute monthly data based on current filters
    computeMonthlyData();

    // Step 2-6: Update all charts
    if (typeof renderKPI === 'function') renderKPI();
    if (typeof renderMonthlyTrend === 'function') renderMonthlyTrend();
    if (typeof renderGroupedBarChart === 'function') renderGroupedBarChart();
    if (typeof renderHBarChart === 'function') renderHBarChart();
    if (typeof refreshMetricMethodCharts === 'function') refreshMetricMethodCharts();
}