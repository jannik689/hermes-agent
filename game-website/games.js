// 游戏乐园 - 游戏引擎和所有游戏实现

// 游戏管理器
class GameManager {
    constructor() {
        this.currentGame = null;
        this.modal = document.getElementById('gameModal');
        this.gameTitle = document.getElementById('gameTitle');
        this.gameContainer = document.getElementById('gameContainer');
        this.gameControls = document.getElementById('gameControls');
        this.gameScore = document.getElementById('gameScore');
        this.closeModal = document.getElementById('closeModal');
        
        this.init();
    }
    
    init() {
        // 绑定游戏卡片点击事件
        document.querySelectorAll('.game-card').forEach(card => {
            card.addEventListener('click', () => {
                const game = card.dataset.game;
                this.loadGame(game);
            });
        });
        
        // 关闭模态框
        this.closeModal.addEventListener('click', () => {
            this.closeGame();
        });
        
        // 点击模态框外部关闭
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.closeGame();
            }
        });
        
        // ESC 键关闭
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.classList.contains('active')) {
                this.closeGame();
            }
        });
    }
    
    loadGame(gameType) {
        this.closeGame();
        
        const games = {
            'snake': SnakeGame,
            'tetris': TetrisGame,
            'breakout': BreakoutGame,
            'memory': MemoryGame,
            'clicker': ClickerGame,
            'guess': GuessGame
        };
        
        if (games[gameType]) {
            this.gameTitle.textContent = this.getGameName(gameType);
            this.currentGame = new games[gameType](this.gameContainer, this.gameControls, this.gameScore);
            this.modal.classList.add('active');
        }
    }
    
    getGameName(gameType) {
        const names = {
            'snake': '🐍 贪吃蛇',
            'tetris': '🧱 俄罗斯方块',
            'breakout': '🏓 打砖块',
            'memory': '🎴 记忆配对',
            'clicker': '⚡ 手速挑战',
            'guess': '❓ 猜数字'
        };
        return names[gameType] || '游戏';
    }
    
    closeGame() {
        if (this.currentGame) {
            this.currentGame.destroy();
            this.currentGame = null;
        }
        this.modal.classList.remove('active');
        this.gameContainer.innerHTML = '';
        this.gameControls.innerHTML = '';
        this.gameScore.innerHTML = '';
    }
}

// 贪吃蛇游戏
class SnakeGame {
    constructor(container, controls, scoreDisplay) {
        this.container = container;
        this.controls = controls;
        this.scoreDisplay = scoreDisplay;
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'game-canvas';
        this.canvas.width = 400;
        this.canvas.height = 400;
        this.ctx = this.canvas.getContext('2d');
        this.gridSize = 20;
        this.tileCount = 20;
        this.score = 0;
        this.gameRunning = false;
        this.gameLoop = null;
        
        this.init();
    }
    
    init() {
        this.container.appendChild(this.canvas);
        this.reset();
        this.createControls();
        this.draw();
        this.addEventListeners();
    }
    
    reset() {
        this.snake = [{x: 10, y: 10}];
        this.food = this.spawnFood();
        this.direction = {x: 0, y: 0};
        this.nextDirection = {x: 0, y: 0};
        this.score = 0;
        this.updateScore();
    }
    
    spawnFood() {
        return {
            x: Math.floor(Math.random() * this.tileCount),
            y: Math.floor(Math.random() * this.tileCount)
        };
    }
    
    createControls() {
        this.controls.innerHTML = `
            <button id="startGame">开始游戏</button>
            <button id="resetGame">重置</button>
        `;
        
        document.getElementById('startGame').addEventListener('click', () => this.toggleGame());
        document.getElementById('resetGame').addEventListener('click', () => this.reset());
        
        this.addInstructions();
    }
    
    addInstructions() {
        const instructions = document.createElement('div');
        instructions.className = 'game-instructions';
        instructions.innerHTML = `
            <p>🎮 控制：方向键 或 WASD</p>
            <p>📱 手机：使用下方按钮</p>
        `;
        this.controls.appendChild(instructions);
        
        // 移动端控制按钮
        const mobileControls = document.createElement('div');
        mobileControls.style.cssText = 'display: grid; grid-template-columns: repeat(3, 60px); gap: 5px; margin-top: 10px; justify-content: center;';
        mobileControls.innerHTML = `
            <div></div>
            <button data-dir="up" style="padding: 15px;">⬆️</button>
            <div></div>
            <button data-dir="left" style="padding: 15px;">⬅️</button>
            <button data-dir="down" style="padding: 15px;">⬇️</button>
            <button data-dir="right" style="padding: 15px;">➡️</button>
        `;
        this.controls.appendChild(mobileControls);
        
        mobileControls.querySelectorAll('button[data-dir]').forEach(btn => {
            btn.addEventListener('click', () => {
                const dir = btn.dataset.dir;
                if (dir === 'up') this.nextDirection = {x: 0, y: -1};
                if (dir === 'down') this.nextDirection = {x: 0, y: 1};
                if (dir === 'left') this.nextDirection = {x: -1, y: 0};
                if (dir === 'right') this.nextDirection = {x: 1, y: 0};
                if (!this.gameRunning) this.toggleGame();
            });
        });
    }
    
