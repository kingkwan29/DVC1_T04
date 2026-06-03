// js/hbar.js
// Fixed: Dynamic scale with proper tick generation

function renderHBarChart() {
    if (state.jurisdiction === 'all') {
        renderViolationChart();
    } else {
        renderGeoChart();
    }
}

function getDynamicTicks(maxValue) {
    if (maxValue === 0) return { ticks: [0], maxDomain: 0 };

    // Add 10% padding to max value for better visual
    const paddedMax = maxValue * 1.1;

    // Calculate appropriate step size based on padded max
    let step;
    if (paddedMax <= 50000) {
        step = 10000;
    } else if (paddedMax <= 100000) {
        step = 25000;
    } else if (paddedMax <= 250000) {
        step = 50000;
    } else if (paddedMax <= 500000) {
        step = 100000;
    } else if (paddedMax <= 1000000) {
        step = 200000;
    } else if (paddedMax <= 2500000) {
        step = 500000;
    } else if (paddedMax <= 5000000) {
        step = 1000000;
    } else if (paddedMax <= 10000000) {
        step = 2000000;
    } else {
        step = 5000000;
    }

    // Calculate max domain (round up to nearest step)
    const maxDomain = Math.ceil(paddedMax / step) * step;

    // Generate 5 ticks evenly spaced
    const tickStep = maxDomain / 4;
    const ticks = [];
    for (let i = 0; i <= 4; i++) {
        let tickValue = i * tickStep;
        // Round to reasonable precision
        if (tickValue >= 1000000) {
            tickValue = Math.round(tickValue / 100000) * 100000;
        } else if (tickValue >= 1000) {
            tickValue = Math.round(tickValue / 1000) * 1000;
        }
        ticks.push(tickValue);
    }

    return { ticks: ticks, maxDomain: maxDomain };
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
        'unlicensed_driving': '#F9C74F'
    };
    return colors[metric] || '#2E86AB';
}

