// js/kpi.js

function renderKPI() {
    let filtered = [];
    let usingGeoData = false;

    if (state.jurisdiction !== 'all') {
        if (geoData && geoData.length > 0) {
            const jurisData = geoData.find(d => d.jurisdiction === state.jurisdiction);
            if (jurisData) {
                filtered = [jurisData];
                usingGeoData = true;
            }
        }
    }

    if (filtered.length === 0 && intersectionData && intersectionData.length > 0) {
        filtered = [...intersectionData];

        if (state.jurisdiction === 'all') {
            filtered = filtered.filter(d => d.location === 'All Regions');
        }

        if (state.age !== 'all') {
            filtered = filtered.filter(d => d.ageGroup === state.age);
        }

        if (state.method !== 'all' && filtered.length > 0 && filtered[0].method !== undefined) {
            filtered = filtered.filter(d => d.method === state.method);
        }
    }

    const totalFines = d3.sum(filtered, d => d.fines);
    const totalArrests = d3.sum(filtered, d => d.arrests);
    const totalCharges = d3.sum(filtered, d => d.charges);

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

    updateKpiSubtitle(usingGeoData);
}

function updateKpiSubtitle(usingGeoData) {
    let kpiSubtitle = document.querySelector('.kpi-subtitle');
    if (!kpiSubtitle) {
        const kpiRow = document.querySelector('.kpi-row');
        if (kpiRow && kpiRow.parentNode) {
            kpiSubtitle = document.createElement('div');
            kpiSubtitle.className = 'kpi-subtitle';
            kpiRow.parentNode.insertBefore(kpiSubtitle, kpiRow.nextSibling);
        }
        kpiSubtitle = document.querySelector('.kpi-subtitle');
    }

    if (kpiSubtitle) {
        const filterStatus = [];

        if (state.jurisdiction !== 'all') filterStatus.push(`Jurisdiction: ${state.jurisdiction}`);
        if (state.age !== 'all') filterStatus.push(`Age: ${state.age === '65 and over' ? '65+' : state.age}`);
        if (state.method !== 'all') filterStatus.push(`Method: ${state.method}`);

        if (filterStatus.length === 0) {
            kpiSubtitle.textContent = 'National totals across all ages and detection methods';
            kpiSubtitle.removeAttribute('data-filtered');
            kpiSubtitle.removeAttribute('data-jurisdiction');
        } else if (usingGeoData) {
            kpiSubtitle.textContent = `${state.jurisdiction} · Aggregate jurisdiction data`;
            kpiSubtitle.setAttribute('data-jurisdiction', 'true');
            kpiSubtitle.removeAttribute('data-filtered');
        } else {
            kpiSubtitle.textContent = filterStatus.join(' · ');
            kpiSubtitle.setAttribute('data-filtered', 'true');
            kpiSubtitle.removeAttribute('data-jurisdiction');
        }
    }
}