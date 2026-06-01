function renderGroupedBarChart() {
    const container = document.getElementById('groupedBarChart');
    if (!container) return;

    container.innerHTML = '';

    if (!intersectionData || intersectionData.length === 0) {
        container.innerHTML = '<div class="loading-state">Loading data...</div>';
        return;
    }

    let filtered = intersectionData.filter(d => d.location === 'All Regions' && d.ageGroup !== 'All Ages');
    filtered = applyAllFilters(filtered);

    const ageGroups = ['0-16', '17-25', '26-39', '40-64', '65 and over'];
    const data = ageGroups.map(age => {
        const ageData = filtered.filter(d => d.ageGroup === age);
        return {
            ageGroup: age,
            fines: d3.sum(ageData, d => d.fines),
            arrests: d3.sum(ageData, d => d.arrests),
            charges: d3.sum(ageData, d => d.charges)
        };
    }).filter(d => d.fines > 0 || d.arrests > 0);

    if (!data.length) {
        container.innerHTML = '<div class="no-data-state">No data available</div>';
        return;
    }

    setTimeout(() => {
        const rect = container.getBoundingClientRect();
        const width = Math.max(rect.width - 40, 400);
        const height = Math.max(rect.height - 40, 300);

        const margin = { top: 50, right: 80, bottom: 60, left: 70 };
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

        const subgroups = ['fines', 'arrests'];
        const subgroupLabels = { fines: 'Fines ($K)', arrests: 'Arrests' };

        const finesScaled = data.map(d => ({ ...d, finesScaled: d.fines / 1000 }));

        const xScale = d3.scaleBand()
            .domain(data.map(d => d.ageGroup))
            .range([0, innerWidth])
            .padding(0.2);

        const xSubgroup = d3.scaleBand()
            .domain(subgroups)
            .range([0, xScale.bandwidth()])
            .padding(0.1);

        const maxFinesScaled = d3.max(finesScaled, d => d.finesScaled);
        const maxArrests = d3.max(data, d => d.arrests);
        const yMax = Math.max(maxFinesScaled || 0, maxArrests || 0) * 1.1;

        const yScale = d3.scaleLinear()
            .domain([0, yMax])
            .range([innerHeight, 0])
            .nice();

        const colors = {
            fines: COLORS.fines,
            arrests: COLORS.arrests
        };

        svg.append('g')
            .call(d3.axisLeft(yScale).ticks(8).tickSize(-innerWidth).tickFormat(''))
            .style('color', '#e2e8f0')
            .style('stroke-dasharray', '4,4');

        svg.append('g')
            .call(d3.axisLeft(yScale).ticks(8).tickFormat(d => {
                if (d >= 1000) return (d / 1000).toFixed(0) + 'K';
                return d;
            }))
            .style('color', '#64748b')
            .style('font-size', '10px');

        svg.append('g')
            .attr('transform', `translate(0,${innerHeight})`)
            .call(d3.axisBottom(xScale))
            .style('color', '#64748b')
            .style('font-size', '10px');

        svg.append('text')
            .attr('x', innerWidth / 2)
            .attr('y', innerHeight + 42)
            .attr('text-anchor', 'middle')
            .style('font-size', '11px')
            .style('fill', '#5b6e8c')
            .style('font-weight', '500')
            .text('Age Group');

        svg.append('text')
            .attr('x', -innerHeight / 2)
            .attr('y', -52)
            .attr('text-anchor', 'middle')
            .attr('transform', 'rotate(-90)')
            .style('font-size', '11px')
            .style('fill', '#5b6e8c')
            .style('font-weight', '500')
            .text('Amount (Fines in $K, Arrests in count)');

        subgroups.forEach(subgroup => {
            svg.selectAll(`.bar-${subgroup}`)
                .data(data)
                .enter()
                .append('rect')
                .attr('x', d => xScale(d.ageGroup) + xSubgroup(subgroup))
                .attr('y', innerHeight)
                .attr('width', xSubgroup.bandwidth())
                .attr('height', 0)
                .attr('fill', colors[subgroup])
                .attr('opacity', 0.85)
                .attr('rx', 3)
                .style('cursor', 'pointer')
                .transition()
                .duration(500)
                .attr('y', d => {
                    const value = subgroup === 'fines' ? d.fines / 1000 : d.arrests;
                    return yScale(value);
                })
                .attr('height', d => {
                    const value = subgroup === 'fines' ? d.fines / 1000 : d.arrests;
                    return innerHeight - yScale(value);
                })
                .on('mouseenter', function (event, d) {
                    d3.select(this).attr('opacity', 1);
                    const value = subgroup === 'fines' ? d.fines : d.arrests;
                    const formattedValue = subgroup === 'fines' ? '$' + value.toLocaleString() : value.toLocaleString();
                    showTooltip(event, `
                        <div style="font-weight:700;color:#93c5fd;margin-bottom:4px;">${d.ageGroup}</div>
                        <div>${subgroupLabels[subgroup]}: ${formattedValue}</div>
                        <div>Charges: ${d.charges.toLocaleString()}</div>
                    `);
                })
                .on('mousemove', function (event, d) {
                    const value = subgroup === 'fines' ? d.fines : d.arrests;
                    const formattedValue = subgroup === 'fines' ? '$' + value.toLocaleString() : value.toLocaleString();
                    showTooltip(event, `
                        <div style="font-weight:700;color:#93c5fd;margin-bottom:4px;">${d.ageGroup}</div>
                        <div>${subgroupLabels[subgroup]}: ${formattedValue}</div>
                        <div>Charges: ${d.charges.toLocaleString()}</div>
                    `);
                })
                .on('mouseleave', function () {
                    d3.select(this).attr('opacity', 0.85);
                    hideTooltip();
                });
        });

        subgroups.forEach(subgroup => {
            svg.selectAll(`.label-${subgroup}`)
                .data(data)
                .enter()
                .append('text')
                .attr('x', d => xScale(d.ageGroup) + xSubgroup(subgroup) + xSubgroup.bandwidth() / 2)
                .attr('y', d => {
                    const value = subgroup === 'fines' ? d.fines / 1000 : d.arrests;
                    return yScale(value) - 5;
                })
                .attr('text-anchor', 'middle')
                .text(d => {
                    const value = subgroup === 'fines' ? d.fines : d.arrests;
                    if (subgroup === 'fines') {
                        return (value / 1000).toFixed(0) + 'K';
                    }
                    return value.toLocaleString();
                })
                .style('font-size', '9px')
                .style('fill', '#475569')
                .style('font-weight', '500')
                .style('opacity', 0)
                .transition()
                .duration(550)
                .style('opacity', 1);
        });

        const legend = svg.append('g')
            .attr('transform', `translate(${innerWidth - 100}, -25)`);

        legend.append('rect')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', 12)
            .attr('height', 12)
            .attr('fill', colors.fines)
            .attr('rx', 2);

        legend.append('text')
            .attr('x', 18)
            .attr('y', 10)
            .text('Fines ($K)')
            .style('font-size', '10px')
            .style('fill', '#64748b');

        legend.append('rect')
            .attr('x', 0)
            .attr('y', 18)
            .attr('width', 12)
            .attr('height', 12)
            .attr('fill', colors.arrests)
            .attr('rx', 2);

        legend.append('text')
            .attr('x', 18)
            .attr('y', 28)
            .text('Arrests')
            .style('font-size', '10px')
            .style('fill', '#64748b');

    }, 50);
}