// Configuração do Supabase
var SUPABASE_URL = 'https://uztsmkhlvoemjbbyebcr.supabase.co';
var SUPABASE_ANON_KEY = 'sb_publishable_nmolEh_G5_hKcfdgy2Xpeg_s4T6ePAz';
var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const loginSection = document.getElementById('loginSection');
const dashboardSection = document.getElementById('dashboardSection');

// Variáveis Globais
let tentativasIA = 0;
let idImovelEditando = null;
let fotosAntigasEdicao = [];
let videoAntigoEdicao = null;
let listaImoveisGestao = [];
let fotosProcessadas = [];
let urlsDasFotosEnviadas = []; 

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
        if (!idImovelEditando || (event && event.type === 'click')) {
            resetarFormularioImovel();
        }
    } else if(aba === 'gestao') {
        document.getElementById('btnAbaGestao').classList.add('active');
        document.getElementById('abaGestao').style.display = 'block';
        resetarFormularioImovel();
        carregarImoveisGestao();
    } else {
        document.getElementById('btnAbaLeads').classList.add('active');
        document.getElementById('abaLeads').style.display = 'block';
        resetarFormularioImovel();
        carregarLeads();
    }
}

// Reset do formulário
function resetarFormularioImovel() {
    idImovelEditando = null;
    fotosAntigasEdicao = [];
    videoAntigoEdicao = null;
    fotosProcessadas = [];
    urlsDasFotosEnviadas = [];
    tentativasIA = 0;
    
    document.getElementById('formImovel').reset();
    document.getElementById('div-detalhes-mobilia').style.display = 'none';
    document.getElementById('previewFotos').innerHTML = '';
    
    const previewVideoBox = document.getElementById('previewVideoBox');
    if (previewVideoBox) previewVideoBox.style.display = 'none';

    const vHelp = document.getElementById('videoHelpText');
    if(vHelp) {
        vHelp.style.color = 'var(--gold)';
        vHelp.innerHTML = 'Selecione um arquivo de vídeo para exibir dentro do imóvel. <b>Tamanho máximo permitido: 50MB.</b>';
    }
    
    document.getElementById('tituloAbaImovel').innerText = 'Novo Imóvel (Padrão Integração)';
    document.getElementById('btnSubmit').innerText = 'Publicar Imóvel';
    document.getElementById('btnSubmit').disabled = true;
    document.getElementById('btnGerarIA').innerText = '✨ Analisar e Gerar Anúncio com IA';
    document.getElementById('btnGerarIA').style.background = '#25D366';
    document.getElementById('btnGerarIA').disabled = false;
    document.getElementById('imovelMsg').innerText = '';
}

document.getElementById('imoTitulo').addEventListener('input', habilitarBotaoPublicar);
document.getElementById('imoDescricao').addEventListener('input', habilitarBotaoPublicar);

function habilitarBotaoPublicar() {
    const titulo = document.getElementById('imoTitulo').value.trim();
    const desc = document.getElementById('imoDescricao').value.trim();
    if (titulo.length > 0 && desc.length > 0) {
        document.getElementById('btnSubmit').disabled = false;
    } else {
        document.getElementById('btnSubmit').disabled = true;
    }
}

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
            } catch (error) { console.error("Erro ao buscar CEP:", error); }
        }
    });
}

const videoInput = document.getElementById('imoVideo');
const videoHelpText = document.getElementById('videoHelpText');
if(videoInput) {
    videoInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if(!file) return;
        const maxSizeBytes = 52428800; 
        if (file.size > maxSizeBytes) {
            alert('🚨 ARQUIVO MUITO GRANDE! \n\nO vídeo selecionado tem ' + (file.size / 1048576).toFixed(2) + 'MB.\nO limite máximo é de 50MB.');
            videoInput.value = ''; 
            if(videoHelpText) {
                videoHelpText.style.color = '#ff4444';
                videoHelpText.innerHTML = '<b>Atenção:</b> O último arquivo escolhido era muito grande e foi recusado. Escolha um vídeo menor que 50MB.';
            }
        } else {
            if(videoHelpText) {
                videoHelpText.style.color = 'var(--gold)';
                videoHelpText.innerHTML = 'Selecione um arquivo de vídeo para exibir dentro do imóvel. <b>Tamanho máximo: 50MB.</b>';
            }
        }
    });
}

