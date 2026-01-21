import { AIController } from './AIController';
import { Ball } from './Ball';
import { Paddle } from './Paddle';
import { DEFAULT_CONFIG, PlayerSide } from './types';
import type { GameConfig } from './types';

export type GameState = 'LOBBY' | 'PLAYING' | 'ENDED';

export interface GameEvents {
    onScore: (left: number, right: number) => void;
    onMatchEnd: (winner: PlayerSide) => void;
}

export class GameEngine {
    public config: GameConfig;
    public ball: Ball;
    public leftPaddle: Paddle;
    public rightPaddle: Paddle;
    public aiController: AIController | null = null;

    public state: GameState = 'LOBBY';
    public scores = { left: 0, right: 0 };

    private events: GameEvents;
    private animationId: number | null = null;
    private lastTime: number = 0;
    private ctx: CanvasRenderingContext2D | null = null;

    constructor(events: GameEvents, config: GameConfig = DEFAULT_CONFIG) {
        this.config = config;
        this.events = events;
        this.ball = new Ball(config);
        this.leftPaddle = new Paddle(PlayerSide.LEFT, config);
        this.rightPaddle = new Paddle(PlayerSide.RIGHT, config);
    }

    attachCanvas(ctx: CanvasRenderingContext2D) {
        this.ctx = ctx;
        this.draw(); // Initial draw
    }

    detachCanvas() {
        this.ctx = null;
        this.stop();
    }

    enableAI(side: PlayerSide) {
        if (side === PlayerSide.RIGHT) {
            this.aiController = new AIController(this.rightPaddle, this.ball);
        } else {
            // Could support left AI if needed
            this.aiController = new AIController(this.leftPaddle, this.ball);
        }
    }

    start() {
        if (this.state === 'PLAYING') return;
        this.state = 'PLAYING';
        this.lastTime = performance.now();
        this.loop();
    }

    stop() {
        this.state = 'LOBBY';
        if (this.animationId !== null) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    reset() {
        this.scores = { left: 0, right: 0 };
        this.ball.reset(this.config);
        this.events.onScore(0, 0);
        this.state = 'LOBBY';
        this.draw();
    }

    private loop = () => {
        if (this.state !== 'PLAYING') return;

        const now = performance.now();
        // Calculate dt? For now assuming 60fps roughly or using fixed steps.
        // Let's us 1.0 time scale for simplicity as established in Ball.ts
        // Ideally we should use (now - this.lastTime) / 16.666 

        const dt = (now - this.lastTime) / 16.666;
        this.lastTime = now;

        this.update(dt, now);
        this.draw();

        this.animationId = requestAnimationFrame(this.loop);
    };

    private update(dt: number, now: number) {
        this.ball.update(this.config, dt);

        // Update Paddles (for velocity based movement)
        this.leftPaddle.update(this.config);
        // Only update right paddle if not AI. If AI, it moves via controller which might use setPosition or velocity.
        if (!this.aiController) {
            this.rightPaddle.update(this.config);
        }

        // AI Update
        if (this.aiController) {
            this.aiController.update(this.config, now);
        }

        // Collisions
        this.checkCollisions();

        // Scoring
        if (this.ball.x - this.ball.radius < 0) {
            this.handleScore(PlayerSide.RIGHT);
        } else if (this.ball.x + this.ball.radius > this.config.canvasWidth) {
            this.handleScore(PlayerSide.LEFT);
        }
    }

    private checkCollisions() {
        // Left Paddle
        if (
            this.ball.x - this.ball.radius < this.leftPaddle.x + this.leftPaddle.width &&
            this.ball.y > this.leftPaddle.y &&
            this.ball.y < this.leftPaddle.y + this.leftPaddle.height &&
            this.ball.vx < 0
        ) {
            // Calculate relative intersect Y (normalized -1 to 1)
            const paddleCenter = this.leftPaddle.y + (this.leftPaddle.height / 2);
            const relativeIntersectY = (this.ball.y - paddleCenter) / (this.leftPaddle.height / 2);

            // Bounce angle: Max 45 degrees (PI/4) or 60 degrees (PI/3)
            // Let's use up to 60 degrees for more action
            const bounceAngle = relativeIntersectY * (Math.PI / 3);

            const speed = Math.sqrt(this.ball.vx * this.ball.vx + this.ball.vy * this.ball.vy);

            // For left paddle, direction is positive X
            this.ball.vx = speed * Math.cos(bounceAngle);
            this.ball.vy = speed * Math.sin(bounceAngle);

            this.ball.x = this.leftPaddle.x + this.leftPaddle.width + this.ball.radius;

            // Increase speed
            this.ball.increaseSpeed();
        }

        // Right Paddle
        if (
            this.ball.x + this.ball.radius > this.rightPaddle.x &&
            this.ball.y > this.rightPaddle.y &&
            this.ball.y < this.rightPaddle.y + this.rightPaddle.height &&
            this.ball.vx > 0
        ) {
            // Calculate relative intersect Y (normalized -1 to 1)
            const paddleCenter = this.rightPaddle.y + (this.rightPaddle.height / 2);
            const relativeIntersectY = (this.ball.y - paddleCenter) / (this.rightPaddle.height / 2);

            // Bounce angle
            const bounceAngle = relativeIntersectY * (Math.PI / 3);
            const speed = Math.sqrt(this.ball.vx * this.ball.vx + this.ball.vy * this.ball.vy);

            // For right paddle, direction is negative X
            this.ball.vx = -speed * Math.cos(bounceAngle);
            this.ball.vy = speed * Math.sin(bounceAngle);

            this.ball.x = this.rightPaddle.x - this.ball.radius;

            // Increase speed
            this.ball.increaseSpeed();
        }
    }

    private handleScore(winner: PlayerSide) {
        if (winner === PlayerSide.LEFT) {
            this.scores.left++;
        } else {
            this.scores.right++;
        }

        this.events.onScore(this.scores.left, this.scores.right);

        if (this.scores.left >= this.config.winningScore || this.scores.right >= this.config.winningScore) {
            this.endGame(winner);
        } else {
            this.ball.reset(this.config);
        }
    }

    private endGame(winner: PlayerSide) {
        this.state = 'ENDED';
        this.stop();
        this.events.onMatchEnd(winner);
    }

    private draw() {
        if (!this.ctx) return;

        // Clear
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.config.canvasWidth, this.config.canvasHeight);

        // Draw net
        this.ctx.strokeStyle = '#333';
        this.ctx.setLineDash([10, 15]);
        this.ctx.beginPath();
        this.ctx.moveTo(this.config.canvasWidth / 2, 0);
        this.ctx.lineTo(this.config.canvasWidth / 2, this.config.canvasHeight);
        this.ctx.stroke();

        this.ball.render(this.ctx);
        this.leftPaddle.render(this.ctx);
        this.rightPaddle.render(this.ctx);
    }

    // Public input methods
    public setPaddlePosition(side: PlayerSide, y: number) {
        if (side === PlayerSide.LEFT) {
            this.leftPaddle.setPosition(y, this.config);
        } else {
            // Only if not AI?
            if (!this.aiController) {
                this.rightPaddle.setPosition(y, this.config);
            }
        }
    }

    public setPaddleVelocity(side: PlayerSide, direction: number) {
        if (side === PlayerSide.LEFT) {
            this.leftPaddle.setVelocity(direction);
        } else {
            if (!this.aiController) {
                this.rightPaddle.setVelocity(direction);
            }
        }
    }
}