    addEventListeners() {
        document.addEventListener('keydown', (e) => {
            if (!this.modalVisible()) return;
            
            switch(e.key) {
                case 'ArrowUp':
                case 'w':
                case 'W':
                    if (this.direction.y !== 1) this.nextDirection = {x: 0, y: -1};
                    break;
                case 'ArrowDown':
                case 's':
                case 'S':
                    if (this.direction.y !== -1) this.nextDirection = {x: 0, y: 1};
                    break;
                case 'ArrowLeft':
                case 'a':
                case 'A':
                    if (this.direction.x !== 1) this.nextDirection = {x: -1, y: 0};
                    break;
                case 'ArrowRight':
                case 'd':
                case 'D':
                    if (this.direction.x !== -1) this.nextDirection = {x: 1, y: 0};
                    break;
                case ' ':
                    this.toggleGame();
                    break;
            }
        });
    }
    
    modalVisible() {
        return document.getElementById('gameModal').classList.contains('active');
    }
    
    toggleGame() {
        if (this.gameRunning) {
            this.pauseGame();
        } else {
            this.startGame();
        }
    }
    
    startGame() {
        if (!this.gameRunning) {
            this.gameRunning = true;
            this.direction = this.nextDirection = {x: 1, y: 0};
            document.getElementById('startGame').textContent = '暂停';
            this.gameLoop = setInterval(() => this.update(), 100);
        }
    }
    
    pauseGame() {
        this.gameRunning = false;
        clearInterval(this.gameLoop);
        document.getElementById('startGame').textContent = '继续';
    }
    
    update() {
        this.direction = this.nextDirection;
        
        const head = {
            x: this.snake[0].x + this.direction.x,
            y: this.snake[0].y + this.direction.y
        };
        
        // 检测碰撞
        if (head.x < 0 || head.x >= this.tileCount ||
            head.y < 0 || head.y >= this.tileCount ||
            this.snake.some(segment => segment.x === head.x && segment.y === head.y)) {
            this.gameOver();
            return;
        }
        
        this.snake.unshift(head);
        
        // 检测吃食物
        if (head.x === this.food.x && head.y === this.food.y) {
            this.score += 10;
            this.updateScore();
            this.food = this.spawnFood();
        } else {
            this.snake.pop();
        }
        
        this.draw();
    }
    
    draw() {
        // 清空画布
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 画食物
        this.ctx.fillStyle = '#e74c3c';
        this.ctx.beginPath();
        this.ctx.arc(
            this.food.x * this.gridSize + this.gridSize / 2,
            this.food.y * this.gridSize + this.gridSize / 2,
            this.gridSize / 2 - 2,
            0,
            Math.PI * 2
        );
        this.ctx.fill();
        
        // 画蛇
        this.snake.forEach((segment, index) => {
            this.ctx.fillStyle = index === 0 ? '#2ecc71' : '#27ae60';
            this.ctx.fillRect(
                segment.x * this.gridSize + 1,
                segment.y * this.gridSize + 1,
                this.gridSize - 2,
                this.gridSize - 2
            );
        });
    }
    
    updateScore() {
        this.scoreDisplay.innerHTML = `🏆 分数：${this.score}`;
    }
    
    gameOver() {
        this.pauseGame();
        document.getElementById('startGame').textContent = '重新开始';
        alert(`游戏结束！得分：${this.score}`);
    }
    
    destroy() {
        clearInterval(this.gameLoop);
        this.pauseGame();
    }
}

