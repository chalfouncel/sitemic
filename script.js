// --- CONFIGURAÇÃO DO SUPABASE ---
var SUPABASE_URL = 'https://uztsmkhlvoemjbbyebcr.supabase.co';
var SUPABASE_ANON_KEY = 'sb_publishable_nmolEh_G5_hKcfdgy2Xpeg_s4T6ePAz';
var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- LÓGICA DO SPLASH SCREEN ---
document.addEventListener("DOMContentLoaded", () => {
    const splashScreen = document.getElementById('splashScreen');
    const splashVideo = document.getElementById('splashVideo');
    const btnSkip = document.getElementById('skipSplash');

    if (splashScreen && splashVideo) {
        splashVideo.addEventListener('ended', fecharSplash);
        if(btnSkip) {
            btnSkip.addEventListener('click', fecharSplash);
        }
    }

    function fecharSplash() {
        splashScreen.style.opacity = '0';
        document.body.classList.remove('no-scroll');
        setTimeout(() => {
            splashScreen.style.display = 'none';
        }, 1000);
    }

    // Carrega os imóveis assim que a página abre
    carregarImoveisSite();
});

// Navbar scroll effect
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

// Mobile menu toggle
const menuToggle = document.getElementById('menuToggle');
const navLinks = document.getElementById('navLinks');
if (menuToggle) {
    menuToggle.addEventListener('click', () => {
        navLinks.classList.toggle('active');
    });
}

// Close mobile menu on link click
document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', () => {
        if (navLinks) navLinks.classList.remove('active');
    });
});

// --- FORMULÁRIO DE CONTATO (Envio por E-mail + WhatsApp) ---
const form = document.getElementById('contatoForm');
const formFeedback = document.getElementById('formFeedback');

if (form) {
    form.addEventListener('submit', (e) => {
        e.preventDefault(); // Evita recarregar a página

        // Puxa os valores dos campos
        const nome = document.getElementById('nomeLead').value;
        const telefone = document.getElementById('telefoneLead').value;
        const email = document.getElementById('emailLead').value;
        const interesse = document.getElementById('interesseLead').value;
        const mensagem = document.getElementById('mensagemLead').value;

        // Feedback na tela
        formFeedback.style.display = 'block';
        formFeedback.style.color = 'var(--gold)';
        formFeedback.innerText = 'Processando a sua mensagem...';

        // Envia via FormSubmit de forma invisível
        fetch("https://formsubmit.co/ajax/chalfouncorretor@gmail.com", {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                Nome: nome,
                Telefone: telefone,
                Email: email,
                Interesse: interesse,
                Mensagem: mensagem
            })
        })
        .then(response => response.json())
        .then(data => {
            // Se o e-mail enviar com sucesso, formata e abre o WhatsApp
            const msgWp = `*Novo Lead via Site M&IC*\n\n*Nome:* ${nome}\n*Telefone:* ${telefone}\n*E-mail:* ${email}\n*Interesse:* ${interesse}\n*Mensagem:* ${mensagem}`;
            const urlWp = `https://wa.me/5521979748388?text=${encodeURIComponent(msgWp)}`;

            formFeedback.innerText = 'Tudo certo! Redirecionando para o WhatsApp...';

            setTimeout(() => {
                window.open(urlWp, '_blank');
                form.reset();
                formFeedback.style.display = 'none';
            }, 1500);
        })
        .catch(error => {
            console.error('Erro no FormSubmit:', error);
            // Fallback: Se der erro no e-mail, pelo menos salva o lead enviando direto pro WhatsApp
            const msgWp = `*Novo Lead via Site M&IC*\n\n*Nome:* ${nome}\n*Telefone:* ${telefone}\n*E-mail:* ${email}\n*Interesse:* ${interesse}\n*Mensagem:* ${mensagem}`;
            const urlWp = `https://wa.me/5521979748388?text=${encodeURIComponent(msgWp)}`;
            
            window.open(urlWp, '_blank');
            form.reset();
            formFeedback.style.display = 'none';
        });
    });
}

