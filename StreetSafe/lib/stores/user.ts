import { UserService } from "lib/http/user";
import { create } from "zustand";

export type User = {
  id: number;
  name: string;
  email: string;
  avatarUrl: string;
};

export type UserState = {
  value: User | null,
  setValue: (next: User) => void
  clear: () => void
};

export const useUser = create<UserState>((set, get) => ({
  value: null,
  setValue: (next: User) => set({ value: next }),
  clear: () => set({ value: null }),
}));

export const tryUpdateUser = async () => {
  const user = await UserService.getCurrent();

  if (!user) {
    return;
  }

  useUser.getState().setValue(user);
}