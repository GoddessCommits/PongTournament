import React, { useEffect, useState } from 'react';
import { GameScreen } from './GameScreen';
import { PlayerSide } from '../engine/types';
import { db } from '../firebase';
import { ref, onValue, update, onDisconnect } from 'firebase/database';
import { GameEngine } from '../engine/GameEngine';

interface OnlineManagerProps {
    lobbyId: string;
    playerSide: PlayerSide; // 'LEFT' is Host/Authority, 'RIGHT' is Guest/Peer
    playerName: string;
    opponentName: string;
    onGameEnd: () => void;
    onMatchComplete?: (winner: PlayerSide) => void;
}

export const OnlineManager: React.FC<OnlineManagerProps> = ({
    lobbyId,
    playerSide,
    onGameEnd,
    playerName,
    opponentName,
    onMatchComplete
}) => {
    // State for scores to pass down to UI
    const [scores, setScores] = useState({ left: 0, right: 0 });

    // Instantiate Engine ONCE
    const engine = React.useMemo(() => {
        return new GameEngine({
            onScore: (left, right) => setScores({ left, right }),
            onMatchEnd: (winner) => {
                // We'll handle this via props/refs if needed, but OnlineManager controls flow mostly via useEffect below?
                // Actually, onMatchEnd is passed to GameScreen which calls props.
                // But since WE own the engine, we should probably handle it or let GameScreen handle it?
                // GameScreen calls props.onMatchEnd when it receives this event...
                // WAIT: If we pass engine to GameScreen, GameScreen attaches listeners?
                // NO. GameScreen attaches CANVAS.
                // The Engine events are defined HERE in constructor.
                // So WE need to call the props.

                // However, GameScreen ALSO takes onMatchEnd prop.
                // But GameScreen only calls onMatchEnd if IT created the engine?
                // No, let's check GameScreen:
                // It calls `activeEngine = ...`
                // It does NOT re-attach listeners if external engine.
                // So WE must call the prop here.
                onGameEnd();
                if (onMatchComplete) onMatchComplete(winner);
            }
        });
    }, []); // Empty deps = once per component lifecycle

    useEffect(() => {
        if (!engine) return;

        const lobbyRef = ref(db, `lobbies/${lobbyId}`);
        const gameStateRef = ref(db, `lobbies/${lobbyId}/gamestate`);

        // Disconnect cleanup
        onDisconnect(lobbyRef).remove();

        if (playerSide === PlayerSide.LEFT) {
            // HOST LOGIC (AUTHORITY)
            let lastSyncedBall = { x: 0, y: 0 };

            const syncInterval = setInterval(() => {
                if (engine.state === 'PLAYING') {
                    // Only sync if ball moved significantly (reduces Firebase writes)
                    const dx = Math.abs(engine.ball.x - lastSyncedBall.x);
                    const dy = Math.abs(engine.ball.y - lastSyncedBall.y);

                    if (dx > 2 || dy > 2) { // Threshold in pixels
                        update(gameStateRef, {
                            ball: {
                                x: engine.ball.x,
                                y: engine.ball.y,
                                vx: engine.ball.vx,
                                vy: engine.ball.vy
                            },
                            score: engine.scores,
                            paddleLeft: engine.leftPaddle.y
                        });

                        lastSyncedBall = { x: engine.ball.x, y: engine.ball.y };
                    }
                }
            }, 50); // Reduced from 30ms to 50ms for better performance

            // Listen for Guest Paddle
            const unsubscribe = onValue(ref(db, `lobbies/${lobbyId}/gamestate/paddleRight`), (snapshot) => {
                const val = snapshot.val();
                if (typeof val === 'number') {
                    engine.rightPaddle.setPosition(val, engine.config);
                }
            });

            return () => {
                clearInterval(syncInterval);
                unsubscribe();
            };

        } else {
            // GUEST LOGIC
            // Reduced sync interval for better performance
            const syncInterval = setInterval(() => {
                update(gameStateRef, {
                    paddleRight: engine.rightPaddle.y
                });
            }, 50); // Reduced from 30ms to 50ms

            // Listen for Host State with interpolation
            const unsubscribe = onValue(gameStateRef, (snapshot) => {
                const data = snapshot.val();
                if (data) {
                    if (data.ball) {
                        // Interpolate ball position for smooth movement
                        // Instead of teleporting, smoothly blend toward target position
                        const lerpFactor = 0.6; // Increased from 0.3 for better responsiveness

                        engine.ball.x += (data.ball.x - engine.ball.x) * lerpFactor;
                        engine.ball.y += (data.ball.y - engine.ball.y) * lerpFactor;

                        // Store velocity for visual consistency (guest doesn't run ball physics)
                        engine.ball.vx = data.ball.vx;
                        engine.ball.vy = data.ball.vy;
                    }
                    if (data.score) {
                        engine.scores = data.score;
                        // Also update local state for UI
                        setScores(prev => (prev.left === data.score.left && prev.right === data.score.right) ? prev : data.score);
                    }
                    if (typeof data.paddleLeft === 'number') {
                        engine.leftPaddle.setPosition(data.paddleLeft, engine.config);
                    }
                }
            });

            return () => {
                clearInterval(syncInterval);
                unsubscribe();
            };
        }
    }, [engine, lobbyId, playerSide]);

    const p1Name = playerSide === PlayerSide.LEFT ? playerName : opponentName;
    const p2Name = playerSide === PlayerSide.LEFT ? opponentName : playerName;

    return (
        <GameScreen
            onMatchEnd={(winner) => {
                // This might be redundant if we handle it in constructor, 
                // but GameScreen might keep using it for other things or it's harmless.
                onGameEnd();
                if (onMatchComplete) onMatchComplete(winner);
            }}
            isAiOpponent={false}
            player1Name={p1Name}
            player2Name={p2Name}
            engine={engine}
            externalScores={scores}
        />
    );
};
