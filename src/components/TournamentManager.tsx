import { useState } from 'react';
import { Lobby } from './Lobby';
import { OnlineTournamentController } from './OnlineTournamentController';
import { GameScreen } from './GameScreen';
import { PlayerSide } from '../engine/types';

interface Match {
    p1: string;
    p2: string;
    winner?: string;
}

export const TournamentManager = () => {
    const [phase, setPhase] = useState<'LOBBY' | 'BRACKET' | 'GAME' | 'WINNER' | 'ONLINE_GAME'>('LOBBY');
    const [, setPlayers] = useState<string[]>([]);
    const [matches, setMatches] = useState<Match[]>([]);
    const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
    const [tournamentWinner, setTournamentWinner] = useState<string | null>(null);

    const [onlineConfig, setOnlineConfig] = useState<{
        lobbyId: string;
        isHost: boolean;
        playerName: string;
    } | null>(null);

    const startTournament = (playerNames: string[]) => {
        let currentPlayers = [...playerNames];

        // Fill with AI if odd
        if (currentPlayers.length % 2 !== 0) {
            currentPlayers.push('AI Bot');
        }

        // Create first round matches
        const newMatches: Match[] = [];
        for (let i = 0; i < currentPlayers.length; i += 2) {
            newMatches.push({ p1: currentPlayers[i], p2: currentPlayers[i + 1] });
        }

        setPlayers(currentPlayers);
        setMatches(newMatches);
        setCurrentMatchIndex(0);
        setPhase('BRACKET');
    };

    const startOnlineGame = (lobbyId: string, playerName: string, isHost: boolean) => {
        setOnlineConfig({
            lobbyId,
            isHost,
            playerName
        });
        setPhase('ONLINE_GAME');
    };

    const startNextMatch = () => {
        setPhase('GAME');
    };

    const handleMatchEnd = (winnerSide: PlayerSide) => {
        const currentMatch = matches[currentMatchIndex];
        const winnerName = winnerSide === PlayerSide.LEFT ? currentMatch.p1 : currentMatch.p2;

        const updatedMatches = [...matches];
        updatedMatches[currentMatchIndex].winner = winnerName;
        setMatches(updatedMatches);

        setPhase('BRACKET'); // Go back to bracket to show progress or start next match logic
    };

    const advanceRound = () => {
        // Check if current round is finished
        if (matches.every(m => m.winner)) {
            const winners = matches.map(m => m.winner!);
            if (winners.length === 1) {
                setTournamentWinner(winners[0]);
                setPhase('WINNER');
                return;
            }

            // Create next round
            const nextRoundMatches: Match[] = [];
            for (let i = 0; i < winners.length; i += 2) {
                if (i + 1 < winners.length) {
                    nextRoundMatches.push({ p1: winners[i], p2: winners[i + 1] });
                } else {
                    nextRoundMatches.push({ p1: winners[i], p2: "AI Bot (Filler)" });
                }
            }
            setMatches(nextRoundMatches);
            setCurrentMatchIndex(0);
        } else {
            // Next match in current round
            setCurrentMatchIndex(prev => prev + 1);
        }
    };

    if (phase === 'LOBBY') {
        return <Lobby onStartTournament={startTournament} onStartOnlineGame={startOnlineGame} />;
    }

    if (phase === 'WINNER') {
        return (
            <div style={{ textAlign: 'center' }}>
                <h1>🏆 TOURNAMENT WINNER 🏆</h1>
                <h2 style={{ fontSize: '4rem', color: 'gold' }}>{tournamentWinner}</h2>
                <button onClick={() => setPhase('LOBBY')}>New Tournament</button>
            </div>
        );
    }

    if (phase === 'BRACKET') {
        const currentMatch = matches[currentMatchIndex];
        if (!currentMatch) {
            return (
                <div style={{ textAlign: 'center' }}>
                    <h2>Round Complete!</h2>
                    <button onClick={advanceRound}>Start Next Round</button>
                </div>
            );
        }

        if (currentMatch.winner) {
            return (
                <div style={{ textAlign: 'center' }}>
                    <h2>Match Complete!</h2>
                    <h3>Winner: {currentMatch.winner}</h3>
                    <button onClick={advanceRound}>Continue</button>
                </div>
            );
        }

        return (
            <div style={{ textAlign: 'center' }}>
                <h2>Next Match</h2>
                <div style={{ fontSize: '2rem', margin: '2rem' }}>
                    {currentMatch.p1} <span style={{ fontSize: '1rem', color: '#888' }}>VS</span> {currentMatch.p2}
                </div>
                <button
                    onClick={startNextMatch}
                    style={{ fontSize: '1.5rem', padding: '1rem 3rem', background: 'green' }}
                >
                    FIGHT!
                </button>
            </div>
        );
    }

    if (phase === 'GAME') {
        const currentMatch = matches[currentMatchIndex];
        const isAi = currentMatch.p2.includes('AI') || currentMatch.p2.includes('Bot');

        return (
            <div>
                <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                    {currentMatch.p1} vs {currentMatch.p2}
                </div>
                <GameScreen
                    onMatchEnd={handleMatchEnd}
                    isAiOpponent={isAi}
                    player1Name={currentMatch.p1}
                    player2Name={currentMatch.p2}
                />
            </div>
        );
    }

    if (phase === 'ONLINE_GAME' && onlineConfig) {
        return (
            <OnlineTournamentController
                lobbyId={onlineConfig.lobbyId}
                isHost={onlineConfig.isHost}
                playerName={onlineConfig.playerName}
                onExit={() => setPhase('LOBBY')}
            />
        );
    }

    return null;
};
