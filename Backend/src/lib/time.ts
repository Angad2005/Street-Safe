export const currentUnixSeconds = () => Math.floor(Date.now() / 1000);
export const currentUnixMillis = () => Date.now();

export const toUnixSeconds = (date: Date) => Math.floor(date.getTime() / 1000);
export const toUnixMilliseconds = (date: Date) => date.getTime();