// 俄罗斯方块游戏
class TetrisGame {
    constructor(container, controls, scoreDisplay) {
        this.container = container;
        this.controls = controls;
        this.scoreDisplay = scoreDisplay;
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'game-canvas';
        this.canvas.width = 300;
        this.canvas.height = 600;
        this.ctx = this.canvas.getContext('2d');
        this.gridSize = 30;
        this.cols = 10;
        this.rows = 20;
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.gameRunning = false;
        this.gameLoop = null;
        this.dropCounter = 0;
        this.dropInterval = 1000;
        
        this.shapes = [
            [[1, 1, 1, 1]], // I
            [[1, 1, 1], [0, 1, 0]], // T
            [[1, 1, 1], [1, 0, 0]], // L
            [[1, 1, 1], [0, 0, 1]], // J
            [[1, 1], [1, 1]], // O
            [[1, 1, 0], [0, 1, 1]], // S
            [[0, 1, 1], [1, 1, 0]] // Z
        ];
        
        this.colors = [
            '#00f0f0', '#a000f0', '#f0a000', '#0000f0',
            '#f0f000', '#00f000', '#f00000'
        ];
        
        this.init();
    }
    
    init() {
        this.container.appendChild(this.canvas);
        this.reset();
        this.createControls();
        this.draw();
        this.addEventListeners();
    }
    
    reset() {
        this.board = Array(this.rows).fill().map(() => Array(this.cols).fill(0));
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.dropInterval = 1000;
        this.updateScore();
        this.newPiece();
    }
    
    newPiece() {
        const index = Math.floor(Math.random() * this.shapes.length);
        this.piece = {
            shape: this.shapes[index],
            color: this.colors[index],
            x: Math.floor(this.cols / 2) - Math.floor(this.shapes[index][0].length / 2),
            y: 0
        };
        
        if (this.collide(this.piece.x, this.piece.y, this.piece.shape)) {
            this.gameOver();
        }
    }
    
    collide(x, y, shape) {
        return shape.some((row, dy) => {
            return row.some((value, dx) => {
                if (value === 0) return false;
                const newX = x + dx;
                const newY = y + dy;
                return newX < 0 || newX >= this.cols || newY >= this.rows ||
                       (newY >= 0 && this.board[newY][newX] !== 0);
            });
        });
    }
    
    createControls() {
        this.controls.innerHTML = `
            <button id="startGame">开始游戏</button>
            <button id="resetGame">重置</button>
        `;
        
        document.getElementById('startGame').addEventListener('click', () => this.toggleGame());
        document.getElementById('resetGame').addEventListener('click', () => this.reset());
        
        this.addInstructions();
    }
    
    addInstructions() {
        const instructions = document.createElement('div');
        instructions.className = 'game-instructions';
        instructions.innerHTML = `
            <p>🎮 控制：← → 移动，↑ 旋转，↓ 加速</p>
            <p>📱 手机：使用下方按钮</p>
        `;
        this.controls.appendChild(instructions);
        
        // 移动端控制
        const mobileControls = document.createElement('div');
        mobileControls.style.cssText = 'display: grid; grid-template-columns: repeat(3, 60px); gap: 5px; margin-top: 10px; justify-content: center;';
        mobileControls.innerHTML = `
            <button data-action="rotate" style="padding: 15px;">🔄</button>
            <button data-dir="up" style="padding: 15px;">⬆️</button>
            <div></div>
            <button data-dir="left" style="padding: 15px;">⬅️</button>
            <button data-dir="down" style="padding: 15px;">⬇️</button>
            <button data-dir="right" style="padding: 15px;">➡️</button>
        `;
        this.controls.appendChild(mobileControls);
        
        mobileControls.querySelectorAll('button[data-dir], button[data-action]').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!this.gameRunning) this.toggleGame();
                const dir = btn.dataset.dir;
                const action = btn.dataset.action;
                
