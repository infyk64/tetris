// === CONSTANTS ===
        const COLS = 10;
        const ROWS = 20;
        const BLOCK_SIZE = 30;
        
        const SHAPES = [
            [[1,1,1,1]], // I
            [[1,1],[1,1]], // O
            [[0,1,0],[1,1,1]], // T
            [[1,0,0],[1,1,1]], // L
            [[0,0,1],[1,1,1]], // J
            [[0,1,1],[1,1,0]], // S
            [[1,1,0],[0,1,1]]  // Z
        ];
        
        const COLORS = [
            '#00f0f0', '#f0f000', '#a000f0', '#f0a000',
            '#0000f0', '#00f000', '#f00000'
        ];

        // === GAME STATE ===
        const canvas = document.getElementById('tetris');
        const ctx = canvas.getContext('2d');
        const nextCanvas = document.getElementById('next');
        const nextCtx = nextCanvas.getContext('2d');
        const holdCanvas = document.getElementById('hold');
        const holdCtx = holdCanvas.getContext('2d');
        
        let board = Array(ROWS).fill().map(() => Array(COLS).fill(0));
        let score = 0;
        let lines = 0;
        let level = 1;
        let gameLoop;
        let dropCounter = 0;
        let dropInterval = 1000;
        let lastTime = 0;
        let gameRunning = false;
        let gamePaused = false;
        let currentPiece = null;
        let nextPiece = null;
        let holdPiece = null;
        let canHold = true;
        let combo = 0;
        let soundEnabled = true;
        let gameMode = 'classic';
        let startTime = 0;
        let timerInterval = null;

        // === AUDIO CONTEXT ===
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

        function playSound(frequency, duration, type = 'sine') {
            if (!soundEnabled) return;
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            oscillator.frequency.value = frequency;
            oscillator.type = type;
            gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
            oscillator.start(audioCtx.currentTime);
            oscillator.stop(audioCtx.currentTime + duration);
        }

        // === PIECE CLASS ===
        class Piece {
            constructor(shape, color) {
                this.shape = shape;
                this.color = color;
                this.x = Math.floor(COLS / 2) - Math.floor(shape[0].length / 2);
                this.y = 0;
            }
            
            draw(context, offsetX = 0, offsetY = 0, blockSize = BLOCK_SIZE, alpha = 1) {
                context.globalAlpha = alpha;
                context.fillStyle = this.color;
                this.shape.forEach((row, y) => {
                    row.forEach((value, x) => {
                        if (value) {
                            context.fillRect(
                                (this.x + x) * blockSize + offsetX,
                                (this.y + y) * blockSize + offsetY,
                                blockSize - 1,
                                blockSize - 1
                            );
                        }
                    });
                });
                context.globalAlpha = 1;
            }
            
            drawPreview(context, width, height) {
                const blockSize = 20;
                const offsetX = (width - this.shape[0].length * blockSize) / 2;
                const offsetY = (height - this.shape.length * blockSize) / 2;
                context.fillStyle = this.color;
                this.shape.forEach((row, y) => {
                    row.forEach((value, x) => {
                        if (value) {
                            context.fillRect(
                                x * blockSize + offsetX,
                                y * blockSize + offsetY,
                                blockSize - 2,
                                blockSize - 2
                            );
                        }
                    });
                });
            }
            
            move(dir) {
                this.x += dir;
                if (this.collides()) {
                    this.x -= dir;
                    return false;
                }
                playSound(200, 0.05);
                return true;
            }
            
            rotate() {
                const rotated = this.shape[0].map((_, i) =>
                    this.shape.map(row => row[i]).reverse()
                );
                const prevShape = this.shape;
                this.shape = rotated;
                
                let offset = 1;
                while (this.collides()) {
                    this.x += offset;
                    offset = -(offset + (offset > 0 ? 1 : -1));
                    if (offset > this.shape[0].length) {
                        this.shape = prevShape;
                        return;
                    }
                }
                playSound(300, 0.1);
            }
            
            drop() {
                this.y++;
                if (this.collides()) {
                    this.y--;
                    return false;
                }
                return true;
            }
            
            collides() {
                return this.shape.some((row, dy) =>
                    row.some((value, dx) => {
                        if (!value) return false;
                        const newX = this.x + dx;
                        const newY = this.y + dy;
                        return (
                            newX < 0 ||
                            newX >= COLS ||
                            newY >= ROWS ||
                            (newY >= 0 && board[newY][newX])
                        );
                    })
                );
            }
            
            hardDrop() {
                let distance = 0;
                while (this.drop()) {
                    distance++;
                }
                return distance;
            }

            getGhostY() {
                let ghostY = this.y;
                while (true) {
                    this.y++;
                    if (this.collides()) {
                        this.y--;
                        break;
                    }
                }
                const result = this.y;
                this.y = ghostY;
                return result;
            }
        }

        // === GAME FUNCTIONS ===
        function createPiece() {
            const index = Math.floor(Math.random() * SHAPES.length);
            return new Piece(SHAPES[index], COLORS[index]);
        }

        function drawGhost() {
            if (!currentPiece) return;
            const ghostY = currentPiece.getGhostY();
            const originalY = currentPiece.y;
            currentPiece.y = ghostY;
            currentPiece.draw(ctx, 0, 0, BLOCK_SIZE, 0.3);
            currentPiece.y = originalY;
        }
        
        function drawBoard() {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            board.forEach((row, y) => {
                row.forEach((value, x) => {
                    if (value) {
                        ctx.fillStyle = COLORS[value - 1];
                        ctx.fillRect(
                            x * BLOCK_SIZE,
                            y * BLOCK_SIZE,
                            BLOCK_SIZE - 1,
                            BLOCK_SIZE - 1
                        );
                    }
                });
            });
            
            if (currentPiece) {
                drawGhost();
                currentPiece.draw(ctx);
            }
        }
        
        function drawNext() {
            nextCtx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
            if (nextPiece) {
                nextPiece.drawPreview(nextCtx, nextCanvas.width, nextCanvas.height);
            }
        }

        function drawHold() {
            holdCtx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            holdCtx.fillRect(0, 0, holdCanvas.width, holdCanvas.height);
            if (holdPiece) {
                holdPiece.drawPreview(holdCtx, holdCanvas.width, holdCanvas.height);
            }
        }

        function holdCurrentPiece() {
            if (!canHold || !currentPiece) return;
            
            playSound(400, 0.1);
            
            if (holdPiece === null) {
                holdPiece = new Piece(currentPiece.shape, currentPiece.color);
                currentPiece = nextPiece;
                nextPiece = createPiece();
            } else {
                const temp = new Piece(holdPiece.shape, holdPiece.color);
                holdPiece = new Piece(currentPiece.shape, currentPiece.color);
                currentPiece = temp;
            }
            
            canHold = false;
            drawHold();
            drawNext();
        }
        
        function merge() {
            currentPiece.shape.forEach((row, y) => {
                row.forEach((value, x) => {
                    if (value) {
                        const boardY = currentPiece.y + y;
                        const boardX = currentPiece.x + x;
                        if (boardY >= 0) {
                            board[boardY][boardX] = COLORS.indexOf(currentPiece.color) + 1;
                        }
                    }
                });
            });
            playSound(150, 0.2);
        }

        function createParticles(y) {
            const container = document.querySelector('.game-area');
            for (let i = 0; i < 20; i++) {
                const particle = document.createElement('div');
                particle.className = 'particle';
                particle.style.left = canvas.offsetLeft + Math.random() * canvas.width + 'px';
                particle.style.top = canvas.offsetTop + y * BLOCK_SIZE + 'px';
                particle.style.background = COLORS[Math.floor(Math.random() * COLORS.length)];
                particle.style.setProperty('--tx', (Math.random() - 0.5) * 200 + 'px');
                particle.style.setProperty('--ty', (Math.random() - 0.5) * 200 + 'px');
                container.appendChild(particle);
                setTimeout(() => particle.remove(), 1000);
            }
        }

        function showCombo(lines) {
            if (lines < 2) return;
            const comboDiv = document.createElement('div');
            comboDiv.className = 'combo-display';
            comboDiv.textContent = lines === 4 ? 'TETRIS!' : `${lines}x COMBO!`;
            document.querySelector('.game-area').appendChild(comboDiv);
            setTimeout(() => comboDiv.remove(), 1000);
        }
        
        function clearLines() {
            let linesCleared = 0;
            const clearedRows = [];
            
            for (let y = ROWS - 1; y >= 0; y--) {
                let isFull = true;
                for (let x = 0; x < COLS; x++) {
                    if (!board[y][x]) {
                        isFull = false;
                        break;
                    }
                }
                if (isFull) {
                    clearedRows.push(y);
                    linesCleared++;
                }
            }
            
            if (linesCleared > 0) {
                clearedRows.forEach(y => createParticles(y));
                
                setTimeout(() => {
                    clearedRows.forEach(y => {
                        board.splice(y, 1);
                        board.unshift(Array(COLS).fill(0));
                    });
                }, 200);

                combo++;
                lines += linesCleared;
                const comboMultiplier = Math.min(combo, 10);
                score += [40, 100, 300, 1200][linesCleared - 1] * level * comboMultiplier;
                
                if (combo > 1) {
                    document.getElementById('comboBox').style.display = 'block';
                    document.getElementById('combo').textContent = combo;
                }
                
                showCombo(linesCleared);
                playSound(523 + linesCleared * 100, 0.3, 'square');
                
                level = Math.floor(lines / 10) + (parseInt(document.getElementById('startLevel').value) - 1);
                dropInterval = Math.max(100, 1000 - (level - 1) * 80);
                updateDisplay();
                checkWinCondition();
            } else {
                combo = 0;
                document.getElementById('comboBox').style.display = 'none';
            }
        }

        function checkWinCondition() {
            if (gameMode === 'marathon' && lines >= 150) {
                gameOver(true);
            } else if (gameMode === 'sprint' && lines >= 40) {
                gameOver(true);
            }
        }

        function updateTimer() {
            if (!gameRunning || gamePaused) return;
            const elapsed = Date.now() - startTime;
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            document.getElementById('timer').textContent = 
                `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }
        
        function updateDisplay() {
            document.getElementById('score').textContent = score;
            document.getElementById('level').textContent = level;
            
            let linesText = lines;
            if (gameMode === 'marathon') linesText += ' / 150';
            else if (gameMode === 'sprint') linesText += ' / 40';
            else linesText += ' / ∞';
            document.getElementById('lines').textContent = linesText;
        }
        
        function gameOver(win = false) {
            gameRunning = false;
            cancelAnimationFrame(gameLoop);
            clearInterval(timerInterval);
            
            document.getElementById('finalScore').textContent = score;
            document.getElementById('finalLines').textContent = lines;
            
            if (gameMode === 'sprint') {
                const elapsed = Date.now() - startTime;
                const minutes = Math.floor(elapsed / 60000);
                const seconds = Math.floor((elapsed % 60000) / 1000);
                document.getElementById('finalTime').style.display = 'block';
                document.getElementById('finalTimeValue').textContent = 
                    `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            }
            
            saveScore();
            document.getElementById('gameOver').classList.add('show');
            
            if (win) {
                playSound(523, 0.2);
                setTimeout(() => playSound(659, 0.2), 150);
                setTimeout(() => playSound(784, 0.3), 300);
            } else {
                playSound(200, 0.5, 'sawtooth');
            }
        }

        async function saveScore() {
            try {
                const timestamp = Date.now();
                const scoreData = {
                    score,
                    lines,
                    level,
                    mode: gameMode,
                    date: new Date().toLocaleDateString('ru-RU')
                };
                
                await window.storage.set(`score:${timestamp}`, JSON.stringify(scoreData));
                await loadLeaderboard();
            } catch (e) {
                console.log('Не удалось сохранить результат');
            }
        }

        async function loadLeaderboard() {
            try {
                const result = await window.storage.list('score:');
                if (!result || !result.keys) {
                    document.getElementById('leaderboard').innerHTML = 
                    '<div style="text-align: center; opacity: 0.7;">Нет записей</div>';
                return;
                }
                
                const scores = await Promise.all(
                    result.keys.map(async key => {
                        const data = await window.storage.get(key);
                        return JSON.parse(data.value);
                    })
                );
                
                scores.sort((a, b) => b.score - a.score);
                const top5 = scores.slice(0, 5);
                
                const html = top5.map((s, i) => `
                    <div class="leaderboard-entry">
                        <span>${i + 1}. ${s.mode === 'marathon' ? '🏃' : s.mode === 'sprint' ? '⚡' : '🎮'}</span>
                        <span>${s.score}</span>
                    </div>
                `).join('');
                
                document.getElementById('leaderboard').innerHTML = html || 
                    '<div style="text-align: center; opacity: 0.7;">Нет записей</div>';
            } catch (e) {
                console.log('Не удалось загрузить таблицу лидеров');
            }
        }
        
        function update(time = 0) {
            if (!gameRunning || gamePaused) return;
            
            const deltaTime = time - lastTime;
            lastTime = time;
            dropCounter += deltaTime;
            
            if (dropCounter > dropInterval) {
                if (!currentPiece.drop()) {
                    merge();
                    clearLines();
                    currentPiece = nextPiece;
                    nextPiece = createPiece();
                    canHold = true;
                    drawNext();
                    
                    if (currentPiece.collides()) {
                        gameOver();
                        return;
                    }
                }
                dropCounter = 0;
            }
            
            drawBoard();
            gameLoop = requestAnimationFrame(update);
        }
        
        function startGame() {
            board = Array(ROWS).fill().map(() => Array(COLS).fill(0));
            score = 0;
            lines = 0;
            combo = 0;
            level = parseInt(document.getElementById('startLevel').value);
            dropInterval = Math.max(100, 1000 - (level - 1) * 80);
            dropCounter = 0;
            lastTime = 0;
            gameRunning = true;
            gamePaused = false;
            canHold = true;
            holdPiece = null;
            
            gameMode = document.getElementById('gameMode').value;
            soundEnabled = document.getElementById('soundToggle').checked;
            
            let modeText = 'Классический';
            if (gameMode === 'marathon') modeText = 'Марафон (150 линий)';
            else if (gameMode === 'sprint') modeText = 'Спринт (40 линий)';
            document.getElementById('gameModeDisplay').textContent = `Режим: ${modeText}`;
            
            if (gameMode === 'sprint') {
                document.getElementById('timerBox').style.display = 'block';
                startTime = Date.now();
                timerInterval = setInterval(updateTimer, 100);
            } else {
                document.getElementById('timerBox').style.display = 'none';
            }
            
            currentPiece = createPiece();
            nextPiece = createPiece();
            
            updateDisplay();
            drawNext();
            drawHold();
            drawBoard();
            
            document.getElementById('gameOver').classList.remove('show');
            document.getElementById('gameMenu').classList.remove('show');
            document.getElementById('comboBox').style.display = 'none';
            
            gameLoop = requestAnimationFrame(update);
        }
        
        function togglePause() {
            if (!gameRunning) return;
            
            gamePaused = !gamePaused;
            const pauseBtn = document.getElementById('pauseBtn');
            
            if (gamePaused) {
                pauseBtn.textContent = 'Продолжить';
                cancelAnimationFrame(gameLoop);
                if (timerInterval) clearInterval(timerInterval);
            } else {
                pauseBtn.textContent = 'Пауза';
                lastTime = performance.now();
                dropCounter = 0;
                if (gameMode === 'sprint') {
                    timerInterval = setInterval(updateTimer, 100);
                }
                gameLoop = requestAnimationFrame(update);
            }
            playSound(440, 0.1);
        }

        function showMenu() {
            gameRunning = false;
            gamePaused = false;
            cancelAnimationFrame(gameLoop);
            if (timerInterval) clearInterval(timerInterval);
            document.getElementById('gameOver').classList.remove('show');
            document.getElementById('gameMenu').classList.add('show');
        }

        function toggleTheme() {
            document.body.classList.toggle('light-theme');
            const btn = document.getElementById('themeToggle');
            btn.textContent = document.body.classList.contains('light-theme') ? '☀️' : '🌙';
            playSound(330, 0.1);
        }
        
        document.addEventListener('keydown', e => {
            if (!gameRunning || !currentPiece || gamePaused) {
                if (e.key === 'p' || e.key === 'P') togglePause();
                return;
            }
            
            switch(e.key.toLowerCase()) {
                case 'arrowleft':
                    currentPiece.move(-1);
                    break;
                case 'arrowright':
                    currentPiece.move(1);
                    break;
                case 'arrowdown':
                    if (currentPiece.drop()) {
                        score += 1;
                        updateDisplay();
                    }
                    dropCounter = 0;
                    break;
                case 'arrowup':
                    currentPiece.rotate();
                    break;
                case ' ':
                    e.preventDefault();
                    const distance = currentPiece.hardDrop();
                    score += distance * 2;
                    updateDisplay();
                    dropCounter = dropInterval;
                    playSound(100, 0.3);
                    break;
                case 'c':
                    holdCurrentPiece();
                    break;
                case 'p':
                    togglePause();
                    return;
            }
            drawBoard();
        });

        // Mobile controls
        document.getElementById('btnLeft').addEventListener('click', () => {
            if (currentPiece && gameRunning && !gamePaused) {
                currentPiece.move(-1);
                drawBoard();
            }
        });

        document.getElementById('btnRight').addEventListener('click', () => {
            if (currentPiece && gameRunning && !gamePaused) {
                currentPiece.move(1);
                drawBoard();
            }
        });

        document.getElementById('btnDown').addEventListener('click', () => {
            if (currentPiece && gameRunning && !gamePaused) {
                if (currentPiece.drop()) {
                    score += 1;
                    updateDisplay();
                }
                dropCounter = 0;
                drawBoard();
            }
        });

        document.getElementById('btnRotate').addEventListener('click', () => {
            if (currentPiece && gameRunning && !gamePaused) {
                currentPiece.rotate();
                drawBoard();
            }
        });

        document.getElementById('btnHold').addEventListener('click', () => {
            if (gameRunning && !gamePaused) {
                holdCurrentPiece();
                drawBoard();
            }
        });

        document.getElementById('btnDrop').addEventListener('click', () => {
            if (currentPiece && gameRunning && !gamePaused) {
                const distance = currentPiece.hardDrop();
                score += distance * 2;
                updateDisplay();
                dropCounter = dropInterval;
                playSound(100, 0.3);
                drawBoard();
            }
        });
        
        document.getElementById('startMenuBtn').addEventListener('click', startGame);
        document.getElementById('pauseBtn').addEventListener('click', togglePause);
        document.getElementById('menuBtn').addEventListener('click', showMenu);
        document.getElementById('menuBtn2').addEventListener('click', showMenu);
        document.getElementById('restartBtn').addEventListener('click', startGame);
        document.getElementById('themeToggle').addEventListener('click', toggleTheme);
        
        loadLeaderboard();
        drawBoard();