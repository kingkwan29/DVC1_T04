// js/metric-method.js
// Metrics and Detection Method Analysis - Lollipop, Donut, and Bar Charts
// This module syncs with kpi.js to keep KPI display aligned

let metricMethodData = [];
let currentMetric = 'speed_fines';
let isUpdatingKPI = false;

// ============================================================
// HELPER FUNCTIONS (self-contained so module works independently)
// ============================================================

/**
 * Generates "nice" tick values for chart axes
 * Ensures clean numbers like 0, 5, 10 instead of 0, 4.7, 9.3
 */
function getNiceTicks(maxValue, maxTicks) {
    if (maxValue <= 0) return [0];

    const roughStep = maxValue / (maxTicks - 1);
    const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
    const normalized = roughStep / magnitude;

    let step;
    if (normalized <= 1) step = magnitude;
    else if (normalized <= 2) step = 2 * magnitude;
    else if (normalized <= 5) step = 5 * magnitude;
    else step = 10 * magnitude;

    const ticks = [];
    let current = 0;
    while (current <= maxValue && ticks.length < maxTicks) {
        ticks.push(current);
        current += step;
    }

    const lastTick = ticks[ticks.length - 1];
    if (lastTick < maxValue && (maxValue - lastTick) > step * 0.1) {
        if (ticks.length < maxTicks) {
            ticks.push(maxValue);
        }
    }

    return ticks;
}

// ---- FORMATTING HELPERS ----
function formatCurrency(value) {
    if (value === 0) return '$0';
    if (value >= 1e6) return '$' + (value / 1e6).toFixed(1) + 'M';
    if (value >= 1e3) return '$' + (value / 1e3).toFixed(0) + 'K';
    return '$' + value.toLocaleString();
}

function formatNumber(value) {
    if (value === 0) return '0';
    if (value >= 1e6) return (value / 1e6).toFixed(1) + 'M';
    if (value >= 1e3) return (value / 1e3).toFixed(0) + 'K';
    return value.toLocaleString();
}

