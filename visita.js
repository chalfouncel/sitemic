// Conexão com o Supabase
var SUPABASE_URL = 'https://uztsmkhlvoemjbbyebcr.supabase.co';
var SUPABASE_ANON_KEY = 'sb_publishable_nmolEh_G5_hKcfdgy2Xpeg_s4T6ePAz';
var supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let imovelSelecionado = {
    codigo: '',
    titulo: '',
    endereco: '',
    fotoCapa: '',
    arquivoCapa: null
};

let arquivoFachada = null;
let arquivoSelfie = null;

// Inicialização: Data/Hora + Identificação automática do Corretor Logado (Mario ou Ivy)
window.addEventListener('DOMContentLoaded', async () => {
    const agora = new Date();
    document.getElementById('dataVisita').value = agora.toISOString().split('T')[0];
    document.getElementById('horaVisita').value = agora.toTimeString().substring(0, 5);

    // Verifica quem está logado no Supabase ou salvo no aparelho
    const selectCorretor = document.getElementById('corretorMic');
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (user && user.email) {
            const email = user.email.toLowerCase();
            if (email.includes('ivy')) {
                selectCorretor.value = 'Ivy Carla Teixeira Chalfoun | CRECI 75179';
            } else if (email.includes('mario') || email.includes('chalfoun')) {
                selectCorretor.value = 'Mario Chalfoun Junior | CRECI 101338';
            }
        } else {
            const salvo = localStorage.getItem('mic_corretor_padrao');
            if (salvo) selectCorretor.value = salvo;
        }
    } catch (e) {}

    // Memoriza a escolha no celular de cada um
    selectCorretor.addEventListener('change', () => {
        localStorage.setItem('mic_corretor_padrao', selectCorretor.value);
    });
});

function alternarOrigem() {
    const origem = document.getElementById('origemImovel').value;
    document.getElementById('blocoSite').style.display = (origem === 'site') ? 'block' : 'none';
    document.getElementById('blocoOutro').style.display = (origem === 'site') ? 'none' : 'block';
}

function alternarParceiro() {
    const tipo = document.getElementById('tipoContato').value;
    document.getElementById('blocoParceiro').style.display = (tipo === 'parceiro') ? 'block' : 'none';
    document.getElementById('labelNome').innerText = (tipo === 'parceiro') ? 'Nome do Corretor Parceiro' : 'Nome do Cliente';
}

// Busca o imóvel e já baixa a foto principal em memória para envio direto no WhatsApp
async function buscarImovelBanco() {
    const termo = document.getElementById('refImovel').value.trim();
    const btn = document.getElementById('btnBuscar');
    const previewCard = document.getElementById('previewCard');

    if (!termo) return alert('Digite o código do imóvel (Ex: MIC_0021).');

    btn.innerText = '...';
    btn.disabled = true;

    try {
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

        let listaFotos = [];
        if (Array.isArray(imo.fotos)) {
            listaFotos = imo.fotos;
        } else if (typeof imo.fotos === 'string') {
            let clean = imo.fotos.trim().replace(/^[{[\]}]|[{[\]}]$/g, '');
            if (clean) listaFotos = clean.split(',').map(s => s.replace(/^"|"$/g, '').trim());
        }

        const fotoPrincipal = listaFotos.length > 0 ? listaFotos[0] : '';
        const endFormatado = `${imo.endereco || ''}${imo.numero ? ', ' + imo.numero : ''}${imo.bairro ? ' - ' + imo.bairro : ''}${imo.cidade ? ', ' + imo.cidade : ''}`;

        // Baixa o arquivo da foto de capa para anexar direto no WhatsApp pelo celular
        let fileCapa = null;
        if (fotoPrincipal) {
            try {
                const resp = await fetch(fotoPrincipal);
                const blob = await resp.blob();
                fileCapa = new File([blob], `${imo.referencia || 'imovel'}.jpg`, { type: 'image/jpeg' });
            } catch (e) {
                console.warn('Não foi possível converter a capa em arquivo local:', e);
            }
        }

        imovelSelecionado = {
            codigo: imo.referencia || termo.toUpperCase(),
            titulo: imo.titulo || 'Imóvel M&IC',
            endereco: endFormatado,
            fotoCapa: fotoPrincipal,
            arquivoCapa: fileCapa
        };

        const imgEl = document.getElementById('previewFoto');
        if (fotoPrincipal) {
            imgEl.src = fotoPrincipal;
            imgEl.style.display = 'block';
        } else {
            imgEl.style.display = 'none';
        }

        document.getElementById('previewTitulo').innerText = `${imovelSelecionado.codigo} - ${imovelSelecionado.titulo}`;
        document.getElementById('previewEndereco').innerText = imovelSelecionado.endereco;
        previewCard.style.display = 'block';

    } catch (err) {
        btn.innerText = 'Buscar';
        btn.disabled = false;
        alert('Erro ao consultar banco de dados.');
    }
}

