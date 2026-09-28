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
let fotosParaExcluirDoStorage = []; // Guarda as fotos deletadas para apagar do servidor ao salvar
let videoAntigoEdicao = null;
let videoParaExcluirDoStorage = null; 
let listaImoveisGestao = [];

// Agora fotosProcessadas é um array CUMULATIVO de objetos { file, id, localUrl, uploadedUrl }
let fotosProcessadas = []; 
// Variável segura para não perder o vídeo ao clicar no input novamente
let videoNovoProcessado = null; 

// ==========================================
// FUNÇÕES DE FORMATAÇÃO DE MOEDA
// ==========================================
function formatarMoeda(campo) {
    // Remove tudo que não for número
    let valor = campo.value.replace(/\D/g, ''); 
    if (valor) {
        // Coloca o ponto de separação de milhar no padrão brasileiro
        valor = parseInt(valor, 10).toLocaleString('pt-BR');
    }
    campo.value = valor;
}

function limparMoeda(valor) {
    if (!valor) return null;
    // Remove os pontos para enviar para o banco de dados limpo
    let limpo = valor.replace(/\./g, '');
    return limpo ? parseInt(limpo, 10) : null;
}
// ==========================================

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

// Reset do formulário (Restaurando a tela para Modo "Novo Imóvel")
function resetarFormularioImovel() {
    idImovelEditando = null;
    fotosAntigasEdicao = [];
    fotosParaExcluirDoStorage = []; 
    videoAntigoEdicao = null;
    videoParaExcluirDoStorage = null;
    fotosProcessadas = []; // Limpa o array cumulativo
    videoNovoProcessado = null; // Limpa o video novo
    tentativasIA = 0;
    
    document.getElementById('formImovel').reset();
    document.getElementById('div-detalhes-mobilia').style.display = 'none';
    document.getElementById('previewFotos').innerHTML = '';
    
    const previewSalvas = document.getElementById('previewFotosSalvas');
    if(previewSalvas) {
        previewSalvas.style.display = 'none';
        previewSalvas.innerHTML = '';
    }
    
    const previewVideoBox = document.getElementById('previewVideoBox');
    if (previewVideoBox) previewVideoBox.style.display = 'none';

    const previewVideoNovoBox = document.getElementById('previewVideoNovoBox');
    if (previewVideoNovoBox) previewVideoNovoBox.style.display = 'none';

    const lblFotos = document.getElementById('labelFotos');
    if(lblFotos) lblFotos.innerText = "Gestão de Fotos (Fique à vontade para adicionar, os envios são acumulados)";

    const vHelp = document.getElementById('videoHelpText');
    if(vHelp) {
        vHelp.style.color = 'var(--gold)';
        vHelp.innerHTML = 'Selecione um arquivo de vídeo. <b>Tamanho máximo: 50MB.</b>';
    }
    
    document.getElementById('tituloAbaImovel').innerText = 'Novo Imóvel (Padrão Integração)';
    document.getElementById('btnSubmit').innerText = 'Publicar Imóvel';
    document.getElementById('btnSubmit').disabled = true;
    
    const btnIA = document.getElementById('btnGerarIA');
    if(btnIA) {
        btnIA.style.display = 'block';
        btnIA.innerText = '✨ Analisar e Gerar Anúncio com IA';
        btnIA.style.background = '#25D366';
        btnIA.disabled = false;
    }
    
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

// ==========================================
// VÍDEO (LÓGICA BLINDADA E ACUMULATIVA NO ESTADO)
// ==========================================
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
        } else {
            videoNovoProcessado = file;
            document.getElementById('nomeVideoNovo').innerText = file.name;
            document.getElementById('previewVideoNovoBox').style.display = 'flex';
            
            // Lógica essencial: zera o input nativo. 
            // Assim, se o usuário clicar para escolher de novo e apertar cancelar, não perde o arquivo já salvo na variável.
            videoInput.value = '';
        }
    });
}

