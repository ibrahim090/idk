
function initCarousel() {
    console.log("DEBUG: initCarousel init");
    const slides = document.querySelectorAll('.carousel-slide');
    const dots = document.querySelectorAll('.carousel-dot');
    console.log(`DEBUG: Found ${slides.length} slides, ${dots.length} dots`);

    let currentSlide = 0;
    let interval;

    if (slides.length === 0) return;

    // Show first slide initially
    slides[0].classList.add('active');

    const showSlide = (index) => {
        // Remove active from all
        slides.forEach(s => s.classList.remove('active'));
        dots.forEach(d => d.classList.remove('active'));

        // Add to current
        slides[index].classList.add('active');
        dots[index].classList.add('active');
        currentSlide = index;
    };

    const nextSlide = () => {
        let next = currentSlide + 1;
        if (next >= slides.length) next = 0;
        showSlide(next);
    };

    const startTimer = () => {
        interval = setInterval(nextSlide, 5000);
    };

    const stopTimer = () => {
        clearInterval(interval);
    };

    // Manual Navigation
    dots.forEach((dot, idx) => {
        dot.addEventListener('click', () => {
            stopTimer();
            showSlide(idx);
            startTimer();
        });
    });

    // Pause on Hover (optional, good for UX)
    const container = document.getElementById('hero-carousel');
    if (container) {
        container.addEventListener('mouseenter', stopTimer);
        container.addEventListener('mouseleave', startTimer);
    }

    // Start
    startTimer();
}
