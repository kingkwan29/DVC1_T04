function renderVBarChart() {
    const container = document.getElementById('vbarChart');
    if (!container) return;

    container.innerHTML = '';

    if (!geoData || geoData.length === 0) {
        container.innerHTML = '<div class="loading-state">Loading data...</div>';
        return;
    }

    const filtered = applyJurisdictionFilter(geoData);
    const sorted = [...filtered].sort((a, b) => b.fines - a.fines);

    if (!sorted.length) {
        container.innerHTML = '<div class="no-data-state">No data available</div>';
        return;
    }

    setTimeout(() => {
        const rect = container.getBoundingClientRect();
        const width = Math.max(rect.width - 40, 500);
        const height = Math.max(rect.height - 40, 280);

        const margin = { top: 40, right: 30, bottom: 60, left: 70 };
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

        const xScale = d3.scaleBand()
            .domain(sorted.map(d => d.jurisdiction))
            .range([0, innerWidth])
            .padding(0.3);

        const maxFines = d3.max(sorted, d => d.fines);
        const yScale = d3.scaleLinear()
            .domain([0, maxFines * 1.05])
            .range([innerHeight, 0])
            .nice();

        svg.append('g')
            .call(d3.axisLeft(yScale).ticks(8).tickSize(-innerWidth).tickFormat(''))
            .style('color', '#e2e8f0')
            .style('stroke-dasharray', '4,4');

        svg.append('g')
            .call(d3.axisLeft(yScale).ticks(8).tickFormat(d => d >= 1e6 ? (d / 1e6).toFixed(1) + 'M' : d))
            .style('color', '#64748b')
            .style('font-size', '10px');

        svg.append('g')
            .attr('transform', `translate(0,${innerHeight})`)
            .call(d3.axisBottom(xScale))
            .style('color', '#64748b')
            .style('font-size', '10px');

        svg.append('text')
            .attr('x', innerWidth / 2)
            .attr('y', innerHeight + 45)
            .attr('text-anchor', 'middle')
            .style('font-size', '11px')
            .style('fill', '#5b6e8c')
            .style('font-weight', '500')
            .text('Jurisdiction');

        svg.append('text')
            .attr('x', -innerHeight / 2)
            .attr('y', -50)
            .attr('text-anchor', 'middle')
            .attr('transform', 'rotate(-90)')
            .style('font-size', '11px')
            .style('fill', '#5b6e8c')
            .style('font-weight', '500')
            .text('Total Fines ($)');

        svg.selectAll('rect')
            .data(sorted)
            .enter()
            .append('rect')
            .attr('x', d => xScale(d.jurisdiction))
            .attr('y', innerHeight)
            .attr('width', xScale.bandwidth())
            .attr('height', 0)
            .attr('fill', COLORS.fines)
            .attr('opacity', 0.85)
            .attr('rx', 4)
            .style('cursor', 'pointer')
            // ✅ 修复：事件绑定必须在 transition 之前
            .on('mouseenter', function (event, d) {
                d3.select(this).attr('opacity', 1);
                showTooltip(event, `
                    <div style="font-weight:700;color:#93c5fd;margin-bottom:4px;">${d.jurisdiction}</div>
                    <div>Fines: $${d.fines.toLocaleString()}</div>
                    <div>Arrests: ${d.arrests.toLocaleString()}</div>
                    <div>Charges: ${d.charges.toLocaleString()}</div>
                `);
            })
            .on('mousemove', function (event, d) {
                showTooltip(event, `
                    <div style="font-weight:700;color:#93c5fd;margin-bottom:4px;">${d.jurisdiction}</div>
                    <div>Fines: $${d.fines.toLocaleString()}</div>
                    <div>Arrests: ${d.arrests.toLocaleString()}</div>
                    <div>Charges: ${d.charges.toLocaleString()}</div>
                `);
            })
            .on('mouseleave', function () {
                d3.select(this).attr('opacity', 0.85);
                hideTooltip();
            })
            // 最后执行动画
            .transition()
            .duration(500)
            .attr('y', d => yScale(d.fines))
            .attr('height', d => innerHeight - yScale(d.fines));

        svg.selectAll('.bar-value')
            .data(sorted)
            .enter()
            .append('text')
            .attr('x', d => xScale(d.jurisdiction) + xScale.bandwidth() / 2)
            .attr('y', d => yScale(d.fines) - 5)
            .attr('text-anchor', 'middle')
            .text(d => (d.fines / 1e6).toFixed(1) + 'M')
            .style('font-size', '10px')
            .style('fill', '#475569')
            .style('font-weight', '500')
            .style('opacity', 0)
            .transition()
            .duration(550)
            .style('opacity', 1);
    }, 50);
}