// Processa as fotos tiradas na visita com carimbo de data/hora
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

    const carimbo = new Date().toLocaleString('pt-BR');
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(10, h - 40, 300, 30);
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
        arquivoCapa: origem === 'site' ? imovelSelecionado.arquivoCapa : null,
        data: dataFormatada,
        hora: hora,
        tipoContato: document.getElementById('tipoContato').value,
        nome: document.getElementById('nomeParte').value.trim(),
        telefone: document.getElementById('telefoneParte').value.replace(/\D/g, ''),
        creciParceiro: document.getElementById('creciParceiro').value.trim(),
        lgpd: document.getElementById('aceiteLgpd').checked
    };
}

// 1. CONFIRMAÇÃO DE AGENDAMENTO (Envia a foto real no celular ou link com preview no PC)
async function enviarConfirmacaoAgendamento() {
    const d = obterDadosFormulario();

    if (d.origem === 'site' && !d.endereco) return alert('Clique em BUSCAR primeiro para carregar o imóvel.');
    if (d.origem === 'outro' && !d.endereco) return alert('Digite o endereço completo do imóvel.');
    if (!d.nome || !d.telefone) return alert('Preencha o Nome e o WhatsApp.');
    if (d.tipoContato === 'parceiro' && !d.creciParceiro) return alert('Preencha o CRECI do corretor parceiro.');

    let msg = '';
    if (d.tipoContato === 'parceiro') {
        msg += `Olá colega corretor(a) *${d.nome}* (CRECI: ${d.creciParceiro}), tudo bem?\n\n`;
        msg += `Aqui é da *M&IC Corretores de Imóveis*. Estamos registrando nossa parceria de intermediação para a visita agendada:\n\n`;
    } else {
        msg += `Olá *${d.nome}*, tudo bem?\n\n`;
        msg += `Aqui é da *M&IC Corretores de Imóveis*. Passando para confirmar os detalhes da nossa visita ao imóvel:\n\n`;
    }

    if (d.origem === 'site') {
        msg += `• *Imóvel:* ${d.codigo} - ${d.titulo}\n`;
    }
    msg += `• *Endereço:* ${d.endereco}\n`;
    msg += `• *Data:* ${d.data} às *${d.hora}*\n`;

    msg += `\n*Você confirma o nosso agendamento neste local e horário?*\n_(Por favor, responda com "Sim" ou "Confirmado" para validarmos o acesso)._\n\n`;
    msg += `Atenciosamente,\n*${d.corretorMic}*`;

    // No celular: compartilha a FOTO REAL aberta junto com o texto no WhatsApp
    if (d.arquivoCapa && navigator.canShare && navigator.canShare({ files: [d.arquivoCapa] })) {
        try {
            await navigator.share({
                files: [d.arquivoCapa],
                text: msg
            });
            return;
        } catch (err) {
            console.log('Compartilhamento nativo cancelado, abrindo link direto...');
        }
    }

    // Fallback para PC: coloca o link da foto no topo para forçar o WhatsApp a carregar o card
    const textoFallback = (d.origem === 'site' && d.fotoCapa) ? `${d.fotoCapa}\n\n${msg}` : msg;
    const fone = d.telefone.startsWith('55') ? d.telefone : `55${d.telefone}`;
    window.open(`https://wa.me/${fone}?text=${encodeURIComponent(textoFallback)}`, '_blank');
}

