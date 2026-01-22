import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { ref, onValue, update, set, push, onDisconnect } from 'firebase/database';
import { OnlineManager } from './OnlineManager';
import { PlayerSide } from '../engine/types';
import { SpectatorView } from './SpectatorView';
import { TournamentResults } from './TournamentResults';
import { MatchCompletionScreen } from './MatchCompletionScreen';
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
    id: string; // Unique ID (e.g. round_X_match_Y)
}

export const OnlineTournamentController: React.FC<OnlineTournamentControllerProps> = ({
    lobbyId,
    playerName,
    isHost,
    onExit
}) => {
    const [bracket, setBracket] = useState<Match[]>([]);
    const [tournamentWinner, setTournamentWinner] = useState<string | null>(null);
    const [matchJustCompleted, setMatchJustCompleted] = useState<{ winner: PlayerSide, p1: string, p2: string } | null>(null);
    const [currentRound, setCurrentRound] = useState(0);
    const [totalRounds, setTotalRounds] = useState(0);
    const [playerNames, setPlayerNames] = useState<string[]>([]);
    const [roundComplete, setRoundComplete] = useState(false);
    const [completedMatchIds, setCompletedMatchIds] = useState<Set<string>>(new Set());

    const [status, setStatus] = useState<'LOBBY' | 'STARTED'>('LOBBY');
    const [players, setPlayers] = useState<{ id: string; name: string }[]>([]);

    const handleMatchEnd = (matchId: string, winnerName: string) => {
        // Track locally to prevent infinite loop immediately
        setCompletedMatchIds(prev => new Set(prev).add(matchId));

        const updatedBracket = bracket.map(m =>
            m.id === matchId ? { ...m, winner: winnerName } : m
        );
        setBracket(updatedBracket);

        if (!isHost) return;

        const allRoundMatchesComplete = updatedBracket.every(m => m.winner !== undefined);
        const gameStateRef = ref(db, `lobbies/${lobbyId}/matches/${matchId}/gamestate`);

        if (allRoundMatchesComplete && currentRound < totalRounds - 1) {
            update(ref(db, `lobbies/${lobbyId}`), {
                bracket: updatedBracket,
                roundComplete: true
            });
            set(gameStateRef, null);
        } else if (allRoundMatchesComplete) {
            update(ref(db, `lobbies/${lobbyId}`), {
                bracket: updatedBracket,
                status: 'COMPLETE'
            });
            set(gameStateRef, null);
        } else {
            update(ref(db, `lobbies/${lobbyId}`), {
                bracket: updatedBracket
            });
            set(gameStateRef, null);
        }
    };

    useEffect(() => {


        // Listen to everything important
        // Listen for specific fields to avoid 'gamestate' noise (which updates 30fps)

        // 1. Status
        const statusUnsub = onValue(ref(db, `lobbies/${lobbyId}/status`), (snapshot) => {
            const val = snapshot.val();
            if (val) setStatus(prev => prev !== val ? val : prev);
        });

        // 2. Bracket
        const bracketUnsub = onValue(ref(db, `lobbies/${lobbyId}/bracket`), (snapshot) => {
            const val = snapshot.val();
            if (val) {
                setBracket(prev => JSON.stringify(prev) !== JSON.stringify(val) ? val : prev);
            }
        });

        // 3. Winner
        const winnerUnsub = onValue(ref(db, `lobbies/${lobbyId}/winner`), (snapshot) => {
            const val = snapshot.val();
            if (val) setTournamentWinner(prev => prev !== val ? val : prev);
        });

        // 4. Players
        const playersUnsub = onValue(ref(db, `lobbies/${lobbyId}/players`), (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const pList = Object.values(data) as { name: string }[];
                // Sort to ensure deterministic order for JSON.stringify comparison
                pList.sort((a, b) => a.name.localeCompare(b.name));

                const newPlayers = pList.map((p, i) => ({ id: `p${i}`, name: p.name }));
                setPlayers(prev => JSON.stringify(prev) !== JSON.stringify(newPlayers) ? newPlayers : prev);
            }
        });

        // 5. Current Round
        const roundUnsub = onValue(ref(db, `lobbies/${lobbyId}/currentRound`), (snapshot) => {
            const val = snapshot.val();
            if (typeof val === 'number') setCurrentRound(val);
        });

        // 6. Total Rounds
        const totalRoundsUnsub = onValue(ref(db, `lobbies/${lobbyId}/totalRounds`), (snapshot) => {
            const val = snapshot.val();
            if (typeof val === 'number') setTotalRounds(val);
        });

        // 7. Player Names
        const playerNamesUnsub = onValue(ref(db, `lobbies/${lobbyId}/playerNames`), (snapshot) => {
            const val = snapshot.val();
            if (val) setPlayerNames(val);
        });

        // 8. Round Complete
        const roundCompleteUnsub = onValue(ref(db, `lobbies/${lobbyId}/roundComplete`), (snapshot) => {
            setRoundComplete(snapshot.val() === true);
        });

        return () => {
            statusUnsub();
            bracketUnsub();
            winnerUnsub();
            playersUnsub();
            roundUnsub();
            totalRoundsUnsub();
            playerNamesUnsub();
            roundCompleteUnsub();
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

        const names = players.map(p => p.name);
        if (names.length < 2) {
            alert("Need at least 2 players!");
            return;
        }

        // Generate first round of rotating pairs
        const firstRound = generateRoundMatches(names, 0);

        // Calculate total rounds needed for round-robin
        // With odd players: need N rounds (each player plays N-1 humans + 1 AI)
        // With even players: need N-1 rounds (each player plays N-1 opponents)
        const totalRoundsNeeded = names.length;

        update(ref(db, `lobbies/${lobbyId}`), {
            bracket: firstRound,
            currentRound: 0,
            totalRounds: totalRoundsNeeded,
            playerNames: names,
            status: 'STARTED'
        });
    };

    // Helper function to generate one round of matches with rotating pairs
    // Uses the "Circle Method" to ensure everyone plays everyone once without duplicates
    const generateRoundMatches = (playerNames: string[], roundNumber: number): Match[] => {
        let players = [...playerNames];
        // If odd, add AI Bot to make it even for the pairing algorithm
        if (players.length % 2 !== 0) {
            players.push("AI Bot");
        }

        const n = players.length;
        const matches: Match[] = [];
        const pivot = players[0];
        const others = players.slice(1);
        const m = others.length;

        // Rotate the 'others' part based on round number
        const rotated = [];
        for (let i = 0; i < m; i++) {
            rotated.push(others[(i + roundNumber) % m]);
        }

        // Pair pivot with the last element of the rotated list
        matches.push({
            id: `r${roundNumber}_m0`,
            p1: pivot,
            p2: rotated[m - 1]
        });

        // Pair the rest: rotated[0] vs rotated[m-2], rotated[1] vs rotated[m-3], etc.
        for (let i = 0; i < (n / 2) - 1; i++) {
            matches.push({
                id: `r${roundNumber}_m${i + 1}`,
                p1: rotated[i],
                p2: rotated[m - 2 - i]
            });
        }

        return matches;
    };

    const handleStartNextRound = () => {
        if (!isHost) return;

        // Generate next round
        const nextRound = generateRoundMatches(playerNames, currentRound + 1);
        update(ref(db, `lobbies/${lobbyId}`), {
            bracket: nextRound,
            currentRound: currentRound + 1,
            roundComplete: false
        });
    };



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
                    {isHost && (
                        <button
                            onClick={() => {
                                if (confirm('Are you sure? This will wipe all data.')) {
                                    set(ref(db, `lobbies/${lobbyId}`), null);
                                }
                            }}
                            style={{ background: '#dc3545', marginRight: '1rem' }}
                        >
                            Reset Lobby
                        </button>
                    )}
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

    // Show "Round Complete" screen if waiting for next round
    if (roundComplete) {
        return (
            <div style={{ textAlign: 'center', marginTop: '4rem' }}>
                <h1 style={{ fontSize: '3rem', color: '#ffd700' }}>
                    🎉 Round {currentRound + 1} Complete! 🎉
                </h1>
                <p style={{ fontSize: '1.5rem', margin: '2rem 0', color: '#888' }}>
                    All matches finished!
                </p>
                {isHost ? (
                    <button
                        onClick={handleStartNextRound}
                        style={{
                            fontSize: '1.5rem',
                            padding: '1rem 2rem',
                            background: '#28a745',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer'
                        }}
                    >
                        Start Round {currentRound + 2}
                    </button>
                ) : (
                    <p style={{ fontSize: '1.2rem', color: '#646cff' }}>
                        Waiting for host to start next round...
                    </p>
                )}
            </div>
        );
    }

    // Reset completed matches when round changes
    useEffect(() => {
        setCompletedMatchIds(new Set());
    }, [currentRound]);

    // Find the player's current match (first uncompleted match they're in)
    const myMatch = bracket.find(m =>
        !m.winner && !completedMatchIds.has(m.id) && (m.p1 === playerName || m.p2 === playerName)
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
        // Filter out matches the player just completed locally
        const ongoingMatch = bracket.find(m => !m.winner && !completedMatchIds.has(m.id));
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

    // Safety check: don't render if match already has a winner
    if (myMatch.winner) {
        return <div style={{ textAlign: 'center', marginTop: '2rem' }}>Match complete, waiting for round...</div>;
    }

    // Show match completion screen if match just finished
    if (matchJustCompleted) {
        return (
            <MatchCompletionScreen
                winner={matchJustCompleted.winner}
                player1Name={matchJustCompleted.p1}
                player2Name={matchJustCompleted.p2}
                onContinue={() => {
                    setMatchJustCompleted(null);
                    // After countdown, component will re-render and find next match or spectate
                }}
            />
        );
    }

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
                // IMPORTANT: Both players track this locally to stop the rendering loop immediately
                setCompletedMatchIds(prev => new Set(prev).add(myMatch.id));

                // Show completion screen locally for visual feedback
                setMatchJustCompleted({
                    winner: winnerSide,
                    p1: myMatch.p1,
                    p2: myMatch.p2
                });

                const wName = winnerSide === PlayerSide.LEFT ? myMatch.p1 : myMatch.p2;
                if (isP1) {
                    handleMatchEnd(myMatch.id, wName);
                }
            }}
        />
    );
};
