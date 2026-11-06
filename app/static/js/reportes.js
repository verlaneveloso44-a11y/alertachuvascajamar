// Relatos da comunidade: lista no mapa (GET /api/reportes) e envio (POST /api/reportes)
let localRelato = null;

function tempoAtras(iso) {
    const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (min < 1) return 'agora';
    if (min < 60) return min + ' min atrás';
    return Math.floor(min / 60) + ' h atrás';
}

async function carregarReportes() {
    try {
        const res = await fetch('/api/reportes');
        const lista = await res.json();
        camadaReportes.clearLayers();
        const cor = { Leve: '#38bdf8', Moderada: '#7c3aed', Forte: '#f97316', Alagamento: '#dc2626' };
        lista.forEach(r => {
            const icone = L.divIcon({ className: '', html: `<div class="pin-relato" style="background:${cor[r.intensidade] || '#7c3aed'}"></div>`, iconSize: [20, 20], iconAnchor: [10, 10] });
            L.marker([r.latitude, r.longitude], { icon: icone })
                .bindTooltip(`<b>Relato: ${esc(r.intensidade)}</b><br>${tempoAtras(r.data_hora)}${r.descricao ? '<br>' + esc(r.descricao) : ''}`, { direction: 'top', offset: [0, -8] })
                .addTo(camadaReportes);
        });
    } catch (e) { /* sem relatos no mapa */ }
}

document.addEventListener('DOMContentLoaded', () => {
    carregarReportes();
    setInterval(carregarReportes, 2 * 60 * 1000);

    const form = document.getElementById('form-reporte');
    const btnLocal = document.getElementById('rep-local');
    const status = document.getElementById('rep-local-status');
    const btnEnviar = document.getElementById('rep-enviar');
    const erro = document.getElementById('rep-erro');
    const ok = document.getElementById('rep-ok');

    btnLocal.addEventListener('click', () => {
        if (!navigator.geolocation) { status.textContent = 'Seu navegador não permite localização.'; return; }
        status.textContent = 'Obtendo localização...';
        navigator.geolocation.getCurrentPosition(pos => {
            localRelato = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
            status.innerHTML = '<i class="fa-solid fa-circle-check text-success me-1"></i>Localização capturada.';
            btnEnviar.disabled = false;
        }, () => {
            status.textContent = 'Não consegui obter a localização. Permita o acesso no navegador e tente de novo.';
        }, { enableHighAccuracy: true, timeout: 10000 });
    });

    form.addEventListener('submit', async ev => {
        ev.preventDefault();
        erro.classList.add('d-none'); ok.classList.add('d-none');
        btnEnviar.disabled = true;
        try {
            const res = await fetch('/api/reportes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...localRelato,
                    intensidade: document.getElementById('rep-intensidade').value,
                    descricao: document.getElementById('rep-descricao').value
                })
            });
            const j = await res.json();
            if (!res.ok) throw new Error(j.erro || 'Erro ao enviar.');
            ok.classList.remove('d-none');
            form.reset(); localRelato = null;
            status.textContent = 'A localização é obrigatória e precisa estar em Cajamar.';
            carregarReportes();
        } catch (e) {
            erro.textContent = e.message; erro.classList.remove('d-none');
            btnEnviar.disabled = !localRelato;
        }
    });
});