// 2. RELATÓRIO DE VISITA REALIZADA
async function gerarRelatorioVisita() {
    const d = obterDadosFormulario();

    if (!d.endereco || !d.nome || !d.telefone) return alert('Verifique se o Imóvel, Nome e WhatsApp estão preenchidos.');
    if (d.tipoContato === 'parceiro' && !d.creciParceiro) return alert('Informe o CRECI do corretor parceiro.');
    if (!d.lgpd) return alert('É necessário marcar a ciência da LGPD.');

    const btn = document.getElementById('btnRelatorio');
    const statusMsg = document.getElementById('statusMsg');
    btn.disabled = true;
    statusMsg.style.color = 'var(--gold)';
    statusMsg.innerText = 'Salvando fotos comprobatórias...';

    let urlFachada = '';
    let urlSelfie = '';

    try {
        if (arquivoFachada) {
            const nomeArq1 = `visita_fachada_${Date.now()}.jpg`;
            const { error: err1 } = await supabaseClient.storage.from('imoveis_fotos').upload(nomeArq1, arquivoFachada);
            if (!err1) urlFachada = supabaseClient.storage.from('imoveis_fotos').getPublicUrl(nomeArq1).data.publicUrl;
        }
        if (arquivoSelfie) {
            const nomeArq2 = `visita_selfie_${Date.now()}.jpg`;
            const { error: err2 } = await supabaseClient.storage.from('imoveis_fotos').upload(nomeArq2, arquivoSelfie);
            if (!err2) urlSelfie = supabaseClient.storage.from('imoveis_fotos').getPublicUrl(nomeArq2).data.publicUrl;
        }
    } catch (e) {
        console.error('Erro no upload:', e);
    }

    btn.disabled = false;
    statusMsg.style.color = '#25D366';
    statusMsg.innerText = 'Relatório pronto! Abrindo WhatsApp...';

    const carimboAgora = new Date().toLocaleString('pt-BR');

    let rel = `*TERMO E RELATÓRIO DE VISITA IMOBILIÁRIA*\n`;
    rel += `Registro: ${carimboAgora}\n\n`;

    if (d.origem === 'site') {
        rel += `• *Imóvel:* ${d.codigo} - ${d.titulo}\n`;
    }
    rel += `• *Endereço:* ${d.endereco}\n\n`;

    if (d.tipoContato === 'parceiro') {
        rel += `• *Modalidade:* Visita em Parceria Imobiliária\n`;
        rel += `• *Corretor Parceiro:* ${d.nome}\n`;
        rel += `• *CRECI Parceiro:* ${d.creciParceiro}\n`;
    } else {
        rel += `• *Modalidade:* Atendimento Direto\n`;
        rel += `• *Cliente Visitante:* ${d.nome}\n`;
    }

    rel += `\n*EVIDÊNCIAS DE PRESENÇA E INTERMEDIAÇÃO:*\n`;
    if (d.origem === 'site' && d.fotoCapa) rel += `> *Anúncio Oficial:* ${d.fotoCapa}\n`;
    rel += `> *Foto no Local:* ${urlFachada || 'Arquivada no dispositivo'}\n`;
    rel += `> *Selfie com as Partes:* ${urlSelfie || 'Arquivada no dispositivo'}\n`;

    rel += `\n*Nota Legal e LGPD:* Este registro comprova a efetiva apresentação do imóvel e a intermediação imobiliária realizada nesta data. Os dados mínimos acima foram coletados exclusivamente para este fim (Lei 13.709/18).\n\n`;
    rel += `*Por favor, responda "Ciente" ou "De acordo" abaixo para confirmação deste registro.*\n\n`;
    rel += `*${d.corretorMic}*`;

    // No celular: se tirou foto da fachada e selfie, já anexa as imagens reais direto na conversa
    const fotosEvidencia = [arquivoFachada, arquivoSelfie].filter(Boolean);
    if (fotosEvidencia.length > 0 && navigator.canShare && navigator.canShare({ files: fotosEvidencia })) {
        try {
            await navigator.share({
                files: fotosEvidencia,
                text: rel
            });
            return;
        } catch (err) {}
    }

    const fone = d.telefone.startsWith('55') ? d.telefone : `55${d.telefone}`;
    window.open(`https://wa.me/${fone}?text=${encodeURIComponent(rel)}`, '_blank');
}
