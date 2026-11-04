// Conexão com o seu Supabase (mesmas credenciais do portal.js e app.js)
var SUPABASE_URL = 'https://uztsmkhlvoemjbbyebcr.supabase.co';
var SUPABASE_ANON_KEY = 'sb_publishable_nmolEh_G5_hKcfdgy2Xpeg_s4T6ePAz';
var supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Variáveis de estado
let imovelSelecionado = {
    codigo: '',
    titulo: '',
    endereco: '',
    fotoCapa: ''
};

let arquivoFachada = null;
let arquivoSelfie = null;

// Preenche data e hora atuais por padrão ao abrir a tela
window.addEventListener('DOMContentLoaded', () => {
    const agora = new Date();
    document.getElementById('dataVisita').value = agora.toISOString().split('T')[0];
    document.getElementById('horaVisita').value = agora.toTimeString().substring(0, 5);
});

// Alterna entre busca do site ou endereço digitado manualmente
function alternarOrigem() {
    const origem = document.getElementById('origemImovel').value;
    if (origem === 'site') {
        document.getElementById('blocoSite').style.display = 'block';
        document.getElementById('blocoOutro').style.display = 'none';
    } else {
        document.getElementById('blocoSite').style.display = 'none';
        document.getElementById('blocoOutro').style.display = 'block';
    }
}

// Alterna exibição do campo CRECI quando for corretor parceiro
function alternarParceiro() {
    const tipo = document.getElementById('tipoContato').value;
    const blocoParceiro = document.getElementById('blocoParceiro');
    const labelNome = document.getElementById('labelNome');

    if (tipo === 'parceiro') {
        blocoParceiro.style.display = 'block';
        labelNome.innerText = 'Nome do Corretor Parceiro';
    } else {
        blocoParceiro.style.display = 'none';
        labelNome.innerText = 'Nome do Cliente';
    }
}

// Busca o imóvel no Supabase pelo código (ex: MIC_0021)
async function buscarImovelBanco() {
    const campoRef = document.getElementById('refImovel');
    const termo = campoRef.value.trim();
    const btn = document.getElementById('btnBuscar');
    const previewCard = document.getElementById('previewCard');

    if (!termo) {
        alert('Digite o código do imóvel (Ex: MIC_0021).');
        return;
    }

    btn.innerText = '...';
    btn.disabled = true;

    try {
        // Busca na tabela imoveis filtrando pela coluna referencia
        const { data, error } = await supabaseClient
            .from('imoveis')
            .select('*')
            .ilike('referencia', `%${termo}%`)
            .limit(1);

        btn.innerText = 'Buscar';
        btn.disabled = false;

        if (error || !data || data.length === 0) {
            alert('Nenhum imóvel encontrado com o código: ' + termo);
            previewCard.style.display = 'none';
            return;
        }

        const imo = data[0];

        // Extrai o array de fotos com o mesmo tratamento seguro do seu portal.js
        let listaFotos = [];
        if (Array.isArray(imo.fotos)) {
            listaFotos = imo.fotos;
        } else if (typeof imo.fotos === 'string') {
            let clean = imo.fotos.trim().replace(/^[{[\]}]|[{[\]}]$/g, '');
            if (clean) listaFotos = clean.split(',').map(s => s.replace(/^"|"$/g, '').trim());
        }

        const fotoPrincipal = listaFotos.length > 0 ? listaFotos[0] : '';
        const endFormatado = `${imo.endereco || ''}${imo.numero ? ', ' + imo.numero : ''}${imo.bairro ? ' - ' + imo.bairro : ''}${imo.cidade ? ', ' + imo.cidade : ''}`;

        // Salva no estado
        imovelSelecionado = {
            codigo: imo.referencia || termo.toUpperCase(),
            titulo: imo.titulo || 'Imóvel M&IC',
            endereco: endFormatado,
            fotoCapa: fotoPrincipal
        };

        // Exibe o Card com Foto Principal e Endereço na tela
        const imgEl = document.getElementById('previewFoto');
        if (fotoPrincipal) {
            imgEl.src = fotoPrincipal;
            imgEl.style.display = 'block';
        } else {
            imgEl.style.display = 'none';
        }

        document.getElementById('previewTitulo').innerText = `${imovelSelecionado.codigo} - ${imovelSelecionado.titulo}`;
        document.getElementById('previewEndereco').innerText = `📍 ${imovelSelecionado.endereco}`;
        previewCard.style.display = 'block';

    } catch (err) {
        btn.innerText = 'Buscar';
        btn.disabled = false;
        alert('Erro ao consultar banco de dados.');
        console.error(err);
    }
}

