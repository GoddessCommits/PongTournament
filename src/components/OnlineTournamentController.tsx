import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { ref, onValue, update, set, push, onDisconnect } from 'firebase/database';
import { OnlineManager } from './OnlineManager';
import { PlayerSide } from '../engine/types';
import { SpectatorView } from './SpectatorView';
import { TournamentResults } from './TournamentResults';
interface OnlineTournamentControllerProps {
    lobbyId: string;
    playerName: string;
    isHost: boolean;
    onExit: () => void;
}

interface Match {
    p1: string; // Player Name
    p2: string; // Player Name
    winner?: string;
    id: number;
}

export const OnlineTournamentController: React.FC<OnlineTournamentControllerProps> = ({
    lobbyId,
    playerName,
    isHost,
    onExit
}) => {
    const [bracket, setBracket] = useState<Match[]>([]);
    const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
    const [tournamentWinner, setTournamentWinner] = useState<string | null>(null);

    // Handlers (Host Only)
    // We define this BEFORE the useEffect that uses it.
    const handleMatchEnd = (winnerName: string) => {
        if (!isHost) return;

        const currentMatch = bracket[currentMatchIndex];
        const newBracket = [...bracket];
        newBracket[currentMatchIndex] = { ...currentMatch, winner: winnerName };

        const allMatchesFinished = newBracket.every(m => m.winner);

        let updates: any = { bracket: newBracket };

        if (allMatchesFinished) {
            const winners = newBracket.map(m => m.winner!);
            if (winners.length === 1) {
                updates.winner = winners[0];
            } else {
                // Next Round
                const nextRoundMatches: Match[] = [];
                for (let i = 0; i < winners.length; i += 2) {
                    if (i + 1 < winners.length) {
                        nextRoundMatches.push({ id: newBracket.length + nextRoundMatches.length, p1: winners[i], p2: winners[i + 1] });
                    } else {
                        nextRoundMatches.push({ id: newBracket.length + nextRoundMatches.length, p1: winners[i], p2: "AI Bot (Filler)" });
                    }
                }
                updates.bracket = [...newBracket, ...nextRoundMatches];
                updates.currentMatchIndex = newBracket.length; // Start of next round
            }
        } else {
            // Find next match?
            // If we just have a list of matches, we just go +1
            if (currentMatchIndex + 1 < newBracket.length) {
                updates.currentMatchIndex = currentMatchIndex + 1;
            }
        }

        update(ref(db, `lobbies/${lobbyId}`), updates);
    };

    const [status, setStatus] = useState<'LOBBY' | 'STARTED'>('LOBBY');
    const [players, setPlayers] = useState<{ id: string; name: string }[]>([]);

    useEffect(() => {


        // Listen to everything important
        // Listen for specific fields to avoid 'gamestate' noise (which updates 30fps)

        // 1. Status
        const statusUnsub = onValue(ref(db, `lobbies/${lobbyId}/status`), (snapshot) => {
            const val = snapshot.val();
            if (val) setStatus(prev => prev !== val ? val : prev);
        });

        // 2. Bracket (Complex object, use stringify check if needed, but separate listener helps)
        const bracketUnsub = onValue(ref(db, `lobbies/${lobbyId}/bracket`), (snapshot) => {
            const val = snapshot.val();
            if (!val) return;
            setBracket(prev => JSON.stringify(prev) !== JSON.stringify(val) ? val : prev);
        });

        // 3. Match Index
        const matchIndexUnsub = onValue(ref(db, `lobbies/${lobbyId}/currentMatchIndex`), (snapshot) => {
            const val = snapshot.val();
            if (typeof val === 'number') setCurrentMatchIndex(prev => prev !== val ? val : prev);
        });

        // 4. Winner
        const winnerUnsub = onValue(ref(db, `lobbies/${lobbyId}/winner`), (snapshot) => {
            const val = snapshot.val();
            if (val) setTournamentWinner(prev => prev !== val ? val : prev);
        });

        // 5. Players
        const playersUnsub = onValue(ref(db, `lobbies/${lobbyId}/players`), (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const pList = Object.values(data) as { name: string }[];
                const newPlayers = pList.map((p, i) => ({ id: `p${i}`, name: p.name }));
                setPlayers(prev => JSON.stringify(prev) !== JSON.stringify(newPlayers) ? newPlayers : prev);
            }
        });

        return () => {
            statusUnsub();
            bracketUnsub();
            matchIndexUnsub();
            winnerUnsub();
            playersUnsub();
        };
    }, [lobbyId]);

    // Register Player in Lobby
    useEffect(() => {
        const playersRef = ref(db, `lobbies/${lobbyId}/players`);
        const newPlayerRef = push(playersRef);

        // set player info
        set(newPlayerRef, {
            name: playerName,
            joinedAt: Date.now()
        });

        // Remove on disconnect (clean up)
        onDisconnect(newPlayerRef).remove();

        return () => {
            // Also remove if component unmounts (e.g. user leaves manually)
            set(newPlayerRef, null);
        };
    }, [lobbyId, playerName]);

    // Start Tournament (Host Only)
    const handleStartTournament = () => {
        if (!isHost) return;

        // Generate Round-Robin Bracket (everyone plays everyone once)
        const names = players.map(p => p.name);
        if (names.length < 2) {
            alert("Need at least 2 players!");
            return;
        }

        // Add AI bot if odd number of players
        if (names.length % 2 !== 0) {
            names.push("AI Bot");
        }

        // Generate all possible match combinations (round-robin)
        const roundRobinMatches: Match[] = [];
        for (let i = 0; i < names.length; i++) {
            for (let j = i + 1; j < names.length; j++) {
                roundRobinMatches.push({
                    id: roundRobinMatches.length,
                    p1: names[i],
                    p2: names[j]
                });
            }
        }

        update(ref(db, `lobbies/${lobbyId}`), {
            bracket: roundRobinMatches,
            status: 'STARTED'
        });
    };

    // Listen for Match Results (Host Only)
    // IMPORTANT: This must be before any early returns to comply with Rules of Hooks
    useEffect(() => {
        if (!isHost) return;

        const matchResultRef = ref(db, `lobbies/${lobbyId}/matchResult`);
        const unsubscribe = onValue(matchResultRef, (snapshot) => {
            const result = snapshot.val();
            if (result && bracket[currentMatchIndex] && result.matchId === bracket[currentMatchIndex].id) {
                // Confirm it's for the current match
                handleMatchEnd(result.winner);
                // Clear the result to avoid re-trigger
                set(matchResultRef, null);
                // Also clear gamestate for next match
                set(ref(db, `lobbies/${lobbyId}/gamestate`), null);
            }
        });
        return () => unsubscribe();
    }, [isHost, lobbyId, bracket, currentMatchIndex]); // Dependencies critical

    if (status === 'LOBBY') {
        return (
            <div style={{ textAlign: 'center', marginTop: '4rem' }}>
                <h2>Lobby Code: <span style={{ fontFamily: 'monospace', color: '#646cff' }}>{lobbyId}</span></h2>
                <div style={{ margin: '2rem auto', maxWidth: 400, background: '#222', padding: '1rem', borderRadius: 8 }}>
                    <h3>Connected Players ({players.length})</h3>
                    <ul style={{ listStyle: 'none', padding: 0 }}>
                        {players.map(p => (
                            <li key={p.id} style={{ padding: '0.5rem', borderBottom: '1px solid #333' }}>
                                {p.name}
                            </li>
                        ))}
                    </ul>
                </div>
                {isHost ? (
                    <button
                        onClick={handleStartTournament}
                        style={{ fontSize: '1.2rem', padding: '1rem 2rem', background: '#28a745' }}
                    >
                        Start Tournament
                    </button>
                ) : (
                    <p>Waiting for host to start...</p>
                )}
                <div style={{ marginTop: '2rem' }}>
                    <button onClick={onExit} style={{ background: '#555' }}>Leave</button>
                </div>
            </div>
        );
    }



    if (tournamentWinner) {
        return (
            <TournamentResults
                bracket={bracket}
                onExit={onExit}
            />
        );
    }

    if (bracket.length === 0) {
        return <div style={{ textAlign: 'center', marginTop: '2rem' }}>Initializing Bracket...</div>;
    }

    // Find the player's current match (first uncompleted match they're in)
    const myMatch = bracket.find(m =>
        !m.winner && (m.p1 === playerName || m.p2 === playerName)
    );

    if (!myMatch) {
        // Player has no more matches - check if tournament is complete
        const allMatchesComplete = bracket.every(m => m.winner !== undefined);

        if (allMatchesComplete) {
            return (
                <TournamentResults
                    bracket={bracket}
                    onExit={onExit}
                />
            );
        }

        // Player finished their matches but tournament not done - spectate
        const ongoingMatch = bracket.find(m => !m.winner);
        if (ongoingMatch) {
            return (
                <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                    <h2>Your Matches Complete!</h2>
                    <p style={{ color: '#888', margin: '2rem 0' }}>
                        Waiting for other matches to finish...
                    </p>
                    <h3>Ongoing Match</h3>
                    <div style={{ fontSize: '1.5rem', margin: '1rem 0', color: '#646cff' }}>
                        {ongoingMatch.p1} vs {ongoingMatch.p2}
                    </div>
                    <SpectatorView
                        lobbyId={lobbyId}
                        matchId={ongoingMatch.id}
                        player1Name={ongoingMatch.p1}
                        player2Name={ongoingMatch.p2}
                    />
                </div>
            );
        }

        return <div style={{ textAlign: 'center', marginTop: '2rem' }}>Waiting...</div>;
    }

    const isP1 = myMatch.p1 === playerName;

    // Active Player - render their match
    return (
        <OnlineManager
            lobbyId={lobbyId}
            matchId={myMatch.id}
            // If I am P1 -> LEFT host. If P2 -> RIGHT guest.
            playerSide={isP1 ? PlayerSide.LEFT : PlayerSide.RIGHT}
            playerName={playerName}
            // Determine opponent name
            opponentName={isP1 ? myMatch.p2 : myMatch.p1}
            // Game End handled by OnlineManager internal UI flow usually,
            // but we also need onMatchComplete
            onGameEnd={() => { /* Do nothing, wait for bracket update */ }}

            // Only P1 (Authority) writes result
            onMatchComplete={(winnerSide: PlayerSide) => {
                const wName = winnerSide === PlayerSide.LEFT ? myMatch.p1 : myMatch.p2;
                if (isP1) {
                    // Update the specific match in the bracket
                    const updatedBracket = bracket.map(m =>
                        m.id === myMatch.id ? { ...m, winner: wName } : m
                    );
                    update(ref(db, `lobbies/${lobbyId}`), {
                        bracket: updatedBracket
                    });
                }
            }}
        />
    );
};
