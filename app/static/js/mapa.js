const mapa = L.map('mapa-cajamar', { scrollWheelZoom: false }).setView([-23.3740, -46.8550], 13);

// Mapa base: OpenStreetMap (mesmo do projeto original, sem chave de API)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap | Defesa Civil Cajamar',
    maxZoom: 19
}).addTo(mapa);

// Garante que o mapa calcule o tamanho certo depois que a página carrega
window.addEventListener('load', () => mapa.invalidateSize());
setTimeout(() => mapa.invalidateSize(), 500);

// Zoom com scroll só depois de clicar no mapa (não atrapalha a rolagem da página)
mapa.on('click', () => mapa.scrollWheelZoom.enable());
mapa.getContainer().addEventListener('mouseleave', () => mapa.scrollWheelZoom.disable());

const camadaEstacoes = L.layerGroup().addTo(mapa);
const camadaRios = L.layerGroup().addTo(mapa);
const camadaReportes = L.layerGroup().addTo(mapa);

function obterCor(nivel) {
    return nivel === 'CRÍTICO' ? '#dc2626' :
           nivel === 'ALERTA' ? '#f97316' :
           nivel === 'ATENÇÃO' ? '#eab308' : '#16a34a';
}

// Legenda
const legenda = L.control({ position: 'bottomleft' });
legenda.onAdd = function () {
    const d = L.DomUtil.create('div', 'legenda-mapa');
    d.innerHTML = ['Normal', 'Atenção', 'Alerta', 'Crítico']
        .map(n => `<div><i style="background:${obterCor(n.toUpperCase())}"></i>${n}</div>`).join('');
    return d;
};
legenda.addTo(mapa);

function atualizarMapa(dados) {
    camadaEstacoes.clearLayers();
    dados.forEach(l => {
        if (l.erro) return;

        const cor = obterCor(l.alerta.nivel);
        const pulsa = l.alerta.nivel === 'CRÍTICO' || l.alerta.nivel === 'ALERTA';
        const icone = L.divIcon({
            className: '',
            html: `<div class="pin ${pulsa ? 'pulsa' : ''}" style="--cor:${cor}"><span class="pin-ring"></span><span class="pin-core"></span></div>`,
            iconSize: [22, 22],
            iconAnchor: [11, 11]
        });

        const marcador = L.marker([l.latitude, l.longitude], { icon: icone });
        marcador.bindTooltip(
            `<div class="text-center"><b>${l.bairro}</b><br>${l.temperatura_c}°C &middot; ${l.precipitacao_mm} mm<br><span style="color:${cor}">${l.alerta.nivel}</span></div>`,
            { direction: 'top', offset: [0, -10] }
        );
        marcador.on('click', () => {
            exibirDetalhesRegiao(l);
            mapa.flyTo([l.latitude, l.longitude], 15, { duration: 1.5 });
        });

        marcador.addTo(camadaEstacoes);
    });
}
