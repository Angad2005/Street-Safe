export const encodeWithoutPadding = (
  data: Buffer
) => data.toString("base64url").replaceAll("=", "");

export const decode = (data: string) => Buffer.from(data, "base64url");