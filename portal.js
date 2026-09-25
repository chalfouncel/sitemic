// Configuração do Supabase
var SUPABASE_URL = 'https://uztsmkhlvoemjbbyebcr.supabase.co';
var SUPABASE_ANON_KEY = 'sb_publishable_nmolEh_G5_hKcfdgy2Xpeg_s4T6ePAz';
var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const loginSection = document.getElementById('loginSection');
const dashboardSection = document.getElementById('dashboardSection');

// Variável de controle para falhas da IA
let tentativasIA = 0;

// Verifica sessão
async function checarSessao() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        loginSection.style.display = 'none';
        dashboardSection.style.display = 'block';
        carregarLeads();
    } else {
        loginSection.style.display = 'block';
        dashboardSection.style.display = 'none';
    }
}

// Lógica de Login e Logout
async function fazerLogin() {
    const email = document.getElementById('loginEmail').value;
    const senha = document.getElementById('loginSenha').value;
    const msg = document.getElementById('loginMsg');
    
    msg.style.display = 'block';
    msg.style.color = 'var(--gold)';
    msg.innerText = 'A verificar credenciais...';

    const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });

    if (error) {
        msg.style.color = '#ff4444';
        msg.innerText = 'Acesso negado. Verifique o e-mail e a senha.';
    } else {
        msg.style.display = 'none';
        checarSessao();
    }
}

async function fazerLogout() {
    await supabase.auth.signOut();
    checarSessao();
}

function mudarAba(aba) {
    document.getElementById('btnAbaImovel').classList.remove('active');
    document.getElementById('btnAbaGestao').classList.remove('active');
    document.getElementById('btnAbaLeads').classList.remove('active');
    
    document.getElementById('abaImovel').style.display = 'none';
    document.getElementById('abaGestao').style.display = 'none';
    document.getElementById('abaLeads').style.display = 'none';

    if(aba === 'imovel') {
        document.getElementById('btnAbaImovel').classList.add('active');
        document.getElementById('abaImovel').style.display = 'block';
    } else if(aba === 'gestao') {
        document.getElementById('btnAbaGestao').classList.add('active');
        document.getElementById('abaGestao').style.display = 'block';
    } else {
        document.getElementById('btnAbaLeads').classList.add('active');
        document.getElementById('abaLeads').style.display = 'block';
        carregarLeads();
    }
}

// Interações do Formulário (Mobília e Lazer)
function toggleMobiliaDetalhes() {
    const radioSim = document.getElementById('mobSim');
    const divDetalhes = document.getElementById('div-detalhes-mobilia');
    const textareaDetalhes = document.getElementById('detalhes_mobilia');

    if (radioSim && radioSim.checked) {
        divDetalhes.style.display = 'block';
    } else {
        divDetalhes.style.display = 'none';
        if (textareaDetalhes) textareaDetalhes.value = ''; 
    }
}

let todosLazerMarcados = false;
function toggleTodosLazer() {
    todosLazerMarcados = !todosLazerMarcados;
    const checkboxes = document.querySelectorAll('input[name="lazer"]');
    checkboxes.forEach(cb => cb.checked = todosLazerMarcados);
    
    const btn = document.getElementById('btnToggleLazer');
    btn.innerText = todosLazerMarcados ? 'Desmarcar Todos' : 'Marcar Todos';
}

// Busca CEP
const cepInput = document.getElementById('imoCep');
if (cepInput) {
    cepInput.addEventListener('blur', async function() {
        let cep = this.value.replace(/\D/g, ''); 
        if (cep.length === 8) {
            try {
                const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
                const dados = await response.json();
                if (!dados.erro) {
                    document.getElementById('imoEndereco').value = dados.logradouro;
                    document.getElementById('imoBairro').value = dados.bairro;
                    document.getElementById('imoCidade').value = dados.localidade;
                    document.getElementById('imoEstado').value = dados.uf;
                    document.getElementById('imoNumero').focus();
                }
            } catch (error) {
                console.error("Erro ao buscar CEP:", error);
            }
        }
    });
}

// Processamento de Fotos (Marca D'água)
let fotosProcessadas = [];
let urlsDasFotosEnviadas = []; 