function removerVideoAntigo() {
    videoAntigoEdicao = null;
    document.getElementById('previewVideoBox').style.display = 'none';
    const vHelp = document.getElementById('videoHelpText');
    if(vHelp) {
        vHelp.style.color = '#ff4444';
        vHelp.innerHTML = 'Vídeo atual será removido. Você pode publicar sem vídeo ou escolher um novo.';
    }
}

const fileInput = document.getElementById('imoFotos');
if(fileInput) {
    fileInput.addEventListener('change', async function(e) {
        urlsDasFotosEnviadas = [];
        tentativasIA = 0; 
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

        if (idImovelEditando && fotosAntigasEdicao.length > 0) {
            const aviso = document.createElement('div');
            aviso.style.width = '100%';
            aviso.style.fontSize = '12px';
            aviso.style.color = '#ff4444';
            aviso.style.marginBottom = '10px';
            aviso.innerHTML = '<b>As novas fotos irão substituir as fotos antigas do banco ao salvar.</b>';
            previewContainer.appendChild(aviso);
        }

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

async function gerarTextoIA() {
    if(fotosProcessadas.length === 0 && !idImovelEditando) {
        alert('Por favor, adicione as fotos do imóvel. A IA precisa delas para criar o anúncio.');
        return;
    }

    const btnIA = document.getElementById('btnGerarIA');
    const msg = document.getElementById('imovelMsg');
    const btnSubmit = document.getElementById('btnSubmit');
    
    btnIA.disabled = true;
    btnIA.innerText = '⏳ Fazendo upload e analisando...';
    msg.innerText = '';

    try {
        if (urlsDasFotosEnviadas.length === 0 && fotosProcessadas.length > 0) {
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

        let urlsParaIa = urlsDasFotosEnviadas.length > 0 ? urlsDasFotosEnviadas : fotosAntigasEdicao;

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
            mobiliado: document.getElementById('mobSim').checked,
            detalhes_mobilia: document.getElementById('detalhes_mobilia').value,
            lazer: itensLazer,
            fotosUrls: urlsParaIa
        };

        const response = await fetch('/api/gerar-anuncio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payloadParaIA)
        });

        if (!response.ok) throw new Error("Erro na rota da IA");
        const dadosIA = await response.json();

        document.getElementById('imoTitulo').value = dadosIA.titulo || "Título indisponível";
        document.getElementById('imoDescricao').value = dadosIA.descricao || "Descrição indisponível";

        tentativasIA = 0;
        btnSubmit.disabled = false;
        btnIA.innerText = '✅ Anúncio Gerado com Sucesso!';
        btnIA.style.background = '#0F9D58'; 

    } catch (error) {
        console.error(error);
        tentativasIA++; 
        btnIA.disabled = false;
        if (tentativasIA >= 2) {
            btnIA.innerText = '⚠️ IA Indisponível. Edição Manual Liberada.';
            btnIA.style.background = '#e6a100'; 
            btnIA.disabled = true; 
            msg.style.color = '#e6a100';
            msg.innerHTML = 'Preencha manualmente o Título e a Descrição para liberar o botão.';
            document.getElementById('imoTitulo').focus();
        } else {
            btnIA.innerText = '❌ Falha ao gerar. Tentar novamente';
            msg.style.color = '#ff4444';
            msg.innerText = 'Erro de comunicação com a IA. Tente novamente.';
        }
    }
}

function extrairPathDoStorage(url) {
    if(!url) return null;
    const nomeBucket = 'imoveis_fotos/';
    if(url.includes(nomeBucket)) return url.split(nomeBucket)[1];
    return null;
}

// SALVAR MODO EDIÇÃO E NOVO
const formImovel = document.getElementById('formImovel');
if (formImovel) {
    formImovel.addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = document.getElementById('imovelMsg');
        msg.style.color = 'var(--gold)';
        msg.innerText = 'Salvando e fazendo upload das mídias...';

        const titulo = document.getElementById('imoTitulo').value.trim().substring(0, 100);
        const descricao = document.getElementById('imoDescricao').value.trim().substring(0, 3000);

        if (!titulo || !descricao) {
            msg.style.color = '#ff4444';
            msg.innerText = 'Por favor, preencha o Título e a Descrição.';
            return;
        }

        if (fotosProcessadas.length > 0 && urlsDasFotosEnviadas.length === 0) {
            for(let file of fotosProcessadas) {
                const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
                const { data, error } = await supabase.storage.from('imoveis_fotos').upload(fileName, file);
                if(!error) {
                    const { data: pUrl } = supabase.storage.from('imoveis_fotos').getPublicUrl(fileName);
                    urlsDasFotosEnviadas.push(pUrl.publicUrl);
                }
            }
        }

        let videoUrl = videoAntigoEdicao;
        if (videoInput && videoInput.files.length > 0) {
            const videoFile = videoInput.files[0];
            const videoName = `video_${Date.now()}_${videoFile.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
            const { data: vData, error: vError } = await supabase.storage.from('imoveis_fotos').upload(videoName, videoFile);
            if (!vError) {
                const { data: vPublicUrl } = supabase.storage.from('imoveis_fotos').getPublicUrl(videoName);
                videoUrl = vPublicUrl.publicUrl;
            }
        }

        let fotosFinais = urlsDasFotosEnviadas.length > 0 ? urlsDasFotosEnviadas : fotosAntigasEdicao;

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
            fotos: fotosFinais, 
            video: videoUrl
        };

        if (idImovelEditando) {
            const { error } = await supabase.from('imoveis').update(payload).eq('id', idImovelEditando);
            if (!error) {
                if (urlsDasFotosEnviadas.length > 0 && fotosAntigasEdicao.length > 0) {
                    let paths = fotosAntigasEdicao.map(u => extrairPathDoStorage(u)).filter(p => p);
                    if(paths.length > 0) supabase.storage.from('imoveis_fotos').remove(paths);
                }
                if (videoUrl !== videoAntigoEdicao && videoAntigoEdicao) {
                    let pathV = extrairPathDoStorage(videoAntigoEdicao);
                    if(pathV) supabase.storage.from('imoveis_fotos').remove([pathV]);
                }
                msg.style.color = '#25D366'; 
                msg.innerText = 'Imóvel atualizado com sucesso!';
                setTimeout(() => { mudarAba('gestao'); }, 2000);
            } else {
                msg.style.color = '#ff4444';
                msg.innerText = 'Erro ao atualizar o imóvel.';
            }
        } else {
            payload.status = 'Ativo';
            const { error } = await supabase.from('imoveis').insert([payload]);
            if (!error) {
                msg.style.color = '#25D366'; 
                msg.innerText = 'Imóvel publicado com sucesso!';
                setTimeout(() => { resetarFormularioImovel(); }, 2500);
            } else {
                msg.style.color = '#ff4444';
                msg.innerText = 'Erro ao gravar o imóvel.';
            }
        }
    });
}

// ABA GERENCIAR ANÚNCIOS
async function carregarImoveisGestao() {
    const loading = document.getElementById('loadingGestao');
    const tabela = document.getElementById('tabelaGestao');
    const corpo = document.getElementById('corpoTabelaGestao');
    
    loading.style.display = 'block';
    tabela.style.display = 'none';
    cancelarAcao();

    const { data, error } = await supabase.from('imoveis').select('*').order('created_at', { ascending: false });
    loading.style.display = 'none';

    if (error) {
        corpo.innerHTML = '<tr><td colspan="5">Erro ao carregar imóveis.</td></tr>';
        tabela.style.display = 'table';
        return;
    }

    listaImoveisGestao = data;
    renderizarTabelaGestao(listaImoveisGestao);
    tabela.style.display = 'table';
}

function renderizarTabelaGestao(lista) {
    const corpo = document.getElementById('corpoTabelaGestao');
    if (lista.length === 0) {
        corpo.innerHTML = '<tr><td colspan="5">Nenhum imóvel encontrado.</td></tr>';
        return;
    }

    corpo.innerHTML = '';
    lista.forEach(imo => {
        const isAtivo = (imo.status === 'Ativo' || imo.status === 'ativo');
        const statusCor = isAtivo ? '#25D366' : '#ff4444';
        const textoStatus = isAtivo ? 'Ativo' : 'Inativo';
        
        let valores = [];
        if(imo.valor_venda) valores.push(`Venda: R$ ${Number(imo.valor_venda).toLocaleString('pt-BR')}`);
        if(imo.valor_aluguel) valores.push(`Aluguel: R$ ${Number(imo.valor_aluguel).toLocaleString('pt-BR')}`);
        const strValores = valores.length > 0 ? valores.join('<br>') : 'Não informado';
        
        const enderecoCurto = `${imo.endereco || ''} ${imo.bairro ? '- ' + imo.bairro : ''}`;

        corpo.innerHTML += `
            <tr>
                <td><strong>${imo.referencia || 'S/N'}</strong></td>
                <td>${enderecoCurto}</td>
                <td><small>${strValores}</small></td>
                <td><span style="color:${statusCor}; font-weight:bold;">${textoStatus}</span></td>
                <td class="acoes-container">
                    <button class="btn-acao" style="background: var(--gold); color: black;" onclick="abrirEdicao('${imo.id}')">Editar</button>
                    <button class="btn-acao" style="background: ${isAtivo ? '#e6a100' : '#25D366'};" onclick="confirmarAcaoGestao('status', '${imo.id}', '${imo.status}')">${isAtivo ? 'Inativar' : 'Reativar'}</button>
                    <button class="btn-acao" style="background: #ff4444;" onclick="confirmarAcaoGestao('excluir', '${imo.id}')">Excluir</button>
                </td>
            </tr>
        `;
    });
}

function filtrarListaGestao() {
    const termo = document.getElementById('buscaRef').value.toLowerCase();
    const filtrados = listaImoveisGestao.filter(i => 
        (i.referencia && i.referencia.toLowerCase().includes(termo)) ||
        (i.endereco && i.endereco.toLowerCase().includes(termo)) ||
        (i.bairro && i.bairro.toLowerCase().includes(termo))
    );
    renderizarTabelaGestao(filtrados);
}

// ABRIR MODO EDIÇÃO BLINDADO
function abrirEdicao(id) {
    const imovel = listaImoveisGestao.find(i => i.id === id);
    if(!imovel) return;

    resetarFormularioImovel(); // Limpa a div #previewFotos
    idImovelEditando = imovel.id;
    
    // EXTRAÇÃO ROBUSTA DAS FOTOS
    fotosAntigasEdicao = [];
    if (imovel.fotos) {
        let raw = imovel.fotos;
        if (Array.isArray(raw)) {
            fotosAntigasEdicao = [...raw];
        } else if (typeof raw === 'string') {
            let clean = raw.trim();
            // Verifica se é Array estilo Postgres {}
            if (clean.startsWith('{') && clean.endsWith('}')) {
                clean = clean.slice(1, -1);
                if (clean) fotosAntigasEdicao = clean.split(',').map(s => s.replace(/^"|"$/g, '').trim());
            } 
            // Verifica se é Array estilo JSON []
            else if (clean.startsWith('[') && clean.endsWith(']')) {
                try {
                    fotosAntigasEdicao = JSON.parse(clean);
                } catch(e) {
                    clean = clean.slice(1, -1);
                    if (clean) fotosAntigasEdicao = clean.split(',').map(s => s.replace(/^"|"$/g, '').trim());
                }
            } 
            // Se for apenas string separada por vírgula
            else {
                if (clean) fotosAntigasEdicao = clean.split(',').map(s => s.trim());
            }
        }
    }

    // Filtra pra ter certeza que são URLs de verdade (não nulos/vazios)
    fotosAntigasEdicao = fotosAntigasEdicao.filter(url => typeof url === 'string' && url.length > 5);
    videoAntigoEdicao = imovel.video || null;

    // RENDERIZAR AS FOTOS NA TELA (CAIXA DE PREVIEW)
    const previewContainer = document.getElementById('previewFotos');
    
    if (fotosAntigasEdicao.length > 0) {
        const aviso = document.createElement('div');
        aviso.style.width = '100%';
        aviso.style.fontSize = '12px';
        aviso.style.color = 'var(--gold)';
        aviso.style.marginBottom = '10px';
        aviso.innerHTML = '<b>Atenção:</b> Estas são as fotos atuais. Se você selecionar novos arquivos, estas serão apagadas e substituídas pelas novas.';
        previewContainer.appendChild(aviso);

        fotosAntigasEdicao.forEach(url => {
            const img = document.createElement('img');
            img.src = url;
            // Se o link vier quebrado, vai marcar de vermelho
            img.onerror = function() {
                this.style.border = '2px solid red';
                this.title = 'Link da foto quebrado: ' + url;
            };
            previewContainer.appendChild(img);
        });
    } else {
        // SE REALMENTE NÃO HOUVER FOTOS PARA ESTE IMÓVEL
        const erroMsg = document.createElement('div');
        erroMsg.style.width = '100%';
        erroMsg.style.fontSize = '12px';
        erroMsg.style.color = '#ff4444';
        erroMsg.innerHTML = '<b>Nenhuma foto salva no banco de dados para este imóvel.</b> (Se você as enviou no passado, ocorreu alguma falha na gravação delas na época).';
        previewContainer.appendChild(erroMsg);
    }

    // RENDERIZAR CAIXA DO VÍDEO
    const previewVideoBox = document.getElementById('previewVideoBox');
    if (videoAntigoEdicao && typeof videoAntigoEdicao === 'string' && videoAntigoEdicao.trim() !== '') {
        if (previewVideoBox) previewVideoBox.style.display = 'flex';
        document.getElementById('linkVideoAtual').href = videoAntigoEdicao;
        const vHelp = document.getElementById('videoHelpText');
        if(vHelp) vHelp.innerHTML = 'Escolha um arquivo acima <b>apenas se quiser substituir</b> o vídeo atual.';
    } else {
        if (previewVideoBox) previewVideoBox.style.display = 'none';
        const vHelp = document.getElementById('videoHelpText');
        if(vHelp) {
            vHelp.style.color = '#ff4444';
            vHelp.innerHTML = '<b>Nenhum vídeo salvo para este imóvel.</b> Selecione um arquivo se desejar adicionar.';
        }
    }

    // Preencher campos textuais
    document.getElementById('imoTitulo').value = imovel.titulo || '';
    document.getElementById('imoTipo').value = imovel.tipo || 'Apartamento';
    document.getElementById('imoFinalidade').value = imovel.finalidade || 'Venda';
    document.getElementById('imoVenda').value = imovel.valor_venda || '';
    document.getElementById('imoAluguel').value = imovel.valor_aluguel || '';
    document.getElementById('imoCondominio').value = imovel.valor_condominio || '';
    document.getElementById('imoIptu').value = imovel.valor_iptu || '';
    document.getElementById('imoAreaUtil').value = imovel.area_util || '';
    document.getElementById('imoAreaTotal').value = imovel.area_total || '';
    document.getElementById('imoQuartos').value = imovel.quartos || '0';
    document.getElementById('imoSuites').value = imovel.suites || '0';
    document.getElementById('imoBanheiros').value = imovel.banheiros || '0';
    document.getElementById('imoVagas').value = imovel.vagas || '0';
    
    if(imovel.mobiliado) {
        document.getElementById('mobSim').checked = true;
        document.getElementById('detalhes_mobilia').value = imovel.detalhes_mobilia || '';
        document.getElementById('div-detalhes-mobilia').style.display = 'block';
    } else {
        document.getElementById('mobNao').checked = true;
        document.getElementById('div-detalhes-mobilia').style.display = 'none';
    }

    document.querySelectorAll('input[name="lazer"]').forEach(cb => {
        cb.checked = imovel.itens_lazer && imovel.itens_lazer.includes(cb.value);
    });

    document.getElementById('imoCep').value = imovel.cep || '';
    document.getElementById('imoEndereco').value = imovel.endereco || '';
    document.getElementById('imoNumero').value = imovel.numero || '';
    document.getElementById('imoComplemento').value = imovel.complemento || '';
    document.getElementById('imoBairro').value = imovel.bairro || '';
    document.getElementById('imoCidade').value = imovel.cidade || '';
    document.getElementById('imoEstado').value = imovel.estado || '';
    document.getElementById('imoDescricao').value = imovel.descricao || '';

    document.getElementById('btnAbaGestao').classList.remove('active');
    document.getElementById('abaGestao').style.display = 'none';
    document.getElementById('btnAbaImovel').classList.add('active');
    document.getElementById('abaImovel').style.display = 'block';

    document.getElementById('tituloAbaImovel').innerText = `Editar Imóvel (${imovel.referencia || imovel.id})`;
    document.getElementById('btnSubmit').innerText = 'Atualizar Imóvel';
    document.getElementById('btnSubmit').disabled = false;
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

let idAcaoGestao = null;
let statusParaAcao = null;

function confirmarAcaoGestao(acao, id, statusAtual = null) {
    idAcaoGestao = id;
    const area = document.getElementById('areaConfirmacao');
    const texto = document.getElementById('textoConfirmacao');
    const btnSim = document.getElementById('btnConfirmaSim');

    area.style.display = 'block';
    area.scrollIntoView({ behavior: 'smooth', block: 'center' });

    if(acao === 'status') {
        const isAtivo = (statusAtual === 'Ativo' || statusAtual === 'ativo');
        statusParaAcao = isAtivo ? 'Inativo' : 'Ativo';
        area.style.background = 'rgba(230,161,0,0.1)';
        area.style.borderColor = '#e6a100';
        texto.innerText = isAtivo ? 'Tem certeza que deseja OCULTAR este anúncio do site público?' : 'Tem certeza que deseja REATIVAR este anúncio e mostrá-lo no site público?';
        btnSim.style.background = '#e6a100';
        btnSim.onclick = executarStatusGestao;
    } else if (acao === 'excluir') {
        area.style.background = 'rgba(255,68,68,0.1)';
        area.style.borderColor = '#ff4444';
        texto.innerHTML = '<strong>ATENÇÃO (IRREVERSÍVEL):</strong> Esta ação apagará o imóvel e excluirá todas as fotos e vídeos. Tem certeza?';
        btnSim.style.background = '#ff4444';
        btnSim.onclick = executarExclusaoGestao;
    }
}

function cancelarAcao() {
    idAcaoGestao = null;
    const area = document.getElementById('areaConfirmacao');
    if(area) area.style.display = 'none';
}

async function executarStatusGestao() {
    document.getElementById('textoConfirmacao').innerText = 'Processando...';
    document.getElementById('btnConfirmaSim').disabled = true;

    const { error } = await supabase.from('imoveis').update({ status: statusParaAcao }).eq('id', idAcaoGestao);
    
    document.getElementById('btnConfirmaSim').disabled = false;
    if(!error) {
        alert(`Status alterado com sucesso!`);
        carregarImoveisGestao();
    } else {
        alert('Erro ao tentar mudar o status.');
        cancelarAcao();
    }
}

async function executarExclusaoGestao() {
    document.getElementById('textoConfirmacao').innerText = 'Limpando mídias e excluindo registro...';
    document.getElementById('btnConfirmaSim').disabled = true;

    const imo = listaImoveisGestao.find(i => i.id === idAcaoGestao);
    let arquivos = [];
    if(imo.fotos) imo.fotos.forEach(u => { let p = extrairPathDoStorage(u); if(p) arquivos.push(p); });
    if(imo.video) { let p = extrairPathDoStorage(imo.video); if(p) arquivos.push(p); }

    if(arquivos.length > 0) await supabase.storage.from('imoveis_fotos').remove(arquivos);

    const { error } = await supabase.from('imoveis').delete().eq('id', idAcaoGestao);

    document.getElementById('btnConfirmaSim').disabled = false;
    if(!error) {
        alert('Imóvel excluído permanentemente!');
        carregarImoveisGestao();
    } else {
        alert('Erro ao excluir o registro.');
        cancelarAcao();
    }
}

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
