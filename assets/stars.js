const canvas = document.getElementById('starsCanvas');
const ctx = canvas.getContext('2d');
const loadingText = document.getElementById('loadingText');

// Set canvas size initially
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
const palette = [
    [150, 143, 187],
    [23, 19, 43],
    [90, 90, 90],
]

// Resize canvas when the window is resized
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    drawStars();
});

// Function to draw colorful stars
function drawStars() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < 300; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const radius = Math.random() * 3;

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgb(${palette[Math.floor(Math.random() * palette.length)]})`;
        ctx.fill();
        ctx.closePath();
    }
}

// Initial draw
drawStars();

// Simulate loading process (you can replace this with your actual loading logic)
let currentDots = 0;
const loadingInterval = setInterval(() => {
    loadingText.textContent = `Building${'.'.repeat((++currentDots) % 4)}`;
}, 200);