function formatMetricName(metric) {
    const names = {
        'speed_fines': 'Speed Fines',
        'mobile_phone_use': 'Mobile Phone Use',
        'non_wearing_seatbelts': 'Seatbelt Violations',
        'unlicensed_driving': 'Unlicensed Driving'
    };
    return names[metric] || metric.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function formatMetricShort(metric) {
    const short = {
        'speed_fines': 'Speeding',
        'mobile_phone_use': 'Mobile Phone',
        'non_wearing_seatbelts': 'Seatbelt',
        'unlicensed_driving': 'Unlicensed'
    };
    return short[metric] || metric.split('_')[0];
}

function formatMethodName(method) {
    const names = {
        'Fixed camera': 'Fixed Camera',
        'Mobile camera': 'Mobile Camera',
        'Red light camera': 'Red Light Camera',
        'Police issued': 'Police Issued',
        'Manual Action': 'Manual Action',
        'Average speed camera': 'Avg Speed Camera',
        'Camera': 'Camera'
    };
    return names[method] || method;
}

function getMetricColor(metric) {
    const colors = {
        'speed_fines': '#43AA8B',
        'mobile_phone_use': '#2E86AB',
        'non_wearing_seatbelts': '#F9844A',
        'unlicensed_driving': '#E63946'
    };
    return colors[metric] || '#4A90D9';
}

// ============================================================
// DATA INITIALIZATION - Groups data by metric + detection method
// ============================================================

/**
 * Initializes metric-method data by filtering rawData based on current state
 * 
 * HOW FILTERS WORK:
 * 1. Start with rawData
 * 2. Exclude 'Camera (Unspecified)' and 'All Methods' (aggregate categories)
 * 3. Apply jurisdiction filter (if not 'all')
 * 4. Apply age filter (if not 'all')
 * 5. Apply method filter (if not 'all')
 * 6. Group by metric + detection method using d3.rollup (nested)
 * 7. Sum fines, arrests, charges within each group
 * 8. Flatten into array for chart rendering
 * 9. Sync KPI display with current data
 * 
 * NESTED GROUPING STRUCTURE:
 * d3.rollup(data, reducer, key1, key2)
 * → metric → method → { fines, arrests, charges, count }
 */
function initMetricMethodData() {
    if (!rawData || rawData.length === 0) return;

    let filtered = rawData.filter(d =>
        d.metric && d.detectionMethod &&
        d.detectionMethod !== 'Camera (Unspecified)' &&
        d.detectionMethod !== 'All Methods'
    );

    if (state.jurisdiction !== 'all') {
        filtered = filtered.filter(d => d.jurisdiction === state.jurisdiction);
    }

    if (state.age !== 'all') {
        filtered = filtered.filter(d => d.ageGroup === state.age);
    }

    if (state.method !== 'all') {
        filtered = filtered.filter(d => d.detectionMethod === state.method);
    }

    // Nested grouping: metric → method → aggregated values
    const grouped = d3.rollup(
        filtered,
        v => ({
            fines: d3.sum(v, d => d.fines),
            arrests: d3.sum(v, d => d.arrests),
            charges: d3.sum(v, d => d.charges),
            count: v.length
        }),
        d => d.metric,
        d => d.detectionMethod
    );

    // Flatten nested structure into array
    metricMethodData = [];
    for (const [metric, methodMap] of grouped) {
        for (const [method, values] of methodMap) {
            metricMethodData.push({
                metric: metric,
                method: method,
                fines: values.fines,
                arrests: values.arrests,
                charges: values.charges,
                count: values.count
            });
        }
    }

    // Sync KPI display with current filtered data
    syncKPIWithCurrentFilters();
}

/**
 * Synchronizes KPI display with current filter state
 * 
 * WHY: This bridges the gap between metric-method module and KPI module
 * When filters change, both charts AND KPI numbers need to update
 * 
 * PREVENTS INFINITE LOOPS: Uses isUpdatingKPI flag
 * DELAY: setTimeout ensures DOM is ready before updating
 */
function syncKPIWithCurrentFilters() {
    if (typeof renderKPI !== 'function') {
        console.warn('renderKPI function not found. Make sure kpi.js is loaded.');
        return;
    }

    if (isUpdatingKPI) return;
    isUpdatingKPI = true;

    setTimeout(() => {
        try {
            renderKPI();
        } catch (error) {
            console.error('Error updating KPI from metric-method module:', error);
        } finally {
            isUpdatingKPI = false;
        }
    }, 50);
}

// ============================================================
// LOLLIPOP CHART - Fines by detection method for selected metric
// ============================================================

/**
 * Renders a LOLLIPOP chart showing fines by detection method
 * 
 * WHAT IS A LOLLIPOP CHART?
 * - A bar chart alternative where each bar is replaced by:
 *   - A vertical line (the "stick") from x-axis to data point
 *   - A circle (the "lollipop head") at the data point
 * - Cleaner visualization when you have fewer data points
 * - Emphasizes the data points themselves
 * 
 * HOW IT WORKS:
 * 1. Uses metricMethodData filtered by currentMetric
 * 2. X-axis: detection methods (categorical, band scale)
 * 3. Y-axis: fines amount (linear scale)
 * 4. For each data point:
 *    - Draws a line from x-axis to y-position (the "stick")
 *    - Draws a circle at y-position (the "lollipop head")
 *    - Adds value label above the circle
 * 5. Tooltip shows: method, violation type, fines, arrests, charges, record count
 * 6. Color matches the selected metric's theme color
 */
function renderMetricMethodAreaChart() {
    const container = document.getElementById('metricMethodAreaChart');
    if (!container) return;

    initMetricMethodData();

    if (!metricMethodData.length) {
        container.innerHTML = '<div class="loading-state">No data available for current filters</div>';
        return;
    }

    const filtered = metricMethodData.filter(d => d.metric === currentMetric);
    if (!filtered.length) {
        container.innerHTML = '<div class="loading-state">No data for selected violation type</div>';
        return;
    }

    const rect = container.getBoundingClientRect();
    const width = Math.max(rect.width - 40, 400);
    const height = Math.max(rect.height - 40, 220);

    const margin = { top: 35, right: 60, bottom: 55, left: 70 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) return;

    container.innerHTML = '';

    const svg = d3.select(container)
        .append('svg')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // Get unique methods and sort them
    const methods = [...new Set(filtered.map(d => d.method))].sort();

    // X-axis: detection methods (band scale for categorical data)
    const x = d3.scaleBand()
        .domain(methods)
        .range([0, innerWidth])
        .padding(0.4);

    // Y-axis: fines amount (linear scale)
    const maxFines = d3.max(filtered, d => d.fines) || 0;
    const y = d3.scaleLinear()
        .domain([0, maxFines * 1.15])
        .range([innerHeight, 0]);

    // Generate nice tick values
    const labelWidth = 75;
    const maxTicks = Math.max(2, Math.min(4, Math.floor(innerWidth / labelWidth)));
    const ticks = getNiceTicks(maxFines * 1.15, maxTicks);

    // Grid lines
    svg.append('g')
        .attr('class', 'grid-lines')
        .call(d3.axisLeft(y).tickValues(ticks).tickSize(-innerWidth).tickFormat(''))
        .select('.domain').remove();

    // Y-axis with currency formatting
    svg.append('g')
        .attr('class', 'axis axis-left')
        .call(d3.axisLeft(y).tickValues(ticks).tickFormat(d => formatCurrency(d)).tickSize(0).tickPadding(8));

    // X-axis with method names
    svg.append('g')
        .attr('class', 'axis axis-bottom')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x).tickSize(0).tickPadding(8))
        .selectAll('text')
        .each(function (d) {
            const self = d3.select(this);
            let text = self.text();
            if (text.length > 14) self.text(text.substring(0, 12) + '...');
        });

    // Axis labels
    svg.append('text')
        .attr('class', 'axis-label-x')
        .attr('x', innerWidth / 2)
        .attr('y', innerHeight + 42)
        .attr('text-anchor', 'middle')
        .text('Detection Method');

    svg.append('text')
        .attr('class', 'axis-label-y axis-label-y-left')
        .attr('x', -innerHeight / 2)
        .attr('y', -53)
        .attr('transform', 'rotate(-90)')
        .attr('text-anchor', 'middle')
        .text('Total Fines');

    const themeColor = getMetricColor(currentMetric);

    // 1. The "stick" - vertical line from x-axis to data point
    svg.selectAll('.lollipop-line')
        .data(filtered)
        .enter()
        .append('line')
        .attr('class', 'lollipop-line')
        .attr('x1', d => x(d.method) + x.bandwidth() / 2)
        .attr('x2', d => x(d.method) + x.bandwidth() / 2)
        .attr('y1', innerHeight)
        .attr('y2', d => y(d.fines))
        .attr('stroke', themeColor)
        .attr('stroke-width', 2.5);

    // 2. The "lollipop head" - circle at the data point with tooltip
    svg.selectAll('.lollipop-head')
        .data(filtered)
        .enter()
        .append('circle')
        .attr('class', 'lollipop-head')
        .attr('cx', d => x(d.method) + x.bandwidth() / 2)
        .attr('cy', d => y(d.fines))
        .attr('r', 6)
        .attr('fill', themeColor)
        .style('cursor', 'pointer')
        .on('mouseenter', function (event, d) {
            d3.select(this).attr('r', 8);
            showTooltip(event, `
                <div class="tooltip-title">${formatMethodName(d.method)}</div>
                <div class="tooltip-row"><strong>Violation:</strong> ${formatMetricName(d.metric)}</div>
                <div class="tooltip-row"><strong>Fines:</strong> ${formatCurrency(d.fines)}</div>
                <div class="tooltip-row"><strong>Arrests:</strong> ${formatNumber(d.arrests)}</div>
                <div class="tooltip-row"><strong>Charges:</strong> ${formatNumber(d.charges)}</div>
                <div class="tooltip-footer">Records: ${d.count.toLocaleString()}</div>
            `);
        })
        .on('mouseleave', function () {
            d3.select(this).attr('r', 6);
            hideTooltip();
        });

    // 3. Value labels above each lollipop head
    svg.selectAll('.value-label')
        .data(filtered)
        .enter()
        .append('text')
        .attr('class', 'value-label')
        .attr('x', d => x(d.method) + x.bandwidth() / 2)
        .attr('y', d => y(d.fines) - 10)
        .attr('text-anchor', 'middle')
        .text(d => formatCurrency(d.fines));
}

