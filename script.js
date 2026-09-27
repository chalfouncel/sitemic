// --- CONFIGURAÇÃO DO SUPABASE ---
var SUPABASE_URL = 'https://uztsmkhlvoemjbbyebcr.supabase.co';
var SUPABASE_ANON_KEY = 'sb_publishable_nmolEh_G5_hKcfdgy2Xpeg_s4T6ePAz';
var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- LÓGICA DO SPLASH SCREEN & INICIALIZAÇÃO ---
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

    // --- Evento de clique no botão "Buscar" ---
    const btnSearch = document.querySelector('.btn-search');
    if (btnSearch) {
        btnSearch.addEventListener('click', () => {
            const finalidade = document.getElementById('buscaFinalidade') ? document.getElementById('buscaFinalidade').value : 'Todos';
            const tipo = document.getElementById('buscaTipo') ? document.getElementById('buscaTipo').value : 'Todos';
            const localizacao = document.getElementById('buscaLocalizacao') ? document.getElementById('buscaLocalizacao').value.trim() : '';
            const preco = document.getElementById('buscaPreco') ? document.getElementById('buscaPreco').value : 'Qualquer valor';

            document.getElementById('imoveis').scrollIntoView({ behavior: 'smooth' });
            carregarImoveisSite({ finalidade, tipo, localizacao, preco });
        });
    }

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

document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', () => {
        if (navLinks) navLinks.classList.remove('active');
    });
});


// --- LÓGICA DO TYPEBOT (ABRIR E FECHAR) ---
const btnFaleConosco = document.getElementById('btnFaleConoscoBot');
const typebotModal = document.getElementById('typebotModal');

// Abre o bot
if (btnFaleConosco) {
    btnFaleConosco.addEventListener('click', (e) => {
        e.preventDefault(); 
        
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
        
        if (isMobile) {
            // Celular: WhatsApp direto
            const numeroWhatsApp = "5521979748388"; 
            const mensagem = encodeURIComponent("Olá! Vim pelo site e gostaria de conversar com um corretor.");
            window.open(`https://wa.me/${numeroWhatsApp}?text=${mensagem}`, '_blank');
        } else {
            // Computador: Abre o Modal nativo
            if(typebotModal) {
                typebotModal.classList.add('active');
                document.body.style.overflow = 'hidden'; 
            }
        }
    });
}

// Fechamento blindado via função global na janela
window.fecharTypebot = function() {
    const modalTypebot = document.getElementById('typebotModal');
    if (modalTypebot) {
        modalTypebot.classList.remove('active');
        // Só devolve o scroll se não houver outro modal aberto
        const imovelModalAberto = document.querySelector('#imovelModal.active');
        if(!imovelModalAberto) {
            document.body.style.overflow = 'auto'; 
        }
    }
};


// --- FORMULÁRIO DE CONTATO (Envio por E-mail + WhatsApp) ---
const form = document.getElementById('contatoForm');
const formFeedback = document.getElementById('formFeedback');

