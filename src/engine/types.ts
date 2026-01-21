export interface Point {
    x: number;
    y: number;
}

export interface Velocity {
    vx: number;
    vy: number;
}

export interface Dimensions {
    width: number;
    height: number;
}

export const PlayerSide = {
    LEFT: 'LEFT',
    RIGHT: 'RIGHT',
} as const;

export type PlayerSide = typeof PlayerSide[keyof typeof PlayerSide];

export interface GameConfig {
    canvasWidth: number;
    canvasHeight: number;
    paddleWidth: number;
    paddleHeight: number;
    ballRadius: number;
    winningScore: number;
}

export const DEFAULT_CONFIG: GameConfig = {
    canvasWidth: 800,
    canvasHeight: 600,
    paddleWidth: 10,
    paddleHeight: 100,
    ballRadius: 6,
    winningScore: 5,
};
