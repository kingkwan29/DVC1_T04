// js/main.js
// Main Application Entry Point - Data loading, exports, filters, navigation

// ============================================================
// EXPORT FUNCTIONS
// ============================================================

/**
 * Exports the entire dashboard as a PNG image using html2canvas
 */
async function exportAsPNG() {
    const mainContent = document.querySelector('.main-content');
    const originalOverflow = mainContent.style.overflow;
    mainContent.style.overflow = 'visible';

    try {
        if (typeof html2canvas === 'undefined') {
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
        }
        const canvas = await html2canvas(mainContent, {
            scale: 2,
            backgroundColor: '#f8fafc',
            logging: false
        });
        const link = document.createElement('a');
        link.download = 'enforcement-nexus-dashboard.png';
        link.href = canvas.toDataURL();
        link.click();
    } catch (err) {
        console.error('PNG export failed:', err);
        alert('Export failed. Please try again.');
    }
    mainContent.style.overflow = originalOverflow;
}

/**
 * Dynamically loads an external script
 */
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

/**
 * Exports intersectionData as a CSV file
 */
function exportAsCSV() {
    if (!intersectionData.length) {
        alert('No data to export');
        return;
    }

    const headers = ['location', 'ageGroup', 'metric', 'method', 'fines', 'arrests', 'charges'];
    const rows = intersectionData.map(d => [
        d.location, d.ageGroup, d.metric, d.method || '', d.fines, d.arrests, d.charges
    ]);

    const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', 'enforcement-data.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Exports a chart as JPG using html2canvas (for ALL charts now)
 */
async function exportChartAsImage(chartId, filename) {
    const container = document.getElementById(chartId);
    if (!container) {
        console.error('Container not found:', chartId);
        alert('Chart container not found');
        return;
    }

    // Make sure html2canvas is loaded
    if (typeof html2canvas === 'undefined') {
        try {
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
        } catch (err) {
            console.error('Failed to load html2canvas:', err);
            alert('Failed to load export library. Please try again.');
            return;
        }
    }

    try {
        // Wait a tiny bit for any pending renders
        await new Promise(resolve => setTimeout(resolve, 100));

        const canvas = await html2canvas(container, {
            scale: 2,
            backgroundColor: '#FFFFFF',
            logging: false,
            useCORS: true,
            allowTaint: true,
            width: container.scrollWidth,
            height: container.scrollHeight
        });

        const link = document.createElement('a');
        link.download = `${filename}.jpg`;
        link.href = canvas.toDataURL('image/jpeg', 0.95);
        link.click();
    } catch (err) {
        console.error('Chart export failed:', err);
        alert('Export failed. Please try again.');
    }
}

// ---- DATA LOADING ----

let dataLoaded = false;

async function loadAllData() {
    showLoadingStates();

    try {
        const [rawRaw, kpiRaw, monthlyRaw, geoRaw, intersectionRaw] = await Promise.all([
            d3.csv('data/Clean Police Enforcement 2024.csv'),
            d3.csv('data/global_kpi.csv'),
            d3.csv('data/monthly_time_series_trend.csv'),
            d3.csv('data/geographic_spatial_distribution.csv'),
            d3.csv('data/fine_grained_intersection.csv')
        ]);

        console.log('Data loaded:', {
            raw: rawRaw?.length,
            kpi: kpiRaw?.length,
            monthly: monthlyRaw?.length,
            geo: geoRaw?.length,
            intersection: intersectionRaw?.length
        });

        if (rawRaw && rawRaw.length > 0) {
            rawData = rawRaw.map(d => ({
                year: parseNumber(d.YEAR),
                month: parseNumber(d.MONTH),
                monthPadded: String(d.MONTH).padStart(2, '0'),
                jurisdiction: d.JURISDICTION,
                location: d.LOCATION,
                ageGroup: d.AGE_GROUP,
                metric: d.METRIC,
                detectionMethod: d.DETECTION_METHOD,
                fines: parseNumber(d.FINES),
                arrests: parseNumber(d.ARRESTS),
                charges: parseNumber(d.CHARGES),
                date: new Date(parseNumber(d.YEAR), parseNumber(d.MONTH) - 1, 1)
            }));
        }

        if (kpiRaw && kpiRaw.length > 0) {
            kpiData = {
                fines: parseNumber(kpiRaw[0].FINES),
                arrests: parseNumber(kpiRaw[0].ARRESTS),
                charges: parseNumber(kpiRaw[0].CHARGES)
            };
        }

        if (monthlyRaw && monthlyRaw.length > 0) {
            monthlyData = monthlyRaw.map(d => ({
                year: parseNumber(d.YEAR),
                month: parseNumber(d.MONTH),
                fines: parseNumber(d.FINES),
                date: new Date(parseNumber(d.YEAR), parseNumber(d.MONTH) - 1, 1)
            })).sort((a, b) => a.date - b.date);
        }

        if (geoRaw && geoRaw.length > 0) {
            geoData = geoRaw.map(d => ({
                jurisdiction: d.JURISDICTION,
                method: d.DETECTION_METHOD,
                fines: parseNumber(d.FINES),
                arrests: parseNumber(d.ARRESTS),
                charges: parseNumber(d.CHARGES)
            }));
        }

        if (intersectionRaw && intersectionRaw.length > 0) {
            intersectionData = intersectionRaw.map(d => ({
                location: d.LOCATION,
                ageGroup: d.AGE_GROUP,
                metric: d.METRIC,
                method: d.DETECTION_METHOD || 'unspecified',
                fines: parseNumber(d.FINES),
                arrests: parseNumber(d.ARRESTS),
                charges: parseNumber(d.CHARGES)
            }));
        }

        dataLoaded = true;

        setTimeout(() => {
            refreshAllCharts();
            if (typeof initMetricMethodModule === 'function') {
                initMetricMethodModule();
            }
        }, 100);

    } catch (error) {
        console.error('Data loading error:', error);
        showErrorMessage(error.message);
    }
}

function parseNumber(value) {
    if (value === undefined || value === null || value === '') return 0;
    const num = Number(String(value).replace(/,/g, ''));
    return isNaN(num) ? 0 : num;
}

function showLoadingStates() {
    document.querySelectorAll('.chart-body').forEach(el => {
        if (el) el.innerHTML = '<div class="loading-state">Loading data...</div>';
    });
    const kpiFines = document.getElementById('kpiFines');
    const kpiArrests = document.getElementById('kpiArrests');
    const kpiCharges = document.getElementById('kpiCharges');
    if (kpiFines) kpiFines.textContent = 'Loading...';
    if (kpiArrests) kpiArrests.textContent = 'Loading...';
    if (kpiCharges) kpiCharges.textContent = 'Loading...';
}

function showErrorMessage(message) {
    document.querySelectorAll('.chart-body').forEach(el => {
        if (el) el.innerHTML = `<div class="error-state">⚠️ ${message}</div>`;
    });
}

function safeAddEvent(element, eventType, handler) {
    if (element) {
        element.addEventListener(eventType, handler);
    }
}

// ---- FILTERS ----

safeAddEvent(document.getElementById('filterJurisdiction'), 'change', function (e) {
    state.jurisdiction = e.target.value;

    const trigger = document.querySelector('#containerJurisdiction .custom-select-trigger');
    if (trigger) {
        const selectedOption = document.querySelector('#containerJurisdiction .custom-option.selected');
        if (selectedOption) trigger.textContent = selectedOption.textContent;
    }

    refreshAllCharts();
    if (typeof refreshMetricMethodCharts === 'function') {
        refreshMetricMethodCharts();
    }
});

safeAddEvent(document.getElementById('filterAge'), 'change', function (e) {
    state.age = e.target.value;

    const trigger = document.querySelector('#containerAge .custom-select-trigger');
    if (trigger) {
        const selectedOption = document.querySelector('#containerAge .custom-option.selected');
        if (selectedOption) trigger.textContent = selectedOption.textContent;
    }

    refreshAllCharts();
    if (typeof refreshMetricMethodCharts === 'function') {
        refreshMetricMethodCharts();
    }
});

safeAddEvent(document.getElementById('filterMethod'), 'change', function (e) {
    state.method = e.target.value;

    const trigger = document.querySelector('#containerMethod .custom-select-trigger');
    if (trigger) {
        const selectedOption = document.querySelector('#containerMethod .custom-option.selected');
        if (selectedOption) trigger.textContent = selectedOption.textContent;
    }

    refreshAllCharts();
    if (typeof refreshMetricMethodCharts === 'function') {
        refreshMetricMethodCharts();
    }
});

// ---- EXPORT BUTTONS ----

safeAddEvent(document.getElementById('exportPNG'), 'click', exportAsPNG);
safeAddEvent(document.getElementById('exportCSV'), 'click', exportAsCSV);

// ============================================================
// ALL CHART EXPORT BUTTONS (ALL export as JPG now)
// ============================================================

// ---- Page 1 Chart Exports ----

// Trend Chart Export
const exportTrendBtn = document.querySelector('.chart-card.full-width .chart-action-btn[data-chart="trend"]');
if (exportTrendBtn) {
    exportTrendBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        console.log('Exporting Trend Chart as JPG');
        exportChartAsImage('trendChart', 'monthly-trend');
    });
}

