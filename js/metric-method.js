// js/metric-method.js
// Metrics and Detection Method Analysis with Proper Filter Support

let metricMethodData = [];
let currentMetric = 'speed_fines';

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
}

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
    const height = Math.max(rect.height - 40, 320);

    const margin = { top: 50, right: 80, bottom: 70, left: 85 };
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

    const methods = [...new Set(filtered.map(d => d.method))];
    methods.sort();

    const x = d3.scaleBand()
        .domain(methods)
        .range([0, innerWidth])
        .padding(0.25);

    const maxFines = d3.max(filtered, d => d.fines);
    const y = d3.scaleLinear()
        .domain([0, maxFines * 1.1])
        .range([innerHeight, 0]);

    const labelWidth = 55;
    const maxTicks = Math.max(2, Math.min(5, Math.floor(innerWidth / labelWidth)));
    const ticks = getNiceTicks(maxFines * 1.1, maxTicks);

    svg.append('g')
        .attr('class', 'axis axis-left')
        .call(d3.axisLeft(y).tickValues(ticks).tickFormat(d => formatCurrency(d)));

    svg.append('g')
        .attr('class', 'axis axis-bottom')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x))
        .selectAll('text')
        .attr('transform', 'rotate(-15)')
        .style('text-anchor', 'end');

    svg.append('text')
        .attr('class', 'axis-label-x')
        .attr('x', innerWidth / 2)
        .attr('y', innerHeight + 50)
        .attr('text-anchor', 'middle')
        .style('fill', '#2D3748')
        .style('font-weight', '600')
        .style('font-size', '12px')
        .text('Detection Method');

    svg.append('text')
        .attr('class', 'axis-label-y axis-label-y-left')
        .attr('x', -innerHeight / 2)
        .attr('y', -60)
        .attr('transform', 'rotate(-90)')
        .attr('text-anchor', 'middle')
        .style('fill', '#2D3748')
        .style('font-weight', '600')
        .style('font-size', '12px')
        .text('Total Fines');

    svg.selectAll('.area-bar')
        .data(filtered)
        .enter()
        .append('rect')
        .attr('class', 'area-bar')
        .attr('x', d => x(d.method))
        .attr('y', d => y(d.fines))
        .attr('width', x.bandwidth())
        .attr('height', d => innerHeight - y(d.fines))
        .attr('fill', getMetricColor(currentMetric))
        .attr('opacity', 0.85)
        .attr('rx', 4)
        .style('cursor', 'pointer')
        .on('mouseenter', function (event, d) {
            d3.select(this).attr('opacity', 1);
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
            d3.select(this).attr('opacity', 0.85);
            hideTooltip();
        });

    svg.selectAll('.value-label')
        .data(filtered)
        .enter()
        .append('text')
        .attr('x', d => x(d.method) + x.bandwidth() / 2)
        .attr('y', d => y(d.fines) - 5)
        .attr('text-anchor', 'middle')
        .style('font-size', '10px')
        .style('font-weight', '600')
        .style('fill', getMetricColor(currentMetric))
        .text(d => formatCurrency(d.fines));
}

function renderMetricDonutChart() {
    const container = document.getElementById('metricDonutChart');
    if (!container) return;

    initMetricMethodData();

    if (!metricMethodData.length) {
        container.innerHTML = '<div class="loading-state">No data available for current filters</div>';
        return;
    }

    const aggregated = d3.rollup(
        metricMethodData,
        v => d3.sum(v, d => d.fines),
        d => d.metric
    );

    let data = Array.from(aggregated, ([metric, fines]) => ({
        metric: metric,
        fines: fines
    })).sort((a, b) => b.fines - a.fines);

    const totalFines = d3.sum(data, d => d.fines);

    const rect = container.getBoundingClientRect();
    const width = Math.max(rect.width - 40, 380);
    const height = Math.max(rect.height - 40, 320);
    const radius = Math.min(width, height) / 2.5;

    container.innerHTML = '';

    const svg = d3.select(container)
        .append('svg')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .append('g')
        .attr('transform', `translate(${width / 2},${height / 2})`);

    const colorBlindFriendlyPalette = ['#4A90D9', '#E6635C', '#5DAF5A', '#F4A261'];

    const color = d3.scaleOrdinal()
        .domain(data.map(d => d.metric))
        .range(colorBlindFriendlyPalette);

    const pie = d3.pie()
        .value(d => d.fines)
        .sort(null);

    const arc = d3.arc()
        .innerRadius(radius * 0.55)
        .outerRadius(radius);

    const arcs = pie(data);

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

    const legendX = radius + 15;
    let legendY = -radius + 20;

    data.forEach((d, i) => {
        const legendRow = svg.append('g')
            .attr('transform', `translate(${legendX}, ${legendY + i * 22})`);

        legendRow.append('rect')
            .attr('width', 12)
            .attr('height', 12)
            .attr('fill', color(d.metric))
            .attr('rx', 2);

        legendRow.append('text')
            .attr('x', 18)
            .attr('y', 10)
            .style('font-size', '11px')
            .style('fill', '#2D3748')
            .style('font-weight', '500')
            .text(formatMetricShort(d.metric));
    });

    svg.append('text')
        .attr('text-anchor', 'middle')
        .attr('y', -radius - 8)
        .style('font-size', '13px')
        .style('font-weight', '700')
        .style('fill', '#2D3748')
        .text('Fines by Violation Type');

    svg.append('text')
        .attr('text-anchor', 'middle')
        .attr('y', -radius + 12)
        .style('font-size', '11px')
        .style('fill', '#718096')
        .text(`Total: ${formatCurrency(totalFines)}`);
}

