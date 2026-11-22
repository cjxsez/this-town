/**
 * Set while the start screen's train doors are opening onto the app. Pages read it
 * once, when they mount, to hold their entrance until the doors have parted.
 */
let opening = false;

export const setDoorsOpening = (value: boolean) => {
  opening = value;
};

export const doorsOpening = () => opening;

/** Extra delay for entrance animations on a page the doors are opening onto, in ms. */
export const DOORS_ENTER_DELAY_MS = 380;