// --- CARREGAMENTO DINÂMICO DE IMÓVEIS E MODAL ---
let imoveisCarregados = [];
let slideAtual = 0;

async function carregarImoveisSite() {
    const grid = document.getElementById('gridImoveis');
    if (!grid) return;

    grid.innerHTML = '<p style="color: var(--gold); text-align: center; width: 100%;">A buscar oportunidades exclusivas...</p>';

    // Puxa todos os imóveis
    const { data, error } = await supabase
        .from('imoveis')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Erro Supabase:', error);
        grid.innerHTML = '<p style="color: #ff4444; text-align: center; width: 100%;">Não foi possível carregar o portfólio no momento.</p>';
        return;
    }

    if (!data || data.length === 0) {
        grid.innerHTML = '<p style="color: var(--silver); text-align: center; width: 100%;">Nenhum imóvel disponível no momento.</p>';
        return;
    }

    imoveisCarregados = data;
    grid.innerHTML = '';
    
    data.forEach(imovel => {
        let imgCapa = '';
        if (imovel.fotos && imovel.fotos.length > 0) {
            imgCapa = `background-image: url('${imovel.fotos[0]}'); background-size: cover; background-position: center;`;
        } else {
            imgCapa = `background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);`;
        }

        let precoFormatado = 'Sob Consulta';
        if (imovel.finalidade === 'Venda' && imovel.valor_venda) {
            precoFormatado = `R$ ${Number(imovel.valor_venda).toLocaleString('pt-BR')}`;
        } else if (imovel.finalidade === 'Aluguel' && imovel.valor_aluguel) {
            precoFormatado = `R$ ${Number(imovel.valor_aluguel).toLocaleString('pt-BR')}/mês`;
        } else if (imovel.finalidade === 'Venda e Aluguel') {
            precoFormatado = imovel.valor_venda ? `R$ ${Number(imovel.valor_venda).toLocaleString('pt-BR')}` : 'Sob Consulta';
        }

        const destaqueHtml = imovel.destaque ? `<span class="imovel-tag destaque" style="margin-left: 8px;">Destaque</span>` : '';

        let featuresHtml = '';
        if (imovel.quartos > 0) featuresHtml += `<span>🛏 ${imovel.quartos} Quartos</span>`;
        if (imovel.area_util > 0) featuresHtml += `<span>📐 ${imovel.area_util}m²</span>`;
        if (imovel.vagas > 0) featuresHtml += `<span>🚗 ${imovel.vagas} Vagas</span>`;

        const card = `
            <div class="imovel-card">
                <div class="imovel-img" style="${imgCapa}" onclick="abrirModal('${imovel.id}')">
                    <div style="position:absolute; top:16px; left:16px;">
                        <span class="imovel-tag">${imovel.finalidade || 'Venda'}</span>
                        ${destaqueHtml}
                    </div>
                </div>
                <div class="imovel-info">
                    <h3>${imovel.titulo}</h3>
                    <p class="imovel-local">📍 ${imovel.bairro || 'Localização não informada'}, ${imovel.cidade || ''}</p>
                    <div class="imovel-features">
                        ${featuresHtml}
                    </div>
                    <div class="imovel-footer">
                        <span class="imovel-price">${precoFormatado}</span>
                        <button onclick="abrirModal('${imovel.id}')" class="btn-card">Detalhes →</button>
                    </div>
                </div>
            </div>
        `;
        grid.innerHTML += card;
    });
}

