// Configuração do Supabase
var SUPABASE_URL = 'https://uztsmkhlvoemjbbyebcr.supabase.co';
var SUPABASE_ANON_KEY = 'sb_publishable_nmolEh_G5_hKcfdgy2Xpeg_s4T6ePAz';
var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const loginSection = document.getElementById('loginSection');
const dashboardSection = document.getElementById('dashboardSection');

// Verifica sessão
async function checarSessao() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        loginSection.style.display = 'none';
        dashboardSection.style.display = 'block';
    } else {
        loginSection.style.display = 'block';
        dashboardSection.style.display = 'none';
    }
}

// Lógica de Login
async function fazerLogin() {
    const email = document.getElementById('loginEmail').value;
    const senha = document.getElementById('loginSenha').value;
    const msg = document.getElementById('loginMsg');
    
    msg.style.display = 'block';
    msg.style.color = 'var(--gold)';
    msg.innerText = 'A verificar credenciais...';

    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: senha,
    });

    if (error) {
        msg.style.color = '#ff4444';
        msg.innerText = 'Acesso negado. Verifique o e-mail e a senha.';
    } else {
        msg.style.display = 'none';
        checarSessao();
    }
}

// Lógica de Logout
async function fazerLogout() {
    await supabase.auth.signOut();
    checarSessao();
}

// Lógica de Fotos e Marca D'água
let fotosProcessadas = [];

document.getElementById('imoFotos').addEventListener('change', async function(e) {
    const previewContainer = document.getElementById('previewFotos');
    previewContainer.innerHTML = '<span style="color: var(--gold);">A processar imagens com marca de água...</span>';
    fotosProcessadas = [];
    
    const files = e.target.files;
    if(files.length === 0) {
        previewContainer.innerHTML = '';
        return;
    }

    // Carrega a marca de água (usando .png ou .jpg dependendo de como está salvo no repositório)
    const marcaDagua = new Image();
    marcaDagua.src = 'marca-dagua.png'; // Se a imagem falhar, renomeie para marca-dagua.jpg no repositório
    
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

        // Desenha a foto original
        ctx.drawImage(img, 0, 0);

        // Desenha a marca de água no centro, com 40% de opacidade
        if (marcaDagua.width > 0) {
            ctx.globalAlpha = 0.4; 
            const wmWidth = canvas.width * 0.4; // Ocupa 40% da largura da foto
            const wmHeight = (marcaDagua.height / marcaDagua.width) * wmWidth;
            const dx = (canvas.width - wmWidth) / 2;
            const dy = (canvas.height - wmHeight) / 2;
            ctx.drawImage(marcaDagua, dx, dy, wmWidth, wmHeight);
            ctx.globalAlpha = 1.0;
        }

        // Converte para ficheiro novamente
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
        const processedFile = new File([blob], file.name, { type: 'image/jpeg' });
        fotosProcessadas.push(processedFile);

        // Adiciona miniatura no ecrã
        const previewImg = document.createElement('img');
        previewImg.src = URL.createObjectURL(blob);
        previewContainer.appendChild(previewImg);
    }
});

// Lógica de Inserção de Imóveis
const formImovel = document.getElementById('formImovel');
if (formImovel) {
    formImovel.addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = document.getElementById('imovelMsg');
        msg.style.color = 'var(--gold)';
        msg.innerText = 'A enviar fotos e gravar imóvel (Isto pode demorar uns segundos)...';

        // 1. Fazer upload das fotos primeiro
        const fotosUrls = [];
        for(let file of fotosProcessadas) {
            const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('imoveis_fotos')
                .upload(fileName, file);
            
            if(!uploadError) {
                const { data: publicUrlData } = supabase.storage
                    .from('imoveis_fotos')
                    .getPublicUrl(fileName);
                fotosUrls.push(publicUrlData.publicUrl);
            }
        }

        // 2. Prepara os dados para a tabela imoveis
        const payload = {
            titulo: document.getElementById('imoTitulo').value,
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
            cep: document.getElementById('imoCep').value,
            endereco: document.getElementById('imoEndereco').value,
            numero: document.getElementById('imoNumero').value,
            complemento: document.getElementById('imoComplemento').value,
            bairro: document.getElementById('imoBairro').value,
            cidade: document.getElementById('imoCidade').value,
            estado: document.getElementById('imoEstado').value,
            descricao: document.getElementById('imoDescricao').value,
            fotos: fotosUrls,
            status: 'Ativo'
        };

        // 3. Gravar na base de dados
        const { error } = await supabase.from('imoveis').insert([payload]);

        if (error) {
            console.error(error);
            msg.style.color = '#ff4444';
            msg.innerText = 'Ocorreu um erro ao gravar o imóvel.';
        } else {
            msg.style.color = '#25D366'; // Verde
            msg.innerText = 'Imóvel e fotos guardados com sucesso!';
            formImovel.reset();
            document.getElementById('previewFotos').innerHTML = '';
            fotosProcessadas = [];
            
            setTimeout(() => { msg.innerText = ''; }, 4000);
        }
    });
}

checarSessao();
