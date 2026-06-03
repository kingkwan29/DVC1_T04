function renderHBarChart() {
    if (state.jurisdiction === 'all') {
        renderViolationChart();
    } else {
        renderGeoChart();
    }
}

function getLogTicks(minValue, maxValue) {
    // Law #13: Dynamic ticks based on actual data range
    // Remove ticks outside data range to reduce cognitive load
    const minLog = Math.floor(Math.log10(Math.max(minValue, 1)));
    const maxLog = Math.ceil(Math.log10(maxValue));

    const ticks = [];
    for (let i = minLog; i <= maxLog; i++) {
        ticks.push(Math.pow(10, i));
    }

    // Add intermediate ticks for better granularity if range is small
    if (maxLog - minLog <= 2) {
        const newTicks = [];
        for (let i = minLog; i < maxLog; i++) {
            const base = Math.pow(10, i);
            newTicks.push(base);
            newTicks.push(base * 2);
            newTicks.push(base * 5);
        }
        newTicks.push(Math.pow(10, maxLog));
        return newTicks.filter(t => t >= minValue * 0.3 && t <= maxValue * 3);
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

// Law #3, #4: Enhanced color for small bars
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

    const maxFines = d3.max(data, d => d.fines);
    const minFines = d3.min(data.filter(d => d.fines > 0), d => d.fines);
    const useLogScale = maxFines / minFines > 50;

    setTimeout(() => {
        const rect = container.getBoundingClientRect();
        const width = Math.max(rect.width - 40, 380);
        const height = Math.max(rect.height - 40, 320);

        const margin = { top: 45, right: 85, bottom: 50, left: 160 };
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

        let xScale;
        let ticks;

        if (useLogScale) {
            // Law #1: Log scale with dynamic ticks based on data range
            ticks = getLogTicks(minFines, maxFines);
            xScale = d3.scaleLog()
                .domain([Math.max(minFines * 0.3, 1), maxFines * 1.1])
                .range([0, innerWidth]);
        } else {
            ticks = [0, maxFines * 0.25, maxFines * 0.5, maxFines * 0.75, maxFines];
            xScale = d3.scaleLinear()
                .domain([0, maxFines * 1.1])
                .range([0, innerWidth]);
        }

        // Grid lines - fewer for log scale
        if (useLogScale) {
            svg.append('g')
                .call(d3.axisTop(xScale).tickValues(ticks).tickSize(-innerHeight).tickFormat(''))
                .style('stroke', '#E2E8F0')
                .style('stroke-dasharray', '2,4')
                .style('opacity', 0.25)
                .select('.domain').remove();
        } else {
            svg.append('g')
                .call(d3.axisTop(xScale).tickValues(ticks).tickSize(-innerHeight).tickFormat(''))
                .style('stroke', '#E2E8F0')
                .style('stroke-dasharray', '2,4')
                .style('opacity', 0.3)
                .select('.domain').remove();
        }

        // Bottom axis
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
            .attr('y', innerHeight + 42)
            .attr('text-anchor', 'middle')
            .style('font-size', '13px')
            .style('fill', '#2D3748')
            .style('font-weight', '700')
            .text(useLogScale ? 'Total Fines ($) — Log Scale' : 'Total Fines ($)');

        // Y-axis
        svg.append('g')
            .call(d3.axisLeft(yScale))
            .style('color', '#2D3748')
            .style('font-size', '12px')
            .style('font-weight', '700');

        // Log scale indicator
        if (useLogScale) {
            svg.append('text')
                .attr('x', innerWidth - 5)
                .attr('y', -20)
                .attr('text-anchor', 'end')
                .style('font-size', '10px')
                .style('fill', '#9CA3AF')
                .style('font-style', 'italic')
                .text('Log scale: bar length reflects magnitude');
        }

        // Draw bars with enhanced visibility for small values
        const bars = svg.selectAll('rect.bar')
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
            .attr('opacity', 0.9)
            .attr('rx', 5) // Slightly larger radius for better visual
            .style('cursor', 'pointer')
            .on('mouseenter', function (event, d) {
                d3.select(this).attr('opacity', 1);
                const ratio = d.fines > 0 ? (d.arrests / (d.fines / 1000)).toFixed(1) : '0';
                showTooltip(event, `
                    <div style="font-weight:700;color:#93c5fd;margin-bottom:8px;font-size:14px;">${d.label}</div>
                    <div style="margin-bottom:4px;">Fines: ${formatCurrency(d.fines)}</div>
                    <div style="margin-bottom:4px;">Arrests: ${formatNumber(d.arrests)}</div>
                    <div style="margin-bottom:4px;">Charges: ${formatNumber(d.charges)}</div>
                    <div style="margin-top:6px;padding-top:6px;border-top:1px solid #374151;font-size:12px;color:#9CA3AF;">
                        ${ratio} arrests per $1K fines
                    </div>
                `);
            })
            .on('mousemove', function (event, d) {
                const ratio = d.fines > 0 ? (d.arrests / (d.fines / 1000)).toFixed(1) : '0';
                showTooltip(event, `
                    <div style="font-weight:700;color:#93c5fd;margin-bottom:8px;font-size:14px;">${d.label}</div>
                    <div style="margin-bottom:4px;">Fines: ${formatCurrency(d.fines)}</div>
                    <div style="margin-bottom:4px;">Arrests: ${formatNumber(d.arrests)}</div>
                    <div style="margin-bottom:4px;">Charges: ${formatNumber(d.charges)}</div>
                    <div style="margin-top:6px;padding-top:6px;border-top:1px solid #374151;font-size:12px;color:#9CA3AF;">
                        ${ratio} arrests per $1K fines
                    </div>
                `);
            })
            .on('mouseleave', function () {
                d3.select(this).attr('opacity', 0.9);
                hideTooltip();
            })
            .transition()
            .duration(500)
            .attr('width', d => Math.max(xScale(d.fines), useLogScale ? xScale(Math.max(minFines * 0.3, 1)) + 4 : 4));

        // Law #3, #6: Dot markers at bar end for enhanced visibility
        svg.selectAll('circle.bar-dot')
            .data(data)
            .enter()
            .append('circle')
            .attr('class', 'bar-dot')
            .attr('cy', d => yScale(d.label) + yScale.bandwidth() / 2)
            .attr('cx', 0)
            .attr('r', d => {
                const ratio = d.fines / maxFines;
                // Larger dots for smaller bars to enhance visibility
                return ratio < 0.05 ? 6 : (ratio < 0.2 ? 5 : 4);
            })
            .attr('fill', d => d3.color(getEnhancedColor(getViolationColor(d.metric), d.fines, maxFines)).darker(0.4).formatHex())
            .attr('stroke', '#FFFFFF')
            .attr('stroke-width', 2)
            .style('opacity', 0)
            .style('pointer-events', 'none')
            .transition()
            .delay(400)
            .duration(400)
            .attr('cx', d => Math.max(xScale(d.fines), useLogScale ? xScale(Math.max(minFines * 0.3, 1)) + 4 : 4))
            .style('opacity', 1);

        // Data labels - refined spacing (Law #13)
        svg.selectAll('.hbar-value')
            .data(data.filter(d => d.fines > 0))
            .enter()
            .append('text')
            .attr('x', d => {
                const barWidth = xScale(d.fines);
                // Tighter spacing: 6px instead of 8px
                return barWidth + 6;
            })
            .attr('y', d => yScale(d.label) + yScale.bandwidth() / 2 + 4)
            .attr('text-anchor', 'start')
            .text(d => formatCurrency(d.fines))
            .style('font-size', '11px')
            .style('fill', '#2D3748')
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

        const margin = { top: 45, right: 85, bottom: 50, left: 130 };
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
            .padding(0.3);

        const maxFines = d3.max(data, d => d.fines);
        const minFines = d3.min(data.filter(d => d.fines > 0), d => d.fines);
        const useLogScale = maxFines / minFines > 50;

        let xScale;
        let ticks;

        if (useLogScale) {
            ticks = getLogTicks(minFines, maxFines);
            xScale = d3.scaleLog()
                .domain([Math.max(minFines * 0.3, 1), maxFines * 1.1])
                .range([0, innerWidth]);
        } else {
            ticks = [0, maxFines * 0.25, maxFines * 0.5, maxFines * 0.75, maxFines];
            xScale = d3.scaleLinear()
                .domain([0, maxFines * 1.1])
                .range([0, innerWidth]);
        }

        // Grid lines
        if (useLogScale) {
            svg.append('g')
                .call(d3.axisTop(xScale).tickValues(ticks).tickSize(-innerHeight).tickFormat(''))
                .style('stroke', '#E2E8F0')
                .style('stroke-dasharray', '2,4')
                .style('opacity', 0.25)
                .select('.domain').remove();
        } else {
            svg.append('g')
                .call(d3.axisTop(xScale).tickValues(ticks).tickSize(-innerHeight).tickFormat(''))
                .style('stroke', '#E2E8F0')
                .style('stroke-dasharray', '2,4')
                .style('opacity', 0.3)
                .select('.domain').remove();
        }

        // Bottom axis
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
            .attr('y', innerHeight + 42)
            .attr('text-anchor', 'middle')
            .style('font-size', '13px')
            .style('fill', '#2D3748')
            .style('font-weight', '700')
            .text(useLogScale ? 'Total Fines ($) — Log Scale' : 'Total Fines ($)');

        // Y-axis
        svg.append('g')
            .call(d3.axisLeft(yScale))
            .style('color', '#2D3748')
            .style('font-size', '12px')
            .style('font-weight', '700');

        // Log scale indicator
        if (useLogScale) {
            svg.append('text')
                .attr('x', innerWidth - 5)
                .attr('y', -20)
                .attr('text-anchor', 'end')
                .style('font-size', '10px')
                .style('fill', '#9CA3AF')
                .style('font-style', 'italic')
                .text('Log scale: bar length reflects magnitude');
        }

        // Draw bars
        svg.selectAll('rect.bar')
            .data(data)
            .enter()
            .append('rect')
            .attr('class', 'bar')
            .attr('y', d => yScale(d.displayLabel))
            .attr('x', 0)
            .attr('height', yScale.bandwidth())
            .attr('width', 0)
            .attr('fill', d => getEnhancedColor(getLocationColor(d.location), d.fines, maxFines))
            .attr('stroke', d => {
                const baseColor = getLocationColor(d.location);
                return d.fines / maxFines < 0.05 ? d3.color(baseColor).darker(0.5).formatHex() : 'none';
            })
            .attr('stroke-width', d => d.fines / maxFines < 0.05 ? 2 : 0)
            .attr('opacity', 0.9)
            .attr('rx', 5)
            .style('cursor', 'pointer')
            .on('mouseenter', function (event, d) {
                d3.select(this).attr('opacity', 1);
                const ratio = d.fines > 0 ? (d.arrests / (d.fines / 1000)).toFixed(1) : '0';
                showTooltip(event, `
                    <div style="font-weight:700;color:#93c5fd;margin-bottom:8px;font-size:14px;">${d.displayLabel}</div>
                    <div style="margin-bottom:4px;">Fines: ${formatCurrency(d.fines)}</div>
                    <div style="margin-bottom:4px;">Arrests: ${formatNumber(d.arrests)}</div>
                    <div style="margin-bottom:4px;">Charges: ${formatNumber(d.charges)}</div>
                    <div style="margin-top:6px;padding-top:6px;border-top:1px solid #374151;font-size:12px;color:#9CA3AF;">
                        ${ratio} arrests per $1K fines
                    </div>
                `);
            })
            .on('mousemove', function (event, d) {
                const ratio = d.fines > 0 ? (d.arrests / (d.fines / 1000)).toFixed(1) : '0';
                showTooltip(event, `
                    <div style="font-weight:700;color:#93c5fd;margin-bottom:8px;font-size:14px;">${d.displayLabel}</div>
                    <div style="margin-bottom:4px;">Fines: ${formatCurrency(d.fines)}</div>
                    <div style="margin-bottom:4px;">Arrests: ${formatNumber(d.arrests)}</div>
                    <div style="margin-bottom:4px;">Charges: ${formatNumber(d.charges)}</div>
                    <div style="margin-top:6px;padding-top:6px;border-top:1px solid #374151;font-size:12px;color:#9CA3AF;">
                        ${ratio} arrests per $1K fines
                    </div>
                `);
            })
            .on('mouseleave', function () {
                d3.select(this).attr('opacity', 0.9);
                hideTooltip();
            })
            .transition()
            .duration(500)
            .attr('width', d => Math.max(xScale(d.fines), useLogScale ? xScale(Math.max(minFines * 0.3, 1)) + 4 : 4));

        // Dot markers
        svg.selectAll('circle.bar-dot')
            .data(data)
            .enter()
            .append('circle')
            .attr('class', 'bar-dot')
            .attr('cy', d => yScale(d.displayLabel) + yScale.bandwidth() / 2)
            .attr('cx', 0)
            .attr('r', d => {
                const ratio = d.fines / maxFines;
                return ratio < 0.05 ? 6 : (ratio < 0.2 ? 5 : 4);
            })
            .attr('fill', d => d3.color(getEnhancedColor(getLocationColor(d.location), d.fines, maxFines)).darker(0.4).formatHex())
            .attr('stroke', '#FFFFFF')
            .attr('stroke-width', 2)
            .style('opacity', 0)
            .style('pointer-events', 'none')
            .transition()
            .delay(400)
            .duration(400)
            .attr('cx', d => Math.max(xScale(d.fines), useLogScale ? xScale(Math.max(minFines * 0.3, 1)) + 4 : 4))
            .style('opacity', 1);

        // Data labels
        svg.selectAll('.hbar-value')
            .data(data.filter(d => d.fines > 0))
            .enter()
            .append('text')
            .attr('x', d => xScale(d.fines) + 6)
            .attr('y', d => yScale(d.displayLabel) + yScale.bandwidth() / 2 + 4)
            .attr('text-anchor', 'start')
            .text(d => formatCurrency(d.fines))
            .style('font-size', '11px')
            .style('fill', '#2D3748')
            .style('font-weight', '600')
            .style('opacity', 0)
            .transition()
            .duration(550)
            .style('opacity', 1);

    }, 50);
}
