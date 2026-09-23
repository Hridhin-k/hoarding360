/**
 * One Marketplace frame. Header, footer, and every page share it so the
 * content edge does not shift when you move between screens.
 * Padding is 16 / 24 / 32. Cap is 1440px so wide monitors stay usable.
 */
export const marketFrame = "mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8";

/** Same frame, with the standard 32px page block. */
export const marketSection = `${marketFrame} py-8`;
