async function main() {
  const nav = document.querySelector("nav");
  if (!nav) {
    console.error("failed to get nav element");
    return;
  }

  try {
    const res = await fetch("/api/auth/status");
    if (!res.ok) {
      const links = document.createElement("div");
      const signup = document.createElement("a");
      signup.href = "/signup";
      const login = document.createElement("a");
      login.href = "/login";
      links.append(signup);
      links.append(login);
      nav.append(links);
    } else {
      const links = document.createElement("div");
      const logout = document.createElement("a");
      logout.href = "/logout";
      logout.textContent = "Logout";
      links.append(logout);
      nav.append(links);
    }
  } catch (error) {
    console.error(error);
    return;
  }
}

main();
