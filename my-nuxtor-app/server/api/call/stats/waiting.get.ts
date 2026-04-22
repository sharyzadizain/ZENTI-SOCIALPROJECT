import { getWaitingBlindCount } from "../../../utils/callStore";

export default defineEventHandler(() => {
	return {
		waitingBlindCount: getWaitingBlindCount(),
		measuredAt: Date.now()
	};
});