// Lógica de abertura do Modal
function abrirModal(id) {
    const imovel = imoveisCarregados.find(i => i.id === id);
    if(!imovel) return;

    document.getElementById('modalTitulo').innerText = imovel.titulo;
    document.getElementById('modalLocal').innerText = `📍 ${imovel.endereco || ''} ${imovel.numero || ''} - ${imovel.bairro || ''}, ${imovel.cidade || ''} - ${imovel.estado || ''}`;
    document.getElementById('modalDesc').innerText = imovel.descricao || 'Sem descrição detalhada.';
    
    let precoFormatado = 'Sob Consulta';
    if (imovel.finalidade === 'Venda' && imovel.valor_venda) precoFormatado = `R$ ${Number(imovel.valor_venda).toLocaleString('pt-BR')}`;
    else if (imovel.finalidade === 'Aluguel' && imovel.valor_aluguel) precoFormatado = `R$ ${Number(imovel.valor_aluguel).toLocaleString('pt-BR')}/mês`;
    else if (imovel.finalidade === 'Venda e Aluguel') precoFormatado = imovel.valor_venda ? `R$ ${Number(imovel.valor_venda).toLocaleString('pt-BR')}` : 'Sob Consulta';
    document.getElementById('modalPreco').innerText = precoFormatado;

    let featuresHtml = '';
    if (imovel.quartos > 0) featuresHtml += `<span>🛏 ${imovel.quartos} Quartos</span>`;
    if (imovel.suites > 0) featuresHtml += `<span>🚿 ${imovel.suites} Suítes</span>`;
    if (imovel.banheiros > 0) featuresHtml += `<span>🚽 ${imovel.banheiros} Banheiros</span>`;
    if (imovel.area_util > 0) featuresHtml += `<span>📐 ${imovel.area_util}m² Útil</span>`;
    if (imovel.area_total > 0) featuresHtml += `<span>📐 ${imovel.area_total}m² Total</span>`;
    if (imovel.vagas > 0) featuresHtml += `<span>🚗 ${imovel.vagas} Vagas</span>`;
    if (imovel.valor_condominio > 0) featuresHtml += `<span>🏢 Cond: R$ ${Number(imovel.valor_condominio).toLocaleString('pt-BR')}</span>`;
    if (imovel.valor_iptu > 0) featuresHtml += `<span>📄 IPTU: R$ ${Number(imovel.valor_iptu).toLocaleString('pt-BR')}</span>`;
    document.getElementById('modalFeatures').innerHTML = featuresHtml;

    const msgZap = encodeURIComponent(`Olá, tenho interesse no imóvel: ${imovel.titulo} (${precoFormatado})`);
    document.getElementById('modalZap').href = `https://wa.me/5521979748388?text=${msgZap}`;

    const carousel = document.getElementById('carouselSlides');
    carousel.innerHTML = '';
    if(imovel.fotos && imovel.fotos.length > 0) {
        imovel.fotos.forEach((foto, idx) => {
            carousel.innerHTML += `<img src="${foto}" class="carousel-slide ${idx === 0 ? 'active' : ''}" alt="Foto do imóvel">`;
        });
    } else {
        carousel.innerHTML = `<div class="carousel-slide active" style="background: var(--black-lighter); width:100%; height:100%; display:flex; align-items:center; justify-content:center; color: var(--silver);">Sem fotos</div>`;
    }

    slideAtual = 0;
    document.getElementById('imovelModal').classList.add('active');
    document.body.style.overflow = 'hidden'; 
}

function fecharModal() {
    document.getElementById('imovelModal').classList.remove('active');
    document.body.style.overflow = 'auto'; 
}

function mudarSlide(direcao) {
    const slides = document.querySelectorAll('.carousel-slide');
    if(slides.length === 0) return;
    
    slides[slideAtual].classList.remove('active');
    slideAtual += direcao;
    
    if(slideAtual >= slides.length) slideAtual = 0;
    if(slideAtual < 0) slideAtual = slides.length - 1;
    
    slides[slideAtual].classList.add('active');
}

// Smooth reveal on scroll
const revealElements = document.querySelectorAll('.imovel-card, .servico-card, .feature');
const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, { threshold: 0.1 });

revealElements.forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'all 0.6s ease';
    revealObserver.observe(el);
});