                if (action === 'rotate') this.rotate();
                if (dir === 'up') this.drop();
                if (dir === 'down') this.move(0, 1);
                if (dir === 'left') this.move(-1, 0);
                if (dir === 'right') this.move(1, 0);
            });
        });
    }
    
    addEventListeners() {
        document.addEventListener('keydown', (e) => {
            if (!this.modalVisible()) return;
            
            switch(e.key) {
                case 'ArrowLeft':
                    this.move(-1, 0);
                    break;
                case 'ArrowRight':
                    this.move(1, 0);
                    break;
                case 'ArrowDown':
                    this.drop();
                    break;
                case 'ArrowUp':
                    this.rotate();
                    break;
                case ' ':
                    this.toggleGame();
                    break;
            }
        });
    }
    
    modalVisible() {
        return document.getElementById('gameModal').classList.contains('active');
    }
    
    toggleGame() {
        if (this.gameRunning) {
            this.pauseGame();
        } else {
            this.startGame();
        }
    }
    
    startGame() {
        if (!this.gameRunning) {
            this.gameRunning = true;
            document.getElementById('startGame').textContent = '暂停';
            this.lastTime = 0;
            this.gameLoop = (time = 0) => {
                if (!this.gameRunning) return;
                const deltaTime = time - this.lastTime;
                this.lastTime = time;
                this.dropCounter += deltaTime;
                if (this.dropCounter > this.dropInterval) {
                    this.drop();
                }
                this.draw();
                this.gameLoopId = requestAnimationFrame(this.gameLoop);
            };
            this.gameLoop();
        }
    }
    
    pauseGame() {
        this.gameRunning = false;
        cancelAnimationFrame(this.gameLoopId);
        document.getElementById('startGame').textContent = '继续';
    }
    
    move(dx, dy) {
        if (!this.collide(this.piece.x + dx, this.piece.y + dy, this.piece.shape)) {
            this.piece.x += dx;
            this.piece.y += dy;
            this.draw();
        }
    }
    
    drop() {
        if (!this.collide(this.piece.x, this.piece.y + 1, this.piece.shape)) {
            this.piece.y++;
            this.dropCounter = 0;
        } else {
            this.merge();
            this.clearLines();
            this.newPiece();
        }
        this.draw();
    }
    
    rotate() {
        const rotated = this.piece.shape[0].map((_, i) =>
            this.piece.shape.map(row => row[i]).reverse()
        );
        
        if (!this.collide(this.piece.x, this.piece.y, rotated)) {
            this.piece.shape = rotated;
        }
    }
    
    merge() {
        this.piece.shape.forEach((row, dy) => {
            row.forEach((value, dx) => {
                if (value !== 0) {
                    this.board[this.piece.y + dy][this.piece.x + dx] = 
                        this.colors.indexOf(this.piece.color) + 1;
                }
            });
        });
    }
    
    clearLines() {
        let linesCleared = 0;
        
        this.board = this.board.filter(row => {
            if (row.every(cell => cell !== 0)) {
                linesCleared++;
                return false;
            }
            return true;
        });
        
        while (this.board.length < this.rows) {
            this.board.unshift(Array(this.cols).fill(0));
        }
        
        if (linesCleared > 0) {
            this.lines += linesCleared;
            this.score += [0, 100, 300, 500, 800][linesCleared] * this.level;
            this.level = Math.floor(this.lines / 10) + 1;
            this.dropInterval = Math.max(100, 1000 - (this.level - 1) * 100);
            this.updateScore();
        }
    }
    
    draw() {
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 画网格
        this.ctx.strokeStyle = '#333';
        for (let x = 0; x <= this.cols; x++) {
            this.ctx.beginPath();
            this.ctx.moveTo(x * this.gridSize, 0);
            this.ctx.lineTo(x * this.gridSize, this.canvas.height);
            this.ctx.stroke();
        }
        for (let y = 0; y <= this.rows; y++) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y * this.gridSize);
            this.ctx.lineTo(this.canvas.width, y * this.gridSize);
            this.ctx.stroke();
        }
        
        // 画已固定的方块
        this.board.forEach((row, y) => {
            row.forEach((cell, x) => {
                if (cell !== 0) {
                    this.ctx.fillStyle = this.colors[cell - 1];
                    this.ctx.fillRect(
                        x * this.gridSize + 1,
                        y * this.gridSize + 1,
                        this.gridSize - 2,
                        this.gridSize - 2
                    );
                }
            });
        });
        
        // 画当前方块
        if (this.piece) {
            this.ctx.fillStyle = this.piece.color;
            this.piece.shape.forEach((row, dy) => {
                row.forEach((value, dx) => {
                    if (value !== 0) {
                        this.ctx.fillRect(
                            (this.piece.x + dx) * this.gridSize + 1,
                            (this.piece.y + dy) * this.gridSize + 1,
                            this.gridSize - 2,
                            this.gridSize - 2
                        );
                    }
                });
            });
        }
    }
    
    updateScore() {
        this.scoreDisplay.innerHTML = `🏆 分数：${this.score} | 📊 消行：${this.lines} | ⭐ 等级：${this.level}`;
    }
    
    gameOver() {
        this.pauseGame();
        document.getElementById('startGame').textContent = '重新开始';
        alert(`游戏结束！得分：${this.score}`);
    }
    
    destroy() {
        cancelAnimationFrame(this.gameLoopId);
        this.pauseGame();
    }
}

// 打砖块游戏
class BreakoutGame {
    constructor(container, controls, scoreDisplay) {
        this.container = container;
        this.controls = controls;
        this.scoreDisplay = scoreDisplay;
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'game-canvas';
        this.canvas.width = 600;
        this.canvas.height = 400;
        this.ctx = this.canvas.getContext('2d');
        this.score = 0;
        this.lives = 3;
        this.gameRunning = false;
        this.animationId = null;
        
        this.init();
    }
    