// Comprime e mostra o preview da foto tirada na hora da visita
async function processarFotoLocal(input, idImgPreview, tipo) {
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];

    const img = new Image();
    img.src = URL.createObjectURL(file);
    await new Promise(r => img.onload = r);

    const canvas = document.createElement('canvas');
    const maxDim = 1280;
    let w = img.width;
    let h = img.height;

    if (w > maxDim || h > maxDim) {
        if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
        else { w = Math.round((w * maxDim) / h); h = maxDim; }
    }

    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);

    // Carimbo de data/hora no canto da foto para blindar a prova
    const carimbo = new Date().toLocaleString('pt-BR');
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(10, h - 40, 290, 30);
    ctx.fillStyle = '#C9A84C';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(`M&IC Visita: ${carimbo}`, 18, h - 20);

    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.82));
    const arquivoFinal = new File([blob], `visita_${tipo}_${Date.now()}.jpg`, { type: 'image/jpeg' });

    if (tipo === 'fachada') arquivoFachada = arquivoFinal;
    if (tipo === 'selfie') arquivoSelfie = arquivoFinal;

    const previewEl = document.getElementById(idImgPreview);
    previewEl.src = URL.createObjectURL(blob);
    previewEl.style.display = 'block';
}

// Coleta e valida os campos antes de enviar pro WhatsApp
function obterDadosFormulario() {
    const origem = document.getElementById('origemImovel').value;
    const enderecoFinal = (origem === 'site')
        ? imovelSelecionado.endereco
        : document.getElementById('enderecoAvulso').value.trim();

    const dataBruta = document.getElementById('dataVisita').value;
    const dataFormatada = dataBruta ? dataBruta.split('-').reverse().join('/') : '';
    const hora = document.getElementById('horaVisita').value;

    return {
        corretorMic: document.getElementById('corretorMic').value,
        origem: origem,
        codigo: origem === 'site' ? imovelSelecionado.codigo : 'Imóvel Externo',
        titulo: origem === 'site' ? imovelSelecionado.titulo : '',
        endereco: enderecoFinal,
        fotoCapa: origem === 'site' ? imovelSelecionado.fotoCapa : '',
        data: dataFormatada,
        hora: hora,
        tipoContato: document.getElementById('tipoContato').value,
        nome: document.getElementById('nomeParte').value.trim(),
        telefone: document.getElementById('telefoneParte').value.replace(/\D/g, ''),
        creciParceiro: document.getElementById('creciParceiro').value.trim(),
        lgpd: document.getElementById('aceiteLgpd').checked
    };
}

// 1. BOTÃO DE CONFIRMAÇÃO DE AGENDAMENTO (COM PERGUNTA, ENDEREÇO E FOTO SE FOR DO SITE)
function enviarConfirmacaoAgendamento() {
    const d = obterDadosFormulario();

    if (d.origem === 'site' && !d.endereco) {
        alert('Clique no botão BUSCAR primeiro para carregar o endereço e a foto do imóvel.');
        return;
    }
    if (d.origem === 'outro' && !d.endereco) {
        alert('Digite o endereço completo do imóvel.');
        return;
    }
    if (!d.nome || !d.telefone) {
        alert('Preencha o Nome e o WhatsApp.');
        return;
    }
    if (d.tipoContato === 'parceiro' && !d.creciParceiro) {
        alert('Preencha o CRECI do corretor parceiro.');
        return;
    }

    let msg = '';
    if (d.tipoContato === 'parceiro') {
        msg += `Olá colega corretor(a) *${d.nome}* (CRECI: ${d.creciParceiro}), tudo bem?\n\n`;
        msg += `Aqui é da *M&IC Corretores de Imóveis*. Estamos registrando nossa parceria de intermediação para a visita agendada:\n\n`;
    } else {
        msg += `Olá *${d.nome}*, tudo bem?\n\n`;
        msg += `Aqui é da *M&IC Corretores de Imóveis*. Passando para confirmar os detalhes da nossa visita ao imóvel:\n\n`;
    }

    if (d.origem === 'site') {
        msg += `🏢 *Imóvel:* ${d.codigo} - ${d.titulo}\n`;
    }
    msg += `📍 *Endereço:* ${d.endereco}\n`;
    msg += `🗓️ *Data:* ${d.data} às *${d.hora}*\n`;

    if (d.origem === 'site' && d.fotoCapa) {
        msg += `🖼️ *Foto Principal:* ${d.fotoCapa}\n`;
    }

    msg += `\n*Você confirma o nosso agendamento neste local e horário?*\n_(Por favor, responda com um "Sim" ou "Confirmado" para validarmos o acesso)._\n\n`;
    msg += `Atenciosamente,\n*${d.corretorMic}*`;

    const fone = d.telefone.startsWith('55') ? d.telefone : `55${d.telefone}`;
    window.open(`https://wa.me/${fone}?text=${encodeURIComponent(msg)}`, '_blank');
}