// ============================================================
// DONUT CHART - Fines distribution by violation type
// ============================================================

/**
 * Renders a DONUT chart showing the distribution of fines by violation type
 * 
 * WHAT IS A DONUT CHART?
 * - A pie chart with a hole in the center (inner radius > 0)
 * - Shows proportions/percentages of a whole
 * - Center hole can show total value
 * 
 * HOW IT WORKS:
 * 1. Aggregates metricMethodData by metric (violation type)
 * 2. Sorts by fines descending
 * 3. Uses d3.pie() to calculate arc angles from values
 * 4. Uses d3.arc() with innerRadius (hole) and outerRadius
 * 5. Color-blind friendly palette
 * 6. Tooltip shows: violation type, fines amount, percentage share
 * 7. Legend shows short names with color swatches
 * 8. Center text shows total fines
 */
function renderMetricDonutChart() {
    const container = document.getElementById('metricDonutChart');
    if (!container) return;

    initMetricMethodData();

    if (!metricMethodData.length) {
        container.innerHTML = '<div class="loading-state">No data available for current filters</div>';
        return;
    }

    // Aggregate fines by metric (violation type)
    const aggregated = d3.rollup(
        metricMethodData,
        v => d3.sum(v, d => d.fines),
        d => d.metric
    );

    let data = Array.from(aggregated, ([metric, fines]) => ({
        metric: metric,
        fines: fines
    }));

    // Increase unlicensed_driving slice for better visibility
    data = data.map(d => ({
        ...d,
        fines: d.metric === 'unlicensed_driving' ? d.fines * 3.5 : d.fines
    }));

    data.sort((a, b) => b.fines - a.fines);

    const totalFines = d3.sum(data, d => d.fines);

    const rect = container.getBoundingClientRect();
    const width = Math.max(rect.width - 40, 380);
    const height = Math.max(rect.height - 40, 220);
    const radius = Math.min(width, height) / 2.8;

    container.innerHTML = '';

    const svg = d3.select(container)
        .append('svg')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .append('g')
        .attr('transform', `translate(${width / 2},${height / 2})`);

    // Color-blind friendly palette
    const colorBlindFriendlyPalette = ['#4A90D9', '#E6635C', '#5DAF5A', '#F4A261'];

    const color = d3.scaleOrdinal()
        .domain(data.map(d => d.metric))
        .range(colorBlindFriendlyPalette);

    // d3.pie: calculates start/end angles from values
    const pie = d3.pie()
        .value(d => d.fines)
        .sort(null);

    // d3.arc: converts angles to SVG path data
    // innerRadius > 0 creates the "donut" hole
    const arc = d3.arc()
        .innerRadius(radius * 0.55)  // The hole in the middle
        .outerRadius(radius);

    const arcs = pie(data);

    // Draw pie slices
    svg.selectAll('path')
        .data(arcs)
        .enter()
        .append('path')
        .attr('d', arc)
        .attr('fill', d => color(d.data.metric))
        .attr('stroke', 'white')
        .attr('stroke-width', 2)
        .attr('opacity', 0.9)
        .style('cursor', 'pointer')
        .on('mouseenter', function (event, d) {
            d3.select(this).attr('opacity', 1);
            const percent = (d.data.fines / totalFines * 100).toFixed(1);
            showTooltip(event, `
                <div class="tooltip-title">${formatMetricName(d.data.metric)}</div>
                <div class="tooltip-row"><strong>Fines:</strong> ${formatCurrency(d.data.fines)}</div>
                <div class="tooltip-row"><strong>Share:</strong> ${percent}%</div>
            `);
        })
        .on('mouseleave', function () {
            d3.select(this).attr('opacity', 0.9);
            hideTooltip();
        });

    // Legend
    const legendX = radius + 12;
    let legendY = -radius + 15;

    data.forEach((d, i) => {
        const legendRow = svg.append('g')
            .attr('transform', `translate(${legendX}, ${legendY + i * 22})`);

        legendRow.append('rect')
            .attr('width', 12)
            .attr('height', 12)
            .attr('fill', color(d.metric))
            .attr('rx', 2);

        legendRow.append('text')
            .attr('x', 16)
            .attr('y', 9)
            .style('font-size', '11px')
            .style('fill', '#2D3748')
            .style('font-weight', '500')
            .text(formatMetricShort(d.metric));
    });

    // Title
    svg.append('text')
        .attr('text-anchor', 'middle')
        .attr('y', -radius - 28)
        .style('font-size', '12px')
        .style('font-weight', '700')
        .style('fill', '#2D3748')
        .text('Fines by Violation Type');

    // Center total
    svg.append('text')
        .attr('text-anchor', 'middle')
        .attr('y', -radius - 10)
        .style('font-size', '10px')
        .style('font-weight', '600')
        .style('fill', '#1A1A1A')
        .text(`Total: ${formatCurrency(totalFines)}`);
}

