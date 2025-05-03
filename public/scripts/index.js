async function main() {
  try {
    const res = await fetch("/api/auth/status");
    if (!res.ok) {
      const main = document.querySelector("main");
      if (!main) {
        console.error("failed to get main element");
        return;
      }
      const h1 = document.createElement("h1");
      h1.textContent = "Scroll";
      const p = document.createElement("p");
      p.textContent = "A simple note taking app";
      main.append(h1);
      main.append(p);
    } else {
      const main = document.querySelector("main");
      if (!main) {
        console.error("failed to get main element");
        return;
      }
    }
  } catch (error) {}
}

main();
