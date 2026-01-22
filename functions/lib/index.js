"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.dailyCleanup = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
// Scheduled function to run every day at midnight
exports.dailyCleanup = functions.pubsub.schedule("every 24 hours").onRun(async (context) => {
    const db = admin.database();
    // 1. Read all lobbies to aggregate leaderboard stats
    const lobbiesRef = db.ref("lobbies");
    const snapshot = await lobbiesRef.once("value");
    const lobbies = snapshot.val();
    if (!lobbies) {
        console.log("No lobbies to clean up.");
        return null;
    }
    const leaderboardUpdates = {};
    // 2. Iterate through lobbies to find winners
    // Structure: lobbies -> { lobbyId: { winner: "Name", ... } }
    Object.values(lobbies).forEach((lobby) => {
        if (lobby.winner) {
            const winnerName = lobby.winner;
            if (leaderboardUpdates[winnerName]) {
                leaderboardUpdates[winnerName]++;
            }
            else {
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
        if (!currentLeaderboard)
            currentLeaderboard = {};
        for (const [player, wins] of Object.entries(leaderboardUpdates)) {
            if (currentLeaderboard[player]) {
                currentLeaderboard[player] += wins;
            }
            else {
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
//# sourceMappingURL=index.js.map