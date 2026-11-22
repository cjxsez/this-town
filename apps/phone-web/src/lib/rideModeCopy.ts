/**
 * Ride Mode consent and riding copy that depends on the worker's gamesOnly flag.
 * Mission-mode strings match the previous hardcoded lines; games-only describes the
 * two-player games and that Ride Mode stays on until you turn it off or the trip ends.
 */

export function destinationHint(gamesOnly: boolean): string {
  if (gamesOnly) {
    return "Ride Mode stays on until you turn it off or the trip ends. You'll meet at a kiosk and play together on your phones or glasses.";
  }
  return "Ride Mode turns off at your stop, and missions always end before a stop, so you never miss it.";
}

export function rideModeMissionRule(gamesOnly: boolean): string {
  if (gamesOnly) {
    return "You meet at a kiosk and play short games together on your phones or glasses.";
  }
  return "You meet at a kiosk, play a short mission, and both tap the tag for a stamp. Missions end before your stop.";
}

export function rideModeEndsRule(destName: string, gamesOnly: boolean): string {
  if (gamesOnly) {
    return "Ride Mode stays on until you turn it off or the trip ends.";
  }
  return `Ride Mode turns off by itself at ${destName}.`;
}

export function ridingStayOnHint(ridersOnTrain: number, destName: string, gamesOnly: boolean): string {
  const others =
    ridersOnTrain > 1 ? `${ridersOnTrain - 1} other riders on this train. ` : "";
  if (gamesOnly) {
    return `${others}Ride Mode stays on until you turn it off or the trip ends.`;
  }
  return `${others}Ride Mode turns off at ${destName}.`;
}

/** H1 recap eyebrow when stamped (or time's up). */
export function recapEyebrow(stamped: boolean, gamesOnly: boolean): string {
  if (!stamped) return "Time's up";
  if (gamesOnly) return "Games complete";
  return "Quest complete";
}

/** H1 recap: no stamp this round. */
export function recapNoStamp(gamesOnly: boolean): string {
  if (gamesOnly) {
    return "No stamp this time: finish the games together for one.";
  }
  return "No stamp this time: the tag needs both of you to tap it before the stop.";
}

/** H1 recap: still matched into the pool. */
export function recapStillRiding(destName: string | undefined, gamesOnly: boolean): string {
  if (gamesOnly) {
    return "Ride Mode is still on until you turn it off or the trip ends. You can be matched again soon.";
  }
  return `Ride Mode is still on${destName ? ` until ${destName}` : ""}. You can be matched again after the next stop.`;
}

/** C4 ride over with nothing earned. */
export function rideOverEmpty(gamesOnly: boolean): string {
  if (gamesOnly) {
    return "No stamp this ride. That's most rides.";
  }
  return "No quest this ride. That's most rides.";
}

/** Passport rare footnote. */
export function passportRareFootnote(gamesOnly: boolean): string {
  if (gamesOnly) {
    return "★ rare = a special stamp from a longer ride or a delay";
  }
  return "★ rare = earned during a delay or a late-bonus mission";
}

/** C1 How Ride Mode works step 4. */
export function checkInPlayStep(gamesOnly: boolean): string {
  if (gamesOnly) {
    return "Meet at the kiosk, then play short games together on your phones or glasses.";
  }
  return "Meet at the kiosk, play a quick mission, both tap the tag for a stamp.";
}

/** C1 hint under the steps. */
export function checkInEndsHint(gamesOnly: boolean): string {
  if (gamesOnly) {
    return 'Ride Mode stays on until you turn it off or the trip ends. "Not now" and ghost mode are always one tap away.';
  }
  return 'Ride Mode turns off at your stop. "Not now" and ghost mode are always one tap away.';
}

/** Tap screen: meeting-kiosk / already-on lines that used to say the mission starts. */
export function tapMeetingStarts(gamesOnly: boolean): string {
  if (gamesOnly) {
    return "This is your meeting kiosk. Play together on your phones or glasses.";
  }
  return "This is your meeting kiosk. The mission starts on its screen in a moment.";
}

export function tapAlreadyMeeting(car: string, gamesOnly: boolean): string {
  if (gamesOnly) {
    return `You're checked in to car ${car}. If you're meeting someone here, play together on your phones or glasses.`;
  }
  return `You're checked in to car ${car}. If you're meeting someone here, the mission starts on the kiosk.`;
}

/** Landing blurb. */
export function landingPitch(gamesOnly: boolean): string {
  if (gamesOnly) {
    return "Tap the kiosk in your train car and meet one other rider who likes what you like. Short games, face to face, on your phones or glasses.";
  }
  return "Tap the kiosk in your train car and meet one other rider who likes what you like. A short game, face to face, done before your stop.";
}

/** Me → Glasses: what the lens shows. */
export function glassesShowsBlurb(gamesOnly: boolean): string {
  if (gamesOnly) {
    return "Open In This Town on your glasses and keep it open while you ride. It shows your match, where to meet, the games and your stamp.";
  }
  return "Open In This Town on your glasses and keep it open while you ride. It shows your match, where to meet, the mission and your stamp.";
}
