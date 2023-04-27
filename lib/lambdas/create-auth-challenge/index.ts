import { PublishCommand } from "@aws-sdk/client-sns";
import { CreateAuthChallengeTriggerEvent } from "aws-lambda";

import { randomInt } from "crypto";
import { PhoneNumberFormat, PhoneNumberUtil } from "google-libphonenumber"

import { snsClient } from "./snsClient.js";

const phoneUtil = PhoneNumberUtil.getInstance()

export const handler = async (event: CreateAuthChallengeTriggerEvent) => {
  console.log("received event", JSON.stringify(event, null, 2));
  const {
    request: { userAttributes },
  } = event;
  const { phone_number: phoneNumber } = userAttributes;
  let code: string;
  if (!event.request.session.length) {
    // generate 6 digit code
    code = Array.from({ length: 6 }, () => randomInt(0, 9)).join("");
    await sendSMS(phoneNumber, code);
  } else {
    const [lastChallenge] = event.request.session.reverse();
    code = lastChallenge.challengeMetadata?.match(/CODE-(\d+)/)?.[1] || "";
  }
  event.response.publicChallengeParameters = { phoneNumber };
  event.response.privateChallengeParameters = { code };
  event.response.challengeMetadata = `CODE-${code}`;
  return event;
};

async function sendSMS(phoneNumber: string, code: string) {
  console.log("formatted phone number", formatNumber(phoneNumber));
  const params = {
    Message: `検証コード：　${code}`,
    PhoneNumber: formatNumber(phoneNumber)
  };
  return await snsClient.send(new PublishCommand(params));
}

function formatNumber(phoneNumber: string): string {
  const number = phoneUtil.parseAndKeepRawInput(phoneNumber, "JP");
  return phoneUtil.format(number, PhoneNumberFormat.E164);
}