// Grouped Bar Chart Export
const exportGroupedBtn = document.querySelector('.chart-card.half-width .chart-action-btn[data-chart="grouped"]');
if (exportGroupedBtn) {
    exportGroupedBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        console.log('Exporting Grouped Bar Chart as JPG');
        exportChartAsImage('groupedBarChart', 'grouped-bar-chart');
    });
}

// HBar Chart Export
const exportHBarBtn = document.querySelector('.chart-card.half-width .chart-action-btn[data-chart="hbar"]');
if (exportHBarBtn) {
    exportHBarBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        console.log('Exporting HBar Chart as JPG');
        exportChartAsImage('hbarChart', 'metric-hbar');
    });
}

// ---- Page 2 Chart Exports ----

// Lollipop Chart Export
const exportMetricAreaBtn = document.getElementById('exportMetricArea');
if (exportMetricAreaBtn) {
    exportMetricAreaBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        console.log('Exporting Lollipop Chart as JPG');
        exportChartAsImage('metricMethodAreaChart', 'metric-method-area');
    });
}

// Donut Chart Export
const exportMetricDonutBtn = document.getElementById('exportMetricDonut');
if (exportMetricDonutBtn) {
    exportMetricDonutBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        console.log('Exporting Donut Chart as JPG');
        exportChartAsImage('metricDonutChart', 'metric-donut');
    });
}

