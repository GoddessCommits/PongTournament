import { DEFAULT_CONFIG } from './types';
import type { GameConfig } from './types';

export class Ball {
    public x: number;
    public y: number;
    public vx: number;
    public vy: number;
    public radius: number;
    private speedMultiplier: number = 1.0;
    private readonly initialSpeed = 6; // Start slightly faster
    private readonly maxSpeedMultiplier = 3.0; // Allow it to get really fast

    constructor(config: GameConfig = DEFAULT_CONFIG) {
        this.x = config.canvasWidth / 2;
        this.y = config.canvasHeight / 2;
        this.radius = config.ballRadius;

        // Random initial direction
        const func = Math.random() > 0.5 ? 1 : -1;
        this.vx = this.initialSpeed * func;
        this.vy = (Math.random() * 6 - 3); // Random Y velocity
    }

    update(config: GameConfig, dt: number) {
        // Basic movement

        this.x += this.vx * this.speedMultiplier * dt;
        this.y += this.vy * this.speedMultiplier * dt;

        // Wall collisions (Top/Bottom)
        if (this.y - this.radius < 0) {
            this.y = this.radius;
            this.vy = -this.vy;
        } else if (this.y + this.radius > config.canvasHeight) {
            this.y = config.canvasHeight - this.radius;
            this.vy = -this.vy;
        }
    }

    flipX() {
        this.vx = -this.vx;
        // Add a bit of randomness to Y to avoid stuck loops
        this.vy += (Math.random() - 0.5);
    }

    increaseSpeed() {
        if (this.speedMultiplier < this.maxSpeedMultiplier) {
            this.speedMultiplier += 0.05; // 5% increase per hit
        }
    }

    reset(config: GameConfig) {
        this.x = config.canvasWidth / 2;
        this.y = config.canvasHeight / 2;
        this.speedMultiplier = 1.0;

        // Serve to the loser or random? Random for now.
        const direction = Math.random() > 0.5 ? 1 : -1;
        this.vx = this.initialSpeed * direction;
        this.vy = (Math.random() * 6 - 3);
    }

    render(ctx: CanvasRenderingContext2D) {
        ctx.beginPath();
        ctx.fillStyle = '#fff';
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.closePath();
    }
}
