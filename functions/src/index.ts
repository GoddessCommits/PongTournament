import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

// Scheduled function to run every day at midnight
export const dailyCleanup = functions.pubsub.schedule("every 24 hours").onRun(async (context) => {
    const db = admin.database();

    // 1. Read all lobbies to aggregate leaderboard stats
    const lobbiesRef = db.ref("lobbies");
    const snapshot = await lobbiesRef.once("value");
    const lobbies = snapshot.val();

    if (!lobbies) {
        console.log("No lobbies to clean up.");
        return null;
    }

    const leaderboardUpdates: Record<string, number> = {};

    // 2. Iterate through lobbies to find winners
    // Structure: lobbies -> { lobbyId: { winner: "Name", ... } }
    Object.values(lobbies).forEach((lobby: any) => {
        if (lobby.winner) {
            const winnerName = lobby.winner;
            if (leaderboardUpdates[winnerName]) {
                leaderboardUpdates[winnerName]++;
            } else {
                leaderboardUpdates[winnerName] = 1;
            }
        }
    });

    // 3. Update Global Leaderboard
    // We transactionally update to ensure we don't overwrite existing historical stats
    const leaderboardRef = db.ref("leaderboard");

    // We'll interpret the new wins and add them to existing ones
    // Note: This is a simple implementation. For robust long-term stats, 
    // you might want to read the existing leaderboard and add.

    await leaderboardRef.transaction((currentLeaderboard) => {
        if (!currentLeaderboard) currentLeaderboard = {};

        for (const [player, wins] of Object.entries(leaderboardUpdates)) {
            if (currentLeaderboard[player]) {
                currentLeaderboard[player] += wins;
            } else {
                currentLeaderboard[player] = wins;
            }
        }
        return currentLeaderboard;
    });

    console.log("Leaderboard updated with new wins:", leaderboardUpdates);

    // 4. Wipe 'lobbies' node
    await lobbiesRef.remove();
    console.log("All lobbies wiped successfully.");

    return null;
});
