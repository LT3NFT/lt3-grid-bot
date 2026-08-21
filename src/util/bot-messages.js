const BOT_MESSAGES = [
  "Beep boop. Scanning complete. 🤖",
  "Beep boop. Mission accomplished. 🤖",
  "Beep boop. No LT3s were harmed during generation. 🤖",
  "Beep boop. Generating serotonin... success. 🤖",
  "Beep boop. Side effects may include staring. 🤖",
  "Beep boop. I spun around three times and this appeared. 🤖",
  "Beep boop. A grid has transpired. 🤖",
  "Beep boop. Your LT3s have assembled for a group photo. 🤖",
  "Beep boop. All eyes on your collection. 🤖",
  "Beep boop. Your LT3s are looking unusually photogenic. 🤖",
  "Beep boop. Your LT3s are ready to be appreciated. 🤖",
  "Beep boop. Your LT3s clean up nicely. 🤖",
];

export function pickBotMessage() {
  return BOT_MESSAGES[Math.floor(Math.random() * BOT_MESSAGES.length)];
}

const GIF_MESSAGES = [
  "Beep boop. Your collection is now in motion. 🤖",
  "Beep boop. Sit back and watch your LT3s parade by. 🤖",
  "Beep boop. The gallery has come alive. 🤖",
  "Beep boop. Your LT3s formed an orderly queue. 🤖",
  "Beep boop. Please hold your applause until all LT3s have been displayed. 🤖",
  "Beep boop. Please admire responsibly. 🤖",
  "Beep boop. Your LT3s seem pleased to be together. 🤖",
  "Beep boop. I am beginning to understand why humans collect things. 🤖",
  "Beep boop. I showed your collection to another robot. It nodded. 🤖",
  "Beep boop. Your collection feels well cared for. 🤖",
  "Beep boop. I am told collections are reflections of their owners. Intriguing. 🤖",
];

export function pickGifMessage() {
  return GIF_MESSAGES[Math.floor(Math.random() * GIF_MESSAGES.length)];
}

const TRAIT_GRID_MESSAGES = [
  "Beep boop. Random {traitType}: {traitValue}. 🤖",
  "Beep boop. Nine {traitValue} LT3s, fresh from the chain. 🤖",
  "Beep boop. {traitType} {traitValue} sample grid. 🤖",
  "Beep boop. I shuffled the collection and these showed up. 🤖",
  "Beep boop. Trait scan complete. Enjoy the {traitValue} set. 🤖",
];

export function pickTraitGridMessage(traitType, traitValue) {
  const template = TRAIT_GRID_MESSAGES[Math.floor(Math.random() * TRAIT_GRID_MESSAGES.length)];
  return template.replace("{traitType}", traitType).replace("{traitValue}", traitValue);
}
