import React, { useState } from 'react';

interface LobbyProps {
    onStartTournament: (players: string[]) => void;
    onStartOnlineGame: (lobbyId: string, playerName: string, isHost: boolean) => void;
}

export const Lobby: React.FC<LobbyProps> = ({ onStartTournament, onStartOnlineGame }) => {
    const [players, setPlayers] = useState<string[]>([]);
    const [newPlayerName, setNewPlayerName] = useState('');
    const [mode, setMode] = useState<'LOCAL' | 'ONLINE'>('LOCAL');
    const [onlineName, setOnlineName] = useState('');
    const [lobbyCode, setLobbyCode] = useState('');

    const addPlayer = () => {
        if (newPlayerName.trim()) {
            setPlayers([...players, newPlayerName.trim()]);
            setNewPlayerName('');
        }
    };

    const removePlayer = (index: number) => {
        setPlayers(players.filter((_, i) => i !== index));
    };

    const handleStart = () => {
        if (players.length >= 1) {
            onStartTournament(players);
        }
    };

    const handleCreateLobby = () => {
        if (!onlineName.trim()) return;
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        // Host is true
        onStartOnlineGame(code, onlineName, true);
    };

    const handleJoinLobby = () => {
        if (!onlineName.trim() || !lobbyCode.trim()) return;
        // Host is false
        onStartOnlineGame(lobbyCode, onlineName, false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            addPlayer();
        }
    };

    return (
        <div style={{ textAlign: 'center', maxWidth: 600, margin: '0 auto' }}>
            <h2>Tournament Lobby</h2>

            <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                <button
                    onClick={() => setMode('LOCAL')}
                    style={{ background: mode === 'LOCAL' ? '#646cff' : '#333', border: 'none', padding: '0.5rem 1rem' }}
                >
                    Local Tournament
                </button>
                <button
                    onClick={() => setMode('ONLINE')}
                    style={{ background: mode === 'ONLINE' ? '#646cff' : '#333', border: 'none', padding: '0.5rem 1rem' }}
                >
                    Online Multiplayer
                </button>
            </div>

            {mode === 'LOCAL' ? (
                <>
                    <p style={{ color: '#888' }}>Add players (1 vs AI, or 2+ for Tournament)</p>
                    {/* ... Existing Local UI ... */}
                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', margin: '2rem 0' }}>
                        <input
                            type="text"
                            value={newPlayerName}
                            onChange={(e) => setNewPlayerName(e.target.value)}
                            placeholder="Enter player name"
                            onKeyDown={handleKeyDown}
                            style={{ padding: '0.5rem', fontSize: '1rem' }}
                        />
                        <button onClick={addPlayer}>Add Player</button>
                    </div>

                    <div style={{ margin: '2rem 0', minHeight: '100px' }}>
                        {players.length === 0 ? (
                            <p>No players added yet.</p>
                        ) : (
                            <ul style={{ listStyle: 'none', padding: 0 }}>
                                {players.map((p, i) => (
                                    <li key={i} style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '0.5rem 1rem',
                                        background: '#333',
                                        margin: '0.5rem 0',
                                        borderRadius: 4
                                    }}>
                                        <span>{p}</span>
                                        <button
                                            onClick={() => removePlayer(i)}
                                            style={{ background: '#ff4444', marginLeft: '1rem', padding: '0.2rem 0.6rem', fontSize: '0.8rem' }}
                                        >
                                            ✕
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <button
                        onClick={handleStart}
                        disabled={players.length < 1}
                        style={{
                            fontSize: '1.2rem',
                            padding: '1rem 2rem',
                            background: players.length < 1 ? '#555' : '#646cff',
                            color: 'white',
                            border: 'none',
                            borderRadius: 8,
                            cursor: players.length < 1 ? 'not-allowed' : 'pointer'
                        }}
                    >
                        {players.length === 1 ? 'Start vs AI' : 'Start Tournament'}
                    </button>
                </>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem' }}>
                    <div>
                        <h3>Your Name</h3>
                        <input
                            type="text"
                            value={onlineName}
                            onChange={(e) => setOnlineName(e.target.value)}
                            placeholder="Enter your name"
                            style={{ padding: '0.5rem', fontSize: '1rem', textAlign: 'center' }}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '4rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <h3>Create Lobby</h3>
                            <button
                                onClick={handleCreateLobby}
                                disabled={!onlineName}
                                style={{ padding: '1rem', background: '#28a745', cursor: !onlineName ? 'not-allowed' : 'pointer', opacity: !onlineName ? 0.5 : 1 }}
                            >
                                Create New Game
                            </button>
                        </div>

                        <div style={{ width: 1, background: '#444' }}></div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <h3>Join Lobby</h3>
                            <input
                                type="text"
                                placeholder="Lobby Code"
                                value={lobbyCode}
                                onChange={(e) => setLobbyCode(e.target.value.toUpperCase())}
                                style={{ padding: '0.5rem', textAlign: 'center' }}
                            />
                            <button
                                onClick={handleJoinLobby}
                                disabled={!onlineName || !lobbyCode}
                                style={{ padding: '1rem', background: '#007bff', cursor: (!onlineName || !lobbyCode) ? 'not-allowed' : 'pointer', opacity: (!onlineName || !lobbyCode) ? 0.5 : 1 }}
                            >
                                Join Game
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
