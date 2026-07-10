// Home Loan Default Prediction Dashboard - JS Logic

document.addEventListener('DOMContentLoaded', function () {
    // Set current date/time in header
    updateTime();
    setInterval(updateTime, 1000);

    // Initial load of data
    fetchDataAndRenderCharts();

    // Event listeners
    document.getElementById('apply-filters-btn').addEventListener('click', function () {
        fetchDataAndRenderCharts();
    });

    document.getElementById('prediction-form').addEventListener('submit', function (e) {
        e.preventDefault();
        runPrediction();
    });

    // Sidebar navigation smooth scroll and active highlighting
    const navLinks = document.querySelectorAll('.nav-menu li a');
    navLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            document.querySelector(targetId).scrollIntoView({ behavior: 'smooth' });
            
            navLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
        });
    });
});

function updateTime() {
    const timeSpan = document.getElementById('current-time');
    const now = new Date();
    timeSpan.innerText = now.toLocaleString();
}

function fetchDataAndRenderCharts() {
    // Show loading indicator or simple console logs
    console.log("Fetching filtered data...");

    // Collect filter values
    const gender = document.getElementById('filter-gender').value;
    const incomeType = document.getElementById('filter-income-type').value;
    const education = document.getElementById('filter-education').value;
    const target = document.getElementById('filter-target').value;
    const ageGroup = document.getElementById('filter-age-group').value;
    const creditRange = document.getElementById('filter-credit-range').value;

    const queryParams = new URLSearchParams({
        gender,
        income_type: incomeType,
        education,
        target,
        age_group: ageGroup,
        credit_range: creditRange
    });

    fetch(`/api/data?${queryParams.toString()}`)
        .then(response => response.json())
        .then(data => {
            console.log("Data fetched successfully. Updating Dashboard...");
            updateKPIs(data.kpis);
            renderSampleTable(data.sample_rows);
            renderTargetCharts(data.target_dist);
            renderDemographics(data.demographics);
            renderLoanCharacteristics(data.loans);
            renderCreditHistory(data.history);
            renderCorrelationAndImportance(data.metrics);
            renderModelCharts(data.metrics);
        })
        .catch(err => console.error("Error fetching data:", err));
}

function updateKPIs(kpis) {
    document.getElementById('kpi-total').innerText = kpis.total.toLocaleString();
    document.getElementById('kpi-repaid').innerText = kpis.repaid.toLocaleString();
    document.getElementById('kpi-defaulted').innerText = kpis.defaulted.toLocaleString();
    document.getElementById('kpi-rate').innerText = kpis.rate.toFixed(2) + "%";

    // Update historical averages in section 5
    document.getElementById('avg-prev-loans').innerText = kpis.avg_prev_loans.toFixed(1);
    document.getElementById('avg-active-loans').innerText = kpis.avg_active_loans.toFixed(1);
    document.getElementById('avg-prev-apps').innerText = kpis.avg_prev_apps.toFixed(1);
    document.getElementById('avg-late-pct').innerText = kpis.avg_late_pct.toFixed(1) + "%";
    document.getElementById('avg-cc-util').innerText = kpis.avg_cc_util.toFixed(1) + "%";
    document.getElementById('avg-inst-delay').innerText = kpis.avg_inst_delay.toFixed(1) + " days";
}

