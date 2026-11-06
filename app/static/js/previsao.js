// Dados dos bairros (estações) vindos do seu backend: /api/clima

function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// "ATENÇÃO" -> "atencao", "CRÍTICO" -> "critico"
function slugNivel(nivel) {
    return String(nivel || 'NORMAL').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

async function carregar() {
    try {
        const res = await fetch('/api/clima');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const dados = await res.json();
        atualizarPainel(dados);
        atualizarMapa(dados);
        const el = document.getElementById('bairros-atualizado');
        if (el) el.innerHTML = '<i class="fa-regular fa-clock me-1"></i>Atualizado às ' +
            new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        document.dispatchEvent(new CustomEvent('bairros:ok', { detail: dados }));
    } catch (e) {
        document.getElementById('painel-alertas').innerHTML =
            '<div class="col-12"><div class="alert alert-danger mb-0">Falha ao carregar dados dos bairros. Tente novamente mais tarde.</div></div>';
    }
}

function atualizarPainel(dados) {
    const p = document.getElementById('painel-alertas');
    p.innerHTML = '';

    dados.forEach(l => {
        if (l.erro) return;

        const slug = slugNivel(l.alerta.nivel);
        const chove = l.precipitacao_mm > 0;
        const pct = Math.max(chove ? 4 : 0, Math.min(100, (l.precipitacao_mm / 50) * 100)); // barra: 0 a 50 mm
        const prob = (l.probabilidade_chuva ?? null);

        p.insertAdjacentHTML('beforeend', `
        <div class="col-md-6 col-lg-4">
            <article class="bairro" data-nivel="${slug}">
                <div class="bairro-topo">
                    <h3 class="bairro-nome">${esc(l.bairro)}</h3>
                    <span class="chip-temp"><i class="fa-solid fa-temperature-half"></i>${esc(l.temperatura_c)}°C</span>
                </div>
                <div class="bairro-chuva">
                    <div class="bairro-mm">${esc(l.precipitacao_mm)}<small>mm</small></div>
                    <i class="bairro-icone fa-solid ${chove ? 'fa-cloud-rain chove' : 'fa-cloud'}"></i>
                    ${prob !== null ? `<span class="bairro-prob"><i class="fa-solid fa-umbrella"></i>${esc(prob)}%</span>` : ''}
                </div>
                <div class="barra" title="Chuva acumulada (escala até 50 mm)"><span style="width:${pct}%"></span></div>
                <span class="selo-nivel">${esc(l.alerta.nivel)}</span>
                <p class="bairro-msg"><b>Aviso:</b> ${esc(l.alerta.mensagem)}</p>
            </article>
        </div>`);
    });
}

function exibirDetalhesRegiao(l) {
    const slug = slugNivel(l.alerta.nivel);
    document.getElementById('painel-detalhes').innerHTML = `
        <div class="det-nome">${esc(l.bairro)}</div>
        <div class="det-grid">
            <div class="det-item"><i class="fa-solid fa-temperature-half text-danger"></i><b>${esc(l.temperatura_c)}°C</b></div>
            <div class="det-item"><i class="fa-solid fa-droplet text-primary"></i><b>${esc(l.precipitacao_mm)} mm</b></div>
            <div class="det-item"><i class="fa-solid fa-umbrella text-info"></i><b>${esc(l.probabilidade_chuva ?? '--')}%</b></div>
        </div>
        <div class="det-aviso" data-nivel="${slug}"><strong>${esc(l.alerta.nivel)}</strong>: ${esc(l.alerta.mensagem)}</div>
    `;
}

document.addEventListener('DOMContentLoaded', () => {
    carregar();
    setInterval(carregar, 5 * 60 * 1000); // atualiza a cada 5 min
});
