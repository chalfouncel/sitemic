// Usando as mesmas chaves do seu portal.js
const SUPABASE_URL = 'https://uztsmkhlvoemjbbyebcr.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_nmolEh_G5_hKcfdgy2Xpeg_s4T6ePAz';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const origemImovel = document.getElementById('origemImovel');
const blocoBuscaSite = document.getElementById('blocoBuscaSite');
const blocoAvulso = document.getElementById('blocoAvulso');
const tipoContato = document.getElementById('tipoContato');
const blocoParceiro = document.getElementById('blocoParceiro');
let enderecoConfirmado = '';
let fotoConfirmada = '';

// Alternar entre Site e Avulso
origemImovel.addEventListener('change', (e) => {
    if (e.target.value === 'site') {
        blocoBuscaSite.classList.remove('hidden');
        blocoAvulso.classList.add('hidden');
    } else {
        blocoBuscaSite.classList.add('hidden');
        blocoAvulso.classList.remove('hidden');
        document.getElementById('previewCard').style.display = 'none';
    }
    enderecoConfirmado = '';
});

// Alternar Creci
tipoContato.addEventListener('change', (e) => {
    if (e.target.value === 'parceiro') {
        blocoParceiro.classList.remove('hidden');
    } else {
        blocoParceiro.classList.add('hidden');
    }
});

// Buscar Imóvel no Banco Supabase
document.getElementById('btnBuscar').addEventListener('click', async () => {
    const ref = document.getElementById('refImovel').value.trim();
    if (!ref) return alert('Digite a referência.');

    document.getElementById('btnBuscar').innerText = '...';
    
    const { data, error } = await supabase.from('imoveis').select('endereco, numero, bairro, fotos').ilike('referencia', ref).single();
    
    document.getElementById('btnBuscar').innerText = 'Buscar';

    if (error || !data) {
        alert('Imóvel não encontrado. Verifique a referência.');
        document.getElementById('previewCard').style.display = 'none';
        enderecoConfirmado = '';
        return;
    }

    // Monta o endereço e resgata a capa (fotos[0])
    enderecoConfirmado = `${data.endereco}, ${data.numero} - ${data.bairro}`;
    
    let fotosArray = [];
    if (typeof data.fotos === 'string') {
        fotosArray = data.fotos.replace(/^[{[\]}]/g, '').split(',').map(s => s.replace(/^"|"$/g, '').trim());
    } else if (Array.isArray(data.fotos)) {
        fotosArray = data.fotos;
    }

    fotoConfirmada = fotosArray.length > 0 ? fotosArray[0] : '';

    document.getElementById('previewEndereco').innerText = enderecoConfirmado;
    const imgPreview = document.getElementById('previewFoto');
    if (fotoConfirmada) {
        imgPreview.src = fotoConfirmada;
        imgPreview.style.display = 'block';
    } else {
        imgPreview.style.display = 'none';
    }
    
    document.getElementById('previewCard').style.display = 'block';
});

// Helper para pegar os dados do formulário
function coletarDados() {
    let endereco = origemImovel.value === 'site' ? enderecoConfirmado : document.getElementById('enderecoAvulso').value.trim();
    return {
        endereco: endereco,
        nome: document.getElementById('nomeParte').value.trim(),
        telefone: document.getElementById('telefoneParte').value.replace(/\D/g, ''),
        tipo: tipoContato.value,
        creci: document.getElementById('creciParceiro').value.trim()
    };
}

// Enviar Confirmação (Com Pergunta e Endereço)
document.getElementById('btnAgendar').addEventListener('click', () => {
    const d = coletarDados();
    if (!d.nome || !d.telefone || !d.endereco) {
        return alert('Preencha o Nome, Telefone e certifique-se de que o Endereço do imóvel está definido.');
    }

    const sauda = d.tipo === 'parceiro' ? `Olá corretor(a) ${d.nome}` : `Olá ${d.nome}`;
    
    // Texto com pergunta direta e endereço obrigatório
    const msg = `${sauda}, tudo bem?\n\nPodemos confirmar nossa visita de hoje ao imóvel localizado em:\n📍 *${d.endereco}* ?\n\nAguardo seu retorno para alinhar o horário.\n\nMario Chalfoun Junior | CRECI 101338`;
    
    window.open(`https://wa.me/55${d.telefone}?text=${encodeURIComponent(msg)}`, '_blank');
});

// Enviar Relatório de Intermediação
document.getElementById('btnRelatorio').addEventListener('click', () => {
    const d = coletarDados();
    if (!d.nome || !d.telefone || !d.endereco) {
        return alert('Preencha os dados básicos antes de gerar o relatório.');
    }

    const dataAtual = new Date().toLocaleString('pt-BR');
    let msg = `*REGISTRO DE INTERMEDIAÇÃO IMOBILIÁRIA*\nData: ${dataAtual}\n\n`;
    msg += `📍 *Endereço do Imóvel:* ${d.endereco}\n`;
    
    if (d.tipo === 'parceiro') {
        msg += `🤝 *Corretor Parceiro:* ${d.nome}\n*CRECI:* ${d.creci}\n`;
    } else {
        msg += `👤 *Cliente Visitante:* ${d.nome}\n`;
    }
    
    if (origemImovel.value === 'site' && fotoConfirmada) {
        msg += `\n📸 *Foto do Imóvel:* ${fotoConfirmada}\n`;
    }

    msg += `\n_Imagens comprobatórias (fachada e selfie) foram registradas fisicamente durante a visita para lastro documental da intermediação._\n\nAtenciosamente,\nM&IC Corretores de Imóveis\nMario Chalfoun Junior | CRECI 101338`;

    window.open(`https://wa.me/55${d.telefone}?text=${encodeURIComponent(msg)}`, '_blank');
});
