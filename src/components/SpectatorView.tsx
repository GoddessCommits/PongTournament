import React, { useEffect, useRef, useState } from 'react';
import { db } from '../firebase';
import { ref, onValue } from 'firebase/database';
import { ScoreDisplay } from './ScoreDisplay';

interface SpectatorViewProps {
    lobbyId: string;
    player1Name: string;
    player2Name: string;
}

export const SpectatorView: React.FC<SpectatorViewProps> = ({
    lobbyId,
    player1Name,
    player2Name
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [gameState, setGameState] = useState<any>(null);
    const animationFrameRef = useRef<number | undefined>(undefined);

    // Listen to game state from Firebase
    useEffect(() => {
        const gameStateRef = ref(db, `lobbies/${lobbyId}/gamestate`);
        const unsubscribe = onValue(gameStateRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                setGameState(data);
            }
        });
        return () => {
            unsubscribe();
        };
    }, [lobbyId]);

    // Render game state on canvas
    useEffect(() => {
        if (!canvasRef.current || !gameState) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const render = () => {
            // Clear canvas
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, 800, 600);

            // Draw center line
            ctx.strokeStyle = '#333';
            ctx.setLineDash([10, 10]);
            ctx.beginPath();
            ctx.moveTo(400, 0);
            ctx.lineTo(400, 600);
            ctx.stroke();
            ctx.setLineDash([]);

            // Draw paddles
            ctx.fillStyle = '#fff';
            if (typeof gameState.paddleLeft === 'number') {
                ctx.fillRect(10, gameState.paddleLeft, 10, 100);
            }
            if (typeof gameState.paddleRight === 'number') {
                ctx.fillRect(780, gameState.paddleRight, 10, 100);
            }

            // Draw ball
            if (gameState.ball) {
                ctx.beginPath();
                ctx.arc(gameState.ball.x, gameState.ball.y, 8, 0, Math.PI * 2);
                ctx.fill();
            }

            animationFrameRef.current = requestAnimationFrame(render);
        };

        render();

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [gameState]);

    const scores = gameState?.score || { left: 0, right: 0 };

    return (
        <div style={{ position: 'relative', width: 800, height: 600, margin: '0 auto', border: '2px solid #333' }}>
            <ScoreDisplay
                leftScore={scores.left}
                rightScore={scores.right}
                player1Name={player1Name}
                player2Name={player2Name}
            />
            <canvas
                ref={canvasRef}
                width={800}
                height={600}
                style={{ width: '100%', height: '100%' }}
            />
            <div style={{
                position: 'absolute',
                bottom: 10,
                left: 0,
                right: 0,
                textAlign: 'center',
                color: '#888',
                fontSize: '14px'
            }}>
                Spectating - Waiting for your turn...
            </div>
        </div>
    );
};
