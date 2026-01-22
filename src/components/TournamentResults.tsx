import React from 'react';

interface Match {
    p1: string;
    p2: string;
    winner?: string;
    id: string;
}

interface TournamentResultsProps {
    bracket: Match[];
    onExit: () => void;
}

export const TournamentResults: React.FC<TournamentResultsProps> = ({
    bracket,
    onExit
}) => {
    // Calculate wins per player
    const playerWins = new Map<string, number>();

    bracket.forEach(match => {
        if (match.winner) {
            playerWins.set(match.winner, (playerWins.get(match.winner) || 0) + 1);
        }
    });

    // Sort by wins (descending)
    const leaderboard = Array.from(playerWins.entries())
        .sort((a, b) => b[1] - a[1]);

    const winner = leaderboard[0];

    return (
        <div style={{
            textAlign: 'center',
            padding: '2rem',
            maxWidth: '800px',
            margin: '0 auto'
        }}>
            <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>
                🏆 Tournament Complete! 🏆
            </h1>

            <div style={{
                fontSize: '4rem',
                margin: '2rem 0',
                color: '#ffd700',
                fontWeight: 'bold',
                textShadow: '0 0 20px rgba(255, 215, 0, 0.5)'
            }}>
                {winner[0]}
            </div>
            <p style={{ fontSize: '2rem', color: '#646cff', marginBottom: '3rem' }}>
                Champion!
            </p>

            <h2 style={{ fontSize: '2rem', marginBottom: '1.5rem' }}>
                Final Standings
            </h2>

            <table style={{
                margin: '0 auto',
                fontSize: '1.3rem',
                borderCollapse: 'collapse',
                width: '100%',
                maxWidth: '500px'
            }}>
                <thead>
                    <tr style={{ borderBottom: '2px solid #646cff' }}>
                        <th style={{ padding: '1rem', textAlign: 'left' }}>Rank</th>
                        <th style={{ padding: '1rem', textAlign: 'left' }}>Player</th>
                        <th style={{ padding: '1rem', textAlign: 'center' }}>Wins</th>
                    </tr>
                </thead>
                <tbody>
                    {leaderboard.map(([player, wins], index) => (
                        <tr
                            key={player}
                            style={{
                                borderBottom: '1px solid #333',
                                backgroundColor: index === 0 ? 'rgba(255, 215, 0, 0.1)' : 'transparent'
                            }}
                        >
                            <td style={{ padding: '1rem' }}>
                                {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`}
                            </td>
                            <td style={{
                                padding: '1rem',
                                fontWeight: index === 0 ? 'bold' : 'normal',
                                color: index === 0 ? '#ffd700' : 'inherit'
                            }}>
                                {player}
                            </td>
                            <td style={{ padding: '1rem', textAlign: 'center' }}>
                                {wins}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <button
                onClick={onExit}
                style={{
                    marginTop: '3rem',
                    padding: '1rem 2rem',
                    fontSize: '1.2rem',
                    backgroundColor: '#646cff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer'
                }}
            >
                Return to Home Page
            </button>
        </div>
    );
};
