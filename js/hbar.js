function renderHBarChart() {
    if (state.jurisdiction === 'all') {
        renderViolationChart();
    } else {
        renderGeoChart();
    }
}

function getNiceTicks(maxValue, maxTicks) {
    // Generate at most 'maxTicks' evenly-spaced nice ticks from 0 to maxValue
    if (maxValue <= 0) return [0];

    // Determine nice step size
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

    // Ensure max value is included if close to last tick or if we have room
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

function getViolationColor(metric) {
    const colors = {
        'mobile_phone_use': '#2E86AB',
        'non_wearing_seatbelts': '#F9844A',
        'speed_fines': '#43AA8B',
        'unlicensed_driving': '#E63946'
    };
    return colors[metric] || '#2E86AB';
}

function getLocationColor(location) {
    const colors = {
        'Major Cities of Australia': '#2E86AB',
        'Inner Regional Australia': '#F9844A',
        'Outer Regional Australia': '#43AA8B',
        'Remote Australia': '#E63946',
        'Very Remote Australia': '#6A4C93'
    };
    return colors[location] || '#2E86AB';
}

function getEnhancedColor(baseColor, value, maxValue) {
    const ratio = value / maxValue;
    if (ratio < 0.05) {
        return d3.color(baseColor).darker(0.3).formatHex();
    }
    return baseColor;
}

function renderViolationChart() {
    const container = document.getElementById('hbarChart');
    if (!container) return;

    container.innerHTML = '';

    if (!intersectionData || intersectionData.length === 0) {
        container.innerHTML = '<div class="loading-state">Loading data...</div>';
        return;
    }

    let filtered = [...intersectionData];

    // Apply age filter if specific age selected
    if (state.age !== 'all') {
        filtered = filtered.filter(d => d.ageGroup === state.age);
    }

    // Always use 'All Regions' - this chart shows violation breakdown across ALL jurisdictions
    filtered = filtered.filter(d => d.location === 'All Regions');

    // Apply method filter only (NOT jurisdiction filter)
    if (state.method === 'all') {
        filtered = filtered.filter(d => d.method !== 'All Methods');
        filtered = filtered.filter(d => d.method !== 'Camera');
    } else {
        filtered = filtered.filter(d => d.method === state.method);
    }

    const metrics = ['mobile_phone_use', 'non_wearing_seatbelts', 'speed_fines', 'unlicensed_driving'];
    const metricLabels = {
        'mobile_phone_use': 'Mobile Phone Use',
        'non_wearing_seatbelts': 'Non-wearing Seatbelts',
        'speed_fines': 'Speed Fines',
        'unlicensed_driving': 'Unlicensed Driving'
    };

    let data = metrics.map(m => {
        const metricData = filtered.filter(f => f.metric === m);
        return {
            metric: m,
            label: metricLabels[m],
            fines: d3.sum(metricData, d => d.fines),
            arrests: d3.sum(metricData, d => d.arrests),
            charges: d3.sum(metricData, d => d.charges)
        };
    });

    const hasData = data.some(d => d.fines > 0);
    if (!hasData) {
        let reason = '';
        if (state.age !== 'all') {
            reason = 'No data for selected age group in this view. Try selecting "All Ages".';
        } else if (state.method !== 'all') {
            reason = 'No data for selected detection method in this view.';
        } else {
            reason = 'No data available for current filters.';
        }
        container.innerHTML = `<div class="no-data-state">${reason}</div>`;
        return;
    }

    data = data.sort((a, b) => b.fines - a.fines);

    const maxFines = d3.max(data, d => d.fines);

    setTimeout(() => {
        const rect = container.getBoundingClientRect();
        const width = Math.max(rect.width - 40, 380);
        const height = Math.max(rect.height - 40, 320);

        const margin = { top: 50, right: 90, bottom: 55, left: 170 };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        container.innerHTML = '';

        const svg = d3.select(container)
            .append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', `0 0 ${width} ${height}`)
            .attr('role', 'img')
            .attr('aria-label', 'Horizontal bar chart showing fines by violation type')
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        const yScale = d3.scaleBand()
            .domain(data.map(d => d.label))
            .range([0, innerHeight])
            .padding(0.3);

        // Always use linear scale
        const xMax = maxFines * 1.1;
        const xScale = d3.scaleLinear()
            .domain([0, xMax])
            .range([0, innerWidth]);

        // Calculate max ticks that can fit (each label needs ~55px for "$XXXK" format)
        const labelWidth = 55;
        const maxTicks = Math.max(2, Math.min(5, Math.floor(innerWidth / labelWidth)));
        const ticks = getNiceTicks(xMax, maxTicks);

        // Grid lines
        svg.append('g')
            .attr('class', 'grid-lines')
            .call(d3.axisTop(xScale).tickValues(ticks).tickSize(-innerHeight).tickFormat(''))
            .select('.domain').remove();

        // Bottom axis with calculated ticks
        svg.append('g')
            .attr('class', 'axis axis-bottom')
            .attr('transform', `translate(0,${innerHeight})`)
            .call(d3.axisBottom(xScale)
                .tickValues(ticks)
                .tickFormat(d => formatCurrency(d)));

        // X-axis label
        svg.append('text')
            .attr('class', 'axis-label axis-label-x')
            .attr('x', innerWidth / 2)
            .attr('y', innerHeight + 48)
            .attr('text-anchor', 'middle')
            .text('Total Fines ($)');

        // Y-axis
        svg.append('g')
            .attr('class', 'axis axis-left')
            .call(d3.axisLeft(yScale));

        // Draw bars
        svg.selectAll('rect.bar')
            .data(data)
            .enter()
            .append('rect')
            .attr('class', 'bar')
            .attr('y', d => yScale(d.label))
            .attr('x', 0)
            .attr('height', yScale.bandwidth())
            .attr('width', 0)
            .attr('fill', d => getEnhancedColor(getViolationColor(d.metric), d.fines, maxFines))
            .attr('stroke', d => {
                const baseColor = getViolationColor(d.metric);
                return d.fines / maxFines < 0.05 ? d3.color(baseColor).darker(0.5).formatHex() : 'none';
            })
            .attr('stroke-width', d => d.fines / maxFines < 0.05 ? 2 : 0)
            .style('cursor', 'pointer')
            .on('mouseenter', function (event, d) {
                d3.select(this).attr('opacity', 1);
                const ratio = d.fines > 0 ? (d.arrests / (d.fines / 1000)).toFixed(1) : '0';
                showTooltip(event, `
                    <div class="tooltip-title">${d.label}</div>
                    <div class="tooltip-row">Fines: ${formatCurrency(d.fines)}</div>
                    <div class="tooltip-row">Arrests: ${formatNumber(d.arrests)}</div>
                    <div class="tooltip-row">Charges: ${formatNumber(d.charges)}</div>
                    <div class="tooltip-footer">${ratio} arrests per $1K fines</div>
                `);
            })
            .on('mousemove', function (event, d) {
                const ratio = d.fines > 0 ? (d.arrests / (d.fines / 1000)).toFixed(1) : '0';
                showTooltip(event, `
                    <div class="tooltip-title">${d.label}</div>
                    <div class="tooltip-row">Fines: ${formatCurrency(d.fines)}</div>
                    <div class="tooltip-row">Arrests: ${formatNumber(d.arrests)}</div>
                    <div class="tooltip-row">Charges: ${formatNumber(d.charges)}</div>
                    <div class="tooltip-footer">${ratio} arrests per $1K fines</div>
                `);
            })
            .on('mouseleave', function () {
                d3.select(this).attr('opacity', 0.9);
                hideTooltip();
            })
            .transition()
            .duration(500)
            .attr('width', d => Math.max(xScale(d.fines), 4));

        // Dot markers
        svg.selectAll('circle.bar-dot')
            .data(data)
            .enter()
            .append('circle')
            .attr('class', 'bar-dot')
            .attr('cy', d => yScale(d.label) + yScale.bandwidth() / 2)
            .attr('cx', 0)
            .attr('r', d => {
                const ratio = d.fines / maxFines;
                return ratio < 0.05 ? 6 : (ratio < 0.2 ? 5 : 4);
            })
            .attr('fill', d => d3.color(getEnhancedColor(getViolationColor(d.metric), d.fines, maxFines)).darker(0.4).formatHex())
            .style('opacity', 0)
            .transition()
            .delay(400)
            .duration(400)
            .attr('cx', d => Math.max(xScale(d.fines), 4))
            .style('opacity', 1);

        // Data labels
        svg.selectAll('.hbar-value')
            .data(data.filter(d => d.fines > 0))
            .enter()
            .append('text')
            .attr('class', 'hbar-value')
            .attr('x', d => xScale(d.fines) + 6)
            .attr('y', d => yScale(d.label) + yScale.bandwidth() / 2 + 5)
            .attr('text-anchor', 'start')
            .text(d => formatCurrency(d.fines))
            .style('opacity', 0)
            .transition()
            .duration(550)
            .style('opacity', 1);

    }, 50);
}

function renderGeoChart() {
    const container = document.getElementById('hbarChart');
    if (!container) return;

    container.innerHTML = '';

    // When a specific jurisdiction is selected, use geoData instead of intersectionData
    // because intersectionData doesn't have jurisdiction-level granularity
    const targetJurisdiction = state.jurisdiction;

    // Check if we have geoData
    if (!geoData || geoData.length === 0) {
        container.innerHTML = '<div class="loading-state">Loading data...</div>';
        return;
    }

    // Filter geoData by jurisdiction
    let filtered = [...geoData];
    if (targetJurisdiction !== 'all') {
        filtered = filtered.filter(d => d.jurisdiction === targetJurisdiction);
    }

    if (!filtered.length) {
        container.innerHTML = `<div class="no-data-state">No data available for ${targetJurisdiction}</div>`;
        return;
    }

    // Sort by fines descending
    const data = filtered.sort((a, b) => b.fines - a.fines);

    const maxFines = d3.max(data, d => d.fines);

    setTimeout(() => {
        const rect = container.getBoundingClientRect();
        const width = Math.max(rect.width - 40, 380);
        const height = Math.max(rect.height - 40, 370);

        const margin = { top: 50, right: 90, bottom: 55, left: 140 };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        container.innerHTML = '';

        const svg = d3.select(container)
            .append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', `0 0 ${width} ${height}`)
            .attr('role', 'img')
            .attr('aria-label', 'Horizontal bar chart showing fines by jurisdiction')
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        const yScale = d3.scaleBand()
            .domain(data.map(d => d.jurisdiction))
            .range([0, innerHeight])
            .padding(0.3);

        // Always use linear scale
        const xMax = maxFines * 1.1;
        const xScale = d3.scaleLinear()
            .domain([0, xMax])
            .range([0, innerWidth]);

        // Calculate max ticks that can fit
        const labelWidth = 55;
        const maxTicks = Math.max(2, Math.min(5, Math.floor(innerWidth / labelWidth)));
        const ticks = getNiceTicks(xMax, maxTicks);

        // Grid lines
        svg.append('g')
            .attr('class', 'grid-lines')
            .call(d3.axisTop(xScale).tickValues(ticks).tickSize(-innerHeight).tickFormat(''))
            .select('.domain').remove();

        // Bottom axis
        svg.append('g')
            .attr('class', 'axis axis-bottom')
            .attr('transform', `translate(0,${innerHeight})`)
            .call(d3.axisBottom(xScale)
                .tickValues(ticks)
                .tickFormat(d => formatCurrency(d)));

        // X-axis label
        svg.append('text')
            .attr('class', 'axis-label axis-label-x')
            .attr('x', innerWidth / 2)
            .attr('y', innerHeight + 48)
            .attr('text-anchor', 'middle')
            .text('Total Fines ($)');

        // Y-axis
        svg.append('g')
            .attr('class', 'axis axis-left')
            .call(d3.axisLeft(yScale));

        // Jurisdiction colors
        const jurisdictionColors = {
            'ACT': '#2E86AB',
            'NSW': '#F9844A',
            'NT': '#43AA8B',
            'QLD': '#E63946',
            'SA': '#6A4C93',
            'TAS': '#F4A261',
            'VIC': '#2A9D8F',
            'WA': '#E76F51'
        };

        // Draw bars
        svg.selectAll('rect.bar')
            .data(data)
            .enter()
            .append('rect')
            .attr('class', 'bar')
            .attr('y', d => yScale(d.jurisdiction))
            .attr('x', 0)
            .attr('height', yScale.bandwidth())
            .attr('width', 0)
            .attr('fill', d => jurisdictionColors[d.jurisdiction] || '#2E86AB')
            .attr('rx', 4)
            .style('cursor', 'pointer')
            .on('mouseenter', function (event, d) {
                d3.select(this).attr('opacity', 1);
                const ratio = d.fines > 0 ? (d.arrests / (d.fines / 1000)).toFixed(1) : '0';
                showTooltip(event, `
                    <div class="tooltip-title">${d.jurisdiction}</div>
                    <div class="tooltip-row">Fines: ${formatCurrency(d.fines)}</div>
                    <div class="tooltip-row">Arrests: ${formatNumber(d.arrests)}</div>
                    <div class="tooltip-row">Charges: ${formatNumber(d.charges)}</div>
                    <div class="tooltip-footer">${ratio} arrests per $1K fines</div>
                `);
            })
            .on('mousemove', function (event, d) {
                const ratio = d.fines > 0 ? (d.arrests / (d.fines / 1000)).toFixed(1) : '0';
                showTooltip(event, `
                    <div class="tooltip-title">${d.jurisdiction}</div>
                    <div class="tooltip-row">Fines: ${formatCurrency(d.fines)}</div>
                    <div class="tooltip-row">Arrests: ${formatNumber(d.arrests)}</div>
                    <div class="tooltip-row">Charges: ${formatNumber(d.charges)}</div>
                    <div class="tooltip-footer">${ratio} arrests per $1K fines</div>
                `);
            })
            .on('mouseleave', function () {
                d3.select(this).attr('opacity', 0.9);
                hideTooltip();
            })
            .transition()
            .duration(500)
            .attr('width', d => Math.max(xScale(d.fines), 4));

        // Dot markers
        svg.selectAll('circle.bar-dot')
            .data(data)
            .enter()
            .append('circle')
            .attr('class', 'bar-dot')
            .attr('cy', d => yScale(d.jurisdiction) + yScale.bandwidth() / 2)
            .attr('cx', 0)
            .attr('r', 4)
            .attr('fill', d => d3.color(jurisdictionColors[d.jurisdiction] || '#2E86AB').darker(0.4).formatHex())
            .style('opacity', 0)
            .transition()
            .delay(400)
            .duration(400)
            .attr('cx', d => Math.max(xScale(d.fines), 4))
            .style('opacity', 1);

        // Data labels
        svg.selectAll('.hbar-value')
            .data(data.filter(d => d.fines > 0))
            .enter()
            .append('text')
            .attr('class', 'hbar-value')
            .attr('x', d => xScale(d.fines) + 6)
            .attr('y', d => yScale(d.jurisdiction) + yScale.bandwidth() / 2 + 5)
            .attr('text-anchor', 'start')
            .text(d => formatCurrency(d.fines))
            .style('opacity', 0)
            .transition()
            .duration(550)
            .style('opacity', 1);

    }, 50);
}