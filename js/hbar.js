// js/hbar.js

function renderHBarChart() {
    if (state.jurisdiction === 'all') {
        renderViolationChart();
    } else {
        renderGeoChart();
    }
}

function getSmartTicks(maxValue) {
    if (maxValue === 0) return { ticks: [0], niceMax: 0 };
    const niceMax = Math.ceil(maxValue / 100000) * 100000;
    const step = niceMax / 5;
    const ticks = [];
    for (let i = 0; i <= 5; i++) {
        ticks.push(Math.round(i * step));
    }
    return { ticks: ticks, niceMax: niceMax };
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
        const width = Math.max(rect.width - 40, 300);
        const height = Math.max(rect.height - 40, 280);

        const margin = { top: 20, right: 80, bottom: 30, left: 140 };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        container.innerHTML = '';

        const svg = d3.select(container)
            .append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', `0 0 ${width} ${height}`)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        const yScale = d3.scaleBand()
            .domain(data.map(d => d.label))
            .range([0, innerHeight])
            .padding(0.35);

        const maxFines = d3.max(data, d => d.fines);
        const { ticks, niceMax } = getSmartTicks(maxFines);

        const xScale = d3.scaleLinear()
            .domain([0, niceMax])
            .range([0, innerWidth]);

        const metricColors = {
            'mobile_phone_use': '#3b82f6',
            'non_wearing_seatbelts': '#f59e0b',
            'speed_fines': '#10b981',
            'unlicensed_driving': '#ef4444'
        };

        svg.append('g')
            .call(d3.axisTop(xScale).tickValues(ticks).tickSize(-innerHeight).tickFormat(''))
            .style('color', '#e2e8f0')
            .style('stroke-dasharray', '4,4');

        svg.append('g')
            .attr('transform', `translate(0,${innerHeight})`)
            .call(d3.axisBottom(xScale).tickValues(ticks).tickFormat(d => {
                if (d >= 1e6) return (d / 1e6).toFixed(1) + 'M';
                if (d >= 1e3) return (d / 1e3).toFixed(0) + 'K';
                return d;
            }))
            .style('color', '#64748b')
            .style('font-size', '10px');

        svg.append('text')
            .attr('x', innerWidth / 2)
            .attr('y', innerHeight + 35)
            .attr('text-anchor', 'middle')
            .style('font-size', '11px')
            .style('fill', '#5b6e8c')
            .style('font-weight', '500')
            .text('Total Fines ($)');

        svg.append('g')
            .call(d3.axisLeft(yScale))
            .style('color', '#64748b')
            .style('font-size', '10px');

        svg.selectAll('rect')
            .data(data)
            .enter()
            .append('rect')
            .attr('y', d => yScale(d.label))
            .attr('x', 0)
            .attr('height', yScale.bandwidth())
            .attr('width', 0)
            .attr('fill', d => metricColors[d.metric])
            .attr('opacity', 0.85)
            .attr('rx', 4)
            .style('cursor', 'pointer')
            .on('mouseenter', function (event, d) {
                d3.select(this).attr('opacity', 1);
                showTooltip(event, `
                    <div style="font-weight:700;color:#93c5fd;margin-bottom:4px;">${d.label}</div>
                    <div>Fines: $${d.fines.toLocaleString()}</div>
                    <div>Arrests: ${d.arrests.toLocaleString()}</div>
                    <div>Charges: ${d.charges.toLocaleString()}</div>
                `);
            })
            .on('mousemove', function (event, d) {
                showTooltip(event, `
                    <div style="font-weight:700;color:#93c5fd;margin-bottom:4px;">${d.label}</div>
                    <div>Fines: $${d.fines.toLocaleString()}</div>
                    <div>Arrests: ${d.arrests.toLocaleString()}</div>
                    <div>Charges: ${d.charges.toLocaleString()}</div>
                `);
            })
            .on('mouseleave', function () {
                d3.select(this).attr('opacity', 0.85);
                hideTooltip();
            })
            .transition()
            .duration(500)
            .attr('width', d => {
                const width = xScale(d.fines);
                if (d.fines > 0 && width < 4) return 4;
                return width;
            });

        svg.selectAll('.hbar-value')
            .data(data.filter(d => d.fines > 0))
            .enter()
            .append('text')
            .attr('x', d => {
                const barWidth = xScale(d.fines);
                if (barWidth < 4) return 8;
                return barWidth + 5;
            })
            .attr('y', d => yScale(d.label) + yScale.bandwidth() / 2 + 4)
            .text(d => {
                if (d.fines >= 1e6) return (d.fines / 1e6).toFixed(1) + 'M';
                if (d.fines >= 1e3) return (d.fines / 1e3).toFixed(0) + 'K';
                return d.fines.toLocaleString();
            })
            .style('font-size', '10px')
            .style('fill', '#475569')
            .style('font-weight', '500')
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

    const locationColors = {
        'Major Cities of Australia': '#1e40af',
        'Inner Regional Australia': '#3b82f6',
        'Outer Regional Australia': '#60a5fa',
        'Remote Australia': '#f59e0b',
        'Very Remote Australia': '#ea580c'
    };

    setTimeout(() => {
        const rect = container.getBoundingClientRect();
        const width = Math.max(rect.width - 40, 300);
        const height = Math.max(rect.height - 40, 320);

        const margin = { top: 20, right: 80, bottom: 30, left: 120 };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        container.innerHTML = '';

        const svg = d3.select(container)
            .append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', `0 0 ${width} ${height}`)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        const yScale = d3.scaleBand()
            .domain(data.map(d => d.displayLabel))
            .range([0, innerHeight])
            .padding(0.4);

        const maxFines = d3.max(data, d => d.fines);
        const { ticks, niceMax } = getSmartTicks(maxFines);

        const xScale = d3.scaleLinear()
            .domain([0, niceMax])
            .range([0, innerWidth]);

        svg.append('g')
            .call(d3.axisTop(xScale).tickValues(ticks).tickSize(-innerHeight).tickFormat(''))
            .style('color', '#e2e8f0')
            .style('stroke-dasharray', '4,4');

        svg.append('g')
            .attr('transform', `translate(0,${innerHeight})`)
            .call(d3.axisBottom(xScale).tickValues(ticks).tickFormat(d => {
                if (d >= 1e6) return (d / 1e6).toFixed(1) + 'M';
                if (d >= 1e3) return (d / 1e3).toFixed(0) + 'K';
                return d;
            }))
            .style('color', '#64748b')
            .style('font-size', '10px');

        svg.append('text')
            .attr('x', innerWidth / 2)
            .attr('y', innerHeight + 35)
            .attr('text-anchor', 'middle')
            .style('font-size', '11px')
            .style('fill', '#5b6e8c')
            .style('font-weight', '500')
            .text('Total Fines ($)');

        svg.append('g')
            .call(d3.axisLeft(yScale))
            .style('color', '#64748b')
            .style('font-size', '11px')
            .style('font-weight', '500');

        svg.selectAll('rect')
            .data(data)
            .enter()
            .append('rect')
            .attr('y', d => yScale(d.displayLabel))
            .attr('x', 0)
            .attr('height', yScale.bandwidth())
            .attr('width', 0)
            .attr('fill', d => locationColors[d.location] || '#64748b')
            .attr('opacity', 0.85)
            .attr('rx', 4)
            .style('cursor', 'pointer')
            .on('mouseenter', function (event, d) {
                d3.select(this).attr('opacity', 1);
                showTooltip(event, `
                    <div style="font-weight:700;color:#93c5fd;margin-bottom:6px;">${d.displayLabel}</div>
                    <div>Fines: $${d.fines.toLocaleString()}</div>
                    <div>Arrests: ${d.arrests.toLocaleString()}</div>
                    <div>Charges: ${d.charges.toLocaleString()}</div>
                `);
            })
            .on('mousemove', function (event, d) {
                showTooltip(event, `
                    <div style="font-weight:700;color:#93c5fd;margin-bottom:6px;">${d.displayLabel}</div>
                    <div>Fines: $${d.fines.toLocaleString()}</div>
                    <div>Arrests: ${d.arrests.toLocaleString()}</div>
                    <div>Charges: ${d.charges.toLocaleString()}</div>
                `);
            })
            .on('mouseleave', function () {
                d3.select(this).attr('opacity', 0.85);
                hideTooltip();
            })
            .transition()
            .duration(500)
            .attr('width', d => {
                const width = xScale(d.fines);
                if (d.fines > 0 && width < 4) return 4;
                return width;
            });

        svg.selectAll('.hbar-value')
            .data(data.filter(d => d.fines > 0))
            .enter()
            .append('text')
            .attr('x', d => {
                const barWidth = xScale(d.fines);
                if (barWidth < 4) return 8;
                return barWidth + 5;
            })
            .attr('y', d => yScale(d.displayLabel) + yScale.bandwidth() / 2 + 4)
            .text(d => {
                if (d.fines >= 1e6) return (d.fines / 1e6).toFixed(1) + 'M';
                if (d.fines >= 1e3) return (d.fines / 1e3).toFixed(0) + 'K';
                return d.fines.toLocaleString();
            })
            .style('font-size', '10px')
            .style('fill', '#475569')
            .style('font-weight', '600')
            .style('opacity', 0)
            .transition()
            .duration(550)
            .style('opacity', 1);

    }, 50);
}