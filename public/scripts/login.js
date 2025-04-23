function main() {
  const form = document.getElementById("login_form");

  if (!form) {
    console.error("signup form not found");
    return;
  } else if (!(form instanceof HTMLFormElement)) {
    console.error("element with id 'signup_form' is not a form element");
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email");
    const password = document.getElementById("password");

    if (!password) {
      console.error("password feild not found");
      return;
    } else if (!email) {
      console.error("email feild not found");
      return;
    }

    if (!(password instanceof HTMLInputElement)) {
      console.error("element with id 'password' is not an input element");
      return;
    } else if (!(email instanceof HTMLInputElement)) {
      console.error("element with id 'email' is not an input element");
      return;
    }

    try {
      await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.value, password: password.value }),
      });
    } catch (error) {
      console.error("failed to fetch:", error);
    }
  });
}

main();
