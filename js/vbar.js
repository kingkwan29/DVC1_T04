function renderVBarChart() {
    const container = document.getElementById('vbarChart');
    if (!container) return;

    container.innerHTML = '';

    if (!geoData || geoData.length === 0) {
        container.innerHTML = '<div class="loading-state">Loading data...</div>';
        return;
    }

    // 应用 Jurisdiction 筛选
    let filtered = applyJurisdictionFilter(geoData);
    const sorted = [...filtered].sort((a, b) => b.fines - a.fines);

    if (!sorted.length) {
        container.innerHTML = '<div class="no-data-state">No data available</div>';
        return;
    }

    setTimeout(() => {
        const rect = container.getBoundingClientRect();
        const width = Math.max(rect.width - 40, 800);
        const height = Math.max(rect.height - 40, 480);

        const margin = { top: 30, right: 100, bottom: 100, left: 70 };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        container.innerHTML = '';

        const svg = d3.select(container)
            .append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', `0 0 ${width} ${height}`)
            .style('overflow', 'visible')
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Y轴: 各个州
        const yScale = d3.scaleBand()
            .domain(sorted.map(d => d.jurisdiction))
            .range([0, innerHeight])
            .padding(0.35);

        const bandHeight = yScale.bandwidth();

        // 计算最大值
        const maxFines = d3.max(sorted, d => d.fines);
        const maxArrests = d3.max(sorted, d => d.arrests);

        // 左右各占一半宽度
        const halfWidth = innerWidth / 2;

        // 左侧罚款轴：从中心向左延伸，最大值映射到 halfWidth
        const xFinesScale = d3.scaleLinear()
            .domain([0, maxFines * 1.1])
            .range([0, halfWidth])
            .nice();

        // 右侧逮捕轴：从中心向右延伸，最大值映射到 halfWidth
        const xArrestsScale = d3.scaleLinear()
            .domain([0, maxArrests * 1.3])
            .range([0, halfWidth])
            .nice();

        // 中心线位置
        const centerX = halfWidth;

        // ========== 图例（放到最右边）==========
        const legendGroup = svg.append('g')
            .attr('transform', `translate(${innerWidth - 140}, -15)`);

        legendGroup.append('rect')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', 12)
            .attr('height', 12)
            .attr('fill', '#1e40af')
            .attr('rx', 2);

        legendGroup.append('text')
            .attr('x', 16)
            .attr('y', 10)
            .text('Fines (w/ arrests)')
            .style('font-size', '10px')
            .style('fill', '#475569');

        legendGroup.append('rect')
            .attr('x', 0)
            .attr('y', 18)
            .attr('width', 12)
            .attr('height', 12)
            .attr('fill', '#94a3b8')
            .attr('rx', 2);

        legendGroup.append('text')
            .attr('x', 16)
            .attr('y', 28)
            .text('Fines (no arrests)')
            .style('font-size', '10px')
            .style('fill', '#475569');

        legendGroup.append('rect')
            .attr('x', 0)
            .attr('y', 36)
            .attr('width', 12)
            .attr('height', 12)
            .attr('fill', '#b91c1c')
            .attr('rx', 2);

        legendGroup.append('text')
            .attr('x', 16)
            .attr('y', 46)
            .text('Arrests')
            .style('font-size', '10px')
            .style('fill', '#475569');

        // ========== 上方网格线和 X 轴（罚款）==========
        svg.append('g')
            .call(d3.axisTop(xFinesScale).ticks(6).tickSize(-innerHeight).tickFormat(''))
            .style('color', '#e2e8f0')
            .style('stroke-dasharray', '3,3');

        // 左侧 X 轴（罚款）- 放在顶部
        const leftAxisGroup = svg.append('g')
            .attr('transform', `translate(0, -10)`);

        leftAxisGroup.call(d3.axisTop(xFinesScale).ticks(6)
            .tickFormat(d => {
                if (d >= 1e6) return (d / 1e6).toFixed(1) + 'M';
                if (d >= 1e3) return (d / 1e3).toFixed(0) + 'K';
                return d;
            }))
            .style('color', '#1e40af')
            .style('font-size', '10px')
            .style('font-weight', '600');

        // 左侧轴标签 - 往上移动10步（从 -18 改为 -28）
        svg.append('text')
            .attr('x', halfWidth / 2)
            .attr('y', -28)
            .attr('text-anchor', 'middle')
            .style('font-size', '12px')
            .style('fill', '#1e40af')
            .style('font-weight', '700')
            .text('← Fines ($)');

        // ========== 右侧 X 轴（逮捕）- 放在底部 ==========
        const rightAxisGroup = svg.append('g')
            .attr('transform', `translate(${centerX}, ${innerHeight + 10})`);

        rightAxisGroup.call(d3.axisBottom(xArrestsScale).ticks(6)
            .tickFormat(d => d.toLocaleString()))
            .style('color', '#b91c1c')
            .style('font-size', '10px')
            .style('font-weight', '600');

        // 右侧轴标签
        svg.append('text')
            .attr('x', centerX + halfWidth / 2)
            .attr('y', innerHeight + 40)
            .attr('text-anchor', 'middle')
            .style('font-size', '12px')
            .style('fill', '#b91c1c')
            .style('font-weight', '700')
            .text('Arrests (count) →');

        // ========== Y 轴（州名）==========
        svg.append('g')
            .call(d3.axisLeft(yScale))
            .style('color', '#334155')
            .style('font-size', '11px')
            .style('font-weight', '600');

        // ========== 中心基准线 ==========
        svg.append('line')
            .attr('x1', centerX)
            .attr('y1', 0)
            .attr('x2', centerX)
            .attr('y2', innerHeight)
            .attr('stroke', '#94a3b8')
            .attr('stroke-width', 1.5)
            .attr('stroke-dasharray', '5,5');

        // ========== 绘制罚款条形（向左）==========
        svg.selectAll('.bar-fines')
            .data(sorted)
            .enter()
            .append('rect')
            .attr('y', d => yScale(d.jurisdiction))
            .attr('x', d => centerX - xFinesScale(d.fines))
            .attr('height', bandHeight)
            .attr('width', 0)
            .attr('fill', d => d.arrests === 0 ? '#94a3b8' : '#1e40af')
            .attr('opacity', d => d.arrests === 0 ? 0.5 : 0.85)
            .attr('rx', 4)
            .style('cursor', 'pointer')
            .on('mouseenter', function (event, d) {
                d3.select(this).attr('opacity', 1);
                const ratio = d.arrests === 0 ? 'No arrests' : (d.arrests / (d.fines / 1e6)).toFixed(1) + ' arrests per $1M fine';
                showTooltip(event, `
                    <div style="font-weight:700;margin-bottom:6px;">${d.jurisdiction}</div>
                    <div>Fines: $${d.fines.toLocaleString()}</div>
                    <div>Arrests: ${d.arrests === 0 ? '0' : d.arrests.toLocaleString()}</div>
                    <div>Charges: ${d.charges.toLocaleString()}</div>
                    <div>Ratio: ${ratio}</div>
                `);
            })
            .on('mousemove', function (event, d) {
                const ratio = d.arrests === 0 ? 'No arrests' : (d.arrests / (d.fines / 1e6)).toFixed(1) + ' arrests per $1M fine';
                showTooltip(event, `
                    <div style="font-weight:700;margin-bottom:6px;">${d.jurisdiction}</div>
                    <div>Fines: $${d.fines.toLocaleString()}</div>
                    <div>Arrests: ${d.arrests === 0 ? '0' : d.arrests.toLocaleString()}</div>
                    <div>Charges: ${d.charges.toLocaleString()}</div>
                    <div>Ratio: ${ratio}</div>
                `);
            })
            .on('mouseleave', function () {
                d3.select(this).attr('opacity', d => d.arrests === 0 ? 0.5 : 0.85);
                hideTooltip();
            })
            .transition()
            .duration(500)
            .attr('width', d => xFinesScale(d.fines));

        // 罚款数值标签
        svg.selectAll('.label-fines')
            .data(sorted)
            .enter()
            .append('text')
            .attr('x', d => centerX - xFinesScale(d.fines) - 5)
            .attr('y', d => yScale(d.jurisdiction) + bandHeight / 2 + 4)
            .attr('text-anchor', 'end')
            .text(d => {
                if (d.fines >= 1e6) return (d.fines / 1e6).toFixed(1) + 'M';
                if (d.fines >= 1e3) return (d.fines / 1e3).toFixed(0) + 'K';
                return d.fines;
            })
            .style('font-size', '10px')
            .style('fill', d => d.arrests === 0 ? '#64748b' : '#1e3a5f')
            .style('font-weight', '600')
            .style('opacity', 0)
            .transition()
            .duration(550)
            .style('opacity', 1);

        // ========== 绘制逮捕条形（向右）==========
        svg.selectAll('.bar-arrests')
            .data(sorted)
            .enter()
            .append('rect')
            .attr('y', d => yScale(d.jurisdiction))
            .attr('x', centerX)
            .attr('height', bandHeight)
            .attr('width', 0)
            .attr('fill', d => d.arrests === 0 ? '#e2e8f0' : '#b91c1c')
            .attr('opacity', d => d.arrests === 0 ? 0.6 : 0.85)
            .attr('rx', 4)
            .style('cursor', 'pointer')
            .on('mouseenter', function (event, d) {
                d3.select(this).attr('opacity', 1);
                const ratio = d.arrests === 0 ? 'No arrests' : (d.arrests / (d.fines / 1e6)).toFixed(1) + ' arrests per $1M fine';
                showTooltip(event, `
                    <div style="font-weight:700;margin-bottom:6px;">${d.jurisdiction}</div>
                    <div>Fines: $${d.fines.toLocaleString()}</div>
                    <div>Arrests: ${d.arrests === 0 ? '0' : d.arrests.toLocaleString()}</div>
                    <div>Charges: ${d.charges.toLocaleString()}</div>
                    <div>Ratio: ${ratio}</div>
                `);
            })
            .on('mousemove', function (event, d) {
                const ratio = d.arrests === 0 ? 'No arrests' : (d.arrests / (d.fines / 1e6)).toFixed(1) + ' arrests per $1M fine';
                showTooltip(event, `
                    <div style="font-weight:700;margin-bottom:6px;">${d.jurisdiction}</div>
                    <div>Fines: $${d.fines.toLocaleString()}</div>
                    <div>Arrests: ${d.arrests === 0 ? '0' : d.arrests.toLocaleString()}</div>
                    <div>Charges: ${d.charges.toLocaleString()}</div>
                    <div>Ratio: ${ratio}</div>
                `);
            })
            .on('mouseleave', function () {
                d3.select(this).attr('opacity', d => d.arrests === 0 ? 0.6 : 0.85);
                hideTooltip();
            })
            .transition()
            .duration(500)
            .attr('width', d => xArrestsScale(d.arrests));

        // 逮捕数值标签
        svg.selectAll('.label-arrests')
            .data(sorted.filter(d => d.arrests > 0))
            .enter()
            .append('text')
            .attr('x', d => centerX + xArrestsScale(d.arrests) + 5)
            .attr('y', d => yScale(d.jurisdiction) + bandHeight / 2 + 4)
            .attr('text-anchor', 'start')
            .text(d => d.arrests.toLocaleString())
            .style('font-size', '10px')
            .style('fill', '#7f1d1d')
            .style('font-weight', '600')
            .style('opacity', 0)
            .transition()
            .duration(550)
            .style('opacity', 1);

        // ========== 注释区域 ==========
        svg.append('text')
            .attr('x', 0)
            .attr('y', innerHeight + 55)
            .attr('text-anchor', 'start')
            .style('font-size', '9px')
            .style('fill', '#94a3b8')
            .style('font-style', 'italic')
            .text('Note: Fines and arrests use independent scales — left axis 0–$23M, right axis 0–5,000 arrests.');

        svg.append('text')
            .attr('x', 0)
            .attr('y', innerHeight + 70)
            .attr('text-anchor', 'start')
            .style('font-size', '9px')
            .style('fill', '#94a3b8')
            .style('font-style', 'italic')
            .text('Source: BITRE · Enforcement Statistics Annual Report · Showing massive fines vs minimal arrests across jurisdictions.');

    }, 50);
}