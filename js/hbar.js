function renderHBarChart() {
    const container = document.getElementById('hbarChart');
    if (!container) return;

    container.innerHTML = '';

    if (!intersectionData || intersectionData.length === 0) {
        container.innerHTML = '<div class="loading-state">Loading data...</div>';
        return;
    }

    let filtered = intersectionData.filter(d => d.location === 'All Regions' && d.ageGroup === 'All Ages');
    filtered = applyAllFilters(filtered);

    const metrics = ['mobile_phone_use', 'non_wearing_seatbelts', 'speed_fines', 'unlicensed_driving'];
    const metricLabels = {
        'mobile_phone_use': 'Mobile Phone Use',
        'non_wearing_seatbelts': 'Non-wearing Seatbelts',
        'speed_fines': 'Speed Fines',
        'unlicensed_driving': 'Unlicensed Driving'
    };

    let data = metrics.map(m => {
        const d = filtered.find(f => f.metric === m);
        return {
            metric: m,
            label: metricLabels[m],
            fines: d ? d.fines : 0,
            arrests: d ? d.arrests : 0,
            charges: d ? d.charges : 0
        };
    }).filter(d => d.fines > 0);

    if (!data.length) {
        container.innerHTML = '<div class="no-data-state">No data available</div>';
        return;
    }

    data = data.sort((a, b) => b.fines - a.fines);

    setTimeout(() => {
        const rect = container.getBoundingClientRect();
        const width = Math.max(rect.width - 40, 300);
        const height = Math.max(rect.height - 40, 280);

        const margin = { top: 20, right: 80, bottom: 20, left: 140 };
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
        const xScale = d3.scaleLinear()
            .domain([0, maxFines * 1.05])
            .range([0, innerWidth])
            .nice();

        const metricColors = {
            'mobile_phone_use': '#3b82f6',
            'non_wearing_seatbelts': '#f59e0b',
            'speed_fines': '#10b981',
            'unlicensed_driving': '#ef4444'
        };

        svg.append('g')
            .call(d3.axisTop(xScale).ticks(6).tickSize(-innerHeight).tickFormat(''))
            .style('color', '#e2e8f0')
            .style('stroke-dasharray', '4,4');

        svg.append('g')
            .attr('transform', `translate(0,${innerHeight})`)
            .call(d3.axisBottom(xScale).ticks(6).tickFormat(d => d >= 1e6 ? (d / 1e6).toFixed(1) + 'M' : d))
            .style('color', '#64748b')
            .style('font-size', '10px');

        svg.append('text')
            .attr('x', innerWidth / 2)
            .attr('y', innerHeight + 38)
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
            // ✅ 修复：事件绑定必须在 transition 之前
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
            // 最后执行动画
            .transition()
            .duration(500)
            .attr('width', d => xScale(d.fines));

        svg.selectAll('.hbar-value')
            .data(data)
            .enter()
            .append('text')
            .attr('x', d => xScale(d.fines) + 5)
            .attr('y', d => yScale(d.label) + yScale.bandwidth() / 2 + 4)
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