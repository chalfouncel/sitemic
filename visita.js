document.addEventListener('DOMContentLoaded', () => {
    // 1. Verifica se o Supabase foi carregado corretamente no HTML
    if (typeof window.supabase === 'undefined') {
        alert("Erro: A biblioteca do Supabase não foi carregada. Verifique o link no HTML.");
        return;
    }

    const SUPABASE_URL = 'https://uztsmkhlvoemjbbyebcr.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_nmolEh_G5_hKcfdgy2Xpeg_s4T6ePAz';
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // 2. Mapeamento de elementos
    const origemImovel = document.getElementById('origemImovel');
    const blocoBuscaSite = document.getElementById('blocoBuscaSite');
    const blocoAvulso = document.getElementById('blocoAvulso');
    const tipoContato = document.getElementById('tipoContato');
    const blocoParceiro = document.getElementById('blocoParceiro');
    
    const btnBuscar = document.getElementById('btnBuscar');
    const btnAgendar = document.getElementById('btnAgendar');
    const btnRelatorio = document.getElementById('btnRelatorio');

    let enderecoConfirmado = '';
    let fotoConfirmada = '';

    // Segurança: Se os botões não existirem no HTML, pára aqui para não quebrar o site
    if (!btnBuscar || !btnAgendar || !btnRelatorio) {
        console.error("ERRO: Os IDs dos botões (btnBuscar, btnAgendar, btnRelatorio) não foram encontrados no HTML.");
        return;
    }

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
    btnBuscar.addEventListener('click', async () => {
        const refInput = document.getElementById('refImovel');
        const ref = refInput ? refInput.value.trim() : '';
        
        if (!ref) return alert('Digite a referência do imóvel.');

        btnBuscar.innerText = 'A BUSCAR...';
        
        const { data, error } = await supabase.from('imoveis').select('endereco, numero, bairro, fotos').ilike('referencia', ref).single();
        
        btnBuscar.innerText = 'BUSCAR';

        if (error || !data) {
            alert('Imóvel não encontrado. Verifique a referência.');
            document.getElementById('previewCard').style.display = 'none';
            enderecoConfirmado = '';
            return;
        }

        // Monta o endereço e resgata a capa
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

    // Função auxiliar para recolher os dados do formulário
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

    // Enviar Confirmação
    btnAgendar.addEventListener('click', () => {
        const d = coletarDados();
        if (!d.nome || !d.telefone || !d.endereco) {
            return alert('Preencha o Nome, Telefone e certifique-se de que o Endereço do imóvel está definido (faça a busca primeiro).');
        }

        const sauda = d.tipo === 'parceiro' ? `Olá corretor(a) ${d.nome}` : `Olá ${d.nome}`;
        const msg = `${sauda}, tudo bem?\n\nPodemos confirmar a nossa visita de hoje ao imóvel localizado em:\n📍 *${d.endereco}* ?\n\nAguardo o seu retorno para alinhar o horário.\n\nMario Chalfoun Junior | CRECI 101338`;
        
        window.open(`https://wa.me/55${d.telefone}?text=${encodeURIComponent(msg)}`, '_blank');
    });

    // Enviar Relatório de Intermediação
    btnRelatorio.addEventListener('click', () => {
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

        msg += `\n_Imagens comprobatórias (fachada e selfie) foram registadas fisicamente durante a visita para lastro documental da intermediação._\n\nAtenciosamente,\nM&IC Corretores de Imóveis\nMario Chalfoun Junior | CRECI 101338`;

        window.open(`https://wa.me/55${d.telefone}?text=${encodeURIComponent(msg)}`, '_blank');
    });
});