    init() {
        this.container.appendChild(this.canvas);
        this.reset();
        this.createControls();
        this.draw();
        this.addEventListeners();
    }
    
    reset() {
        this.paddle = {
            x: this.canvas.width / 2 - 50,
            y: this.canvas.height - 30,
            width: 100,
            height: 15,
            speed: 8
        };
        
        this.ball = {
            x: this.canvas.width / 2,
            y: this.canvas.height - 50,
            radius: 8,
            speed: 5,
            dx: 5,
            dy: -5
        };
        
        this.bricks = [];
        this.rows = 5;
        this.cols = 8;
        this.brickWidth = 65;
        this.brickHeight = 20;
        this.brickPadding = 10;
        this.brickOffsetTop = 50;
        this.brickOffsetLeft = 25;
        
        for (let c = 0; c < this.cols; c++) {
            this.bricks[c] = [];
            for (let r = 0; r < this.rows; r++) {
                this.bricks[c][r] = { x: 0, y: 0, status: 1 };
            }
        }
        
        this.score = 0;
        this.lives = 3;
        this.updateScore();
        this.rightPressed = false;
        this.leftPressed = false;
    }
    
    createControls() {
        this.controls.innerHTML = `
            <button id="startGame">开始游戏</button>
            <button id="resetGame">重置</button>
        `;
        
        document.getElementById('startGame').addEventListener('click', () => this.toggleGame());
        document.getElementById('resetGame').addEventListener('click', () => this.reset());
        
        this.addInstructions();
    }
    
    addInstructions() {
        const instructions = document.createElement('div');
        instructions.className = 'game-instructions';
        instructions.innerHTML = `
            <p>🎮 控制：← → 或 A D 移动挡板</p>
            <p>📱 手机：使用下方按钮</p>
        `;
        this.controls.appendChild(instructions);
        
        // 移动端控制
        const mobileControls = document.createElement('div');
        mobileControls.style.cssText = 'display: flex; gap: 20px; margin-top: 10px; justify-content: center;';
        mobileControls.innerHTML = `
            <button data-dir="left" style="padding: 15px 30px;">⬅️ 左移</button>
            <button data-dir="right" style="padding: 15px 30px;">右移 ➡️</button>
        `;
        this.controls.appendChild(mobileControls);
        
        mobileControls.querySelectorAll('button[data-dir]').forEach(btn => {
            btn.addEventListener('click', () => {
                const dir = btn.dataset.dir;
                if (!this.gameRunning) this.toggleGame();
                if (dir === 'left') {
                    this.paddle.x -= 30;
                    if (this.paddle.x < 0) this.paddle.x = 0;
                }
                if (dir === 'right') {
                    this.paddle.x += 30;
                    if (this.paddle.x + this.paddle.width > this.canvas.width) {
                        this.paddle.x = this.canvas.width - this.paddle.width;
                    }
                }
                this.draw();
            });
        });
    }
    
