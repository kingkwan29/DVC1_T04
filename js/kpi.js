function renderKPI() {
    if (kpiData && kpiData.fines !== undefined) {
        document.getElementById('kpiFines').textContent = '$' + (kpiData.fines / 1e6).toFixed(1) + 'M';
        document.getElementById('kpiArrests').textContent = kpiData.arrests.toLocaleString();
        document.getElementById('kpiCharges').textContent = kpiData.charges.toLocaleString();
    } else {
        document.getElementById('kpiFines').textContent = '—';
        document.getElementById('kpiArrests').textContent = '—';
        document.getElementById('kpiCharges').textContent = '—';
    }
}