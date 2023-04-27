import { VerifyAuthChallengeResponseTriggerEvent } from "aws-lambda";

export const handler = async (
  event: VerifyAuthChallengeResponseTriggerEvent
) => {
  const expectedAnswer = event.request.privateChallengeParameters?.code;
  event.response.answerCorrect =
    event.request.challengeAnswer === expectedAnswer;
  return event;
};
