import { getFriends } from "utils/friends";
import { fetchWithToken } from "lib/stores/auth";
import { UserService } from "lib/http/user";

jest.mock("lib/stores/auth", () => ({
  fetchWithToken: jest.fn(),
}));

jest.mock("lib/http/user", () => ({
  UserService: {
    getCurrent: jest.fn(),
  },
}));

describe("friends utils", () => {
    describe("getFriends", () => {
        it("should return correct friend IDs when user is sender", async () => {
            (UserService.getCurrent as jest.Mock).mockResolvedValue({ id: 1 });
            (fetchWithToken as jest.Mock).mockResolvedValue({
                json: jest.fn().mockResolvedValue([
                    { sender_id: 1, accepter_id: 2, status: "accepted" },
                    { sender_id: 3, accepter_id: 1, status: "accepted" },
                ]),
            });

            const friends = await getFriends();
            expect(friends).toEqual([2, 3]);
        });

        it("should handle same sender and accepter ID", async () => {
            (UserService.getCurrent as jest.Mock).mockResolvedValue({ id: 1 });
            (fetchWithToken as jest.Mock).mockResolvedValue({
                json: jest.fn().mockResolvedValue([
                    { sender_id: 4, accepter_id: 4, status: "accepted" },
                ]),
            });

            const friends = await getFriends();
            expect(friends).toEqual([4]);
        });
    });
});
