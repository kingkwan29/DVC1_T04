function renderMonthlyTrend() {
    const container = document.getElementById('trendChart');
    if (!container) return;

    container.innerHTML = '';

    if (!monthlyData || monthlyData.length === 0) {
        container.innerHTML = '<div class="loading-state">Loading data...</div>';
        return;
    }

    setTimeout(() => {
        const rect = container.getBoundingClientRect();
        const width = Math.max(rect.width - 40, 500);
        const height = Math.max(rect.height - 40, 260);

        const margin = { top: 20, right: 30, bottom: 50, left: 70 };
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

        const xScale = d3.scaleTime()
            .domain(d3.extent(monthlyData, d => d.date))
            .range([0, innerWidth]);

        const yMax = d3.max(monthlyData, d => d.fines) * 1.05;
        const yScale = d3.scaleLinear()
            .domain([0, yMax])
            .range([innerHeight, 0])
            .nice();

        svg.append('g')
            .call(d3.axisLeft(yScale).ticks(6).tickSize(-innerWidth).tickFormat(''))
            .style('color', '#e2e8f0')
            .style('stroke-dasharray', '4,4');

        const area = d3.area()
            .x(d => xScale(d.date))
            .y0(yScale(0))
            .y1(d => yScale(d.fines));

        svg.append('path')
            .datum(monthlyData)
            .attr('fill', COLORS.finesLight)
            .attr('opacity', 0.3)
            .attr('d', area);

        const line = d3.line()
            .x(d => xScale(d.date))
            .y(d => yScale(d.fines));

        svg.append('path')
            .datum(monthlyData)
            .attr('fill', 'none')
            .attr('stroke', COLORS.fines)
            .attr('stroke-width', 2.5)
            .attr('stroke-linecap', 'round')
            .attr('d', line);

        svg.append('g')
            .attr('transform', `translate(0,${innerHeight})`)
            .call(d3.axisBottom(xScale).ticks(8).tickFormat(d3.timeFormat('%b %Y')))
            .style('color', '#64748b')
            .style('font-size', '10px');

        svg.append('g')
            .call(d3.axisLeft(yScale).ticks(6).tickFormat(d => d >= 1e6 ? (d / 1e6).toFixed(1) + 'M' : d))
            .style('color', '#64748b')
            .style('font-size', '10px');

        svg.append('text')
            .attr('x', innerWidth / 2)
            .attr('y', innerHeight + 38)
            .attr('text-anchor', 'middle')
            .style('font-size', '11px')
            .style('fill', '#5b6e8c')
            .style('font-weight', '500')
            .text('Date');

        svg.append('text')
            .attr('x', -innerHeight / 2)
            .attr('y', -50)
            .attr('text-anchor', 'middle')
            .attr('transform', 'rotate(-90)')
            .style('font-size', '11px')
            .style('fill', '#5b6e8c')
            .style('font-weight', '500')
            .text('Total Fines ($)');

        svg.selectAll('.trend-dot')
            .data(monthlyData)
            .enter()
            .append('circle')
            .attr('cx', d => xScale(d.date))
            .attr('cy', d => yScale(d.fines))
            .attr('r', 5)
            .attr('fill', COLORS.fines)
            .attr('stroke', 'white')
            .attr('stroke-width', 2)
            .style('cursor', 'pointer')
            .style('opacity', 0.7)
            .on('mouseenter', function (event, d) {
                d3.select(this).attr('r', 8).style('opacity', 1);
                showTooltip(event, `
                    <div style="font-weight:700;color:#93c5fd;margin-bottom:4px;">${d3.timeFormat('%b %Y')(d.date)}</div>
                    <div>$${d.fines.toLocaleString()}</div>
                `);
            })
            .on('mousemove', function (event, d) {
                showTooltip(event, `
                    <div style="font-weight:700;color:#93c5fd;margin-bottom:4px;">${d3.timeFormat('%b %Y')(d.date)}</div>
                    <div>$${d.fines.toLocaleString()}</div>
                `);
            })
            .on('mouseleave', function () {
                d3.select(this).attr('r', 5).style('opacity', 0.7);
                hideTooltip();
            });

    }, 50);
}