function getLocationColor(location) {
    const colors = {
        'Major Cities of Australia': '#2E86AB',
        'Inner Regional Australia': '#F9844A',
        'Outer Regional Australia': '#43AA8B',
        'Remote Australia': '#F9C74F',
        'Very Remote Australia': '#577590'
    };
    return colors[location] || '#2E86AB';
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

    if (state.age === 'all') {
        filtered = filtered.filter(d => d.ageGroup === 'All Ages');
    }

    filtered = filtered.filter(d => d.location === 'All Regions');

    if (state.method === 'all') {
        filtered = filtered.filter(d => d.method !== 'All Methods');
        filtered = filtered.filter(d => d.method !== 'Camera');
    } else {
        filtered = filtered.filter(d => d.method === state.method);
    }

    filtered = applyAllFilters(filtered);

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

    setTimeout(() => {
        const rect = container.getBoundingClientRect();
        const width = Math.max(rect.width - 40, 380);
        const height = Math.max(rect.height - 40, 320);

        const margin = { top: 30, right: 85, bottom: 45, left: 155 };
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
            .padding(0.35);

        const maxFines = d3.max(data, d => d.fines);
        const { ticks, maxDomain } = getDynamicTicks(maxFines);

        const xScale = d3.scaleLinear()
            .domain([0, maxDomain])
            .range([0, innerWidth]);

        // Grid lines
        svg.append('g')
            .call(d3.axisTop(xScale).tickValues(ticks).tickSize(-innerHeight).tickFormat(''))
            .style('color', '#E2E8F0')
            .style('stroke-dasharray', '3,3')
            .style('opacity', 0.4);

        // Bottom axis with proper ticks
        svg.append('g')
            .attr('transform', `translate(0,${innerHeight})`)
            .call(d3.axisBottom(xScale)
                .tickValues(ticks)
                .tickFormat(d => formatCurrency(d)))
            .style('color', '#2D3748')
            .style('font-size', '11px')
            .style('font-weight', '600');

        // X-axis label
        svg.append('text')
            .attr('x', innerWidth / 2)
            .attr('y', innerHeight + 38)
            .attr('text-anchor', 'middle')
            .style('font-size', '13px')
            .style('fill', '#2D3748')
            .style('font-weight', '700')
            .text('Total Fines');

        // Y-axis - bold labels
        svg.append('g')
            .call(d3.axisLeft(yScale))
            .style('color', '#2D3748')
            .style('font-size', '12px')
            .style('font-weight', '700');

        // Draw bars
        svg.selectAll('rect')
            .data(data)
            .enter()
            .append('rect')
            .attr('y', d => yScale(d.label))
            .attr('x', 0)
            .attr('height', yScale.bandwidth())
            .attr('width', 0)
            .attr('fill', d => getViolationColor(d.metric))
            .attr('opacity', 0.85)
            .attr('rx', 4)
            .style('cursor', 'pointer')
            .on('mouseenter', function (event, d) {
                d3.select(this).attr('opacity', 1);
                showTooltip(event, `
                    <div style="font-weight:700;color:#93c5fd;margin-bottom:6px;">${d.label}</div>
                    <div>Fines: ${formatCurrency(d.fines)}</div>
                    <div>Arrests: ${formatNumber(d.arrests)}</div>
                    <div>Charges: ${formatNumber(d.charges)}</div>
                `);
            })
            .on('mousemove', function (event, d) {
                showTooltip(event, `
                    <div style="font-weight:700;color:#93c5fd;margin-bottom:6px;">${d.label}</div>
                    <div>Fines: ${formatCurrency(d.fines)}</div>
                    <div>Arrests: ${formatNumber(d.arrests)}</div>
                    <div>Charges: ${formatNumber(d.charges)}</div>
                `);
            })
            .on('mouseleave', function () {
                d3.select(this).attr('opacity', 0.85);
                hideTooltip();
            })
            .transition()
            .duration(500)
            .attr('width', d => Math.max(xScale(d.fines), 4));

        // Data labels
        svg.selectAll('.hbar-value')
            .data(data.filter(d => d.fines > 0))
            .enter()
            .append('text')
            .attr('x', d => {
                const barWidth = xScale(d.fines);
                if (barWidth < 50) return barWidth + 8;
                return barWidth - 10;
            })
            .attr('y', d => yScale(d.label) + yScale.bandwidth() / 2 + 4)
            .attr('text-anchor', d => {
                const barWidth = xScale(d.fines);
                return barWidth < 50 ? 'start' : 'end';
            })
            .text(d => formatCurrency(d.fines))
            .style('font-size', '11px')
            .style('fill', d => {
                const barWidth = xScale(d.fines);
                return barWidth >= 50 ? '#FFFFFF' : '#2D3748';
            })
            .style('font-weight', '600')
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

    if (!intersectionData || intersectionData.length === 0) {
        container.innerHTML = '<div class="loading-state">Loading data...</div>';
        return;
    }

    const targetJurisdiction = state.jurisdiction;

    let filtered = [...intersectionData];
    filtered = filtered.filter(d => d.location !== 'All Regions');
    filtered = filtered.filter(d => d.ageGroup === 'All Ages');

    if (targetJurisdiction !== 'all') {
        filtered = filtered.filter(d => d.location === targetJurisdiction);
    }

    if (state.method === 'all') {
        filtered = filtered.filter(d => d.method !== 'All Methods');
        filtered = filtered.filter(d => d.method !== 'Camera');
    } else {
        filtered = filtered.filter(d => d.method === state.method);
    }

    const locationGroups = {};
    filtered.forEach(d => {
        const loc = d.location;
        if (!locationGroups[loc]) {
            locationGroups[loc] = { fines: 0, arrests: 0, charges: 0, location: loc };
        }
        locationGroups[loc].fines += d.fines;
        locationGroups[loc].arrests += d.arrests;
        locationGroups[loc].charges += d.charges;
    });

    let data = Object.values(locationGroups);

    const locationOrder = [
        'Major Cities of Australia',
        'Inner Regional Australia',
        'Outer Regional Australia',
        'Remote Australia',
        'Very Remote Australia'
    ];

    const locationLabels = {
        'Major Cities of Australia': 'Major Cities',
        'Inner Regional Australia': 'Inner Regional',
        'Outer Regional Australia': 'Outer Regional',
        'Remote Australia': 'Remote',
        'Very Remote Australia': 'Very Remote'
    };

    data = data.sort((a, b) => {
        const idxA = locationOrder.indexOf(a.location);
        const idxB = locationOrder.indexOf(b.location);
        return idxA - idxB;
    });

    data = data.map(d => ({
        ...d,
        displayLabel: locationLabels[d.location] || d.location
    }));

    if (!data.length) {
        let reason = `No geographic data available for ${targetJurisdiction}`;
        if (state.method !== 'all') {
            reason += ` with detection method "${state.method}"`;
        }
        container.innerHTML = `<div class="no-data-state">${reason}</div>`;
        return;
    }

    setTimeout(() => {
        const rect = container.getBoundingClientRect();
        const width = Math.max(rect.width - 40, 380);
        const height = Math.max(rect.height - 40, 370);

        const margin = { top: 30, right: 85, bottom: 45, left: 125 };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        container.innerHTML = '';

        const svg = d3.select(container)
            .append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', `0 0 ${width} ${height}`)
            .attr('role', 'img')
            .attr('aria-label', 'Horizontal bar chart showing fines by geographic location')
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        const yScale = d3.scaleBand()
            .domain(data.map(d => d.displayLabel))
            .range([0, innerHeight])
            .padding(0.35);

        const maxFines = d3.max(data, d => d.fines);
        const { ticks, maxDomain } = getDynamicTicks(maxFines);

        const xScale = d3.scaleLinear()
            .domain([0, maxDomain])
            .range([0, innerWidth]);

        // Grid lines
        svg.append('g')
            .call(d3.axisTop(xScale).tickValues(ticks).tickSize(-innerHeight).tickFormat(''))
            .style('color', '#E2E8F0')
            .style('stroke-dasharray', '3,3')
            .style('opacity', 0.4);

        // Bottom axis with proper ticks
        svg.append('g')
            .attr('transform', `translate(0,${innerHeight})`)
            .call(d3.axisBottom(xScale)
                .tickValues(ticks)
                .tickFormat(d => formatCurrency(d)))
            .style('color', '#2D3748')
            .style('font-size', '11px')
            .style('font-weight', '600');

        // X-axis label
        svg.append('text')
            .attr('x', innerWidth / 2)
            .attr('y', innerHeight + 38)
            .attr('text-anchor', 'middle')
            .style('font-size', '13px')
            .style('fill', '#2D3748')
            .style('font-weight', '700')
            .text('Total Fines');

        // Y-axis - bold labels
        svg.append('g')
            .call(d3.axisLeft(yScale))
            .style('color', '#2D3748')
            .style('font-size', '12px')
            .style('font-weight', '700');

        // Draw bars
        svg.selectAll('rect')
            .data(data)
            .enter()
            .append('rect')
            .attr('y', d => yScale(d.displayLabel))
            .attr('x', 0)
            .attr('height', yScale.bandwidth())
            .attr('width', 0)
            .attr('fill', d => getLocationColor(d.location))
            .attr('opacity', 0.85)
            .attr('rx', 4)
            .style('cursor', 'pointer')
            .on('mouseenter', function (event, d) {
                d3.select(this).attr('opacity', 1);
                showTooltip(event, `
                    <div style="font-weight:700;color:#93c5fd;margin-bottom:6px;">${d.displayLabel}</div>
                    <div>Fines: ${formatCurrency(d.fines)}</div>
                    <div>Arrests: ${formatNumber(d.arrests)}</div>
                    <div>Charges: ${formatNumber(d.charges)}</div>
                `);
            })
            .on('mousemove', function (event, d) {
                showTooltip(event, `
                    <div style="font-weight:700;color:#93c5fd;margin-bottom:6px;">${d.displayLabel}</div>
                    <div>Fines: ${formatCurrency(d.fines)}</div>
                    <div>Arrests: ${formatNumber(d.arrests)}</div>
                    <div>Charges: ${formatNumber(d.charges)}</div>
                `);
            })
            .on('mouseleave', function () {
                d3.select(this).attr('opacity', 0.85);
                hideTooltip();
            })
            .transition()
            .duration(500)
            .attr('width', d => Math.max(xScale(d.fines), 4));

        // Data labels
        svg.selectAll('.hbar-value')
            .data(data.filter(d => d.fines > 0))
            .enter()
            .append('text')
            .attr('x', d => {
                const barWidth = xScale(d.fines);
                if (barWidth < 50) return barWidth + 8;
                return barWidth - 10;
            })
            .attr('y', d => yScale(d.displayLabel) + yScale.bandwidth() / 2 + 4)
            .attr('text-anchor', d => {
                const barWidth = xScale(d.fines);
                return barWidth < 50 ? 'start' : 'end';
            })
            .text(d => formatCurrency(d.fines))
            .style('font-size', '11px')
            .style('fill', d => {
                const barWidth = xScale(d.fines);
                return barWidth >= 50 ? '#FFFFFF' : '#2D3748';
            })
            .style('font-weight', '600')
            .style('opacity', 0)
            .transition()
            .duration(550)
            .style('opacity', 1);

    }, 50);
}