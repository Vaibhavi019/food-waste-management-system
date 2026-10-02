document.addEventListener('DOMContentLoaded', () => {
    const iotSection = document.getElementById('iotMonitorSection');
    if (!iotSection) return; // Not on the dashboard

    const elStatus = document.getElementById('iotConnectionStatus');
    const elTime = document.getElementById('iotTimestamp');
    const elValTemp = document.getElementById('valTemp');
    const elValHum = document.getElementById('valHum');
    const elValEnergy = document.getElementById('valEnergy');
    const elValMachine = document.getElementById('valMachine');
    const elStatusTemp = document.getElementById('statusTemp');
    const elStatusHum = document.getElementById('statusHum');
    const elStatusMachine = document.getElementById('statusMachine');
    
    const cardTemp = document.getElementById('cardTemp');
    const cardHum = document.getElementById('cardHum');
    const cardMachine = document.getElementById('cardMachine');

    const alertBanner = document.getElementById('iotRiskAlert');
    const alertMsg = document.getElementById('iotRiskMessage');
    const alertAction = document.getElementById('iotRiskAction');

    function updateTelemetry() {
        fetch('/api/iot/telemetry')
            .then(res => {
                if (!res.ok) throw new Error('API Error');
                return res.json();
            })
            .then(data => {
                const cur = data.current;
                const risk = data.risk;

                elStatus.className = 'badge badge-success';
                elStatus.textContent = 'Live';
                
                const secs = Math.round((Date.now() - new Date(cur.timestamp).getTime()) / 1000);
                elTime.textContent = `Last update: ${secs}s ago`;

                elValTemp.textContent = cur.temperature.toFixed(1) + '°C';
                elValTemp.className = 'stat-value'; // remove text-muted
                
                elValHum.textContent = cur.humidity.toFixed(1) + '%';
                elValHum.className = 'stat-value';
                
                elValEnergy.textContent = cur.energyUsage.toFixed(2);
                elValEnergy.className = 'stat-value';

                elValMachine.textContent = cur.machineStatus;
                elValMachine.className = 'stat-value';

                // Check temp risk in reasons
                const tempRisk = risk.reasons.find(r => r.includes('Temperature'));
                if (tempRisk) {
                    elStatusTemp.textContent = tempRisk.includes('critically') ? 'CRITICAL' : 'WARNING';
                    elStatusTemp.style.color = tempRisk.includes('critically') ? 'var(--danger)' : 'var(--warning-dark)';
                    cardTemp.style.borderLeftColor = tempRisk.includes('critically') ? 'var(--danger)' : 'var(--warning-dark)';
                } else {
                    elStatusTemp.textContent = 'NORMAL';
                    elStatusTemp.style.color = 'var(--success)';
                    cardTemp.style.borderLeftColor = 'var(--success)';
                }

                // Check hum risk
                const humRisk = risk.reasons.find(r => r.includes('Humidity'));
                if (humRisk) {
                    elStatusHum.textContent = humRisk.includes('critically') ? 'CRITICAL' : 'WARNING';
                    elStatusHum.style.color = humRisk.includes('critically') ? 'var(--danger)' : 'var(--warning-dark)';
                    cardHum.style.borderLeftColor = humRisk.includes('critically') ? 'var(--danger)' : 'var(--warning-dark)';
                } else {
                    elStatusHum.textContent = 'NORMAL';
                    elStatusHum.style.color = 'var(--success)';
                    cardHum.style.borderLeftColor = 'var(--success)';
                }

                if (cur.machineStatus !== 'ONLINE') {
                    elStatusMachine.textContent = 'ATTENTION';
                    elStatusMachine.style.color = 'var(--warning-dark)';
                    cardMachine.style.borderLeftColor = 'var(--warning-dark)';
                } else {
                    elStatusMachine.textContent = cur.storageStatus; // NORMAL, WARNING, CRITICAL
                    if(cur.storageStatus === 'CRITICAL') {
                         elStatusMachine.style.color = 'var(--danger)';
                         cardMachine.style.borderLeftColor = 'var(--danger)';
                    } else if (cur.storageStatus === 'WARNING') {
                         elStatusMachine.style.color = 'var(--warning-dark)';
                         cardMachine.style.borderLeftColor = 'var(--warning-dark)';
                    } else {
                         elStatusMachine.style.color = 'var(--success)';
                         cardMachine.style.borderLeftColor = 'var(--success)';
                    }
                }

                if (risk.level === 'CRITICAL' || risk.level === 'WARNING') {
                    alertBanner.style.display = 'block';
                    alertBanner.style.backgroundColor = risk.level === 'CRITICAL' ? 'var(--danger)' : 'var(--warning-dark)';
                    alertBanner.style.color = 'white';
                    alertMsg.innerHTML = `<strong>${risk.level} STORAGE RISK:</strong> ${risk.reasons.join(' | ')}`;
                    alertAction.textContent = risk.recommendedAction;
                } else {
                    alertBanner.style.display = 'none';
                }

                // Check if intelligence dashboard is open to update that too
                const intelStorageRisk = document.getElementById('intelStorageRisk');
                if (intelStorageRisk) {
                     intelStorageRisk.textContent = risk.level;
                     if(risk.level === 'CRITICAL') {
                         intelStorageRisk.parentElement.className = 'metric-line warning';
                         intelStorageRisk.style.color = 'var(--danger)';
                     } else if (risk.level === 'WARNING') {
                         intelStorageRisk.parentElement.className = 'metric-line warning';
                         intelStorageRisk.style.color = 'var(--warning-dark)';
                     } else {
                         intelStorageRisk.parentElement.className = 'metric-line';
                         intelStorageRisk.style.color = 'var(--success)';
                     }
                }
            })
            .catch(err => {
                console.error(err);
                elStatus.className = 'badge badge-danger';
                elStatus.textContent = 'Offline';
            });
    }

    // Initial fetch
    updateTelemetry();

    // Poll every 5 seconds
    setInterval(updateTelemetry, 5000);
});
