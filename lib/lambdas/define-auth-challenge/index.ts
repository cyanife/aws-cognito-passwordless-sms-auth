import { DefineAuthChallengeTriggerEvent } from "aws-lambda";

const ALLOWED_ATTEMPTS = 3;
const challengeName = "CUSTOM_CHALLENGE";

export const handler = async (event: DefineAuthChallengeTriggerEvent) => {
  const [lastChallenge] = event.request.session.reverse();
  const challengeAttempts = event.request.session.length;
  if (challengeAttempts >= ALLOWED_ATTEMPTS) {
    event.response.failAuthentication = true;
    event.response.issueTokens = false;
    return event;
  }
  if (lastChallenge?.challengeName === challengeName) {
    event.response.failAuthentication = !lastChallenge.challengeResult;
    event.response.issueTokens = lastChallenge.challengeResult;
    return event;
  }
  event.response.issueTokens = false;
  event.response.failAuthentication = false;
  event.response.challengeName = challengeName;
  return event;
};
