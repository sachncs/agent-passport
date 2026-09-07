(function () {
  const API = '';

  document.getElementById('search-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') lookupWallet();
  });

  async function lookupWallet() {
    const wallet = document.getElementById('search-input').value.trim();
    if (!wallet) return;

    try {
      const res = await fetch(`${API}/score?wallet=${wallet}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        flash(err.error || 'Wallet lookup failed', 'error');
        document.getElementById('score-section').classList.add('hidden');
        return;
      }
      const data = await res.json();
      showScore(data);
    } catch (e) {
      flash('Request failed: ' + e.message, 'error');
    }
  }

  function showScore(d) {
    document.getElementById('score-section').classList.remove('hidden');

    document.getElementById('trust-score').textContent = d.trustScore;
    const colors = { low: '#28a745', medium: '#ffc107', high: '#fd7e14', critical: '#dc3545' };
    document.getElementById('trust-score').style.color = colors[d.riskLevel] || '#1a1a2e';

    document.getElementById('risk-badge').innerHTML =
      `<span class="badge badge-${d.riskLevel}">${d.riskLevel}</span>`;
    document.getElementById('approved-val').textContent = d.approved ? 'Yes' : 'No';
    document.getElementById('limit-val').textContent = d.recommendedLimit;

    if (d.breakdown) {
      document.getElementById('b-age').textContent = d.breakdown.ageScore;
      document.getElementById('b-activity').textContent = d.breakdown.activityScore;
      document.getElementById('b-volume').textContent = d.breakdown.volumeScore;
      document.getElementById('b-velocity').textContent = d.breakdown.velocityScore;
      document.getElementById('b-compliance').textContent = d.breakdown.complianceScore;
    }

    if (d.onChain) {
      document.getElementById('oc-balance').textContent = d.onChain.balanceAlgo.toFixed(2);
      document.getElementById('oc-txns').textContent = d.onChain.totalTxns;
      document.getElementById('oc-assets').textContent = d.onChain.assetCount;
      document.getElementById('oc-apps').textContent = d.onChain.appCount;
      document.getElementById('oc-age').textContent = d.onChain.accountAgeDays + 'd';
      document.getElementById('oc-round').textContent = d.onChain.lastSeenRound;
    }

    const list = document.getElementById('explanation-list');
    list.innerHTML = '';
    for (const line of (d.explanation || [])) {
      const li = document.createElement('li');
      li.textContent = line;
      list.appendChild(li);
    }
  }

  async function loadHealth() {
    try {
      const res = await fetch(`${API}/health`);
      const data = await res.json();
      const dot = document.getElementById('health-dot');
      const text = document.getElementById('health-text');
      const details = document.getElementById('health-details');

      if (data.status === 'ok') {
        dot.className = 'health-dot ok';
        text.textContent = `Healthy — ${data.service} v${data.version}`;
      } else {
        dot.className = 'health-dot err';
        text.textContent = `Unhealthy: ${data.status}`;
      }
      details.textContent = `Network: ${data.network} | Timestamp: ${data.timestamp}`;
    } catch (e) {
      const dot = document.getElementById('health-dot');
      dot.className = 'health-dot err';
      document.getElementById('health-text').textContent = 'Could not reach API';
    }
  }

  function flash(msg, type) {
    const area = document.getElementById('flash-area');
    area.innerHTML = `<div class="flash flash-${type}">${msg}</div>`;
    setTimeout(() => area.innerHTML = '', 5000);
  }

  loadHealth();
})();