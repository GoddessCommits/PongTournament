import { PlayerSide } from './types';
import type { GameConfig } from './types';

export class Paddle {
    public x: number;
    public y: number;
    public width: number;
    public height: number;
    public side: PlayerSide;
    private readonly speed = 8;
    public velocity: number = 0;

    constructor(side: PlayerSide, config: GameConfig) {
        this.side = side;
        this.width = config.paddleWidth;
        this.height = config.paddleHeight;
        this.y = (config.canvasHeight - this.height) / 2;

        if (side === PlayerSide.LEFT) {
            this.x = 20; // Padding from wall
        } else {
            this.x = config.canvasWidth - 20 - this.width;
        }
    }

    update(config: GameConfig) {
        if (this.velocity !== 0) {
            this.y += this.velocity * this.speed;
            this.y = Math.max(0, Math.min(config.canvasHeight - this.height, this.y));
        }
    }

    // Directly set position (e.g. from mouse)
    setPosition(y: number, config: GameConfig) {
        // Input y is likely the mouse Y. We want the paddle center to be at mouse Y.
        let newY = y - this.height / 2;
        newY = Math.max(0, Math.min(config.canvasHeight - this.height, newY));
        this.y = newY;
    }

    setVelocity(direction: number) {
        // -1 for up, 1 for down, 0 for stop
        this.velocity = direction;
    }

    moveTo(targetY: number, config: GameConfig) {
        // Center the paddle on targetY
        const paddleCenter = this.y + this.height / 2;
        const diff = targetY - paddleCenter;

        // Clamp movement speed
        if (Math.abs(diff) < this.speed) {
            this.y += diff;
        } else {
            this.y += Math.sign(diff) * this.speed;
        }

        // Clamp to canvas
        this.y = Math.max(0, Math.min(config.canvasHeight - this.height, this.y));
    }

    render(ctx: CanvasRenderingContext2D) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}