const fileInput = document.getElementById('imoFotos');
if(fileInput) {
    fileInput.addEventListener('change', async function(e) {
        urlsDasFotosEnviadas = [];
        tentativasIA = 0; 
        document.getElementById('btnSubmit').disabled = true;
        document.getElementById('btnGerarIA').innerText = '✨ Analisar e Gerar Anúncio com IA';
        document.getElementById('btnGerarIA').disabled = false;
        
        document.getElementById('imoTitulo').value = '';
        document.getElementById('imoDescricao').value = '';

        const previewContainer = document.getElementById('previewFotos');
        previewContainer.innerHTML = '<span style="color: var(--gold);">Processando imagens com marca d\'água...</span>';
        fotosProcessadas = [];
        
        const files = e.target.files;
        if(files.length === 0) {
            previewContainer.innerHTML = '';
            return;
        }

        const marcaDagua = new Image();
        marcaDagua.src = 'marca-dagua.png'; 
        
        await new Promise(r => { marcaDagua.onload = r; marcaDagua.onerror = r; });
        previewContainer.innerHTML = '';

        for(let file of files) {
            const img = new Image();
            const url = URL.createObjectURL(file);
            img.src = url;
            await new Promise(r => img.onload = r);

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            if (marcaDagua.width > 0) {
                ctx.globalAlpha = 0.4; 
                const wmWidth = canvas.width * 0.4; 
                const wmHeight = (marcaDagua.height / marcaDagua.width) * wmWidth;
                const dx = (canvas.width - wmWidth) / 2;
                const dy = (canvas.height - wmHeight) / 2;
                ctx.drawImage(marcaDagua, dx, dy, wmWidth, wmHeight);
                ctx.globalAlpha = 1.0;
            }

            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
            const processedFile = new File([blob], file.name, { type: 'image/jpeg' });
            fotosProcessadas.push(processedFile);

            const previewImg = document.createElement('img');
            previewImg.src = URL.createObjectURL(blob);
            previewContainer.appendChild(previewImg);
        }
    });
}

// GERAR TEXTO COM INTELIGÊNCIA ARTIFICIAL
async function gerarTextoIA() {
    if(fotosProcessadas.length === 0) {
        alert('Por favor, adicione as fotos do imóvel. A IA precisa delas para criar o anúncio.');
        return;
    }

    const btnIA = document.getElementById('btnGerarIA');
    const msg = document.getElementById('imovelMsg');
    const btnSubmit = document.getElementById('btnSubmit');
    
    btnIA.disabled = true;
    btnIA.innerText = '⏳ Fazendo upload e analisando... (Isso pode demorar alguns segundos)';
    msg.innerText = '';

    try {
        if (urlsDasFotosEnviadas.length === 0) {
            for(let file of fotosProcessadas) {
                const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
                const { data: uploadData, error: uploadError } = await supabase.storage.from('imoveis_fotos').upload(fileName, file);
                
                if(!uploadError) {
                    const { data: publicUrlData } = supabase.storage.from('imoveis_fotos').getPublicUrl(fileName);
                    urlsDasFotosEnviadas.push(publicUrlData.publicUrl);
                }
            }
        }

        const itensLazer = [];
        document.querySelectorAll('input[name="lazer"]:checked').forEach(cb => itensLazer.push(cb.value));
        const isMobiliado = document.getElementById('mobSim').checked;
        const detalhesMobilia = document.getElementById('detalhes_mobilia').value;

        const payloadParaIA = {
            tipo: document.getElementById('imoTipo').value,
            finalidade: document.getElementById('imoFinalidade').value,
            area_util: document.getElementById('imoAreaUtil').value,
            area_total: document.getElementById('imoAreaTotal').value,
            quartos: document.getElementById('imoQuartos').value,
            suites: document.getElementById('imoSuites').value,
            banheiros: document.getElementById('imoBanheiros').value,
            vagas: document.getElementById('imoVagas').value,
            bairro: document.getElementById('imoBairro').value,
            cidade: document.getElementById('imoCidade').value,
            mobiliado: isMobiliado,
            detalhes_mobilia: detalhesMobilia,
            lazer: itensLazer,
            fotosUrls: urlsDasFotosEnviadas
        };

        const response = await fetch('/api/gerar-anuncio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payloadParaIA)
        });

        if (!response.ok) throw new Error("Erro na rota da IA");

        const dadosIA = await response.json();

        document.getElementById('imoTitulo').value = dadosIA.titulo || "Título gerado indisponível";
        document.getElementById('imoDescricao').value = dadosIA.descricao || "Descrição gerada indisponível";

        tentativasIA = 0;
        btnSubmit.disabled = false;
        btnIA.innerText = '✅ Anúncio Gerado com Sucesso! Sinta-se livre para editar os textos acima.';
        btnIA.style.background = '#0F9D58'; 

    } catch (error) {
        console.error(error);
        tentativasIA++; 
        
        btnIA.disabled = false;
        
        if (tentativasIA >= 2) {
            btnIA.innerText = '⚠️ IA Indisponível. Publicação Manual Liberada.';
            btnIA.style.background = '#e6a100'; 
            btnIA.disabled = true; 
            
            msg.style.color = '#e6a100';
            msg.innerHTML = 'Houve instabilidade nos servidores de IA. <br><b>O botão de publicar foi desbloqueado!</b> Você pode preencher o Título e a Descrição manualmente e publicar o imóvel.';
            
            document.getElementById('imoTitulo').focus();
            btnSubmit.disabled = false;
        } else {
            btnIA.innerText = '❌ Falha ao gerar. Tentar novamente (' + tentativasIA + '/2)';
            msg.style.color = '#ff4444';
            msg.innerText = 'Erro de comunicação com a IA. Os servidores podem estar sobrecarregados. Tente novamente.';
        }
    }
}

