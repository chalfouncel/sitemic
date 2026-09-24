// --- LÓGICA DO SPLASH SCREEN ---
document.addEventListener("DOMContentLoaded", () => {
    const splashScreen = document.getElementById('splashScreen');
    const splashVideo = document.getElementById('splashVideo');
    const btnSkip = document.getElementById('skipSplash');

    if (splashScreen && splashVideo) {
        // Quando o vídeo acabar, esconde o splash screen
        splashVideo.addEventListener('ended', fecharSplash);
        
        // Se clicar no botão de pular, esconde o splash screen
        if(btnSkip) {
            btnSkip.addEventListener('click', fecharSplash);
        }
    }

    function fecharSplash() {
        splashScreen.style.opacity = '0';
        document.body.classList.remove('no-scroll');
        
        // Remove do DOM após a transição
        setTimeout(() => {
            splashScreen.style.display = 'none';
        }, 1000); // tempo que bate com a transição de opacity no CSS
    }
});
