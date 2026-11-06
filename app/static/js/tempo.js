// Clima atual, previsão por hora e 7 dias (Open-Meteo: gratuito, sem chave de API)
const CAJAMAR = { lat: -23.3740, lon: -46.8550 };
const URL_TEMPO = 'https://api.open-meteo.com/v1/forecast'
    + `?latitude=${CAJAMAR.lat}&longitude=${CAJAMAR.lon}`
    + '&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m'
    + '&hourly=temperature_2m,precipitation_probability,weather_code,is_day'
    + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,uv_index_max,sunrise,sunset'
    + '&timezone=America%2FSao_Paulo&forecast_days=7&wind_speed_unit=kmh';

const $ = id => document.getElementById(id);

// Código WMO -> texto, ícone e tema do fundo
function descreverTempo(code, dia = true) {
    const t = (txt, icone, tema) => ({ txt, icone, tema });
    if (code === 0) return dia ? t('Céu limpo', 'fa-sun', 'dia') : t('Céu limpo', 'fa-moon', 'noite');
    if (code === 1) return dia ? t('Predominantemente limpo', 'fa-cloud-sun', 'dia') : t('Predominantemente limpo', 'fa-cloud-moon', 'noite');
    if (code === 2) return dia ? t('Parcialmente nublado', 'fa-cloud-sun', 'dia') : t('Parcialmente nublado', 'fa-cloud-moon', 'noite');
    if (code === 3) return t('Nublado', 'fa-cloud', 'nublado');
    if (code === 45 || code === 48) return t('Neblina', 'fa-smog', 'nublado');
    if (code >= 51 && code <= 57) return t('Garoa', 'fa-cloud-rain', 'chuva');
    if (code === 61 || code === 66) return t('Chuva fraca', 'fa-cloud-rain', 'chuva');
    if (code === 63 || code === 67) return t('Chuva moderada', 'fa-cloud-rain', 'chuva');
    if (code === 65) return t('Chuva forte', 'fa-cloud-showers-heavy', 'chuva');
    if (code >= 71 && code <= 77) return t('Neve', 'fa-snowflake', 'nublado');
    if (code === 80) return t('Pancadas de chuva fracas', 'fa-cloud-sun-rain', 'chuva');
    if (code === 81) return t('Pancadas de chuva', 'fa-cloud-showers-heavy', 'chuva');
    if (code === 82) return t('Pancadas de chuva fortes', 'fa-cloud-showers-heavy', 'tempestade');
    if (code === 85 || code === 86) return t('Pancadas de neve', 'fa-snowflake', 'nublado');
    if (code === 95) return t('Tempestade', 'fa-cloud-bolt', 'tempestade');
    if (code === 96 || code === 99) return t('Tempestade com granizo', 'fa-cloud-bolt', 'tempestade');
    return t('Condição indisponível', 'fa-cloud', 'dia');
}

function direcaoVento(graus) {
    const pts = ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO'];
    return pts[Math.round(graus / 45) % 8];
}

function nivelUV(uv) {
    if (uv < 3) return 'Baixo';
    if (uv < 6) return 'Moderado';
    if (uv < 8) return 'Alto';
    if (uv < 11) return 'Muito alto';
    return 'Extremo';
}

const hhmm = iso => iso.slice(11, 16);
const arred = n => Math.round(n);

async function carregarTempo() {
    try {
        const res = await fetch(URL_TEMPO);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const d = await res.json();
        desenharAgora(d);
        desenharHoras(d);
        desenharDias(d);
    } catch (e) {
        $('t-texto').textContent = 'Previsão indisponível no momento';
        $('horas').innerHTML = '<div class="text-muted small p-3">Não foi possível carregar a previsão. Tente novamente mais tarde.</div>';
    }
}

function desenharAgora(d) {
    const c = d.current, dia = d.daily;
    const info = descreverTempo(c.weather_code, c.is_day === 1);

    $('agora').dataset.tema = info.tema;
    $('t-icone').className = 'hero-icone fa-solid ' + info.icone;
    $('t-atual').textContent = arred(c.temperature_2m);
    $('t-texto').textContent = info.txt;
    $('t-max').textContent = arred(dia.temperature_2m_max[0]);
    $('t-min').textContent = arred(dia.temperature_2m_min[0]);
    $('t-sens').textContent = arred(c.apparent_temperature);

    $('m-umidade').textContent = c.relative_humidity_2m + '%';
    $('m-vento').textContent = arred(c.wind_speed_10m) + ' km/h';
    $('m-vento-sub').textContent = 'de ' + direcaoVento(c.wind_direction_10m) + ' · rajadas ' + arred(c.wind_gusts_10m);
    $('m-prob').textContent = (dia.precipitation_probability_max[0] ?? 0) + '%';
    $('m-chuva').textContent = (dia.precipitation_sum[0] ?? 0).toFixed(1).replace('.', ',') + ' mm';
    $('m-pressao').textContent = arred(c.surface_pressure) + ' hPa';
    const uv = dia.uv_index_max[0] ?? 0;
    $('m-uv').textContent = uv.toFixed(0);
    $('m-uv-sub').textContent = nivelUV(uv) + ' (máx. hoje)';
    $('m-nascer').textContent = hhmm(dia.sunrise[0]);
    $('m-por').textContent = hhmm(dia.sunset[0]);
}