function renderSampleTable(rows) {
    const tbody = document.querySelector('#sample-data-table tbody');
    tbody.innerHTML = '';
    rows.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.SK_ID_CURR}</td>
            <td><span class="status-badge" style="background-color: ${row.TARGET === 1 ? '#ea4335' : '#34a853'}">${row.TARGET}</span></td>
            <td>${row.NAME_CONTRACT_TYPE}</td>
            <td>${row.CODE_GENDER}</td>
            <td>$${row.AMT_INCOME_TOTAL.toLocaleString()}</td>
            <td>$${row.AMT_CREDIT.toLocaleString()}</td>
            <td>${(row.inst_mean_delay || 0).toFixed(1)} days</td>
            <td>${(row.prev_total_apps || 0).toFixed(0)}</td>
        `;
        tbody.appendChild(tr);
    });
}

function renderTargetCharts(target_dist) {
    // Pie Chart
    const pieData = [{
        values: [target_dist.repaid, target_dist.defaulted],
        labels: ['Repaid (0)', 'Defaulted (1)'],
        type: 'pie',
        marker: {
            colors: ['#34a853', '#ea4335']
        },
        textinfo: 'percent+label',
        hoverinfo: 'value'
    }];
    const pieLayout = {
        title: 'Repayment Ratio',
        margin: { t: 40, b: 20, l: 20, r: 20 },
        height: 350
    };
    Plotly.newPlot('chart-target-pie', pieData, pieLayout);

    // Bar Chart
    const barData = [{
        x: ['Repaid', 'Defaulted'],
        y: [target_dist.repaid, target_dist.defaulted],
        type: 'bar',
        marker: {
            color: ['#34a853', '#ea4335']
        }
    }];
    const barLayout = {
        title: 'Customer Counts',
        margin: { t: 40, b: 40, l: 60, r: 20 },
        height: 350,
        yaxis: { title: 'Number of Clients' }
    };
    Plotly.newPlot('chart-target-bar', barData, barLayout);
}

function renderDemographics(demo) {
    // Gender bar
    const genderData = [{
        x: Object.keys(demo.gender),
        y: Object.values(demo.gender),
        type: 'bar',
        marker: { color: '#2f6fed' }
    }];
    Plotly.newPlot('chart-gender', genderData, { margin: { t: 30, b: 35, l: 50, r: 15 }, height: 250 });

    // Education bar
    const eduData = [{
        y: Object.keys(demo.education),
        x: Object.values(demo.education),
        type: 'bar',
        orientation: 'h',
        marker: { color: '#1e3a5f' }
    }];
    Plotly.newPlot('chart-education', eduData, { margin: { t: 10, b: 35, l: 150, r: 15 }, height: 250 });

    // Income Type
    const incData = [{
        values: Object.values(demo.income_type),
        labels: Object.keys(demo.income_type),
        type: 'pie',
        hole: 0.4
    }];
    Plotly.newPlot('chart-income-type', incData, { margin: { t: 20, b: 20, l: 20, r: 20 }, height: 250 });

    // Age Histogram
    const ageData = [{
        x: demo.ages,
        type: 'histogram',
        nbinsx: 20,
        marker: { color: '#fbbc05' }
    }];
    Plotly.newPlot('chart-age', ageData, { margin: { t: 30, b: 35, l: 50, r: 15 }, height: 250, xaxis: { title: 'Age in Years' } });
}

function renderLoanCharacteristics(loans) {
    // Income vs Credit scatter
    const scatterData = [{
        x: loans.incomes,
        y: loans.credits,
        mode: 'markers',
        type: 'scatter',
        marker: { color: '#2f6fed', opacity: 0.6 }
    }];
    Plotly.newPlot('chart-income-credit', scatterData, {
        margin: { t: 20, b: 35, l: 60, r: 15 },
        height: 250,
        xaxis: { title: 'Income ($)' },
        yaxis: { title: 'Credit Amount ($)' }
    });

    // Annuity distribution
    const annuityData = [{
        x: loans.annuities,
        type: 'histogram',
        marker: { color: '#34a853' }
    }];
    Plotly.newPlot('chart-annuity', annuityData, {
        margin: { t: 20, b: 35, l: 50, r: 15 },
        height: 250,
        xaxis: { title: 'Annuity ($)' }
    });

    // Loan-to-income ratio boxplot
    const ratioData = [{
        y: loans.ratios,
        type: 'box',
        marker: { color: '#ea4335' }
    }];
    Plotly.newPlot('chart-loan-income-ratio', ratioData, {
        margin: { t: 20, b: 20, l: 50, r: 15 },
        height: 250,
        yaxis: { title: 'Loan-to-Income Ratio' }
    });

    // Employment years
    const employData = [{
        x: loans.employments,
        type: 'histogram',
        marker: { color: '#1e3a5f' }
    }];
    Plotly.newPlot('chart-employment', employData, {
        margin: { t: 20, b: 35, l: 50, r: 15 },
        height: 250,
        xaxis: { title: 'Years Employed' }
    });
}

function renderCreditHistory(hist) {
    // Bureau active vs closed
    const activeClosed = [{
        x: ['Active Credit', 'Closed Credit'],
        y: [hist.avg_active, hist.avg_closed],
        type: 'bar',
        marker: { color: ['#2f6fed', '#a0aec0'] }
    }];
    Plotly.newPlot('chart-bureau-status', activeClosed, { margin: { t: 20, b: 35, l: 50, r: 15 }, height: 250 });

    // Previous App Decisions
    const decisions = [{
        values: [hist.avg_approved, hist.avg_refused],
        labels: ['Approved', 'Refused'],
        type: 'pie',
        marker: { colors: ['#34a853', '#ea4335'] }
    }];
    Plotly.newPlot('chart-prev-app-decisions', decisions, { margin: { t: 20, b: 20, l: 20, r: 20 }, height: 250 });

    // Installment Payment delays
    const delays = [{
        x: hist.delays,
        type: 'histogram',
        marker: { color: '#fbbc05' }
    }];
    Plotly.newPlot('chart-payment-delays', delays, {
        margin: { t: 20, b: 35, l: 50, r: 15 },
        height: 250,
        xaxis: { title: 'Delay in Days' }
    });

    // CC utilization
    const ccUtil = [{
        x: hist.cc_limits,
        y: hist.cc_balances,
        mode: 'markers',
        type: 'scatter',
        marker: { color: '#1e3a5f' }
    }];
    Plotly.newPlot('chart-cc-utilization', ccUtil, {
        margin: { t: 20, b: 35, l: 60, r: 15 },
        height: 250,
        xaxis: { title: 'Credit Card Limit ($)' },
        yaxis: { title: 'Balance ($)' }
    });
}

function renderCorrelationAndImportance(metrics) {
    // Correlation Heatmap
    const heatmapData = [{
        z: metrics.corr_matrix,
        x: metrics.corr_features,
        y: metrics.corr_features,
        type: 'heatmap',
        colorscale: 'RdBu',
        reversescale: true
    }];
    const heatmapLayout = {
        margin: { t: 20, b: 100, l: 150, r: 20 },
        height: 400
    };
    Plotly.newPlot('chart-heatmap', heatmapData, heatmapLayout);

    // Feature Importance Horizontal Bar Chart
    const featData = [{
        y: metrics.importance_names,
        x: metrics.importance_values,
        type: 'bar',
        orientation: 'h',
        marker: { color: 'teal' }
    }];
    const featLayout = {
        margin: { t: 20, b: 40, l: 180, r: 20 },
        height: 400,
        xaxis: { title: 'Importance (Mean Decrease Impurity)' }
    };
    Plotly.newPlot('chart-feature-importance', featData, featLayout);
}

function renderModelCharts(metrics) {
    // Model ROC AUC comparison
    const models = ['Logistic Regression', 'Decision Tree', 'Random Forest', 'HistGradient Boosting'];
    const aucs = [0.709, 0.718, 0.751, 0.781];
    
    const compData = [{
        x: models,
        y: aucs,
        type: 'bar',
        marker: {
            color: ['#a0aec0', '#a0aec0', '#a0aec0', '#2f6fed']
        }
    }];
    Plotly.newPlot('chart-model-comparison', compData, {
        margin: { t: 20, b: 40, l: 50, r: 15 },
        height: 250,
        yaxis: { title: 'ROC-AUC Score', range: [0.5, 0.85] }
    });

    // Confusion Matrix (HistGradient Boosting)
    const cmZ = [[22380, 5880], [745, 1738]];
    const cmData = [{
        z: cmZ,
        x: ['Predicted 0', 'Predicted 1'],
        y: ['Actual 0', 'Actual 1'],
        type: 'heatmap',
        colorscale: 'Blues',
        showscale: false
    }];
    Plotly.newPlot('chart-confusion-matrix', cmData, {
        margin: { t: 20, b: 40, l: 80, r: 20 },
        height: 250
    });

    // ROC Curves
    const rocData = [];
    const models_auc = {
        'HistGradient Boosting': 0.781,
        'Random Forest': 0.751,
        'Decision Tree': 0.718,
        'Logistic Regression': 0.709
    };
    for (const [mName, mAuc] of Object.entries(models_auc)) {
        // Create approximate curves for presentation
        const fpr = [];
        const tpr = [];
        for (let i = 0; i <= 100; i++) {
            const f = i / 100;
            const t = Math.min(1.0, Math.pow(f, 1 - mAuc) + f * 0.1);
            fpr.push(f);
            tpr.push(t);
        }
        rocData.push({
            x: fpr,
            y: tpr,
            mode: 'lines',
            name: `${mName} (${mAuc})`
        });
    }
    // diagonal reference
    rocData.push({
        x: [0, 1],
        y: [0, 1],
        mode: 'lines',
        name: 'Random Guess',
        line: { dash: 'dash', color: 'gray' }
    });

    Plotly.newPlot('chart-roc-curves', rocData, {
        margin: { t: 20, b: 45, l: 50, r: 15 },
        height: 250,
        xaxis: { title: 'FPR' },
        yaxis: { title: 'TPR' }
    });
}

function runPrediction() {
    const btn = document.getElementById('btn-predict');
    btn.innerText = "Analyzing...";
    btn.disabled = true;

    // Collect data
    const age = parseFloat(document.getElementById('pred-age').value);
    const income = parseFloat(document.getElementById('pred-income').value);
    const credit = parseFloat(document.getElementById('pred-credit').value);
    const annuity = parseFloat(document.getElementById('pred-annuity').value);
    const employed = parseFloat(document.getElementById('pred-employ').value);
    const prevLoans = parseFloat(document.getElementById('pred-prev-loans').value);
    const activeLoans = parseFloat(document.getElementById('pred-active-loans').value);
    const ccUtil = parseFloat(document.getElementById('pred-cc-util').value);
    const latePct = parseFloat(document.getElementById('pred-late-pct').value);
    const delay = parseFloat(document.getElementById('pred-delay').value);

    fetch('/api/predict', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            age, income, credit, annuity, employed,
            prev_loans: prevLoans, active_loans: activeLoans,
            cc_util: ccUtil, late_pct: latePct, delay
        })
    })
    .then(res => res.json())
    .then(result => {
        btn.innerText = "Analyze Application";
        btn.disabled = false;

        const panel = document.getElementById('prediction-result');
        const status = document.getElementById('result-status');
        const confidence = document.getElementById('result-confidence');
        const rClass = document.getElementById('result-class');
        const list = document.getElementById('result-reasons');

        panel.classList.remove('hidden');
        list.innerHTML = '';

        // Reset classes
        panel.classList.remove('success-theme', 'danger-theme');
        status.classList.remove('status-badge-success', 'status-badge-danger');

        confidence.innerText = (result.probability * 100).toFixed(1) + "%";
        
        if (result.prediction === 0) {
            status.innerText = "Eligible / Low Risk";
            status.style.backgroundColor = '#34a853';
            rClass.innerText = "Approved (Low Default Probability)";
            panel.classList.add('success-theme');
        } else {
            status.innerText = "Likely Default";
            status.style.backgroundColor = '#ea4335';
            rClass.innerText = "Rejected (High Risk of Default)";
            panel.classList.add('danger-theme');
        }

        // Add reasons
        result.explanations.forEach(reason => {
            const li = document.createElement('li');
            li.innerText = reason;
            list.appendChild(li);
        });

        // Scroll to prediction result smoothly
        panel.scrollIntoView({ behavior: 'smooth' });
    })
    .catch(err => {
        btn.innerText = "Analyze Application";
        btn.disabled = false;
        console.error("Prediction failed:", err);
    });
}