function removerVideoNovo() {
    videoNovoProcessado = null;
    document.getElementById('previewVideoNovoBox').style.display = 'none';
}

function removerVideoAntigo() {
    if (videoAntigoEdicao) {
        videoParaExcluirDoStorage = videoAntigoEdicao; 
    }
    videoAntigoEdicao = null;
    document.getElementById('previewVideoBox').style.display = 'none';
    const vHelp = document.getElementById('videoHelpText');
    if(vHelp) {
        vHelp.style.color = '#ff4444';
        vHelp.innerHTML = 'Vídeo atual será removido.';
    }
}

// ==========================================
// FOTOS CUMULATIVAS (ADICIONAR SEM APAGAR) COM TOPO NO CADASTRO
// ==========================================
const fileInput = document.getElementById('imoFotos');
if(fileInput) {
    fileInput.addEventListener('change', async function(e) {
        tentativasIA = 0; 
        const files = e.target.files;
        if(files.length === 0) return;

        // Feedback visual de carregamento
        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'loadingFotosNovas';
        loadingDiv.style.color = '#25D366';
        loadingDiv.style.marginTop = '10px';
        loadingDiv.style.fontWeight = 'bold';
        loadingDiv.innerText = `⏳ Processando ${files.length} nova(s) foto(s) com marca d'água...`;
        document.getElementById('containerBlocoFotos').appendChild(loadingDiv);

        const marcaDagua = new Image();
        marcaDagua.src = 'marca-dagua.png'; 
        await new Promise(r => { marcaDagua.onload = r; marcaDagua.onerror = r; });

        // AQUI ESTÁ O SEGREDO: O PUSH SOMA SEMPRE, NUNCA SUBSTITUI.
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
            
            // Adiciona ao array cumulativo de fotos novas
            fotosProcessadas.push({
                id: Date.now() + Math.random().toString(36).substr(2, 9),
                file: processedFile,
                localUrl: URL.createObjectURL(blob),
                uploadedUrl: null 
            });
        }
        
        loadingDiv.remove();
        
        // Zera o input para permitir clicar no botão novamente e escolher mais arquivos sem apagar os anteriores
        fileInput.value = '';
        
        // Renderiza as fotos novas adicionadas
        renderizarFotosNovas();
    });
}