// Method Bar Chart Export
const exportMethodBarBtn = document.getElementById('exportMethodBar');
if (exportMethodBarBtn) {
    exportMethodBarBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        console.log('Exporting Method Bar Chart as JPG');
        exportChartAsImage('methodBarChart', 'method-bar');
    });
}

// ---- RESIZE HANDLER ----

let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        if (dataLoaded) {
            refreshAllCharts();
            if (typeof refreshMetricMethodCharts === 'function') {
                refreshMetricMethodCharts();
            }
        }
    }, 200);
});

// ---- INITIALIZATION ----

loadAllData();

// ---- PAGE NAVIGATION ----

function initPageNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    const homePage = document.getElementById('homePage');
    const dashboardPage = document.getElementById('dashboardPage');

    if (!navButtons.length) return;

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const page = btn.getAttribute('data-page');

            navButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            if (page === 'home') {
                homePage.classList.add('active-page');
                dashboardPage.classList.remove('active-page');
            } else if (page === 'dashboard') {
                homePage.classList.remove('active-page');
                dashboardPage.classList.add('active-page');

                const activePage = document.querySelector('.chart-page.active-page');
                if (activePage && activePage.id === 'page2') {
                    setTimeout(() => {
                        if (typeof refreshMetricMethodCharts === 'function') {
                            refreshMetricMethodCharts();
                        }
                    }, 150);
                } else if (typeof refreshAllCharts === 'function') {
                    setTimeout(refreshAllCharts, 100);
                }
            }
        });
    });
}

// ---- CUSTOM DROPDOWN UI ----

function initCustomDropdowns() {
    const dropdownConfigs = [
        { containerId: 'containerJurisdiction', selectId: 'filterJurisdiction' },
        { containerId: 'containerAge', selectId: 'filterAge' },
        { containerId: 'containerMethod', selectId: 'filterMethod' }
    ];

    dropdownConfigs.forEach(cfg => {
        const container = document.getElementById(cfg.containerId);
        if (!container) return;

        const trigger = container.querySelector('.custom-select-trigger');
        const options = container.querySelectorAll('.custom-option');
        const realSelect = document.getElementById(cfg.selectId);

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();

            dropdownConfigs.forEach(otherCfg => {
                if (otherCfg.containerId !== cfg.containerId) {
                    document.getElementById(otherCfg.containerId)?.classList.remove('open');
                }
            });

            container.classList.toggle('open');
        });

        options.forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                const val = option.getAttribute('data-value');
                const text = option.textContent;

                trigger.textContent = text;
                options.forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');

                container.classList.remove('open');

                if (realSelect) {
                    realSelect.value = val;
                    realSelect.dispatchEvent(new Event('change'));
                }
            });
        });
    });

    document.addEventListener('click', () => {
        dropdownConfigs.forEach(cfg => {
            document.getElementById(cfg.containerId)?.classList.remove('open');
        });
    });
}

// ---- MODULE INITIALIZATION ----

function initAllAppModules() {
    initPageNavigation();
    initCustomDropdowns();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllAppModules);
} else {
    initAllAppModules();
}

// ---- PAGE SWITCHING (Page 1 vs Page 2 inside Dashboard) ----

document.addEventListener('click', function (e) {
    if (e.target.classList.contains('page-btn')) {
        const targetPage = e.target.getAttribute('data-page');

        document.querySelectorAll('.chart-page').forEach(p => p.classList.remove('active-page'));
        const pageToShow = targetPage === '1' ? document.getElementById('page1') : document.getElementById('page2');
        if (pageToShow) pageToShow.classList.add('active-page');

        document.querySelectorAll('.page-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-page') === targetPage);
        });

        document.querySelector('.main-content').scrollTop = 0;

        if (targetPage === '2') {
            setTimeout(() => {
                if (typeof refreshMetricMethodCharts === 'function') {
                    refreshMetricMethodCharts();
                }
            }, 150);
        } else if (targetPage === '1' && typeof refreshAllCharts === 'function') {
            setTimeout(refreshAllCharts, 100);
        }
    }
});