import { init as initContext } from "./context";
import { init as initSession } from "./session";

export const init = () => {
  initContext();
  initSession();
}

export { authService } from "./service";
export { sessionService } from "./session"