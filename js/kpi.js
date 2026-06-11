// js/kpi.js
let globalKPI = null;

async function loadGlobalKPI() {
    try {
        const response = await fetch('data/global_kpi.csv');
        const csvText = await response.text();
        const rows = d3.csvParse(csvText);
        if (rows.length > 0) {
            globalKPI = {
                fines: +rows[0].FINES || 0,
                arrests: +rows[0].ARRESTS || 0,
                charges: +rows[0].CHARGES || 0
            };
        }
    } catch (e) {
        console.warn('Failed to load global_kpi.csv, will compute from intersectionData', e);
        globalKPI = null;
    }
}

function renderKPI() {
    let filtered = [];
    let usingGeoData = false;
    let isGlobalView = false;

    if (state.jurisdiction === 'all' && state.age === 'all' && state.method === 'all') {
        if (globalKPI) {
            updateKPIDisplay(globalKPI.fines, globalKPI.arrests, globalKPI.charges);
            updateKpiSubtitle(true, true);
            return;
        }
        filtered = [...intersectionData];
        isGlobalView = true;
    }
    else if (state.jurisdiction !== 'all') {
        if (geoData && geoData.length > 0) {
            const jurisData = geoData.find(d => d.jurisdiction === state.jurisdiction);
            if (jurisData) {
                filtered = [jurisData];
                usingGeoData = true;
            }
        }
        if (filtered.length === 0 && intersectionData && intersectionData.length > 0) {
            filtered = [...intersectionData];
            filtered = filtered.filter(d => d.jurisdiction === state.jurisdiction);
        }
    }
    else {
        filtered = [...intersectionData];
        isGlobalView = true;
    }

    if (!usingGeoData && filtered.length > 0) {
        if (state.age !== 'all') {
            filtered = filtered.filter(d => d.ageGroup === state.age);
        }
        if (state.method !== 'all') {
            const hasMethod = filtered.some(d => d.method !== undefined && d.method !== null);
            if (hasMethod) {
                filtered = filtered.filter(d => d.method === state.method);
            }
        }
    }

    const totalFines = d3.sum(filtered, d => Number(d.fines) || 0);
    const totalArrests = d3.sum(filtered, d => Number(d.arrests) || 0);
    const totalCharges = d3.sum(filtered, d => Number(d.charges) || 0);

    updateKPIDisplay(totalFines, totalArrests, totalCharges);
    updateKpiSubtitle(usingGeoData, isGlobalView);
}

function updateKPIDisplay(totalFines, totalArrests, totalCharges) {
    const kpiFines = document.getElementById('kpiFines');
    const kpiArrests = document.getElementById('kpiArrests');
    const kpiCharges = document.getElementById('kpiCharges');

    if (kpiFines) {
        if (totalFines >= 1e6) {
            kpiFines.textContent = '$' + (totalFines / 1e6).toFixed(1) + 'M';
        } else if (totalFines >= 1e3) {
            kpiFines.textContent = '$' + (totalFines / 1e3).toFixed(0) + 'K';
        } else {
            kpiFines.textContent = '$' + totalFines.toLocaleString();
        }
    }
    if (kpiArrests) kpiArrests.textContent = totalArrests.toLocaleString();
    if (kpiCharges) kpiCharges.textContent = totalCharges.toLocaleString();
}

function updateKpiSubtitle(usingGeoData, isGlobalView) {
    const kpiSubtitle = document.getElementById('kpiSubtitle');
    if (kpiSubtitle) {
        kpiSubtitle.style.display = 'none';
    }
}