if (form) {
    form.addEventListener('submit', (e) => {
        e.preventDefault(); 

        const nome = document.getElementById('nomeLead').value;
        const telefone = document.getElementById('telefoneLead').value;
        const email = document.getElementById('emailLead').value;
        const interesse = document.getElementById('interesseLead').value;
        const mensagem = document.getElementById('mensagemLead').value;

        formFeedback.style.display = 'block';
        formFeedback.style.color = 'var(--gold)';
        formFeedback.innerText = 'Processando a sua mensagem...';

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

async function carregarImoveisSite(filtros = null) {
    const grid = document.getElementById('gridImoveis');
    if (!grid) return;

    grid.innerHTML = '<p style="color: var(--gold); text-align: center; width: 100%;">A buscar oportunidades exclusivas...</p>';

    let query = supabase
        .from('imoveis')
        .select('*')
        .in('status', ['Ativo', 'ativo']) 
        .order('created_at', { ascending: false });

    if (filtros) {
        if (filtros.finalidade && filtros.finalidade !== 'Todos') {
            query = query.ilike('finalidade', `%${filtros.finalidade}%`);
        }
        if (filtros.tipo && filtros.tipo !== 'Todos') {
            query = query.eq('tipo', filtros.tipo);
        }
        if (filtros.localizacao) {
            query = query.or(`bairro.ilike.%${filtros.localizacao}%,cidade.ilike.%${filtros.localizacao}%`);
        }
        if (filtros.preco && filtros.preco !== 'Qualquer valor' && !filtros.preco.includes('+')) {
            const valorMaximo = parseInt(filtros.preco.replace(/\D/g, ''));
            if (valorMaximo > 0) {
                if (filtros.finalidade === 'Aluguel') {
                    query = query.lte('valor_aluguel', valorMaximo);
                } else {
                    query = query.lte('valor_venda', valorMaximo);
                }
            }
        }
    }

    const { data, error } = await query;

    if (error) {
        console.error('Erro Supabase:', error);
        grid.innerHTML = '<p style="color: #ff4444; text-align: center; width: 100%;">Não foi possível carregar o portfólio no momento.</p>';
        return;
    }

    if (!data || data.length === 0) {
        grid.innerHTML = '<p style="color: var(--silver); text-align: center; width: 100%;">Nenhum imóvel encontrado com esses filtros.</p>';
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
                <div class="imovel-img" style="${imgCapa}" onclick="window.abrirModal('${imovel.id}')">
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
                        <button onclick="window.abrirModal('${imovel.id}')" class="btn-card">Detalhes →</button>
                    </div>
                </div>
            </div>
        `;
        grid.innerHTML += card;
    });

    const urlParams = new URLSearchParams(window.location.search);
    const idNaUrl = urlParams.get('id');
    if (idNaUrl) {
        setTimeout(() => window.abrirModal(idNaUrl), 100); 
    }
}

// Lógica de abertura do Modal exportada para o window global
window.abrirModal = function(id) {
    const imovel = imoveisCarregados.find(i => i.id === id);
    if(!imovel) {
        console.error("Imóvel não encontrado:", id);
        return;
    }

    const modal = document.getElementById('imovelModal');
    if(!modal) {
        console.error("Elemento imovelModal não encontrado no HTML!");
        return;
    }

    // 1. Textos da direita
    const modalTitulo = document.getElementById('modalTitulo');
    if(modalTitulo) modalTitulo.innerText = imovel.titulo;
    
    const modalLocal = document.getElementById('modalLocal');
    if(modalLocal) modalLocal.innerText = `📍 ${imovel.endereco || ''} ${imovel.numero || ''} - ${imovel.bairro || ''}, ${imovel.cidade || ''} - ${imovel.estado || ''}`;
    
    const modalDesc = document.getElementById('modalDesc');
    if(modalDesc) modalDesc.innerText = imovel.descricao || 'Sem descrição detalhada.';
    
    let precoFormatado = 'Sob Consulta';
    if (imovel.finalidade === 'Venda' && imovel.valor_venda) precoFormatado = `R$ ${Number(imovel.valor_venda).toLocaleString('pt-BR')}`;
    else if (imovel.finalidade === 'Aluguel' && imovel.valor_aluguel) precoFormatado = `R$ ${Number(imovel.valor_aluguel).toLocaleString('pt-BR')}/mês`;
    else if (imovel.finalidade === 'Venda e Aluguel') precoFormatado = imovel.valor_venda ? `R$ ${Number(imovel.valor_venda).toLocaleString('pt-BR')}` : 'Sob Consulta';
    
    const modalPreco = document.getElementById('modalPreco');
    if(modalPreco) modalPreco.innerText = precoFormatado;

    let featuresHtml = '';
    if (imovel.quartos > 0) featuresHtml += `<span>🛏 ${imovel.quartos} Quartos</span>`;
    if (imovel.suites > 0) featuresHtml += `<span>🚿 ${imovel.suites} Suítes</span>`;
    if (imovel.banheiros > 0) featuresHtml += `<span>🚽 ${imovel.banheiros} Banheiros</span>`;
    if (imovel.area_util > 0) featuresHtml += `<span>📐 ${imovel.area_util}m² Útil</span>`;
    if (imovel.area_total > 0) featuresHtml += `<span>📐 ${imovel.area_total}m² Total</span>`;
    if (imovel.vagas > 0) featuresHtml += `<span>🚗 ${imovel.vagas} Vagas</span>`;
    if (imovel.valor_condominio > 0) featuresHtml += `<span>🏢 Cond: R$ ${Number(imovel.valor_condominio).toLocaleString('pt-BR')}</span>`;
    if (imovel.valor_iptu > 0) featuresHtml += `<span>📄 IPTU: R$ ${Number(imovel.valor_iptu).toLocaleString('pt-BR')}</span>`;
    
    const modalFeatures = document.getElementById('modalFeatures');
    if(modalFeatures) modalFeatures.innerHTML = featuresHtml;

    // 2. WhatsApp Dinâmico
    const modalZap = document.getElementById('modalZap');
    if(modalZap) {
        const urlAtual = window.location.origin + window.location.pathname;
        const linkDoImovel = `${urlAtual}?id=${imovel.id}`;
        const refImovel = imovel.referencia ? ` (Ref: ${imovel.referencia})` : '';
        const textoWhatsApp = `Olá! Tenho interesse neste imóvel:\n\n*${imovel.titulo}*${refImovel}\n*Valor:* ${precoFormatado}\n\n*Veja o anúncio aqui:* ${linkDoImovel}`;
        modalZap.href = `https://wa.me/5521979748388?text=${encodeURIComponent(textoWhatsApp)}`;
    }

    // 3. Fotos no Carrossel
    const carousel = document.getElementById('carouselSlides');
    if(carousel) {
        carousel.innerHTML = '';
        if(imovel.fotos && imovel.fotos.length > 0) {
            imovel.fotos.forEach((foto, idx) => {
                carousel.innerHTML += `<img src="${foto}" class="carousel-slide ${idx === 0 ? 'active' : ''}" alt="Foto do imóvel">`;
            });
        } else {
            carousel.innerHTML = `<div class="carousel-slide active" style="background: var(--black-lighter); width:100%; height:100%; display:flex; align-items:center; justify-content:center; color: var(--silver);">Sem fotos</div>`;
        }
        slideAtual = 0;
    }

    // 4. Lógica de Vídeo e Mapa na Mídia Inferior
    const mediaBottom = document.getElementById('mediaBottom');
    const videoThumbnail = document.getElementById('videoThumbnail');
    const lightboxPlayer = document.getElementById('lightboxVideoPlayer');
    const mapFrame = document.getElementById('modalMapFrame');

    if(mapFrame) {
        let enderecoCompleto = '';
        if(imovel.endereco || imovel.bairro) {
            enderecoCompleto = `${imovel.endereco || ''} ${imovel.numero || ''} ${imovel.bairro || ''} ${imovel.cidade || ''} RJ Brasil`;
            mapFrame.src = `https://maps.google.com/maps?q=${encodeURIComponent(enderecoCompleto)}&t=m&z=15&output=embed&iwloc=near`;
        } else {
            mapFrame.src = '';
        }
    }

    if(videoThumbnail && mediaBottom && lightboxPlayer) {
        if (imovel.video) {
            videoThumbnail.style.display = 'flex';
            mediaBottom.style.gridTemplateColumns = '1fr 1fr'; 
            lightboxPlayer.src = imovel.video;
        } else {
            videoThumbnail.style.display = 'none';
            mediaBottom.style.gridTemplateColumns = '1fr'; 
            lightboxPlayer.src = '';
        }
    }

    modal.classList.add('active');
    document.body.style.overflow = 'hidden'; 
};

window.fecharModal = function() {
    const modal = document.getElementById('imovelModal');
    if(modal) modal.classList.remove('active');
    
    // Verifica se o bot não está aberto para devolver o scroll
    const modalTypebot = document.getElementById('typebotModal');
    if(!modalTypebot || !modalTypebot.classList.contains('active')) {
        document.body.style.overflow = 'auto'; 
    }
    
    const urlLimpa = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, urlLimpa);

    const mapFrame = document.getElementById('modalMapFrame');
    if(mapFrame) mapFrame.src = '';
    window.fecharVideoPlayer();
};

window.mudarSlide = function(direcao) {
    const slides = document.querySelectorAll('.carousel-slide');
    if(slides.length === 0) return;
    
    slides[slideAtual].classList.remove('active');
    slideAtual += direcao;
    
    if(slideAtual >= slides.length) slideAtual = 0;
    if(slideAtual < 0) slideAtual = slides.length - 1;
    
    slides[slideAtual].classList.add('active');
};

// --- FUNÇÕES DO LIGHTBOX DE VÍDEO ---
window.abrirVideoPlayer = function() {
    const lightbox = document.getElementById('videoLightbox');
    const player = document.getElementById('lightboxVideoPlayer');
    
    if(lightbox && player) {
        lightbox.classList.add('active');
        player.play().catch(error => {
            console.log("Autoplay bloqueado pelo navegador, aguardando clique do usuário.");
        });
    }
};

window.fecharVideoPlayer = function() {
    const lightbox = document.getElementById('videoLightbox');
    const player = document.getElementById('lightboxVideoPlayer');
    
    if(lightbox && player) {
        lightbox.classList.remove('active');
        player.pause();
    }
};

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