    addEventListeners() {
        document.addEventListener('keydown', (e) => {
            if (!this.modalVisible()) return;
            
            if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
                this.rightPressed = true;
            } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
                this.leftPressed = true;
            } else if (e.key === ' ') {
                this.toggleGame();
            }
        });
        
        document.addEventListener('keyup', (e) => {
            if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
                this.rightPressed = false;
            } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
                this.leftPressed = false;
            }
        });
    }
    
    modalVisible() {
        return document.getElementById('gameModal').classList.contains('active');
    }
    
    toggleGame() {
        if (this.gameRunning) {
            this.pauseGame();
        } else {
            this.startGame();
        }
    }
    
    startGame() {
        if (!this.gameRunning) {
            this.gameRunning = true;
            document.getElementById('startGame').textContent = '暂停';
            this.draw();
        }
    }
    
    pauseGame() {
        this.gameRunning = false;
        cancelAnimationFrame(this.animationId);
        document.getElementById('startGame').textContent = '继续';
    }
    
    collisionDetection() {
        for (let c = 0; c < this.cols; c++) {
            for (let r = 0; r < this.rows; r++) {
                const b = this.bricks[c][r];
                if (b.status === 1) {
                    if (this.ball.x > b.x && this.ball.x < b.x + this.brickWidth &&
                        this.ball.y > b.y && this.ball.y < b.y + this.brickHeight) {
                        this.ball.dy = -this.ball.dy;
                        b.status = 0;
                        this.score += 10;
                        this.updateScore();
                        
                        if (this.score === this.rows * this.cols * 10) {
                            alert('恭喜你赢了！');
                            this.pauseGame();
                            document.getElementById('startGame').textContent = '重新开始';
                        }
                    }
                }
            }
        }
    }
    
    update() {
        // 移动挡板
        if (this.rightPressed && this.paddle.x < this.canvas.width - this.paddle.width) {
            this.paddle.x += this.paddle.speed;
        } else if (this.leftPressed && this.paddle.x > 0) {
            this.paddle.x -= this.paddle.speed;
        }
        
        // 移动球
        this.ball.x += this.ball.dx;
        this.ball.y += this.ball.dy;
        
        // 墙壁碰撞
        if (this.ball.x + this.ball.radius > this.canvas.width || this.ball.x - this.ball.radius < 0) {
            this.ball.dx = -this.ball.dx;
        }
        if (this.ball.y - this.ball.radius < 0) {
            this.ball.dy = -this.ball.dy;
        }
        
        // 挡板碰撞
        if (this.ball.y + this.ball.radius > this.paddle.y &&
            this.ball.y - this.ball.radius < this.paddle.y + this.paddle.height &&
            this.ball.x > this.paddle.x &&
            this.ball.x < this.paddle.x + this.paddle.width) {
            this.ball.dy = -this.ball.dy;
        }
        
        // 球掉落
        if (this.ball.y + this.ball.radius > this.canvas.height) {
            this.lives--;
            this.updateScore();
            if (this.lives === 0) {
                this.gameOver();
            } else {
                this.ball.x = this.canvas.width / 2;
                this.ball.y = this.canvas.height - 50;
                this.ball.dx = 5;
                this.ball.dy = -5;
                this.paddle.x = this.canvas.width / 2 - 50;
            }
        }
        
        this.collisionDetection();
    }
    
    draw() {
        if (!this.gameRunning && !this.animationId) {
            this.drawStatic();
            return;
        }
        
        this.update();
        this.drawStatic();
        this.animationId = requestAnimationFrame(() => this.draw());
    }
    
    drawStatic() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 画砖块
        for (let c = 0; c < this.cols; c++) {
            for (let r = 0; r < this.rows; r++) {
                if (this.bricks[c][r].status === 1) {
                    const brickX = c * (this.brickWidth + this.brickPadding) + this.brickOffsetLeft;
                    const brickY = r * (this.brickHeight + this.brickPadding) + this.brickOffsetTop;
                    this.bricks[c][r].x = brickX;
                    this.bricks[c][r].y = brickY;
                    
                    const colors = ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#3498db'];
                    this.ctx.fillStyle = colors[r];
                    this.ctx.fillRect(brickX, brickY, this.brickWidth, this.brickHeight);
                }
            }
        }
        
        // 画挡板
        this.ctx.fillStyle = '#9b59b6';
        this.ctx.fillRect(this.paddle.x, this.paddle.y, this.paddle.width, this.paddle.height);
        
        // 画球
        this.ctx.beginPath();
        this.ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
        this.ctx.fillStyle = '#ecf0f1';
        this.ctx.fill();
        this.ctx.closePath();
    }
    
    updateScore() {
        this.scoreDisplay.innerHTML = `🏆 分数：${this.score} | ❤️ 生命：${this.lives}`;
    }
    
    gameOver() {
        this.pauseGame();
        document.getElementById('startGame').textContent = '重新开始';
        alert(`游戏结束！得分：${this.score}`);
    }
    
    destroy() {
        cancelAnimationFrame(this.animationId);
        this.pauseGame();
    }
}

// 记忆配对游戏
class MemoryGame {
    constructor(container, controls, scoreDisplay) {
        this.container = container;
        this.controls = controls;
        this.scoreDisplay = scoreDisplay;
        this.cards = [];
        this.flippedCards = [];
        this.matchedPairs = 0;
        this.moves = 0;
        this.gameRunning = false;
        
        this.icons = ['🍎', '🍌', '🍇', '🍊', '🍋', '🍉', '🍓', '🍒'];
        
        this.init();
    }
    
    init() {
        this.reset();
        this.createControls();
        this.draw();
    }
    
    reset() {
        this.cards = [...this.icons, ...this.icons]
            .sort(() => Math.random() - 0.5)
            .map((icon, index) => ({
                icon,
                index,
                flipped: false,
                matched: false
            }));
        
        this.flippedCards = [];
        this.matchedPairs = 0;
        this.moves = 0;
        this.gameRunning = true;
        this.updateScore();
    }
    
    createControls() {
        this.controls.innerHTML = `
            <button id="resetGame">重新开始</button>
        `;
        
        document.getElementById('resetGame').addEventListener('click', () => this.reset());
        
        this.addInstructions();
    }
    
