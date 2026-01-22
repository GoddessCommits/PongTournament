import React, { useEffect, useState, useMemo } from 'react';
import { GameScreen } from './GameScreen';
import { PlayerSide } from '../engine/types';
import { db } from '../firebase';
import { ref, onValue, update, onDisconnect } from 'firebase/database';
import { GameEngine } from '../engine/GameEngine';

// --- SOLID: Dependency Inversion (Interface for Sync Logic) ---
interface SyncState {
    ball: { x: number; y: number; vx: number; vy: number };
    score: { left: number; right: number };
    paddleLeft: number;
    paddleRight?: number;
}

interface OnlineManagerProps {
    lobbyId: string;
    matchId: string;
    playerSide: PlayerSide;
    playerName: string;
    opponentName: string;
    onGameEnd: () => void;
    onMatchComplete?: (winner: PlayerSide) => void;
}

export const OnlineManager: React.FC<OnlineManagerProps> = (props) => {
    const { lobbyId, matchId, playerSide, playerName, opponentName, onGameEnd, onMatchComplete } = props;
    const [scores, setScores] = useState({ left: 0, right: 0 });

    // 1. Initialize Engine
    const engine = useMemo(() => {
        const e = new GameEngine({
            onScore: (l, r) => setScores({ left: l, right: r }),
            onMatchEnd: (winner) => {
                onGameEnd();
                onMatchComplete?.(winner);
            }
        });

        if (opponentName.includes('AI Bot') && playerSide === PlayerSide.LEFT) {
            e.enableAI(PlayerSide.RIGHT);
        }
        return e;
    }, [matchId]);

    // 2. Networking Logic (Encapsulated)
    useEffect(() => {
        const gameStatePath = `lobbies/${lobbyId}/matches/${matchId}/gamestate`;
        const gameStateRef = ref(db, gameStatePath);
        const isHost = playerSide === PlayerSide.LEFT;
        const isVsAI = opponentName.includes('AI Bot');

        // Cleanup on disconnect
        onDisconnect(ref(db, `lobbies/${lobbyId}`)).remove();

        // SHARED: Sync Loop (Throttle logic)
        const syncLoop = setInterval(() => {
            if (engine.state !== 'PLAYING') return;

            if (isHost) {
                const updates: Partial<SyncState> = {
                    ball: { ...engine.ball },
                    score: engine.scores,
                    paddleLeft: engine.leftPaddle.y
                };
                if (isVsAI) updates.paddleRight = engine.rightPaddle.y;
                update(gameStateRef, updates);
            } else {
                // GUEST: Only sync their own paddle
                update(gameStateRef, { paddleRight: engine.rightPaddle.y });
            }
        }, 60); // 60ms is roughly 16 ticks/sec - standard for low-bandwidth sync

        // INCOMING DATA: Listen for updates
        const unsubscribe = onValue(gameStateRef, (snapshot) => {
            const data: SyncState = snapshot.val();
            if (!data) return;

            if (isHost) {
                // Host only listens for Guest paddle (if not AI)
                if (!isVsAI && typeof data.paddleRight === 'number') {
                    engine.rightPaddle.setPosition(data.paddleRight, engine.config);
                }
            } else {
                // Guest applies Host's authority with Interpolation
                if (data.ball) {
                    const lerp = 0.8;
                    engine.ball.x += (data.ball.x - engine.ball.x) * lerp;
                    engine.ball.y += (data.ball.y - engine.ball.y) * lerp;
                    engine.ball.vx = data.ball.vx;
                    engine.ball.vy = data.ball.vy;
                }
                if (data.score) {
                    engine.scores = data.score;
                    setScores({ ...data.score });

                    // Check for Game Over (Guest Side Trigger)
                    if (engine.state === 'PLAYING') {
                        if (data.score.left >= engine.config.winningScore) {
                            engine.endGame(PlayerSide.LEFT);
                        } else if (data.score.right >= engine.config.winningScore) {
                            engine.endGame(PlayerSide.RIGHT);
                        }
                    }
                }
                if (data.paddleLeft) engine.leftPaddle.setPosition(data.paddleLeft, engine.config);
            }
        });

        return () => {
            clearInterval(syncLoop);
            unsubscribe();
        };
    }, [engine, lobbyId, matchId, playerSide]);

    return (
        <GameScreen
            onMatchEnd={() => { }} // Handled by engine callback
            isAiOpponent={opponentName.includes('AI Bot')}
            player1Name={playerName}
            player2Name={opponentName}
            engine={engine}
            externalScores={scores}
            playerSide={playerSide}
        />
    );
};