import { fetchWithToken } from "lib/stores/auth";
import { BACKEND_URL } from "./config";
import { UserService } from "lib/http/user";

export interface Friend {
    id: number;
    sender_id: number;
    accepter_id: number;
    status: "pending" | "accepted";
    created_at: string;
}

export async function getFriends(): Promise<number[]> {
    const res = await fetchWithToken(`${BACKEND_URL}/api/getFriends`);
    const userId = (await UserService.getCurrent())?.id;

    return (await res.json()).map((f: Friend) => {
        // If sender and accepter are the same, then it's a return either
        // Otherwise return the one which is different to the current user
        if (f.sender_id === f.accepter_id) return f.sender_id;

        return f.sender_id === userId ? f.accepter_id : f.sender_id;
    });
}