// INSERIR IMÓVEL NO BANCO (Publicar)
const formImovel = document.getElementById('formImovel');
if (formImovel) {
    formImovel.addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = document.getElementById('imovelMsg');
        msg.style.color = 'var(--gold)';
        msg.innerText = 'Gravando imóvel e fazendo upload das mídias...';

        const tituloBruto = document.getElementById('imoTitulo').value.trim();
        const descricaoBruta = document.getElementById('imoDescricao').value.trim();
        
        const titulo = tituloBruto.substring(0, 100);
        const descricao = descricaoBruta.substring(0, 3000);

        if (tentativasIA >= 2 && (!titulo || !descricao)) {
            msg.style.color = '#ff4444';
            msg.innerText = 'Por favor, preencha manualmente o Título e a Descrição antes de publicar.';
            if(!titulo) document.getElementById('imoTitulo').focus();
            else document.getElementById('imoDescricao').focus();
            return;
        }

        // UPLOAD DO VÍDEO
        let videoUrl = null;
        const videoInput = document.getElementById('imoVideo');
        if (videoInput && videoInput.files.length > 0) {
            msg.innerText = 'Fazendo upload do vídeo... Por favor aguarde.';
            const videoFile = videoInput.files[0];
            const videoName = `video_${Date.now()}_${videoFile.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
            
            const { data: vData, error: vError } = await supabase.storage.from('imoveis_fotos').upload(videoName, videoFile);
            
            if (!vError) {
                const { data: vPublicUrl } = supabase.storage.from('imoveis_fotos').getPublicUrl(videoName);
                videoUrl = vPublicUrl.publicUrl;
            } else {
                console.error("Erro no upload do vídeo:", vError);
            }
        }

        const itensLazer = [];
        document.querySelectorAll('input[name="lazer"]:checked').forEach(cb => itensLazer.push(cb.value));

        const payload = {
            titulo: titulo,
            descricao: descricao,
            tipo: document.getElementById('imoTipo').value,
            finalidade: document.getElementById('imoFinalidade').value,
            valor_venda: document.getElementById('imoVenda').value || null,
            valor_aluguel: document.getElementById('imoAluguel').value || null,
            valor_condominio: document.getElementById('imoCondominio').value || null,
            valor_iptu: document.getElementById('imoIptu').value || null,
            area_util: document.getElementById('imoAreaUtil').value || null,
            area_total: document.getElementById('imoAreaTotal').value || null,
            quartos: document.getElementById('imoQuartos').value || 0,
            suites: document.getElementById('imoSuites').value || 0,
            banheiros: document.getElementById('imoBanheiros').value || 0,
            vagas: document.getElementById('imoVagas').value || 0,
            
            mobiliado: document.getElementById('mobSim').checked,
            detalhes_mobilia: document.getElementById('detalhes_mobilia').value,
            itens_lazer: itensLazer,
            
            cep: document.getElementById('imoCep').value,
            endereco: document.getElementById('imoEndereco').value,
            numero: document.getElementById('imoNumero').value,
            complemento: document.getElementById('imoComplemento').value,
            bairro: document.getElementById('imoBairro').value,
            cidade: document.getElementById('imoCidade').value,
            estado: document.getElementById('imoEstado').value,
            
            fotos: urlsDasFotosEnviadas, 
            video: videoUrl,
            status: 'Ativo'
        };

        const { error } = await supabase.from('imoveis').insert([payload]);

        if (error) {
            console.error(error);
            msg.style.color = '#ff4444';
            msg.innerText = 'Ocorreu um erro ao gravar o imóvel.';
        } else {
            msg.style.color = '#25D366'; 
            msg.innerText = 'Imóvel publicado com sucesso!';
            formImovel.reset();
            
            tentativasIA = 0;
            document.getElementById('div-detalhes-mobilia').style.display = 'none'; 
            document.getElementById('previewFotos').innerHTML = '';
            if(document.getElementById('imoVideo')) document.getElementById('imoVideo').value = '';
            
            fotosProcessadas = [];
            urlsDasFotosEnviadas = [];
            
            document.getElementById('btnSubmit').disabled = true;
            document.getElementById('btnGerarIA').innerText = '✨ Analisar e Gerar Anúncio com IA';
            document.getElementById('btnGerarIA').style.background = '#25D366';
            document.getElementById('btnGerarIA').disabled = false;
            
            setTimeout(() => { msg.innerText = ''; }, 4000);
        }
    });
}

// ==========================================
// NOVA LÓGICA: GESTÃO DE ANÚNCIOS (Inativar/Excluir)
// ==========================================
let imovelEmGestao = null;

async function buscarAnuncio() {
    let ref = document.getElementById('buscaRef').value.trim().toUpperCase();
    const msg = document.getElementById('msgBusca');
    const resultDiv = document.getElementById('resultadoBusca');
    
    if(!ref) {
        msg.style.color = '#ff4444';
        msg.innerText = 'Digite uma referência válida (ex: MIC_0001).';
        return;
    }

    msg.style.color = 'var(--gold)';
    msg.innerText = 'Buscando anúncio...';
    resultDiv.style.display = 'none';
    cancelarAcao(); // Fecha painel de confirmação se estiver aberto

    // Busca no banco por referência
    const { data, error } = await supabase.from('imoveis').select('*').eq('referencia', ref).single();

    if (error || !data) {
        msg.style.color = '#ff4444';
        msg.innerText = 'Nenhum imóvel encontrado com essa referência. Tente novamente.';
        return;
    }

    msg.innerText = '';
    imovelEmGestao = data;
    
    // Status atual verifica maiúscula/minúscula (Ativo, ativo, Inativo)
    const isAtivo = (data.status === 'Ativo' || data.status === 'ativo');
    const statusAtualTexto = isAtivo ? 'Ativo (Visível no site)' : 'Inativo (Oculto)';
    const statusAtualCor = isAtivo ? '#25D366' : '#ff4444';
    
    const btnInativarTexto = isAtivo ? 'Inativar Anúncio' : 'Reativar Anúncio';
    const btnInativarCor = isAtivo ? '#e6a100' : '#25D366';
    const novoStatus = isAtivo ? 'Inativo' : 'Ativo';

    resultDiv.innerHTML = `
        <h3 style="color: var(--gold); margin-top: 0; margin-bottom: 10px;">${data.titulo}</h3>
        <p style="margin: 5px 0;"><strong>Referência:</strong> ${data.referencia}</p>
        <p style="margin: 5px 0;"><strong>Status Atual:</strong> <span style="color: ${statusAtualCor}; font-weight: bold;">${statusAtualTexto}</span></p>
        <p style="margin: 5px 0;"><strong>Finalidade:</strong> ${data.finalidade} | <strong>Tipo:</strong> ${data.tipo}</p>
        <p style="margin: 5px 0;"><strong>Local:</strong> ${data.bairro || ''} - ${data.cidade || ''}</p>
        
        <div style="display: flex; gap: 10px; margin-top: 25px; flex-wrap: wrap;">
            <button id="btnAcaoInativar" onclick="confirmarAcao('inativar', '${data.id}', '${novoStatus}')" style="background: ${btnInativarCor}; color: white; width: auto; flex: 1;">${btnInativarTexto}</button>
            <button id="btnAcaoExcluir" onclick="confirmarAcao('excluir', '${data.id}')" style="background: #ff4444; color: white; width: auto; flex: 1;">Excluir Permanentemente</button>
        </div>
        
        <!-- PAINEL DE DUPLA CONFIRMAÇÃO -->
        <div id="areaConfirmacao" style="display:none; margin-top: 15px; padding: 20px; background: rgba(255,68,68,0.1); border: 1px solid #ff4444; border-radius: 4px;">
            <p id="textoConfirmacao" style="margin-top: 0; margin-bottom: 20px; font-weight: 500; font-size: 15px;"></p>
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <button id="btnConfirmaSim" style="background: #ff4444; color: white; flex: 1;">SIM, TENHO CERTEZA</button>
                <button onclick="cancelarAcao()" style="background: transparent; border: 1px solid var(--gray); color: var(--gray); flex: 1;">Cancelar</button>
            </div>
        </div>
    `;
    resultDiv.style.display = 'block';
}

function confirmarAcao(acao, id, parametroExtra = null) {
    const area = document.getElementById('areaConfirmacao');
    const texto = document.getElementById('textoConfirmacao');
    const btnSim = document.getElementById('btnConfirmaSim');

    area.style.display = 'block';
    document.getElementById('btnAcaoInativar').style.display = 'none';
    document.getElementById('btnAcaoExcluir').style.display = 'none';

    if(acao === 'inativar') {
        area.style.background = 'rgba(230,161,0,0.1)';
        area.style.borderColor = '#e6a100';
        texto.innerText = parametroExtra === 'Inativo' ? 'Tem certeza que deseja OCULTAR este anúncio do site público?' : 'Tem certeza que deseja REATIVAR este anúncio e mostrá-lo no site público?';
        btnSim.style.background = '#e6a100';
        btnSim.onclick = () => executarStatus(id, parametroExtra);
    } else if (acao === 'excluir') {
        area.style.background = 'rgba(255,68,68,0.1)';
        area.style.borderColor = '#ff4444';
        texto.innerHTML = '<strong>ATENÇÃO (IRREVERSÍVEL):</strong> Esta ação apagará o imóvel e excluirá todas as suas fotos e vídeos do banco de dados para não ocupar espaço. Tem certeza?';
        btnSim.style.background = '#ff4444';
        btnSim.onclick = () => executarExclusao(id);
    }
}

function cancelarAcao() {
    const area = document.getElementById('areaConfirmacao');
    if(area) area.style.display = 'none';
    
    const btnInat = document.getElementById('btnAcaoInativar');
    const btnExcl = document.getElementById('btnAcaoExcluir');
    if(btnInat) btnInat.style.display = 'block';
    if(btnExcl) btnExcl.style.display = 'block';
}

async function executarStatus(id, novoStatus) {
    document.getElementById('textoConfirmacao').innerText = 'Processando...';
    document.getElementById('btnConfirmaSim').disabled = true;

    const { error } = await supabase.from('imoveis').update({ status: novoStatus }).eq('id', id);
    
    if(!error) {
        alert(`O anúncio foi marcado como ${novoStatus} com sucesso!`);
        buscarAnuncio(); // Recarrega os dados do anúncio na tela
    } else {
        alert('Erro ao tentar mudar o status.');
        cancelarAcao();
    }
}

// Função para descobrir o nome interno do arquivo no Supabase Storage a partir do Link Público
function extrairPathDoStorage(url) {
    if(!url) return null;
    const nomeBucket = 'imoveis_fotos/';
    if(url.includes(nomeBucket)) {
        return url.split(nomeBucket)[1];
    }
    return null;
}

async function executarExclusao(id) {
    document.getElementById('textoConfirmacao').innerText = 'Limpando mídias e excluindo registro... Por favor, não feche a página.';
    document.getElementById('btnConfirmaSim').disabled = true;

    let arquivosParaApagar = [];
    
    // Lista fotos para apagar
    if(imovelEmGestao.fotos && imovelEmGestao.fotos.length > 0) {
        imovelEmGestao.fotos.forEach(url => {
            let path = extrairPathDoStorage(url);
            if(path) arquivosParaApagar.push(path);
        });
    }
    
    // Lista vídeo para apagar
    if(imovelEmGestao.video) {
        let pathVideo = extrairPathDoStorage(imovelEmGestao.video);
        if(pathVideo) arquivosParaApagar.push(pathVideo);
    }

    // 1. Apaga do Storage (evita lixo acumulado no servidor)
    if(arquivosParaApagar.length > 0) {
        await supabase.storage.from('imoveis_fotos').remove(arquivosParaApagar);
    }

    // 2. Apaga da tabela Imóveis
    const { error } = await supabase.from('imoveis').delete().eq('id', id);

    if(!error) {
        alert('Imóvel excluído permanentemente com sucesso!');
        document.getElementById('resultadoBusca').style.display = 'none';
        document.getElementById('buscaRef').value = '';
        imovelEmGestao = null;
    } else {
        alert('Erro ao tentar excluir o registro do banco.');
        cancelarAcao();
    }
}
// ==========================================

// Lógica de Leads
async function carregarLeads() {
    const loading = document.getElementById('loadingLeads');
    const tabela = document.getElementById('tabelaLeads');
    const corpo = document.getElementById('corpoTabelaLeads');
    loading.style.display = 'block';
    tabela.style.display = 'none';

    const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
    loading.style.display = 'none';

    if (error) {
        corpo.innerHTML = '<tr><td colspan="5">Erro ao carregar contatos.</td></tr>';
        tabela.style.display = 'table';
        return;
    }

    if (data.length === 0) {
        corpo.innerHTML = '<tr><td colspan="5">Nenhum contato recebido ainda.</td></tr>';
    } else {
        corpo.innerHTML = '';
        data.forEach(lead => {
            const dataFormatada = new Date(lead.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute:'2-digit' });
            let badgeClass = 'novo';
            if(lead.status === 'Em atendimento') badgeClass = 'atendimento';
            if(lead.status === 'Concluído') badgeClass = 'concluido';

            corpo.innerHTML += `
                <tr>
                    <td>${dataFormatada}</td>
                    <td><strong>${lead.nome}</strong><br>${lead.telefone}<br>${lead.email}</td>
                    <td><span class="badge ${badgeClass}" id="badge-${lead.id}">${lead.interesse}</span></td>
                    <td><small>${lead.mensagem || 'Sem mensagem'}</small></td>
                    <td>
                        <select onchange="atualizarStatusLead('${lead.id}', this.value)">
                            <option value="Novo" ${lead.status === 'Novo' ? 'selected' : ''}>Novo</option>
                            <option value="Em atendimento" ${lead.status === 'Em atendimento' ? 'selected' : ''}>Em atendimento</option>
                            <option value="Concluído" ${lead.status === 'Concluído' ? 'selected' : ''}>Concluído</option>
                        </select>
                    </td>
                </tr>
            `;
        });
    }
    tabela.style.display = 'table';
}

async function atualizarStatusLead(id, novoStatus) {
    const { error } = await supabase.from('leads').update({ status: novoStatus }).eq('id', id);
    if(error) alert('Erro ao atualizar o status.');
    else {
        const badge = document.getElementById(`badge-${id}`);
        badge.className = 'badge';
        if(novoStatus === 'Novo') badge.classList.add('novo');
        if(novoStatus === 'Em atendimento') badge.classList.add('atendimento');
        if(novoStatus === 'Concluído') badge.classList.add('concluido');
    }
}

checarSessao();
