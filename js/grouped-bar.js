// js/grouped-bar.js
// Fixed: Larger fonts to match horizontal bar chart

function renderGroupedBarChart() {
    const container = document.getElementById('groupedBarChart');
    if (!container) return;

    container.innerHTML = '';

    if (!intersectionData || intersectionData.length === 0) {
        container.innerHTML = '<div class="loading-state">Loading data...</div>';
        return;
    }

    let filtered = [...intersectionData];

    filtered = filtered.filter(d => d.location === 'All Regions');

    if (state.method === 'all') {
        filtered = filtered.filter(d => d.method !== 'All Methods');
        filtered = filtered.filter(d => d.method !== 'Camera');
        filtered = filtered.filter(d => d.ageGroup !== 'All Ages');
    } else {
        filtered = filtered.filter(d => d.method === state.method);
    }

    filtered = applyAllFilters(filtered);

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

        const margin = { top: 60, right: 80, bottom: 70, left: 85 };
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
        const subgroupLabels = { fines: 'Fines ($K)', arrests: 'Arrests' };

        const maxFinesScaled = d3.max(data, d => d.fines / 1000);
        const maxArrests = d3.max(data, d => d.arrests);
        const yMax = Math.max(maxFinesScaled || 0, maxArrests || 0) * 1.15;

        const xScale = d3.scaleBand()
            .domain(data.map(d => d.displayLabel))
            .range([0, innerWidth])
            .padding(0.15);

        const xSubgroup = d3.scaleBand()
            .domain(subgroups)
            .range([0, xScale.bandwidth()])
            .padding(0.08);

        const yScale = d3.scaleLinear()
            .domain([0, yMax])
            .range([innerHeight, 0])
            .nice(5);

        // Grid lines
        svg.append('g')
            .call(d3.axisLeft(yScale).ticks(5).tickSize(-innerWidth).tickFormat(''))
            .style('color', '#E2E8F0')
            .style('stroke-dasharray', '3,3')
            .style('opacity', 0.4);

        // Y-axis - LARGER FONT (13px to match hbar's 11px bold + larger)
        svg.append('g')
            .call(d3.axisLeft(yScale).ticks(5).tickFormat(d => {
                if (d >= 1000) return (d / 1000).toFixed(0) + 'K';
                return d;
            }))
            .style('color', '#2D3748')
            .style('font-size', '16px')
            .style('font-weight', '600');

        // X-axis - LARGER FONT
        svg.append('g')
            .attr('transform', `translate(0,${innerHeight})`)
            .call(d3.axisBottom(xScale))
            .style('color', '#2D3748')
            .style('font-size', '16px')
            .style('font-weight', '600');

        // X-axis label - LARGER
        svg.append('text')
            .attr('x', innerWidth / 2)
            .attr('y', innerHeight + 52)
            .attr('text-anchor', 'middle')
            .style('font-size', '16px')
            .style('fill', '#2D3748')
            .style('font-weight', '700')
            .text('Age Group');

        // Y-axis label - LARGER
        svg.append('text')
            .attr('x', -innerHeight / 2)
            .attr('y', -62)
            .attr('text-anchor', 'middle')
            .attr('transform', 'rotate(-90)')
            .style('font-size', '16px')
            .style('fill', '#2D3748')
            .style('font-weight', '700')
            .text('Amount (Fines in $K, Arrests in count)');

        const colors = {
            fines: '#2E86AB',
            arrests: '#D64933'
        };

        // Draw bars
        subgroups.forEach(subgroup => {
            svg.selectAll(`.bar-${subgroup}`)
                .data(data)
                .enter()
                .append('rect')
                .attr('x', d => xScale(d.displayLabel) + xSubgroup(subgroup))
                .attr('y', innerHeight)
                .attr('width', xSubgroup.bandwidth())
                .attr('height', 0)
                .attr('fill', colors[subgroup])
                .attr('opacity', 0.85)
                .attr('rx', 4)
                .style('cursor', 'pointer')
                .on('mouseenter', function (event, d) {
                    d3.select(this).attr('opacity', 1);
                    const value = subgroup === 'fines' ? d.fines : d.arrests;
                    const formattedValue = subgroup === 'fines' ? '$' + value.toLocaleString() : value.toLocaleString();
                    showTooltip(event, `
                        <div style="font-weight:700;color:#93c5fd;margin-bottom:6px;">${d.displayLabel}</div>
                        <div>${subgroupLabels[subgroup]}: ${formattedValue}</div>
                        <div>Charges: ${d.charges.toLocaleString()}</div>
                    `);
                })
                .on('mousemove', function (event, d) {
                    const value = subgroup === 'fines' ? d.fines : d.arrests;
                    const formattedValue = subgroup === 'fines' ? '$' + value.toLocaleString() : value.toLocaleString();
                    showTooltip(event, `
                        <div style="font-weight:700;color:#93c5fd;margin-bottom:6px;">${d.displayLabel}</div>
                        <div>${subgroupLabels[subgroup]}: ${formattedValue}</div>
                        <div>Charges: ${d.charges.toLocaleString()}</div>
                    `);
                })
                .on('mouseleave', function () {
                    d3.select(this).attr('opacity', 0.85);
                    hideTooltip();
                })
                .transition()
                .duration(500)
                .attr('y', d => {
                    const value = subgroup === 'fines' ? d.fines / 1000 : d.arrests;
                    return yScale(value);
                })
                .attr('height', d => {
                    const value = subgroup === 'fines' ? d.fines / 1000 : d.arrests;
                    return innerHeight - yScale(value);
                });
        });

        // Data labels - placed above bars, larger font
        subgroups.forEach(subgroup => {
            svg.selectAll(`.label-${subgroup}`)
                .data(data)
                .enter()
                .append('text')
                .attr('x', d => xScale(d.displayLabel) + xSubgroup(subgroup) + xSubgroup.bandwidth() / 2)
                .attr('y', d => {
                    const value = subgroup === 'fines' ? d.fines / 1000 : d.arrests;
                    const barTop = yScale(value);
                    return barTop - 10;
                })
                .attr('text-anchor', 'middle')
                .text(d => {
                    const value = subgroup === 'fines' ? d.fines : d.arrests;
                    if (subgroup === 'fines') {
                        if (value >= 1e6) return (value / 1e6).toFixed(1) + 'M';
                        if (value >= 1e3) return (value / 1e3).toFixed(0) + 'K';
                        return value;
                    }
                    if (value >= 1000) return (value / 1000).toFixed(0) + 'K';
                    return value;
                })
                .style('font-size', '12px')
                .style('fill', '#2D3748')
                .style('font-weight', '600')
                .style('opacity', 0)
                .transition()
                .duration(550)
                .style('opacity', 1);
        });

        // Legend - larger font
        const legend = svg.append('g')
            .attr('transform', `translate(${innerWidth - 100}, -45)`);

        ['fines', 'arrests'].forEach((key, i) => {
            legend.append('rect')
                .attr('x', 0)
                .attr('y', i * 20)
                .attr('width', 12)
                .attr('height', 12)
                .attr('fill', colors[key])
                .attr('rx', 2);

            legend.append('text')
                .attr('x', 18)
                .attr('y', i * 20 + 9)
                .text(subgroupLabels[key])
                .style('font-size', '14px')
                .style('fill', '#2D3748')
                .style('font-weight', '600');
        });

    }, 50);
}