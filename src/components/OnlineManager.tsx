import React, { useEffect, useState } from 'react';
import { GameScreen } from './GameScreen';
import { PlayerSide } from '../engine/types';
import { db } from '../firebase';
import { ref, onValue, update, onDisconnect } from 'firebase/database';
import { GameEngine } from '../engine/GameEngine';

interface OnlineManagerProps {
    lobbyId: string;
    matchId: number;
    playerSide: PlayerSide; // 'LEFT' is Host/Authority, 'RIGHT' is Guest/Peer
    playerName: string;
    opponentName: string;
    onGameEnd: () => void;
    onMatchComplete?: (winner: PlayerSide) => void;
}

export const OnlineManager: React.FC<OnlineManagerProps> = ({
    lobbyId,
    matchId,
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
        const newEngine = new GameEngine({
            onScore: (left, right) => setScores({ left, right }),
            onMatchEnd: (winner) => {
                onGameEnd();
                if (onMatchComplete) onMatchComplete(winner);
            }
        });

        // Enable AI if opponent is AI Bot - ONLY on host side (LEFT)
        // This prevents conflicts where both players try to control the AI
        if (opponentName.includes('AI Bot') && playerSide === PlayerSide.LEFT) {
            const aiSide = PlayerSide.RIGHT; // AI is always on right when playing vs host
            newEngine.enableAI(aiSide);
        }

        return newEngine;
    }, [opponentName, playerSide]); // Added dependencies

    useEffect(() => {
        if (!engine) return;

        const lobbyRef = ref(db, `lobbies/${lobbyId}`);
        const gameStateRef = ref(db, `lobbies/${lobbyId}/matches/${matchId}/gamestate`);

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
                        const updates: any = {
                            ball: {
                                x: engine.ball.x,
                                y: engine.ball.y,
                                vx: engine.ball.vx,
                                vy: engine.ball.vy
                            },
                            score: engine.scores,
                            paddleLeft: engine.leftPaddle.y
                        };

                        // IMPORTANT: Also sync right paddle if AI is playing
                        // This allows spectators to see the AI paddle
                        if (opponentName.includes('AI Bot')) {
                            updates.paddleRight = engine.rightPaddle.y;
                        }

                        update(gameStateRef, updates);

                        lastSyncedBall = { x: engine.ball.x, y: engine.ball.y };
                    }
                }
            }, 50); // Reduced from 30ms to 50ms for better performance

            // Listen for Guest Paddle
            const unsubscribe = onValue(ref(db, `lobbies/${lobbyId}/matches/${matchId}/gamestate/paddleRight`), (snapshot) => {
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
                        const lerpFactor = 0.85; // Increased from 0.6 for better responsiveness

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
    }, [engine, lobbyId, matchId, playerSide, opponentName]);

    // Fix name display to match player's perspective
    // Both players control the LEFT paddle on their screen
    // So guest (RIGHT) should see their name on left, opponent on right
    const p1Name = playerName;  // Always show player's name on left (they control left paddle)
    const p2Name = opponentName; // Always show opponent on right

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
            playerSide={playerSide}
        />
    );
};