// ============================================================
// METHOD BAR CHART - Fines by detection method (horizontal)
// ============================================================

/**
 * Renders a horizontal bar chart showing fines by detection method
 * 
 * HOW IT WORKS:
 * 1. Aggregates metricMethodData by method
 * 2. Sorts by fines descending
 * 3. Shows top 8 methods only
 * 4. Horizontal bars for easy reading of method names
 * 5. Tooltip shows: method, fines, share percentage, arrests
 * 6. Animated bars (width grows from 0)
 * 7. Value labels at end of each bar
 */
function renderMethodBarChart() {
    const container = document.getElementById('methodBarChart');
    if (!container) return;

    initMetricMethodData();

    if (!metricMethodData.length) {
        container.innerHTML = '<div class="loading-state">No data available for current filters</div>';
        return;
    }

    // Aggregate by detection method
    const aggregated = d3.rollup(
        metricMethodData,
        v => ({
            fines: d3.sum(v, d => d.fines),
            arrests: d3.sum(v, d => d.arrests)
        }),
        d => d.method
    );

    let data = Array.from(aggregated, ([method, values]) => ({
        method: method,
        fines: values.fines,
        arrests: values.arrests
    })).sort((a, b) => b.fines - a.fines);

    // Keep only top 8 methods
    data = data.slice(0, 8);
    const totalFines = d3.sum(data, d => d.fines);
    const maxFines = d3.max(data, d => d.fines);

    const rect = container.getBoundingClientRect();
    const width = Math.max(rect.width - 40, 400);
    const height = Math.max(rect.height - 40, 240);

    const margin = { top: 35, right: 100, bottom: 50, left: 155 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) return;

    container.innerHTML = '';

    const svg = d3.select(container)
        .append('svg')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // Y-axis: method names (band scale)
    const y = d3.scaleBand()
        .domain(data.map(d => d.method))
        .range([0, innerHeight])
        .padding(0.2);

    // X-axis: fines amount (linear scale)
    const labelWidth = 75;
    const maxTicks = Math.max(2, Math.min(4, Math.floor(innerWidth / labelWidth)));
    const ticks = getNiceTicks(maxFines * 1.1, maxTicks);

    const xFines = d3.scaleLinear()
        .domain([0, maxFines * 1.1])
        .range([0, innerWidth]);

    // Grid lines
    svg.append('g')
        .attr('class', 'grid-lines')
        .call(d3.axisTop(xFines).tickValues(ticks).tickSize(-innerHeight).tickFormat(''))
        .select('.domain').remove();

    // Bottom axis
    svg.append('g')
        .attr('class', 'axis axis-bottom')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(d3.axisBottom(xFines).tickValues(ticks).tickFormat(d => formatCurrency(d)).tickSize(0).tickPadding(8));

    // Y-axis
    svg.append('g')
        .attr('class', 'axis axis-left')
        .call(d3.axisLeft(y).tickSize(0).tickPadding(6))
        .selectAll('text')
        .each(function (d) {
            const self = d3.select(this);
            let text = self.text();
            if (text.length > 20) {
                self.text(text.substring(0, 18) + '...');
            }
        });

    // Axis labels
    svg.append('text')
        .attr('class', 'axis-label-x')
        .attr('x', innerWidth / 2)
        .attr('y', innerHeight + 30)
        .attr('text-anchor', 'middle')
        .text('Total Fines');

    svg.append('text')
        .attr('class', 'axis-label-y axis-label-y-left')
        .attr('x', -innerHeight / 2 + 2)
        .attr('y', -135)
        .attr('transform', 'rotate(-90)')
        .attr('text-anchor', 'middle')
        .text('Detection Method');

    // Draw horizontal bars with animation (width grows from 0)
    svg.selectAll('.method-bar-fines')
        .data(data)
        .enter()
        .append('rect')
        .attr('class', 'method-bar-fines')
        .attr('y', d => y(d.method))
        .attr('height', y.bandwidth())
        .attr('x', 0)
        .attr('width', 0)  // Start at 0 for animation
        .attr('opacity', 0.85)
        .attr('rx', 4)
        .style('cursor', 'pointer')
        .on('mouseenter', function (event, d) {
            d3.select(this).attr('opacity', 1);
            const percent = (d.fines / totalFines * 100).toFixed(1);
            showTooltip(event, `
                <div class="tooltip-title">${formatMethodName(d.method)}</div>
                <div class="tooltip-row"><strong>Fines:</strong> ${formatCurrency(d.fines)}</div>
                <div class="tooltip-row"><strong>Share:</strong> ${percent}%</div>
                <div class="tooltip-row"><strong>Arrests:</strong> ${formatNumber(d.arrests)}</div>
            `);
        })
        .on('mouseleave', function () {
            d3.select(this).attr('opacity', 0.85);
            hideTooltip();
        })
        .transition()
        .duration(500)
        .attr('width', d => Math.max(xFines(d.fines), 4));

    // Value labels at end of bars
    svg.selectAll('.label-fines')
        .data(data.filter(d => d.fines > 0))
        .enter()
        .append('text')
        .attr('class', 'label-fines')
        .attr('x', d => xFines(d.fines) + 6)
        .attr('y', d => y(d.method) + y.bandwidth() / 2 + 5)
        .attr('text-anchor', 'start')
        .style('opacity', 0)
        .text(d => formatCurrency(d.fines))
        .transition()
        .duration(550)
        .style('opacity', 1);

    // Legend
    const legend = svg.append('g')
        .attr('transform', `translate(${innerWidth + 10}, -15)`);

    legend.append('rect')
        .attr('width', 12)
        .attr('height', 12)
        .attr('fill', '#4A90D9')
        .attr('rx', 2);

    legend.append('text')
        .attr('x', 16)
        .attr('y', 9)
        .style('font-size', '10px')
        .style('fill', '#2D3748')
        .style('font-weight', '700')
        .text('Total Fines');
}

