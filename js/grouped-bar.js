function renderGroupedBarChart() {
    const container = document.getElementById('groupedBarChart');
    if (!container) return;

    container.innerHTML = '';

    if (!intersectionData || intersectionData.length === 0) {
        container.innerHTML = '<div class="loading-state">Loading data...</div>';
        return;
    }

    let filtered = [...intersectionData];
    // Always use 'All Regions' - this chart shows age breakdown across ALL jurisdictions
    filtered = filtered.filter(d => d.location === 'All Regions');

    // Apply method filter only (NOT jurisdiction filter)
    if (state.method === 'all') {
        filtered = filtered.filter(d => d.method !== 'All Methods');
        filtered = filtered.filter(d => d.method !== 'Camera');
        filtered = filtered.filter(d => d.ageGroup !== 'All Ages');
    } else {
        filtered = filtered.filter(d => d.method === state.method);
    }

    // Apply age filter if specific age selected
    if (state.age !== 'all') {
        filtered = filtered.filter(d => d.ageGroup === state.age);
    }

    const ageGroupsOrder = ['0-16', '17-25', '26-39', '40-64', '65 and over', 'All Ages'];
    const existingAgeGroups = [...new Set(filtered.map(d => d.ageGroup))];
    const ageGroups = ageGroupsOrder.filter(ag => existingAgeGroups.includes(ag));

    const ageGroupLabels = {
        '0-16': '0-16',
        '17-25': '17-25',
        '26-39': '26-39',
        '40-64': '40-64',
        '65 and over': '65+',
        'All Ages': 'All Ages'
    };

    const data = ageGroups.map(age => {
        const ageData = filtered.filter(d => d.ageGroup === age);
        return {
            ageGroup: age,
            displayLabel: ageGroupLabels[age] || age,
            fines: d3.sum(ageData, d => d.fines),
            arrests: d3.sum(ageData, d => d.arrests),
            charges: d3.sum(ageData, d => d.charges)
        };
    }).filter(d => d.fines > 0 || d.arrests > 0);

    if (!data.length) {
        container.innerHTML = '<div class="no-data-state">No data available for selected filters</div>';
        return;
    }

    setTimeout(() => {
        const rect = container.getBoundingClientRect();
        const width = Math.max(rect.width - 40, 550);
        const height = Math.max(rect.height - 40, 400);

        const margin = { top: 95, right: 80, bottom: 70, left: 80 };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        const existingSvg = container.querySelector('svg');
        if (existingSvg) existingSvg.remove();

        const svg = d3.select(container)
            .append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', `0 0 ${width} ${height}`)
            .attr('role', 'img')
            .attr('aria-label', 'Grouped bar chart showing fines and arrests by age group')
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        const subgroups = ['fines', 'arrests'];
        const subgroupLabels = { fines: 'Fines ($)', arrests: 'Arrests' };

        const maxFines = d3.max(data, d => d.fines);
        const maxArrests = d3.max(data, d => d.arrests);
        const yMaxFines = maxFines * 1.15;
        const yMaxArrests = maxArrests * 1.15;

        const xScale = d3.scaleBand()
            .domain(data.map(d => d.displayLabel))
            .range([0, innerWidth])
            .padding(0.2);

        const xSubgroup = d3.scaleBand()
            .domain(subgroups)
            .range([0, xScale.bandwidth()])
            .padding(0.1);

        const yScaleFines = d3.scaleLinear()
            .domain([0, yMaxFines])
            .range([innerHeight, 0])
            .nice();

        const yScaleArrests = d3.scaleLinear()
            .domain([0, yMaxArrests])
            .range([innerHeight, 0])
            .nice();

        // Grid lines
        svg.append('g')
            .attr('class', 'grid-lines')
            .call(d3.axisLeft(yScaleFines).ticks(5).tickSize(-innerWidth).tickFormat(''))
            .select('.domain').remove();

        const colors = { fines: '#2E86AB', arrests: '#E63946' };

        // Left Y-axis: Fines
        svg.append('g')
            .attr('class', 'axis axis-left axis-fines')
            .call(d3.axisLeft(yScaleFines).ticks(5).tickFormat(d => {
                if (d >= 1e6) return (d / 1e6).toFixed(1) + 'M';
                if (d >= 1e3) return (d / 1e3).toFixed(0) + 'K';
                return d;
            }));

        // Right Y-axis: Arrests
        svg.append('g')
            .attr('class', 'axis axis-right axis-arrests')
            .attr('transform', `translate(${innerWidth}, 0)`)
            .call(d3.axisRight(yScaleArrests).ticks(5).tickFormat(d => {
                if (d >= 1e6) return (d / 1e6).toFixed(1) + 'M';
                if (d >= 1e3) return (d / 1e3).toFixed(0) + 'K';
                return d;
            }));

        // X-axis
        svg.append('g')
            .attr('class', 'axis axis-bottom')
            .attr('transform', `translate(0,${innerHeight})`)
            .call(d3.axisBottom(xScale));

        // X-axis label
        svg.append('text')
            .attr('class', 'axis-label axis-label-x')
            .attr('x', innerWidth / 2)
            .attr('y', innerHeight + 48)
            .attr('text-anchor', 'middle')
            .text('Age Group');

        // Left Y-axis label
        svg.append('text')
            .attr('class', 'axis-label axis-label-y-left')
            .attr('x', -innerHeight / 2)
            .attr('y', -55)
            .attr('text-anchor', 'middle')
            .attr('transform', 'rotate(-90)')
            .style('fill', colors.fines)
            .text('Fines ($)');

        // Right Y-axis label
        svg.append('text')
            .attr('class', 'axis-label axis-label-y-right')
            .attr('x', -innerHeight / 2)
            .attr('y', innerWidth + 68)
            .attr('text-anchor', 'middle')
            .attr('transform', 'rotate(-90)')
            .style('fill', colors.arrests)
            .text('Arrests (count)');

        // Dual axis indicator
        svg.append('text')
            .attr('class', 'dual-axis-indicator')
            .attr('x', innerWidth / 2)
            .attr('y', -45)
            .attr('text-anchor', 'middle')
            .text('← Fines ($) · Arrests (count) →');

        // Legend
        const legend = svg.append('g')
            .attr('class', 'legend-group')
            .attr('transform', `translate(${innerWidth - 10}, -85)`);

        // Fines legend item
        legend.append('rect')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', 16)
            .attr('height', 16)
            .attr('fill', colors.fines)
            .attr('rx', 3);

        legend.append('text')
            .attr('class', 'legend-text legend-text-fines')
            .attr('x', 24)
            .attr('y', 13)
            .style('fill', colors.fines)
            .text('Fines');

        // Arrests legend item
        legend.append('rect')
            .attr('x', 0)
            .attr('y', 24)
            .attr('width', 16)
            .attr('height', 16)
            .attr('fill', colors.arrests)
            .attr('rx', 3);

        legend.append('text')
            .attr('class', 'legend-text legend-text-arrests')
            .attr('x', 24)
            .attr('y', 37)
            .style('fill', colors.arrests)
            .text('Arrests');

        // Draw bars
        subgroups.forEach(subgroup => {
            const isFines = subgroup === 'fines';
            const yScale = isFines ? yScaleFines : yScaleArrests;

            svg.selectAll(`.bar-${subgroup}`)
                .data(data)
                .enter()
                .append('rect')
                .attr('class', `bar bar-${subgroup}`)
                .attr('x', d => xScale(d.displayLabel) + xSubgroup(subgroup))
                .attr('y', innerHeight)
                .attr('width', xSubgroup.bandwidth())
                .attr('height', 0)
                .attr('fill', colors[subgroup])
                .attr('rx', 4)
                .style('cursor', 'pointer')
                .on('mouseenter', function (event, d) {
                    d3.select(this).attr('opacity', 1);
                    const ratio = d.fines > 0 ? (d.arrests / (d.fines / 1000)).toFixed(1) : '0';
                    showTooltip(event, `
                        <div class="tooltip-title">${d.displayLabel}</div>
                        <div class="tooltip-row"><span style="color:${colors.fines};">●</span> Fines: ${formatCurrency(d.fines)}</div>
                        <div class="tooltip-row"><span style="color:${colors.arrests};">●</span> Arrests: ${formatNumber(d.arrests)}</div>
                        <div class="tooltip-row"><span style="color:#6B7280;">◆</span> Charges: ${formatNumber(d.charges)}</div>
                        <div class="tooltip-footer">Ratio: ${ratio} arrests per $1K fines</div>
                    `);
                })
                .on('mousemove', function (event, d) {
                    const ratio = d.fines > 0 ? (d.arrests / (d.fines / 1000)).toFixed(1) : '0';
                    showTooltip(event, `
                        <div class="tooltip-title">${d.displayLabel}</div>
                        <div class="tooltip-row"><span style="color:${colors.fines};">●</span> Fines: ${formatCurrency(d.fines)}</div>
                        <div class="tooltip-row"><span style="color:${colors.arrests};">●</span> Arrests: ${formatNumber(d.arrests)}</div>
                        <div class="tooltip-row"><span style="color:#6B7280;">◆</span> Charges: ${formatNumber(d.charges)}</div>
                        <div class="tooltip-footer">Ratio: ${ratio} arrests per $1K fines</div>
                    `);
                })
                .on('mouseleave', function () {
                    d3.select(this).attr('opacity', 0.85);
                    hideTooltip();
                })
                .transition()
                .duration(500)
                .attr('y', d => yScale(isFines ? d.fines : d.arrests))
                .attr('height', d => innerHeight - yScale(isFines ? d.fines : d.arrests));
        });

        // Data labels
        subgroups.forEach(subgroup => {
            const isFines = subgroup === 'fines';
            const yScale = isFines ? yScaleFines : yScaleArrests;

            svg.selectAll(`.label-${subgroup}`)
                .data(data)
                .enter()
                .append('text')
                .attr('class', `data-label data-label-${subgroup}`)
                .attr('x', d => xScale(d.displayLabel) + xSubgroup(subgroup) + xSubgroup.bandwidth() / 2)
                .attr('y', d => {
                    const value = isFines ? d.fines : d.arrests;
                    return yScale(value) - 6;
                })
                .attr('text-anchor', 'middle')
                .text(d => formatCompact(isFines ? d.fines : d.arrests))
                .style('opacity', 0)
                .transition()
                .duration(550)
                .style('opacity', 1);
        });

    }, 50);
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

function formatCompact(value) {
    if (value === 0) return '0';
    if (value >= 1e6) return (value / 1e6).toFixed(1) + 'M';
    if (value >= 1e3) return (value / 1e3).toFixed(0) + 'K';
    return value.toLocaleString();
}