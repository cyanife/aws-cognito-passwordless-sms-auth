import { PreSignUpTriggerEvent } from "aws-lambda";

export const handler = async (event: PreSignUpTriggerEvent) => {
  event.response.autoConfirmUser = true;
  event.response.autoVerifyPhone = true;
  return event;
};
