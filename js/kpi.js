// js/kpi.js
// Key Performance Indicator Display - Shows total fines, arrests, charges

// ============================================================
// GLOBAL KPI CACHE - Pre-loaded data for performance
// ============================================================
// Stores pre-loaded global data. If null, we compute from intersectionData instead.
// This is an optimization: global view doesn't need to recalculate from raw data.
let globalKPI = null;

/**
 * Loads global_kpi.csv - pre-aggregated totals for the unfiltered view
 * 
 * WHY: When all filters are 'all', we can use this cached data instead of
 *      recalculating from intersectionData. Much faster.
 * 
 * FALLBACK: If file is missing, globalKPI stays null, and we compute
 *           from intersectionData instead.
 */
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

/**
 * Main rendering function - calculates KPI numbers based on current filters
 * 
 * DATA SOURCE PRIORITY (highest to lowest):
 * 1. globalKPI - Pre-loaded CSV (only when ALL filters are 'all')
 * 2. geoData - Aggregated by jurisdiction (when a specific state is selected)
 * 3. intersectionData - Computed from raw data (fallback for all other cases)
 * 
 * FILTER LOGIC:
 * - If all filters = 'all' → use globalKPI if available
 * - If jurisdiction is specific → try geoData first, fallback to intersectionData
 * - Otherwise → use intersectionData with age + method filters applied
 * 
 * IMPORTANT: geoData is already aggregated per jurisdiction, so we skip
 *            additional age/method filtering when using geoData.
 */
function renderKPI() {
    let filtered = [];
    let usingGeoData = false;  // Affects subtitle display
    let isGlobalView = false;  // Affects subtitle display

    // CASE 1: No filters applied - use globalKPI if available (fastest)
    if (state.jurisdiction === 'all' && state.age === 'all' && state.method === 'all') {
        if (globalKPI) {
            updateKPIDisplay(globalKPI.fines, globalKPI.arrests, globalKPI.charges);
            updateKpiSubtitle(true, true);
            return;
        }
        filtered = [...intersectionData];
        isGlobalView = true;
    }
    // CASE 2: Specific jurisdiction selected - try geoData first
    else if (state.jurisdiction !== 'all') {
        // geoData has pre-aggregated totals per jurisdiction (more efficient)
        if (geoData && geoData.length > 0) {
            const jurisData = geoData.find(d => d.jurisdiction === state.jurisdiction);
            if (jurisData) {
                filtered = [jurisData];
                usingGeoData = true;
            }
        }
        // If geoData doesn't have it, fall back to intersectionData
        if (filtered.length === 0 && intersectionData && intersectionData.length > 0) {
            filtered = [...intersectionData];
            filtered = filtered.filter(d => d.jurisdiction === state.jurisdiction);
        }
    }
    // CASE 3: Other filter combos (age/method without jurisdiction)
    else {
        filtered = [...intersectionData];
        isGlobalView = true;
    }

    // Apply age and method filters - but ONLY if we're using intersectionData
    // geoData is already aggregated, so we skip additional filtering
    if (!usingGeoData && filtered.length > 0) {
        if (state.age !== 'all') {
            filtered = filtered.filter(d => d.ageGroup === state.age);
        }
        if (state.method !== 'all') {
            // Check if data has method field before filtering
            const hasMethod = filtered.some(d => d.method !== undefined && d.method !== null);
            if (hasMethod) {
                filtered = filtered.filter(d => d.method === state.method);
            }
        }
    }

    // Sum up the totals using d3.sum (handles missing values gracefully)
    const totalFines = d3.sum(filtered, d => Number(d.fines) || 0);
    const totalArrests = d3.sum(filtered, d => Number(d.arrests) || 0);
    const totalCharges = d3.sum(filtered, d => Number(d.charges) || 0);

    // Push to UI
    updateKPIDisplay(totalFines, totalArrests, totalCharges);
    updateKpiSubtitle(usingGeoData, isGlobalView);
}

/**
 * Updates the three KPI boxes with formatted numbers
 * 
 * FORMATTING RULES:
 * - Fines: 
 *   - >= $1M → "$1.5M" (one decimal)
 *   - >= $1K → "$2.3K" (no decimal)
 *   - < $1K → "$950" (with commas)
 * - Arrests & Charges: 
 *   - Always with commas (e.g., "1,234")
 *   - No K/M suffix because they represent people counts
 */
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

/**
 * Updates the subtitle below KPI - currently hidden
 * Kept the params in case we want to show contextual info later
 */
function updateKpiSubtitle(usingGeoData, isGlobalView) {
    const kpiSubtitle = document.getElementById('kpiSubtitle');
    if (kpiSubtitle) {
        kpiSubtitle.style.display = 'none';
    }
}