import { Ball } from './Ball';
import { Paddle } from './Paddle';
import type { GameConfig } from './types';

export class AIController {
    private paddle: Paddle;
    private ball: Ball;
    private lastUpdate: number = 0;
    private readonly baseReactionTime = 200; // ms (Slower base reaction)
    private reactionTime = 200;
    private targetY: number | null = null;
    private errorMargin: number = 0;
    private fatigue = 0;

    constructor(paddle: Paddle, ball: Ball) {
        this.paddle = paddle;
        this.ball = ball;
    }

    update(config: GameConfig, now: number) {
        // Increase fatigue slightly over time (simulates match weariness)
        // Or better: Increase fatigue based on how long the rally is?
        // Let's just increment fatigue every frame and cap it
        if (this.fatigue < 100) {
            this.fatigue += 0.05;
        }

        // Current reaction time = Base + Fatigue
        this.reactionTime = this.baseReactionTime + this.fatigue;

        // Reset fatigue if score changes? 
        // We can't easily detect score change here without callbacks.
        // But we can detect if ball resets (x is in middle).
        // For simplicity, let's just use time-based reaction.

        // Simulate reaction time
        if (now - this.lastUpdate > this.reactionTime) {
            this.lastUpdate = now;

            // Only care if ball is moving towards the paddle (paddle is on the right, so vx > 0)
            if (this.ball.vx > 0) {
                // Predict where ball is going? 
                // For now, track Y with smaller error
                this.errorMargin = (Math.random() - 0.5) * 30; // Increased error margin slightly
                this.targetY = this.ball.y + this.errorMargin;

                // Reset fatigue a bit on successful "think" to avoid it becoming impossible?
                // No, let it build up.
            } else {
                // Ball moving away/reset
                // Check if ball is roughly in center to reset fatigue (new point)
                if (Math.abs(this.ball.x - config.canvasWidth / 2) < 10 && Math.abs(this.ball.vx) < 0.1) {
                    this.fatigue = 0;
                }
                // Also reset fatigue if ball is moving away (breather)
                this.fatigue = Math.max(0, this.fatigue - 0.5);
            }
        }

        if (this.targetY !== null) {
            this.paddle.moveTo(this.targetY, config);
        }
    }
}
