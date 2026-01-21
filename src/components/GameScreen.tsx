import { useEffect, useRef, useState } from 'react';
import { GameEngine } from '../engine/GameEngine';
import { PlayerSide } from '../engine/types';
import { ScoreDisplay } from './ScoreDisplay';

interface GameScreenProps {
    onMatchEnd: (winner: PlayerSide) => void;
    isAiOpponent?: boolean;
    player1Name?: string;
    player2Name?: string;
    // Hybrid: External engine support
    engine?: GameEngine;
    externalScores?: { left: number; right: number };
}

export const GameScreen: React.FC<GameScreenProps> = ({
    onMatchEnd,
    isAiOpponent = false,
    player1Name = "Player 1",
    player2Name = "Player 2",
    engine: externalEngine,
    externalScores
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const localEngineRef = useRef<GameEngine | null>(null);

    // Callback ref
    const onMatchEndRef = useRef(onMatchEnd);
    useEffect(() => {
        onMatchEndRef.current = onMatchEnd;
    }, [onMatchEnd]);

    const [localScores, setLocalScores] = useState({ left: 0, right: 0 });
    const [countdown, setCountdown] = useState<number | null>(5); // Start with 5 second countdown

    const displayScores = externalScores || localScores;

    useEffect(() => {
        if (!canvasRef.current) return;

        let activeEngine: GameEngine;

        if (externalEngine) {
            // USAGE: External (Online)
            activeEngine = externalEngine;
        } else {
            // USAGE: Local (Create our own)
            // Prevent re-creation if already exists
            if (!localEngineRef.current) {
                localEngineRef.current = new GameEngine({
                    onScore: (left, right) => setLocalScores({ left, right }),
                    onMatchEnd: (winner) => {
                        onMatchEndRef.current(winner);
                    },
                });

                if (isAiOpponent) {
                    localEngineRef.current.enableAI(PlayerSide.RIGHT);
                }
            }
            activeEngine = localEngineRef.current;
        }

        // Attach Canvas
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
            activeEngine.attachCanvas(ctx);
            // Don't start immediately - wait for countdown
        }

        // Countdown timer
        const countdownInterval = setInterval(() => {
            setCountdown(prev => {
                if (prev === null || prev <= 0) {
                    clearInterval(countdownInterval);
                    activeEngine.start(); // Start game when countdown finishes
                    return null;
                }
                return prev - 1;
            });
        }, 1000);

        // If countdown is already null (remount), start immediately
        if (countdown === null) {
            activeEngine.start();
        }

        // Handle Input
        const validKeys = new Set(['w', 's', 'ArrowUp', 'ArrowDown']);
        const pressedKeys = new Set<string>();

        const updatePaddleVelocity = () => {
            // Player 1 (Left) - W/S
            let v1 = 0;
            if (pressedKeys.has('w')) v1 -= 1;
            if (pressedKeys.has('s')) v1 += 1;
            activeEngine.setPaddleVelocity(PlayerSide.LEFT, v1);

            // Player 2 (Right) - Arrows (only if not AI or if controlling right side in online?)
            // For now, local logic:
            if (!isAiOpponent) {
                let v2 = 0;
                if (pressedKeys.has('ArrowUp')) v2 -= 1;
                if (pressedKeys.has('ArrowDown')) v2 += 1;
                activeEngine.setPaddleVelocity(PlayerSide.RIGHT, v2);
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (validKeys.has(e.key)) {
                pressedKeys.add(e.key);
                updatePaddleVelocity();
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (validKeys.has(e.key)) {
                pressedKeys.delete(e.key);
                updatePaddleVelocity();
            }
        };

        // Mouse backup (optional, or remove if causing confusion. Leaving it for now but maybe prioritize keyboard)
        const handleMouseMove = (e: MouseEvent) => {
            if (canvasRef.current) {
                const rect = canvasRef.current.getBoundingClientRect();
                const y = e.clientY - rect.top;
                activeEngine.setPaddlePosition(PlayerSide.LEFT, y);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('mousemove', handleMouseMove);

        return () => {
            // Cleanup countdown interval
            clearInterval(countdownInterval);

            // Detach and Stop explicitly
            activeEngine.stop();
            activeEngine.detachCanvas();

            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('mousemove', handleMouseMove);

            // If local, we might allow it to persist in ref or clear it. 
            // Clearing it allows restart on remount.
            if (!externalEngine) {
                localEngineRef.current = null;
            }
        };
    }, [externalEngine, isAiOpponent]);

    return (
        <div style={{ position: 'relative', width: 800, height: 600, margin: '0 auto', border: '2px solid #333' }}>
            <ScoreDisplay
                leftScore={displayScores.left}
                rightScore={displayScores.right}
                player1Name={player1Name}
                player2Name={player2Name}
            />
            <canvas
                ref={canvasRef}
                width={800}
                height={600}
                style={{ width: '100%', height: '100%', cursor: 'none' }}
            />
            {countdown !== null && countdown > 0 && (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    fontSize: '120px',
                    fontWeight: 'bold',
                    color: '#fff',
                    textShadow: '0 0 20px rgba(100, 108, 255, 0.8)',
                    pointerEvents: 'none',
                    zIndex: 10
                }}>
                    {countdown}
                </div>
            )}
        </div>
    );
};
