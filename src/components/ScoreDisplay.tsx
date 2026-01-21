import React from 'react';

interface ScoreDisplayProps {
    leftScore: number;
    rightScore: number;
    player1Name?: string;
    player2Name?: string;
}

export const ScoreDisplay: React.FC<ScoreDisplayProps> = ({
    leftScore,
    rightScore,
    player1Name = "Player 1",
    player2Name = "Player 2"
}) => {
    return (
        <div style={{
            position: 'absolute',
            top: 20,
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            gap: '4rem',
            fontSize: '4rem',
            fontWeight: 'bold',
            color: '#fff',
            pointerEvents: 'none',
            fontFamily: 'monospace',
            textShadow: '0 2px 4px rgba(0,0,0,0.5)'
        }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.2rem', fontWeight: 'normal', color: '#aaa' }}>{player1Name}</span>
                <span>{leftScore}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.2rem', fontWeight: 'normal', color: '#aaa' }}>{player2Name}</span>
                <span>{rightScore}</span>
            </div>
        </div>
    );
};