function renderizarFotosNovas() {
    const container = document.getElementById('previewFotos');
    container.innerHTML = ''; 

    if (fotosProcessadas.length > 0) {
        const title = document.createElement('strong');
        title.style.display = 'block';
        title.style.width = '100%';
        title.style.marginBottom = '10px';
        title.style.color = '#25D366';
        title.innerText = `📸 Fotos novas adicionadas (${fotosProcessadas.length}):`;
        container.appendChild(title);
        
        const imgsContainer = document.createElement('div');
        imgsContainer.style.display = 'flex';
        imgsContainer.style.gap = '10px';
        imgsContainer.style.flexWrap = 'wrap';
        container.appendChild(imgsContainer);

        fotosProcessadas.forEach((fotoItem, index) => {
            const wrapper = document.createElement('div');
            wrapper.style.display = 'flex';
            wrapper.style.flexDirection = 'column';
            wrapper.style.gap = '6px';
            wrapper.style.width = '120px';
            wrapper.style.background = '#2a2a2a';
            wrapper.style.padding = '8px';
            wrapper.style.borderRadius = '6px';
            
            // Se for cadastro novo (sem fotos antigas), a foto index 0 é a Capa!
            const isCapaAbsoluta = (fotosAntigasEdicao.length === 0 && index === 0);
            wrapper.style.border = isCapaAbsoluta ? '2px solid #25D366' : '1px solid rgba(37, 211, 102, 0.5)';

            const labelPos = document.createElement('span');
            labelPos.innerText = isCapaAbsoluta ? '🌟 Capa (1º)' : `Nova: ${index + 1}`;
            labelPos.style.fontSize = '11px';
            labelPos.style.color = '#25D366';
            labelPos.style.textAlign = 'center';
            labelPos.style.fontWeight = 'bold';

            const img = document.createElement('img');
            img.src = fotoItem.localUrl;
            img.style.width = '100%';
            img.style.height = '80px';
            img.style.objectFit = 'cover';
            img.style.borderRadius = '4px';

            const btnContainer = document.createElement('div');
            btnContainer.style.display = 'flex';
            btnContainer.style.gap = '5px';

            // BOTÃO TOPO IMPLEMENTADO PARA FOTOS NOVAS (CADASTRO E EDIÇÃO)
            const btnTopo = document.createElement('button');
            btnTopo.type = 'button';
            btnTopo.innerHTML = '⬆️ Topo';
            btnTopo.style.background = '#25D366';
            btnTopo.style.color = 'white';
            btnTopo.style.fontSize = '11px';
            btnTopo.style.padding = '5px';
            btnTopo.style.margin = '0';
            btnTopo.style.flex = '1';
            btnTopo.style.borderRadius = '3px';
            
            if (index === 0) {
                btnTopo.disabled = true;
                btnTopo.style.opacity = '0.3';
            } else {
                btnTopo.onclick = () => {
                    // Move a foto clicada para o topo do array das novas
                    const fotoMover = fotosProcessadas.splice(index, 1)[0];
                    fotosProcessadas.unshift(fotoMover);
                    renderizarFotosNovas();
                };
            }

            // BOTÃO EXCLUIR
            const btnExcluir = document.createElement('button');
            btnExcluir.type = 'button';
            btnExcluir.innerHTML = '🗑️';
            btnExcluir.style.background = '#ff4444';
            btnExcluir.style.color = 'white';
            btnExcluir.style.fontSize = '11px';
            btnExcluir.style.padding = '5px';
            btnExcluir.style.margin = '0';
            btnExcluir.style.width = '35px';
            btnExcluir.style.borderRadius = '3px';
            btnExcluir.onclick = () => {
                const removida = fotosProcessadas.splice(index, 1)[0];
                if (removida.uploadedUrl) {
                    fotosParaExcluirDoStorage.push(removida.uploadedUrl);
                }
                renderizarFotosNovas();
            };

            btnContainer.appendChild(btnTopo);
            btnContainer.appendChild(btnExcluir);

            wrapper.appendChild(labelPos);
            wrapper.appendChild(img);
            wrapper.appendChild(btnContainer);
            imgsContainer.appendChild(wrapper);
        });
    }
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
        // Envia apenas as fotos novas que ainda NÃO foram enviadas
        for(let item of fotosProcessadas) {
            if (!item.uploadedUrl) {
                const fileName = `${Date.now()}_${item.file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
                const { data: uploadData, error: uploadError } = await supabase.storage.from('imoveis_fotos').upload(fileName, item.file);
                if(!uploadError) {
                    const { data: publicUrlData } = supabase.storage.from('imoveis_fotos').getPublicUrl(fileName);
                    item.uploadedUrl = publicUrlData.publicUrl;
                }
            }
        }

        const itensLazer = [];
        document.querySelectorAll('input[name="lazer"]:checked').forEach(cb => itensLazer.push(cb.value));

        // Pega as fotos velhas + as fotos novas já subidas
        let urlsParaIa = [...fotosAntigasEdicao];
        fotosProcessadas.forEach(f => {
            if (f.uploadedUrl) urlsParaIa.push(f.uploadedUrl);
        });

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

        // Subir as fotos acumuladas que ainda não subiram
        let fotosNovasUrls = [];
        for(let item of fotosProcessadas) {
            if (item.uploadedUrl) {
                fotosNovasUrls.push(item.uploadedUrl);
            } else {
                const fileName = `${Date.now()}_${item.file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
                const { data, error } = await supabase.storage.from('imoveis_fotos').upload(fileName, item.file);
                if(!error) {
                    const { data: pUrl } = supabase.storage.from('imoveis_fotos').getPublicUrl(fileName);
                    item.uploadedUrl = pUrl.publicUrl;
                    fotosNovasUrls.push(item.uploadedUrl);
                }
            }
        }

        let videoUrl = videoAntigoEdicao;
        if (videoNovoProcessado) {
            const videoFile = videoNovoProcessado;
            const videoName = `video_${Date.now()}_${videoFile.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
            const { data: vData, error: vError } = await supabase.storage.from('imoveis_fotos').upload(videoName, videoFile);
            if (!vError) {
                const { data: vPublicUrl } = supabase.storage.from('imoveis_fotos').getPublicUrl(videoName);
                videoUrl = vPublicUrl.publicUrl;
            }
        }

        // AS FOTOS FINAIS SERÃO AS ANTIGAS SALVAS + AS NOVAS SOMADAS (GARANTIA DE NÃO DELETAR)
        let fotosFinais = [...fotosAntigasEdicao, ...fotosNovasUrls];

        const itensLazer = [];
        document.querySelectorAll('input[name="lazer"]:checked').forEach(cb => itensLazer.push(cb.value));

        // UTILIZANDO A FUNÇÃO DE LIMPAR OS PONTOS DA MOEDA ANTES DE GRAVAR
        const payload = {
            titulo: titulo,
            descricao: descricao,
            tipo: document.getElementById('imoTipo').value,
            finalidade: document.getElementById('imoFinalidade').value,
            valor_venda: limparMoeda(document.getElementById('imoVenda').value),
            valor_aluguel: limparMoeda(document.getElementById('imoAluguel').value),
            valor_condominio: limparMoeda(document.getElementById('imoCondominio').value),
            valor_iptu: limparMoeda(document.getElementById('imoIptu').value),
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
                
                // Limpeza apenas do que o usuário apagou manualmente no botão da lixeirinha!
                if (fotosParaExcluirDoStorage.length > 0) {
                    let pathsExcluir = fotosParaExcluirDoStorage.map(u => extrairPathDoStorage(u)).filter(p => p);
                    if (pathsExcluir.length > 0) supabase.storage.from('imoveis_fotos').remove(pathsExcluir);
                }

                // Limpeza do vídeo se foi apagado
                if (videoParaExcluirDoStorage) {
                    let pathV = extrairPathDoStorage(videoParaExcluirDoStorage);
                    if(pathV) supabase.storage.from('imoveis_fotos').remove([pathV]);
                } else if (videoUrl !== videoAntigoEdicao && videoAntigoEdicao) {
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
                // Mesmo num imóvel novo, se ele adicionou uma foto, gerou IA e depois apagou a foto, limpamos
                if (fotosParaExcluirDoStorage.length > 0) {
                    let pathsExcluir = fotosParaExcluirDoStorage.map(u => extrairPathDoStorage(u)).filter(p => p);
                    if (pathsExcluir.length > 0) supabase.storage.from('imoveis_fotos').remove(pathsExcluir);
                }

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

// ==========================================
// FUNÇÕES PARA GERENCIAR FOTOS ANTIGAS
// ==========================================
function renderizarFotosAntigas() {
    const previewSalvas = document.getElementById('previewFotosSalvas');
    if (!previewSalvas) return;

    if (fotosAntigasEdicao.length === 0) {
        previewSalvas.innerHTML = '<span style="color:#ff4444;">Nenhuma foto salva no banco de dados para este imóvel.</span>';
        return;
    }

    previewSalvas.innerHTML = '<strong style="display:block; margin-bottom:10px; color:var(--gold);">📸 Administrar fotos salvas (Organize a ordem ou exclua):</strong>';
    
    const containerImgs = document.createElement('div');
    containerImgs.style.display = 'flex';
    containerImgs.style.gap = '10px';
    containerImgs.style.flexWrap = 'wrap';
    
    fotosAntigasEdicao.forEach((url, index) => {
        const wrapper = document.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.flexDirection = 'column';
        wrapper.style.gap = '6px';
        wrapper.style.width = '120px';
        wrapper.style.background = '#2a2a2a';
        wrapper.style.padding = '8px';
        wrapper.style.borderRadius = '6px';
        wrapper.style.border = index === 0 ? '2px solid #25D366' : '1px solid rgba(201,168,76,0.2)'; 

        const labelPos = document.createElement('span');
        labelPos.innerText = (index === 0) ? '🌟 Capa (1º)' : `Posição: ${index + 1}`;
        labelPos.style.fontSize = '11px';
        labelPos.style.color = (index === 0) ? '#25D366' : '#9a9a9a';
        labelPos.style.textAlign = 'center';
        labelPos.style.fontWeight = 'bold';

        const img = document.createElement('img');
        img.src = url;
        img.style.width = '100%';
        img.style.height = '80px';
        img.style.objectFit = 'cover';
        img.style.borderRadius = '4px';
        img.onerror = function() {
            this.style.border = '2px solid red';
            this.title = 'Link quebrado';
        };

        const btnContainer = document.createElement('div');
        btnContainer.style.display = 'flex';
        btnContainer.style.gap = '5px';

        const btnTopo = document.createElement('button');
        btnTopo.type = 'button'; 
        btnTopo.innerHTML = '⬆️ Topo';
        btnTopo.style.background = '#25D366';
        btnTopo.style.color = 'white';
        btnTopo.style.fontSize = '11px';
        btnTopo.style.padding = '5px';
        btnTopo.style.margin = '0';
        btnTopo.style.flex = '1';
        btnTopo.style.borderRadius = '3px';
        if (index === 0) {
            btnTopo.disabled = true;
            btnTopo.style.opacity = '0.3';
        } else {
            btnTopo.onclick = () => moverFotoParaTopo(index);
        }

        const btnExcluir = document.createElement('button');
        btnExcluir.type = 'button'; 
        btnExcluir.innerHTML = '🗑️';
        btnExcluir.style.background = '#ff4444';
        btnExcluir.style.color = 'white';
        btnExcluir.style.fontSize = '11px';
        btnExcluir.style.padding = '5px';
        btnExcluir.style.margin = '0';
        btnExcluir.style.width = '35px';
        btnExcluir.style.borderRadius = '3px';
        btnExcluir.onclick = () => removerFotoAntiga(index);

        btnContainer.appendChild(btnTopo);
        btnContainer.appendChild(btnExcluir);

        wrapper.appendChild(labelPos);
        wrapper.appendChild(img);
        wrapper.appendChild(btnContainer);
        containerImgs.appendChild(wrapper);
    });
    
    previewSalvas.appendChild(containerImgs);
}

function moverFotoParaTopo(index) {
    if (index === 0) return;
    const foto = fotosAntigasEdicao.splice(index, 1)[0];
    fotosAntigasEdicao.unshift(foto);
    renderizarFotosAntigas();
}

function removerFotoAntiga(index) {
    const urlRemovida = fotosAntigasEdicao.splice(index, 1)[0];
    fotosParaExcluirDoStorage.push(urlRemovida);
    renderizarFotosAntigas();
}
// ==========================================


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

// ABRIR MODO EDIÇÃO (SESSÃO ISOLADA DE BANCO DE DADOS)
function abrirEdicao(id) {
    const imovel = listaImoveisGestao.find(i => i.id === id);
    if(!imovel) return;

    resetarFormularioImovel(); 
    idImovelEditando = imovel.id;
    
    document.getElementById('tituloAbaImovel').innerText = `📝 MODO DE EDIÇÃO (Banco de Dados) - Ref: ${imovel.referencia || imovel.id}`;
    
    const btnIA = document.getElementById('btnGerarIA');
    if(btnIA) btnIA.style.display = 'none';
    
    const lblFotos = document.getElementById('labelFotos');
    if(lblFotos) lblFotos.innerText = 'GESTÃO DE FOTOS (Fique à vontade para adicionar, os envios são acumulados e somados às antigas)';

    fotosAntigasEdicao = [];
    if (imovel.fotos) {
        let raw = imovel.fotos;
        if (Array.isArray(raw)) {
            fotosAntigasEdicao = [...raw];
        } else if (typeof raw === 'string') {
            let clean = raw.trim();
            if (clean.startsWith('{') && clean.endsWith('}')) {
                clean = clean.slice(1, -1);
                if (clean) fotosAntigasEdicao = clean.split(',').map(s => s.replace(/^"|"$/g, '').trim());
            } else if (clean.startsWith('[') && clean.endsWith(']')) {
                try {
                    fotosAntigasEdicao = JSON.parse(clean);
                } catch(e) {
                    clean = clean.slice(1, -1);
                    if (clean) fotosAntigasEdicao = clean.split(',').map(s => s.replace(/^"|"$/g, '').trim());
                }
            } else {
                if (clean) fotosAntigasEdicao = clean.split(',').map(s => s.trim());
            }
        }
    }

    fotosAntigasEdicao = fotosAntigasEdicao.filter(url => typeof url === 'string' && url.length > 5);
    videoAntigoEdicao = imovel.video || null;

    const previewSalvas = document.getElementById('previewFotosSalvas');
    if (previewSalvas) {
        previewSalvas.style.display = 'block';
        renderizarFotosAntigas(); 
    }

    const previewVideoBox = document.getElementById('previewVideoBox');
    if (videoAntigoEdicao && typeof videoAntigoEdicao === 'string' && videoAntigoEdicao.trim() !== '') {
        if (previewVideoBox) previewVideoBox.style.display = 'flex';
        document.getElementById('linkVideoAtual').href = videoAntigoEdicao;
    } else {
        if (previewVideoBox) previewVideoBox.style.display = 'none';
        const vHelp = document.getElementById('videoHelpText');
        if(vHelp) {
            vHelp.style.color = '#ff4444';
            vHelp.innerHTML = '<b>Nenhum vídeo salvo para este imóvel.</b> Selecione um arquivo se desejar adicionar.';
        }
    }

    // Preencher campos textuais E TRAZER OS VALORES DO BANCO COM MÁSCARA
    document.getElementById('imoTitulo').value = imovel.titulo || '';
    document.getElementById('imoTipo').value = imovel.tipo || 'Apartamento';
    document.getElementById('imoFinalidade').value = imovel.finalidade || 'Venda';
    
    document.getElementById('imoVenda').value = imovel.valor_venda ? parseInt(imovel.valor_venda, 10).toLocaleString('pt-BR') : '';
    document.getElementById('imoAluguel').value = imovel.valor_aluguel ? parseInt(imovel.valor_aluguel, 10).toLocaleString('pt-BR') : '';
    document.getElementById('imoCondominio').value = imovel.valor_condominio ? parseInt(imovel.valor_condominio, 10).toLocaleString('pt-BR') : '';
    document.getElementById('imoIptu').value = imovel.valor_iptu ? parseInt(imovel.valor_iptu, 10).toLocaleString('pt-BR') : '';
    
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

    document.getElementById('btnAbaImovel').classList.remove('active'); 
    document.getElementById('btnAbaGestao').classList.remove('active');
    document.getElementById('btnAbaLeads').classList.remove('active');

    document.getElementById('abaGestao').style.display = 'none';
    document.getElementById('abaImovel').style.display = 'block';

    document.getElementById('btnSubmit').innerText = '💾 Atualizar Imóvel (Banco de Dados)';
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