// 2. BOTÃO DE RELATÓRIO DE VISITA REALIZADA (FAZ UPLOAD DAS FOTOS TIRADAS E GERA O TERMO)
async function gerarRelatorioVisita() {
    const d = obterDadosFormulario();

    if (!d.endereco || !d.nome || !d.telefone) {
        alert('Verifique se o Imóvel, Nome e WhatsApp estão preenchidos.');
        return;
    }
    if (d.tipoContato === 'parceiro' && !d.creciParceiro) {
        alert('Informe o CRECI do corretor parceiro.');
        return;
    }
    if (!d.lgpd) {
        alert('É necessário marcar a ciência da LGPD para gerar o relatório.');
        return;
    }

    const btn = document.getElementById('btnRelatorio');
    const statusMsg = document.getElementById('statusMsg');
    btn.disabled = true;
    statusMsg.style.color = 'var(--gold)';
    statusMsg.innerText = '⏳ Gerando links das fotos comprobatórias...';

    let urlFachada = '';
    let urlSelfie = '';

    try {
        // Sobe a foto da fachada pro Supabase Storage (se foi tirada)
        if (arquivoFachada) {
            const nomeArq1 = `visita_fachada_${Date.now()}.jpg`;
            const { error: err1 } = await supabaseClient.storage.from('imoveis_fotos').upload(nomeArq1, arquivoFachada);
            if (!err1) {
                urlFachada = supabaseClient.storage.from('imoveis_fotos').getPublicUrl(nomeArq1).data.publicUrl;
            }
        }

        // Sobe a selfie pro Supabase Storage (se foi tirada)
        if (arquivoSelfie) {
            const nomeArq2 = `visita_selfie_${Date.now()}.jpg`;
            const { error: err2 } = await supabaseClient.storage.from('imoveis_fotos').upload(nomeArq2, arquivoSelfie);
            if (!err2) {
                urlSelfie = supabaseClient.storage.from('imoveis_fotos').getPublicUrl(nomeArq2).data.publicUrl;
            }
        }
    } catch (e) {
        console.error('Erro ao subir imagens:', e);
    }

    btn.disabled = false;
    statusMsg.style.color = '#25D366';
    statusMsg.innerText = '✅ Relatório pronto! Abrindo WhatsApp...';

    const carimboAgora = new Date().toLocaleString('pt-BR');

    let rel = `📋 *TERMO E RELATÓRIO DE VISITA IMOBILIÁRIA*\n`;
    rel += `🕒 *Registro:* ${carimboAgora}\n\n`;

    if (d.origem === 'site') {
        rel += `🏢 *Imóvel:* ${d.codigo} - ${d.titulo}\n`;
    }
    rel += `📍 *Endereço:* ${d.endereco}\n\n`;

    if (d.tipoContato === 'parceiro') {
        rel += `🤝 *Modalidade:* Visita em Parceria Imobiliária\n`;
        rel += `👤 *Corretor Parceiro:* ${d.nome}\n`;
        rel += `🪪 *CRECI Parceiro:* ${d.creciParceiro}\n`;
    } else {
        rel += `👤 *Modalidade:* Atendimento Direto\n`;
        rel += `👤 *Cliente Visitante:* ${d.nome}\n`;
    }

    rel += `\n📸 *EVIDÊNCIAS DE PRESENÇA E INTERMEDIAÇÃO:*\n`;
    if (d.origem === 'site' && d.fotoCapa) {
        rel += `• *Anúncio Oficial:* ${d.fotoCapa}\n`;
    }
    if (urlFachada) {
        rel += `• *Foto no Local:* ${urlFachada}\n`;
    } else {
        rel += `• *Foto no Local:* Arquivada no dispositivo\n`;
    }
    if (urlSelfie) {
        rel += `• *Selfie com as Partes:* ${urlSelfie}\n`;
    } else {
        rel += `• *Selfie com as Partes:* Arquivada no dispositivo\n`;
    }

    rel += `\n⚖️ *Nota Legal e LGPD:* Este registro comprova a efetiva apresentação do imóvel e a intermediação imobiliária realizada nesta data. Os dados mínimos acima foram coletados exclusivamente para este fim (Lei 13.709/18).\n\n`;
    rel += `*Por favor, responda "Ciente" ou "De acordo" abaixo para confirmação deste registro.*\n\n`;
    rel += `*${d.corretorMic}*`;

    const fone = d.telefone.startsWith('55') ? d.telefone : `55${d.telefone}`;
    window.open(`https://wa.me/${fone}?text=${encodeURIComponent(rel)}`, '_blank');
}