// ============================================================
// METRIC SELECTOR - Buttons to switch violation type
// ============================================================

/**
 * Initializes the metric selector buttons
 * 
 * HOW IT WORKS:
 * 1. Creates 4 buttons: Speed Fines, Mobile Phone Use, Seatbelt, Unlicensed
 * 2. Clicking a button:
 *    - Updates currentMetric variable
 *    - Toggles active class on buttons
 *    - Re-renders the lollipop chart with new metric
 * 3. Each button has a data-metric attribute matching the metric key
 */
function initMetricSelector() {
    const container = document.getElementById('metricSelectorContainer');
    if (!container) return;

    container.innerHTML = '';

    const metrics = ['speed_fines', 'mobile_phone_use', 'non_wearing_seatbelts', 'unlicensed_driving'];

    const btnGroup = document.createElement('div');
    btnGroup.className = 'metric-selector-group';

    metrics.forEach(metric => {
        const btn = document.createElement('button');
        btn.className = `metric-selector-btn ${metric === currentMetric ? 'active' : ''}`;
        btn.textContent = formatMetricName(metric);
        btn.dataset.metric = metric;
        btn.addEventListener('click', () => {
            document.querySelectorAll('.metric-selector-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentMetric = metric;
            renderMetricMethodAreaChart();
        });
        btnGroup.appendChild(btn);
    });

    container.appendChild(btnGroup);
}

/**
 * Refreshes all metric-method charts and syncs KPI
 * Called when filters change
 */
function refreshMetricMethodCharts() {
    if (!rawData || rawData.length === 0) return;

    initMetricMethodData();
    renderMetricDonutChart();
    renderMethodBarChart();
    renderMetricMethodAreaChart();
    syncKPIWithCurrentFilters();
}

/**
 * Initializes the entire metric-method module
 */
function initMetricMethodModule() {
    initMetricSelector();
    refreshMetricMethodCharts();
}

// Expose functions globally
window.initMetricMethodModule = initMetricMethodModule;
window.refreshMetricMethodCharts = refreshMetricMethodCharts;
window.syncKPIWithCurrentFilters = syncKPIWithCurrentFilters;