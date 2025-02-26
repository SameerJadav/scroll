/**
 * @param {"INFO" | "WARN" | "ERROR"} level
 * @param {string} msg
 * @returns {void}
 */
export function log(level, msg) {
  const now = new Date();
  const date = now.toLocaleDateString("en-GB");
  const time = now.toLocaleTimeString("en-GB", { hour12: false });
  console.log(`${date} ${time} ${level} ${msg}`);
}
