import React, { useEffect, useState } from 'react';
import { PlayerSide } from '../engine/types';

interface MatchCompletionScreenProps {
    winner: PlayerSide;
    player1Name: string;
    player2Name: string;
    onContinue: () => void;
}

export const MatchCompletionScreen: React.FC<MatchCompletionScreenProps> = ({
    winner,
    player1Name,
    player2Name,
    onContinue
}) => {
    const [countdown, setCountdown] = useState(5);

    useEffect(() => {
        const interval = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(interval);
                    onContinue();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [onContinue]);

    const winnerName = winner === PlayerSide.LEFT ? player1Name : player2Name;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            zIndex: 1000
        }}>
            <h1 style={{
                fontSize: '4rem',
                color: '#ffd700',
                marginBottom: '2rem',
                textShadow: '0 0 30px rgba(255, 215, 0, 0.8)'
            }}>
                🏆 {winnerName} Wins! 🏆
            </h1>

            <div style={{
                fontSize: '6rem',
                color: '#fff',
                fontWeight: 'bold',
                marginTop: '2rem'
            }}>
                {countdown}
            </div>

            <p style={{
                fontSize: '1.5rem',
                color: '#888',
                marginTop: '1rem'
            }}>
                Next match starting...
            </p>
        </div>
    );
};