    addInstructions() {
        const instructions = document.createElement('div');
        instructions.className = 'game-instructions';
        instructions.innerHTML = `<p>🎮 点击卡片翻转，找到所有配对</p>`;
        this.controls.appendChild(instructions);
    }
    
    draw() {
        this.container.innerHTML = '';
        
        const grid = document.createElement('div');
        grid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(4, 80px);
            gap: 10px;
            justify-content: center;
        `;
        
        this.cards.forEach((card, index) => {
            const cardEl = document.createElement('div');
            cardEl.className = 'memory-card';
            cardEl.style.cssText = `
                width: 80px;
                height: 80px;
                background: ${card.flipped || card.matched ? '#6c5ce7' : '#2d3436'};
                border-radius: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 2rem;
                cursor: pointer;
                transition: all 0.3s ease;
                transform: ${card.flipped ? 'rotateY(180deg)' : ''};
            `;
            
            if (card.flipped || card.matched) {
                cardEl.textContent = card.icon;
            }
            
            cardEl.addEventListener('click', () => this.flipCard(index));
            grid.appendChild(cardEl);
        });
        
        this.container.appendChild(grid);
    }
    
    flipCard(index) {
        const card = this.cards[index];
        
        if (card.flipped || card.matched || this.flippedCards.length >= 2) {
            return;
        }
        
        card.flipped = true;
        this.flippedCards.push(card);
        this.draw();
        
        if (this.flippedCards.length === 2) {
            this.moves++;
            this.updateScore();
            
            const [card1, card2] = this.flippedCards;
            
            if (card1.icon === card2.icon) {
                card1.matched = true;
                card2.matched = true;
                this.matchedPairs++;
                this.flippedCards = [];
                this.updateScore();
                
                if (this.matchedPairs === this.icons.length) {
                    setTimeout(() => {
                        alert(`🎉 恭喜你！用了 ${this.moves} 步完成游戏！`);
                    }, 500);
                }
            } else {
                setTimeout(() => {
                    card1.flipped = false;
                    card2.flipped = false;
                    this.flippedCards = [];
                    this.draw();
                }, 1000);
            }
        }
    }
    
    updateScore() {
        this.scoreDisplay.innerHTML = `👟 步数：${this.moves} | 🎯 配对：${this.matchedPairs}/${this.icons.length}`;
    }
    
    destroy() {}
}

// 手速挑战游戏
class ClickerGame {
    constructor(container, controls, scoreDisplay) {
        this.container = container;
        this.controls = controls;
        this.scoreDisplay = scoreDisplay;
        this.score = 0;
        this.timeLeft = 10;
        this.gameRunning = false;
        this.timer = null;
        
        this.init();
    }
    
    init() {
        this.reset();
        this.createControls();
    }
    
    reset() {
        this.score = 0;
        this.timeLeft = 10;
        this.gameRunning = false;
        clearInterval(this.timer);
        this.updateScore();
        this.createClickButton();
    }
    
    createControls() {
        this.controls.innerHTML = `
            <button id="startGame">开始游戏</button>
        `;
        
        document.getElementById('startGame').addEventListener('click', () => this.startGame());
        
        this.addInstructions();
    }
    
    addInstructions() {
        const instructions = document.createElement('div');
        instructions.className = 'game-instructions';
        instructions.innerHTML = `<p>⚡ 10 秒内尽可能多地点击按钮！</p>`;
        this.controls.appendChild(instructions);
    }
    
    createClickButton() {
        this.container.innerHTML = '';
        
        const clickBtn = document.createElement('button');
        clickBtn.textContent = '👆 点击我！';
        clickBtn.style.cssText = `
            padding: 3rem 5rem;
            font-size: 2rem;
            background: linear-gradient(135deg, #6c5ce7, #fd79a8);
            color: white;
            border: none;
            border-radius: 50px;
            cursor: pointer;
            transition: all 0.1s ease;
            font-weight: bold;
        `;
        
        clickBtn.addEventListener('click', () => {
            if (this.gameRunning) {
                this.score++;
                this.updateScore();
                
                // 按钮动画
                clickBtn.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    clickBtn.style.transform = 'scale(1)';
                }, 50);
            }
        });
        
        this.container.appendChild(clickBtn);
    }
    
    startGame() {
        if (this.gameRunning) return;
        
        this.score = 0;
        this.timeLeft = 10;
        this.gameRunning = true;
        this.updateScore();
        document.getElementById('startGame').disabled = true;
        
        this.timer = setInterval(() => {
            this.timeLeft--;
            this.updateScore();
            
            if (this.timeLeft <= 0) {
                this.endGame();
            }
        }, 1000);
    }
    
    endGame() {
        this.gameRunning = false;
        clearInterval(this.timer);
        document.getElementById('startGame').disabled = false;
        
        const cps = (this.score / 10).toFixed(2);
        alert(`时间到！你点击了 ${this.score} 次，手速：${cps} 次/秒`);
    }
    
    updateScore() {
        this.scoreDisplay.innerHTML = `🏆 点击：${this.score} | ⏱️ 时间：${this.timeLeft}s | ⚡ 手速：${this.gameRunning ? (this.score / (10 - this.timeLeft)).toFixed(2) : 0} 次/秒`;
    }
    
    destroy() {
        clearInterval(this.timer);
    }
}

// 猜数字游戏
class GuessGame {
    constructor(container, controls, scoreDisplay) {
        this.container = container;
        this.controls = controls;
        this.scoreDisplay = scoreDisplay;
        this.targetNumber = 0;
        this.attempts = 0;
        this.maxAttempts = 10;
        this.gameRunning = false;
        
        this.init();
    }
    
    init() {
        this.reset();
        this.createControls();
    }
    
    reset() {
        this.targetNumber = Math.floor(Math.random() * 100) + 1;
        this.attempts = 0;
        this.gameRunning = true;
        console.log('目标数字:', this.targetNumber); // 调试用
        this.updateScore();
        this.createInput();
    }
    
    createControls() {
        this.controls.innerHTML = `
            <button id="resetGame">新游戏</button>
        `;
        
        document.getElementById('resetGame').addEventListener('click', () => this.reset());
        
        this.addInstructions();
    }
    
    addInstructions() {
        const instructions = document.createElement('div');
        instructions.className = 'game-instructions';
        instructions.innerHTML = `<p>❓ 猜一个 1-100 之间的数字，你有 ${this.maxAttempts} 次机会</p>`;
        this.controls.appendChild(instructions);
    }
    
    createInput() {
        this.container.innerHTML = '';
        
        const inputGroup = document.createElement('div');
        inputGroup.style.cssText = `
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 20px;
        `;
        
        const input = document.createElement('input');
        input.type = 'number';
        input.min = 1;
        input.max = 100;
        input.placeholder = '输入你的猜测 (1-100)';
        input.style.cssText = `
            padding: 1rem 2rem;
            font-size: 1.5rem;
            width: 300px;
            text-align: center;
            border: 3px solid #6c5ce7;
            border-radius: 10px;
            background: #1a1a2e;
            color: white;
        `;
        
        const submitBtn = document.createElement('button');
        submitBtn.textContent = '提交猜测';
        submitBtn.style.cssText = `
            padding: 1rem 3rem;
            font-size: 1.2rem;
            background: linear-gradient(135deg, #6c5ce7, #fd79a8);
            color: white;
            border: none;
            border-radius: 50px;
            cursor: pointer;
            font-weight: bold;
        `;
        
        const message = document.createElement('div');
        message.id = 'guessMessage';
        message.style.cssText = `
            font-size: 1.5rem;
            text-align: center;
            min-height: 50px;
        `;
        
        inputGroup.appendChild(input);
        inputGroup.appendChild(submitBtn);
        inputGroup.appendChild(message);
        this.container.appendChild(inputGroup);
        
        const submit = () => {
            const guess = parseInt(input.value);
            if (isNaN(guess) || guess < 1 || guess > 100) {
                message.textContent = '⚠️ 请输入 1-100 之间的数字';
                message.style.color = '#fdcb6e';
                return;
            }
            
            this.attempts++;
            this.updateScore();
            
            if (guess === this.targetNumber) {
                message.textContent = `🎉 恭喜你！猜对了！用了 ${this.attempts} 次`;
                message.style.color = '#00b894';
                this.gameRunning = false;
            } else if (this.attempts >= this.maxAttempts) {
                message.textContent = `😢 游戏结束！正确答案是 ${this.targetNumber}`;
                message.style.color = '#e74c3c';
                this.gameRunning = false;
            } else if (guess < this.targetNumber) {
                message.textContent = '⬆️ 太小了！再大一点';
                message.style.color = '#3498db';
            } else {
                message.textContent = '⬇️ 太大了！再小一点';
                message.style.color = '#e74c3c';
            }
            
            input.value = '';
            input.focus();
        };
        
        submitBtn.addEventListener('click', submit);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') submit();
        });
        
        input.focus();
    }
    
    updateScore() {
        this.scoreDisplay.innerHTML = `🎯 尝试：${this.attempts}/${this.maxAttempts}`;
    }
    
    destroy() {}
}

// 初始化游戏管理器
document.addEventListener('DOMContentLoaded', () => {
    window.gameManager = new GameManager();
});
