// Nível dos rios (vazão estimada) vindo do backend: /api/rios
async function carregarRios() {
    const alvo = document.getElementById('painel-rios');
    try {
        const res = await fetch('/api/rios');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const rios = await res.json();
        alvo.innerHTML = '';
        camadaRios.clearLayers();

        rios.forEach(r => {
            const slug = slugNivel(r.alerta.nivel);
            const max = Math.max(...r.previsao.map(p => p.vazao), r.vazao_m3s, 0.1);
            const barras = r.previsao.map((p, i) => {
                const dia = i === 0 ? 'Hoje' : new Date(p.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
                return `<div class="rio-barra ${i === 0 ? 'hoje' : ''}" title="${p.vazao} m³/s"><span style="height:${Math.max(4, (p.vazao / max) * 100)}%"></span><em>${dia}</em></div>`;
            }).join('');
            const seta = r.tendencia === 'subindo' ? 'fa-arrow-trend-up' : r.tendencia === 'caindo' ? 'fa-arrow-trend-down' : 'fa-minus';

            alvo.insertAdjacentHTML('beforeend', `
            <div class="col-lg-6">
              <article class="rio" data-nivel="${slug}">
                <div class="rio-topo">
                    <h3 class="rio-nome"><i class="fa-solid fa-water"></i>${esc(r.nome)}</h3>
                    <span class="selo-nivel" style="background:var(--nivel)">${esc(r.alerta.nivel)}</span>
                </div>
                <div class="rio-vazao">${String(r.vazao_m3s).replace('.', ',')}<small>m³/s</small></div>
                <div class="rio-info"><i class="fa-solid ${seta} me-1"></i>Rio <b>${esc(r.tendencia)}</b> &middot; média de 30 dias: <b>${String(r.media_30d).replace('.', ',')} m³/s</b> (${String(r.razao).replace('.', ',')}x)</div>
                <div class="rio-info mb-2">${esc(r.alerta.mensagem)}</div>
              </article>
            </div>
            <div class="col-lg-6">
              <article class="rio" data-nivel="${slug}">
                <div class="rio-topo"><h3 class="rio-nome" style="font-size:.95rem">Vazão prevista (próximos 7 dias)</h3></div>
                <div class="rio-barras">${barras}</div>
              </article>
            </div>`);

            const icone = L.divIcon({ className: '', html: '<div class="pin-rio"><i class="fa-solid fa-water"></i></div>', iconSize: [26, 26], iconAnchor: [13, 13] });
            L.marker([r.latitude, r.longitude], { icon: icone })
                .bindTooltip(`<b>${esc(r.nome)}</b><br>${r.vazao_m3s} m³/s &middot; ${esc(r.alerta.nivel)}<br><small>estimativa por modelo</small>`, { direction: 'top', offset: [0, -10] })
                .addTo(camadaRios);
        });
        if (!rios.length) alvo.innerHTML = '<div class="col-12 text-muted small">Sem dados dos rios no momento.</div>';
    } catch (e) {
        alvo.innerHTML = '<div class="col-12"><div class="alert alert-warning mb-0">Dados dos rios indisponíveis no momento.</div></div>';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    carregarRios();
    setInterval(carregarRios, 30 * 60 * 1000);
});