function renderMethodBarChart() {
    const container = document.getElementById('methodBarChart');
    if (!container) return;

    initMetricMethodData();

    if (!metricMethodData.length) {
        container.innerHTML = '<div class="loading-state">No data available for current filters</div>';
        return;
    }

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

    data = data.slice(0, 8);
    const totalFines = d3.sum(data, d => d.fines);
    const maxFines = d3.max(data, d => d.fines);

    const rect = container.getBoundingClientRect();
    const width = Math.max(rect.width - 40, 400);
    const height = Math.max(rect.height - 40, 340);

    const margin = { top: 45, right: 120, bottom: 60, left: 145 };
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

    const y = d3.scaleBand()
        .domain(data.map(d => d.method))
        .range([0, innerHeight])
        .padding(0.2);

    const labelWidth = 55;
    const maxTicks = Math.max(2, Math.min(5, Math.floor(innerWidth / labelWidth)));
    const ticks = getNiceTicks(maxFines * 1.1, maxTicks);

    const xFines = d3.scaleLinear()
        .domain([0, maxFines * 1.1])
        .range([0, innerWidth]);

    svg.append('g')
        .attr('class', 'grid-lines')
        .call(d3.axisTop(xFines).tickValues(ticks).tickSize(-innerHeight).tickFormat(''))
        .select('.domain').remove();

    svg.append('g')
        .attr('class', 'axis axis-bottom')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(d3.axisBottom(xFines).tickValues(ticks).tickFormat(d => formatCurrency(d)));

    svg.append('g')
        .attr('class', 'axis axis-left')
        .call(d3.axisLeft(y));

    svg.append('text')
        .attr('class', 'axis-label-x')
        .attr('x', innerWidth / 2)
        .attr('y', innerHeight + 45)
        .attr('text-anchor', 'middle')
        .style('fill', '#2D3748')
        .style('font-weight', '600')
        .style('font-size', '12px')
        .text('Total Fines');

    svg.append('text')
        .attr('class', 'axis-label-y axis-label-y-left')
        .attr('x', -innerHeight / 2)
        .attr('y', -110)
        .attr('transform', 'rotate(-90)')
        .attr('text-anchor', 'middle')
        .style('fill', '#2D3748')
        .style('font-weight', '600')
        .style('font-size', '12px')
        .text('Detection Method');

    svg.selectAll('.method-bar-fines')
        .data(data)
        .enter()
        .append('rect')
        .attr('class', 'method-bar-fines')
        .attr('y', d => y(d.method))
        .attr('height', y.bandwidth())
        .attr('x', 0)
        .attr('width', 0)
        .attr('fill', '#4A90D9')
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

    svg.selectAll('.label-fines')
        .data(data.filter(d => d.fines > 0))
        .enter()
        .append('text')
        .attr('class', 'label-fines')
        .attr('x', d => xFines(d.fines) + 6)
        .attr('y', d => y(d.method) + y.bandwidth() / 2 + 5)
        .attr('text-anchor', 'start')
        .style('font-size', '10px')
        .style('font-weight', '600')
        .style('fill', '#4A90D9')
        .style('opacity', 0)
        .text(d => formatCurrency(d.fines))
        .transition()
        .duration(550)
        .style('opacity', 1);

    const legend = svg.append('g')
        .attr('transform', `translate(${innerWidth + 10}, 10)`);

    legend.append('rect')
        .attr('width', 12)
        .attr('height', 12)
        .attr('fill', '#4A90D9')
        .attr('rx', 2);

    legend.append('text')
        .attr('x', 18)
        .attr('y', 10)
        .style('font-size', '11px')
        .style('fill', '#2D3748')
        .style('font-weight', '500')
        .text('Total Fines');
}

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

function refreshMetricMethodCharts() {
    if (!rawData || rawData.length === 0) return;
    renderMetricDonutChart();
    renderMethodBarChart();
    renderMetricMethodAreaChart();
}

function initMetricMethodModule() {
    initMetricSelector();
    refreshMetricMethodCharts();
}

window.initMetricMethodModule = initMetricMethodModule;
window.refreshMetricMethodCharts = refreshMetricMethodCharts;