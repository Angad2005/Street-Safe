import db from "~/lib/db";

// Initialize the table
db.exec(`
    CREATE TABLE IF NOT EXISTS Friends (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id INTEGER NOT NULL,
        accepter_id INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(sender_id, accepter_id),
        CHECK(status IN ('pending', 'accepted'))
    );
`);

interface Friend {
    id: number;
    sender_id: number;
    accepter_id: number;
    status: "pending" | "accepted";
    created_at: string;
}

enum SendFriendRequestResponse {
    ALREADY_SENT, // The user has already sent a friend request to this person
    ALREADY_FRIEND, // The user is already friends with this person
    SUCCESS, 
    ACCEPTED, // The person had already sent the user a friend request, so they now accept it
    NOT_FOUND
}

export function sendFriendRequest(userId: number, friendId: number): SendFriendRequestResponse {
    // If the user has already sent a friend request
    // If someone else has sent a friend request to the user, return accept it instead of creating one
    const stmt = db.prepare("SELECT * FROM Friends WHERE (sender_id = ? AND accepter_id = ?) OR (sender_id = ? AND accepter_id = ?);");
    const result = stmt.get(userId, friendId, friendId, userId) as Friend | undefined;
    if (!result) {
        // Check if friendid exists
        const stmt = db.prepare("SELECT * FROM Users WHERE id = ?;");
        const result = stmt.get(friendId) as { id: number } | undefined;
        if (!result) {
            return SendFriendRequestResponse.NOT_FOUND;
        }

        db.prepare("INSERT INTO Friends (sender_id, accepter_id) VALUES (?, ?);").run(userId, friendId);
        return SendFriendRequestResponse.SUCCESS;
    }

    // If the user has already accepted the friend request, nothing can be done
    if (result.status === "accepted") {
        return SendFriendRequestResponse.ALREADY_FRIEND;
    }

    // If the user has already sent a friend request
    if (result.status === "pending" && result.sender_id === userId) {
        return SendFriendRequestResponse.ALREADY_SENT;
    }


    if (result.status === "pending" && result.accepter_id === userId) {
        db.prepare("UPDATE Friends SET status = 'accepted' WHERE id = ?;").run(result.id);
        return SendFriendRequestResponse.ACCEPTED;
    }

    // Something went wrong
    return SendFriendRequestResponse.NOT_FOUND;
}

export function getFriends(userId: number) {
    const stmt = db.prepare("SELECT * FROM Friends WHERE (sender_id = ? OR accepter_id = ?) AND status = 'accepted';");
    return stmt.all(userId, userId) as Friend[];
}

export function getFriendRequests(userId: number) {
    const stmt = db.prepare("SELECT * FROM Friends WHERE accepter_id = ? AND status = 'pending';");
    return stmt.all(userId) as Friend[];
}

export function getFriendRequestsSent(userId: number) {
    const stmt = db.prepare("SELECT * FROM Friends WHERE sender_id = ? AND status = 'pending';");
    return stmt.all(userId) as Friend[];
}

export function removeFriend(userId: number, friendId: number) {
    const stmt = db.prepare("DELETE FROM Friends WHERE (sender_id = ? AND accepter_id = ?) OR (sender_id = ? AND accepter_id = ?);");
    stmt.run(userId, friendId, friendId, userId);
}

export function acceptFriendRequest(userId: number, friendId: number) {
    const stmt = db.prepare("UPDATE Friends SET status = 'accepted' WHERE (sender_id = ? AND accepter_id = ?) OR (sender_id = ? AND accepter_id = ?);");
    stmt.run(userId, friendId, friendId, userId);
}

export function rejectFriendRequest(userId: number, friendId: number) {
    const stmt = db.prepare("DELETE FROM Friends WHERE (sender_id = ? AND accepter_id = ?) OR (sender_id = ? AND accepter_id = ?);");
    stmt.run(userId, friendId, friendId, userId);
}