function desenharHoras(d) {
    const h = d.hourly;
    const agoraStr = d.current.time.slice(0, 13) + ':00';
    let i0 = h.time.findIndex(t => t >= agoraStr);
    if (i0 < 0) i0 = 0;

    let html = '';
    for (let i = i0; i < Math.min(i0 + 24, h.time.length); i++) {
        const info = descreverTempo(h.weather_code[i], h.is_day[i] === 1);
        const prob = h.precipitation_probability[i] ?? 0;
        html += `
        <div class="hora ${i === i0 ? 'agora' : ''}">
            <span class="hora-h">${i === i0 ? 'Agora' : hhmm(h.time[i])}</span>
            <i class="fa-solid ${info.icone}" title="${info.txt}"></i>
            <span class="hora-t">${arred(h.temperature_2m[i])}°</span>
            <span class="hora-p ${prob === 0 ? 'zero' : ''}"><i class="fa-solid fa-droplet" style="font-size:.65rem;height:auto;color:inherit"></i> ${prob}%</span>
        </div>`;
    }
    $('horas').innerHTML = html;
}

function desenharDias(d) {
    const dia = d.daily;
    let html = '';
    for (let i = 0; i < dia.time.length; i++) {
        const dt = new Date(dia.time[i] + 'T12:00:00');
        const nome = i === 0 ? 'Hoje' : dt.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
        const data = dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        const info = descreverTempo(dia.weather_code[i], true);
        const mm = dia.precipitation_sum[i] ?? 0;
        const prob = dia.precipitation_probability_max[i] ?? 0;
        html += `
        <div class="dia ${i === 0 ? 'hoje' : ''}" title="${info.txt}">
            <span class="dia-nome">${nome}</span>
            <span class="dia-data">${data}</span>
            <i class="fa-solid ${info.icone}"></i>
            <span class="dia-temp">${arred(dia.temperature_2m_max[i])}°<span>${arred(dia.temperature_2m_min[i])}°</span></span>
            <span class="dia-chuva ${mm === 0 && prob < 10 ? 'zero' : ''}"><i class="fa-solid fa-droplet" style="font-size:.65rem;margin:0 .2rem 0 0;color:inherit"></i>${prob}% · ${mm.toFixed(1).replace('.', ',')} mm</span>
        </div>`;
    }
    $('dias').innerHTML = html;
}

// Situação geral = pior nível entre os bairros
document.addEventListener('bairros:ok', e => {
    const ordem = ['normal', 'atencao', 'alerta', 'critico'];
    const textos = {
        normal: 'Situação normal em Cajamar',
        atencao: 'Atenção: chuva em alguns bairros',
        alerta: 'Alerta: chuva forte em Cajamar',
        critico: 'CRÍTICO: risco alto em Cajamar'
    };
    let pior = 0;
    e.detail.forEach(l => {
        if (l.erro) return;
        pior = Math.max(pior, ordem.indexOf(slugNivel(l.alerta.nivel)));
    });
    $('hero-status').dataset.nivel = ordem[pior];
    $('hero-status-texto').textContent = textos[ordem[pior]];
});

function atualizarRelogio() {
    const agora = new Date();
    const data = agora.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    const hora = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    if ($('hero-data')) $('hero-data').textContent = data.charAt(0).toUpperCase() + data.slice(1) + ' · ' + hora;
    if ($('relogio')) $('relogio').textContent = hora;
}

// Links de compartilhamento usam o endereço real do site
function configurarCompartilhar() {
    const url = encodeURIComponent(window.location.href);
    $('share-whats').href = 'https://api.whatsapp.com/send?text=' + encodeURIComponent('Acompanhe os alertas de chuva em Cajamar: ') + url;
    $('share-face').href = 'https://www.facebook.com/sharer/sharer.php?u=' + url;
    $('share-x').href = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent('Alertas de Chuva Cajamar') + '&url=' + url;
}

document.addEventListener('DOMContentLoaded', () => {
    atualizarRelogio();
    setInterval(atualizarRelogio, 30 * 1000);
    configurarCompartilhar();
    carregarTempo();
    setInterval(carregarTempo, 10 * 60 * 1000); // atualiza a cada 10 min
});
