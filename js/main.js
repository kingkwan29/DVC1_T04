// js/main.js
// Main Application Entry Point

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

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

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

function exportChartSVG(chartId, filename) {
    const container = document.getElementById(chartId);
    const svg = container.querySelector('svg');
    if (!svg) {
        alert('No chart to export');
        return;
    }

    const clone = svg.cloneNode(true);
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(clone);

    source = '<?xml version="1.0" standalone="no"?>\r\n' + source;
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(source);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.svg`;
    link.click();
}

let dataLoaded = false;

async function loadAllData() {
    showLoadingStates();

    try {
        // Load raw data for trend chart filtering + existing datasets
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

        // Parse raw data for trend chart filtering
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

safeAddEvent(document.getElementById('filterJurisdiction'), 'change', function (e) {
    state.jurisdiction = e.target.value;
    refreshAllCharts();
});

safeAddEvent(document.getElementById('filterAge'), 'change', function (e) {
    state.age = e.target.value;
    refreshAllCharts();
});

safeAddEvent(document.getElementById('filterMethod'), 'change', function (e) {
    state.method = e.target.value;
    refreshAllCharts();
});

safeAddEvent(document.getElementById('exportPNG'), 'click', exportAsPNG);
safeAddEvent(document.getElementById('exportCSV'), 'click', exportAsCSV);

const chartGrid = document.querySelector('.chart-grid');
if (chartGrid) {
    chartGrid.addEventListener('click', (e) => {
        const btn = e.target.closest('.chart-action-btn');
        if (btn) {
            const chartMap = {
                'trend': 'monthly-trend',
                'grouped': 'grouped-bar-chart',
                'hbar': 'metric-hbar',
                'vbar': 'jurisdiction-vbar'
            };
            const chartType = btn.getAttribute('data-chart');
            const filename = chartMap[chartType] || 'chart';
            const chartIdMap = {
                'trend': 'trendChart',
                'grouped': 'groupedBarChart',
                'hbar': 'hbarChart',
                'vbar': 'vbarChart'
            };
            exportChartSVG(chartIdMap[chartType], filename);
        }
    });
}

let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        if (dataLoaded) refreshAllCharts();
    }, 200);
});

loadAllData();